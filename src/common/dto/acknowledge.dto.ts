import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AcknowledgeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID(4)
  messageId: string;
}