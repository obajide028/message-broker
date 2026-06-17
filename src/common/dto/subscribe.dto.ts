import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  // Topic names: lowercase, dots and hyphens allowed. e.g. "orders.created"
  @Matches(/^[a-z0-9][a-z0-9.\-]*[a-z0-9]$/, {
    message: 'Topic name must be lowercase alphanumeric with dots or hyphens',
  })
  topic: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  groupId?: string;
}