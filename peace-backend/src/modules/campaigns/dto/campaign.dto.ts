import { IsArray, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertCampaignDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsArray() channels?: string[];
  @IsOptional() @IsString() subject?: string;
  @IsString() body!: string;
  @IsOptional() @IsObject() audience?: Record<string, unknown>;
  @IsOptional() @IsString() targetUrl?: string;
  @IsOptional() @IsArray() productIds?: string[];
  @IsOptional() @IsString() scheduledAt?: string;
  @IsOptional() @IsString() storeId?: string;
}

export class AudienceCountDto {
  @IsOptional() @IsString() base?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() storeId?: string;
}
