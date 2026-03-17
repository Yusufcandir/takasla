import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, SendMessageDto } from './dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async createConversation(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateConversationDto,
  ) {
    return this.conversationsService.getOrCreateConversation(
      user.sub,
      body.participantId,
    );
  }

  @Get()
  async getConversations(@CurrentUser() user: JwtPayload) {
    return this.conversationsService.getConversations(user.sub);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.conversationsService.getUnreadCount(user.sub);
    return { count };
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.conversationsService.getMessages(
      id,
      user.sub,
      pageNum,
      limitNum,
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(id, user.sub, body.content);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.conversationsService.markAsRead(id, user.sub);
    return { success: true };
  }
}
