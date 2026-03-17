import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 100, unique: true })
  slug!: string;

  @Column({ name: 'risk_weight', type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  riskWeight!: number;

  @Column({ name: 'base_fee', type: 'decimal', precision: 10, scale: 2, default: 50.0 })
  baseFee!: number;

  @Column({ name: 'fee_currency', type: 'varchar', length: 3, default: 'TRY' })
  feeCurrency!: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: CategoryEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
