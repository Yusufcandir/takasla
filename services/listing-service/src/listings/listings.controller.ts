import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFiles, Res, NotFoundException, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, CurrentUser, Public, Roles, StorageService, SightEngineService } from '@exchange/common';
import { JwtPayload, ItemCondition } from '@exchange/shared-types';
import { ConfigService } from '@nestjs/config';
import { ListingsService } from './listings.service';
import { CreateListingDto, UpdateListingDto, BoostListingDto, AskQuestionDto, AnswerQuestionDto, AddReplyDto, CreateReportDto, ReviewReportDto } from './dto';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { Response } from 'express';
import { existsSync } from 'fs';

const BOOST_CONFIG = {
  featured: { durationDays: 7, amount: 149.99, label: 'Featured Boost (7 days)' },
  spotlight: { durationDays: 30, amount: 449.99, label: 'Spotlight Boost (30 days)' },
};

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly config: ConfigService,
    private readonly storageService: StorageService,
    private readonly sightEngineService: SightEngineService,
  ) {}

  @Public()
  @Get()
  async findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.listingsService.findAll(parseInt(page), parseInt(limit));
  }

  // Static sub-paths must come before :id to avoid being swallowed by the wildcard
  @Public()
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.listingsService.findByUser(userId);
  }

  @Get('category/:categoryId')
  @Public()
  async findByCategory(@Param('categoryId') categoryId: string) {
    return this.listingsService.findByCategory(categoryId);
  }

  @Public()
  @Get('spotlight')
  async getSpotlight() {
    return this.listingsService.findSpotlightListings();
  }

  @Post(':id/boost')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async boostListing(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: BoostListingDto,
  ) {
    const listing = await this.listingsService.findById(id);
    if (listing.userId !== user.sub) throw new ForbiddenException('Not your listing');
    if (listing.status !== 'active') throw new ForbiddenException('Can only boost active listings');

    const config = BOOST_CONFIG[body.tier];
    if (!config) throw new ForbiddenException('Invalid tier');

    const paymentServiceUrl = this.config.get<string>('PAYMENT_SERVICE_URL', 'http://payment-service:3010');
    const res = await fetch(`${paymentServiceUrl}/payments/create-boost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.sub,
        listingId: id,
        tier: body.tier,
        durationDays: config.durationDays,
        amount: config.amount,
        currency: listing.currency || 'TRY',
      }),
    });

    if (!res.ok) throw new Error('Failed to create boost payment');
    const payment = await res.json() as { id: string };
    return { paymentId: payment.id, tier: body.tier, amount: config.amount };
  }

  @Public()
  @Get('uploads/:filename')
  async serveUpload(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    // Try new fallback dir first, then old upload dir for backward compat
    const fallbackPath = join(process.cwd(), 'uploads-fallback', 'listings', safeName);
    const legacyPath = join(process.cwd(), 'uploads', safeName);
    const filePath = existsSync(fallbackPath) ? fallbackPath : legacyPath;
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }

  // --- Reports (admin routes — must be before :id) ---
  @Get('reports/all')
  @UseGuards(JwtAuthGuard)
  async getAllReports(@Query('status') status?: string) {
    return this.listingsService.getReports(status);
  }

  @Get('reports/:reportId')
  @UseGuards(JwtAuthGuard)
  async getReportById(@Param('reportId') reportId: string) {
    return this.listingsService.getReportById(reportId);
  }

  @Patch('reports/:reportId/review')
  @UseGuards(JwtAuthGuard)
  async reviewReport(
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ReviewReportDto,
  ) {
    return this.listingsService.reviewReport(reportId, user.sub, body.status, body.adminNotes);
  }

  @Get('reports/warnings/:userId')
  @UseGuards(JwtAuthGuard)
  async getWarningCount(@Param('userId') userId: string) {
    return this.listingsService.getWarningCountForUser(userId);
  }

  @Post(':id/admin-archive')
  @UseGuards(JwtAuthGuard)
  @Roles('moderator', 'admin')
  async adminArchiveListing(@Param('id') id: string) {
    await this.listingsService.archiveListingByAdmin(id);
    return { message: 'Listing archived' };
  }

  @Post('reports/:reportId/archive-listing')
  @UseGuards(JwtAuthGuard)
  async archiveReportedListing(
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.listingsService.getReportById(reportId);
    await this.listingsService.archiveListingByAdmin(report.listingId);
    await this.listingsService.reviewReport(reportId, user.sub, 'reviewed', 'Listing archived by admin');
    return { message: 'Listing archived' };
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.listingsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateListingDto,
  ) {
    return this.listingsService.create(user.sub, body);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await Promise.all(
      (files || []).map(async (file) => {
        const result = await this.storageService.upload('listings', file.buffer, file.originalname, file.mimetype);

        // Check for AI-generated content (returns null if unconfigured or on error)
        let aiScore: number | null = null;
        if (file.mimetype.startsWith('image/')) {
          aiScore = await this.sightEngineService.checkImage(file.buffer, file.originalname);
        }

        const fallbackUrl = `/api/listings/uploads/${result.key.split('/').pop()}`;
        const thumbFallbackUrl = result.thumbnailKey
          ? `/api/listings/uploads/${result.thumbnailKey.split('/').pop()}`
          : undefined;
        return {
          url: result.url || fallbackUrl,
          thumbnailUrl: result.thumbnailUrl || thumbFallbackUrl,
          originalName: file.originalname,
          size: file.size,
          aiScore,
        };
      }),
    );
    return results;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateListingDto,
  ) {
    return this.listingsService.update(id, user.sub, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.listingsService.archive(id, user.sub);
    return { message: 'Listing archived' };
  }

  // --- Q&A ---
  @Public()
  @Get(':id/questions')
  async getQuestions(@Param('id') id: string) {
    return this.listingsService.getQuestions(id);
  }

  @Post(':id/questions')
  @UseGuards(JwtAuthGuard)
  async askQuestion(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AskQuestionDto,
  ) {
    return this.listingsService.askQuestion(id, user.sub, body.question);
  }

  @Patch(':id/questions/:questionId/answer')
  @UseGuards(JwtAuthGuard)
  async answerQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AnswerQuestionDto,
  ) {
    return this.listingsService.answerQuestion(id, questionId, user.sub, body.answer);
  }

  @Public()
  @Get(':id/questions/:questionId/thread')
  async getThread(@Param('id') id: string, @Param('questionId') questionId: string) {
    return this.listingsService.getThread(id, questionId);
  }

  @Post(':id/questions/:questionId/replies')
  @UseGuards(JwtAuthGuard)
  async addReply(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AddReplyDto,
  ) {
    return this.listingsService.addReply(id, questionId, user.sub, body.content);
  }

  // --- Favorites ---
  @Public()
  @Get(':id/favorites/count')
  async getFavoritesCount(@Param('id') id: string) {
    return this.listingsService.getFavoritesCount(id);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.listingsService.toggleFavorite(id, user.sub);
  }

  @Get('my/favorites')
  @UseGuards(JwtAuthGuard)
  async getMyFavorites(@CurrentUser() user: JwtPayload) {
    return this.listingsService.getMyFavorites(user.sub);
  }

  @Public()
  @Get(':id/favorites/check')
  async checkFavorite(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) return { favorited: false };
    return this.listingsService.checkFavorite(id, userId);
  }

  // --- Reports (user routes) ---
  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async reportListing(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateReportDto,
  ) {
    return this.listingsService.createReport(id, user.sub, body.reason, body.description);
  }

  @Get(':id/report/check')
  @UseGuards(JwtAuthGuard)
  async checkReport(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.listingsService.checkReport(id, user.sub);
  }
}
