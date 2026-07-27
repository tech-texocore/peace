import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const RULE_FIELDS = ['title', 'tag', 'category', 'brand', 'fabric', 'pattern', 'occasion', 'season', 'price'] as const;
export const RULE_OPERATORS = ['eq', 'ne', 'contains', 'gt', 'lt'] as const;
const SORTS = ['MANUAL', 'BEST_SELLING', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST', 'OLDEST'];

export class RuleConditionDto {
  @IsIn(RULE_FIELDS as unknown as string[]) field!: string;
  @IsIn(RULE_OPERATORS as unknown as string[]) operator!: string;
  @IsString() @MaxLength(120) value!: string;
}

export class RulesDto {
  @IsIn(['ALL', 'ANY']) match!: 'ALL' | 'ANY';
  @IsArray() @ValidateNested({ each: true }) @Type(() => RuleConditionDto) conditions!: RuleConditionDto[];
}

export class CreateCollectionDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(['MANUAL', 'AUTO']) type?: 'MANUAL' | 'AUTO';
  @IsOptional() @ValidateNested() @Type(() => RulesDto) rules?: RulesDto;
  @IsOptional() @IsIn(SORTS) sortOrder?: string;
  @IsOptional() @IsString() @MaxLength(160) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) metaDescription?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCollectionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(['MANUAL', 'AUTO']) type?: 'MANUAL' | 'AUTO';
  @IsOptional() @ValidateNested() @Type(() => RulesDto) rules?: RulesDto;
  @IsOptional() @IsIn(SORTS) sortOrder?: string;
  @IsOptional() @IsString() @MaxLength(160) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) metaDescription?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCollectionsDto extends PaginationDto {
  @IsOptional() @IsIn(['MANUAL', 'AUTO']) type?: 'MANUAL' | 'AUTO';
  @IsOptional() @IsString() storeId?: string;
}

export class SetProductsDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) productIds!: string[];
}
