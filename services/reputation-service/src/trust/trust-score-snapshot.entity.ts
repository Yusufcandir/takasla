import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trust_score_snapshots')
export class TrustScoreSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score!: number;

  @Column({ type: 'jsonb' })
  components!: Record<string, number>;

  @CreateDateColumn({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt!: Date;
}
