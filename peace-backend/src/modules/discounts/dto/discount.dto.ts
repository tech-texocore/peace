import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const METHODS = ['AUTOMATIC', 'CODE'];
const TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y'];
const SCOPES = ['ALL', 'PRODUCTS', 'CATEGORIES', 'COLLECTIONS'];

class DiscountBase {
  @IsOptional() @IsIn(METHODS) method?: string;
  @ValidateIf((o) => o.method === 'CODE') @IsString() @MinLength(2) @MaxLength(40) code?: string;
  @IsOptional() @IsIn(TYPES) type?: string;
  @IsOptional() @IsNumber() @Min(0) value?: number;

  @IsOptional() @IsIn(SCOPES) scope?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) targetProductIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) targetCategoryIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) targetCollectionIds?: string[];

  @IsOptional() @IsNumber() @Min(0) minSubtotal?: number;
  @IsOptional() @IsInt() @Min(0) minQuantity?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) customerGroupIds?: string[];

  @IsOptional() @IsInt() @Min(1) buyQuantity?: number;
  @IsOptional() @IsInt() @Min(1) getQuantity?: number;
  @IsOptional() @IsInt() @Min(0) getDiscountPercent?: number;

  @IsOptional() @IsArray() tiers?: unknown[];

  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;

  @IsOptional() @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @IsInt() @Min(0) perCustomerLimit?: number;

  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() stackable?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() featuredInNewsletter?: boolean;
}

export class CreateDiscountDto extends DiscountBase {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}

export class UpdateDiscountDto extends DiscountBase {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
}

export class ListDiscountsDto extends PaginationDto {
  @IsOptional() @IsIn(METHODS) method?: string;
  @IsOptional() @IsString() storeId?: string;
}
