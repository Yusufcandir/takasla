import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trust_scores')
export class TrustScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score!: number;

  @Column({ type: 'jsonb', nullable: true })
  components?: Record<string, number>;

  @Column({ name: 'risk_flags', type: 'jsonb', default: '[]' })
  riskFlags!: string[];

  @Column({ name: 'last_calculated', type: 'timestamptz', default: () => 'now()' })
  lastCalculated!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
