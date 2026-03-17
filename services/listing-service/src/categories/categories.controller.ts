import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Public, Roles } from '@exchange/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get('by-id/:id')
  async findById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  async create(@Body() body: CreateCategoryDto) {
    return this.categoriesService.create(body.name, body.slug, body.riskWeight, body.parentId);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  async seed() {
    await this.categoriesService.seed();
    return { message: 'Categories seeded' };
  }
}
