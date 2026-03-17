import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, HealthModule } from '@exchange/common';
import { ConversationsModule } from './conversations/conversations.module';
import { ConversationEntity } from './conversations/conversation.entity';
import { MessageEntity } from './conversations/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [ConversationEntity, MessageEntity],
      dbHostEnv: 'MESSAGING_DB_HOST',
      dbPortEnv: 'MESSAGING_DB_PORT',
      dbNameEnv: 'MESSAGING_DB_NAME',
      dbUserEnv: 'MESSAGING_DB_USER',
      dbPasswordEnv: 'MESSAGING_DB_PASSWORD',
    }),
    HealthModule,
    ConversationsModule,
  ],
})
export class AppModule {}
