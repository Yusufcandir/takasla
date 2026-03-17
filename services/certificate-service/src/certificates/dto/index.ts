import { IsUUID } from 'class-validator';

export class TransferCertificateDto {
  @IsUUID() toUserId!: string;
}
