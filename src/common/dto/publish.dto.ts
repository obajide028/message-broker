import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class PublishDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsNotEmpty()
  payload: unknown;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(86400000) // max TTL 24 hours in ms
  ttl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}