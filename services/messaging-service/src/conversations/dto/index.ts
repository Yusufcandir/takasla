import { IsUUID, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  participantId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
