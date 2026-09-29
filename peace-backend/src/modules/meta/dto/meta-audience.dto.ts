import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const AUDIENCE_BASES = [
  'all_customers',
  'newsletter',
  'customer_group',
  'has_ordered',
] as const;

export class AudienceRuleDto {
  @IsIn(AUDIENCE_BASES) base!: (typeof AUDIENCE_BASES)[number];
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() state?: string;
}

export class CreateMetaAudienceDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ValidateNested() @Type(() => AudienceRuleDto) audience!: AudienceRuleDto;
}
