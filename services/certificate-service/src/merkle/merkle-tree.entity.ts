import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('merkle_trees')
export class MerkleTreeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'root_hash', length: 128 })
  rootHash!: string;

  @Column({ name: 'leaf_count', type: 'int' })
  leafCount!: number;

  @Column({ type: 'jsonb' })
  leaves!: Array<{ index: number; certificateId: string; hash: string }>;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd!: Date;

  @Column({ default: false })
  anchored!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
