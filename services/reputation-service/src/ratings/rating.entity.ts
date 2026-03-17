import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('ratings')
@Unique(['tradeId', 'raterId'])
export class RatingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @Column({ name: 'rater_id', type: 'uuid' })
  raterId!: string;

  @Column({ name: 'rated_user_id', type: 'uuid' })
  ratedUserId!: string;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
