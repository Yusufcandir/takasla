import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { MessageEntity } from './message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
  ) {}

  async getOrCreateConversation(
    userId: string,
    participantId: string,
  ): Promise<ConversationEntity> {
    if (userId === participantId) {
      throw new BadRequestException('Cannot create a conversation with yourself');
    }

    const [participant1Id, participant2Id] =
      userId < participantId ? [userId, participantId] : [participantId, userId];

    const existing = await this.conversationRepo.findOne({
      where: { participant1Id, participant2Id },
    });

    if (existing) {
      return existing;
    }

    const conversation = this.conversationRepo.create({
      participant1Id,
      participant2Id,
    });

    return this.conversationRepo.save(conversation);
  }

  async getConversations(userId: string): Promise<
    Array<{
      id: string;
      otherUserId: string;
      lastMessageContent: string | null;
      lastMessageAt: Date | null;
      unreadCount: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const conversations = await this.conversationRepo.find({
      where: [{ participant1Id: userId }, { participant2Id: userId }],
      order: { lastMessageAt: { direction: 'DESC', nulls: 'LAST' } },
    });

    return conversations.map((conv) => {
      const isParticipant1 = conv.participant1Id === userId;
      return {
        id: conv.id,
        otherUserId: isParticipant1 ? conv.participant2Id : conv.participant1Id,
        lastMessageContent: conv.lastMessageContent,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: isParticipant1
          ? conv.participant1Unread
          : conv.participant2Unread,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ messages: MessageEntity[]; total: number }> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.participant1Id !== userId &&
      conversation.participant2Id !== userId
    ) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const [messages, total] = await this.messageRepo.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { messages, total };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<MessageEntity> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.participant1Id !== senderId &&
      conversation.participant2Id !== senderId
    ) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const message = this.messageRepo.create({
      conversationId,
      senderId,
      content,
    });

    const savedMessage = await this.messageRepo.save(message);

    const isParticipant1 = conversation.participant1Id === senderId;

    if (isParticipant1) {
      conversation.participant2Unread += 1;
    } else {
      conversation.participant1Unread += 1;
    }

    conversation.lastMessageContent = content;
    conversation.lastMessageAt = new Date();

    await this.conversationRepo.save(conversation);

    return savedMessage;
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.participant1Id !== userId &&
      conversation.participant2Id !== userId
    ) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    await this.messageRepo
      .createQueryBuilder()
      .update(MessageEntity)
      .set({ isRead: true, readAt: new Date() })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('is_read = false')
      .execute();

    const isParticipant1 = conversation.participant1Id === userId;

    if (isParticipant1) {
      conversation.participant1Unread = 0;
    } else {
      conversation.participant2Unread = 0;
    }

    await this.conversationRepo.save(conversation);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const conversations = await this.conversationRepo.find({
      where: [{ participant1Id: userId }, { participant2Id: userId }],
    });

    let totalUnread = 0;

    for (const conv of conversations) {
      if (conv.participant1Id === userId) {
        totalUnread += conv.participant1Unread;
      } else {
        totalUnread += conv.participant2Unread;
      }
    }

    return totalUnread;
  }
}
