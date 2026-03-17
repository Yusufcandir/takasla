import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('addresses')
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ default: '' })
  label!: string;

  @Column({ default: false })
  isDefault!: boolean;

  @Column()
  name!: string;

  @Column()
  street!: string;

  @Column()
  city!: string;

  @Column({ default: '' })
  state!: string;

  @Column({ default: '' })
  postalCode!: string;

  @Column()
  country!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  district?: string;

  @Column({ nullable: true })
  neighbourhood?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  countryCode?: string;

  @Column({ nullable: true })
  stateCode?: string;

  @Column({ nullable: true })
  cityCode?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
