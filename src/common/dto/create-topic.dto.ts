import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  Matches,
} from 'class-validator';
import { DeliveryMode } from '../enums/message-type.enum';

export class CreateTopicDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9.\-]*[a-z0-9]$/, {
    message: 'Topic name must be lowercase alphanumeric with dots or hyphens',
  })
  name: string;

  @IsOptional()
  @IsEnum(DeliveryMode, {
    message: `deliveryMode must be one of: ${Object.values(DeliveryMode).join(', ')}`,
  })
  deliveryMode?: DeliveryMode;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  retentionMs?: number;
}