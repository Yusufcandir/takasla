import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('completed_trades')
export class CompletedTradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'trade_id' })
  tradeId!: string;

  @Column({ name: 'party_a_id' })
  partyAId!: string;

  @Column({ name: 'party_b_id' })
  partyBId!: string;

  @Column({ name: 'risk_level', type: 'varchar', nullable: true })
  riskLevel!: string | null;

  @CreateDateColumn({ name: 'completed_at' })
  completedAt!: Date;
}
