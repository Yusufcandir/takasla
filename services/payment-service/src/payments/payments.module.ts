import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IyzicoModule } from '../iyzico/iyzico.module';
import { OutboxModule } from '@exchange/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    IyzicoModule,
    OutboxModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
