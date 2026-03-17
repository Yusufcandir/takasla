import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
} from 'typeorm';
import { MessageEntity } from './message.entity';

@Entity('conversations')
@Unique(['participant1Id', 'participant2Id'])
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'participant1_id', type: 'uuid' })
  participant1Id!: string;

  @Column({ name: 'participant2_id', type: 'uuid' })
  participant2Id!: string;

  @Column({ name: 'last_message_content', type: 'text', nullable: true })
  lastMessageContent!: string | null;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ name: 'participant1_unread', type: 'int', default: 0 })
  participant1Unread!: number;

  @Column({ name: 'participant2_unread', type: 'int', default: 0 })
  participant2Unread!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => MessageEntity, (message) => message.conversation)
  messages!: MessageEntity[];
}
