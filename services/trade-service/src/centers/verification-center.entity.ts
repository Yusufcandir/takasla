import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('verification_centers')
export class VerificationCenterEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 50 })
  city!: string;

  @Column({ type: 'varchar', length: 50 })
  district!: string;

  @Column({ type: 'text' })
  street!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 10 })
  postalCode!: string;

  @Column({ type: 'varchar', length: 5, default: 'TR' })
  country!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 100 })
  contactName!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'operating_hours', type: 'varchar', length: 100, nullable: true })
  operatingHours?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
