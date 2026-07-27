import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class QuoteItemDto {
  @IsString() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class QuoteDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items!: QuoteItemDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) couponCodes?: string[];
  @IsOptional() @IsString() customerGroupId?: string;
}
