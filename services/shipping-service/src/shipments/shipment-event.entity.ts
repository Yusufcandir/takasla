import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ShipmentEntity } from './shipment.entity';

@Entity('shipment_events')
export class ShipmentEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  shipmentId!: string;

  @ManyToOne(() => ShipmentEntity, (shipment) => shipment.events)
  @JoinColumn({ name: 'shipmentId' })
  shipment!: ShipmentEntity;

  @Column()
  status!: string;

  @Column({ nullable: true })
  message?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ type: 'timestamp with time zone' })
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
