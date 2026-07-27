import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, IsIn,
  Min, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class VariantDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) @MaxLength(60) sku!: string;
  @IsOptional() @IsObject() attributes?: Record<string, string>;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsNumber() @Min(0) mrp?: number;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsInt() @Min(0) weightGrams?: number;
  @IsOptional() @IsNumber() @Min(0) lengthCm?: number;
  @IsOptional() @IsNumber() @Min(0) widthCm?: number;
  @IsOptional() @IsNumber() @Min(0) heightCm?: number;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MediaDto {
  @IsOptional() @IsIn(['IMAGE', 'VIDEO']) type?: string;
  @IsString() url!: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsString() variantSku?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) colours?: string[];
  @IsOptional() @IsInt() position?: number;
}

export class SpecDto {
  @IsString() key!: string;
  @IsString() label!: string;
  @IsString() @MaxLength(200) value!: string;
}

export class CustomFieldDto {
  @IsString() @MaxLength(60) label!: string;
  @IsIn(['text', 'textarea', 'number', 'select', 'image']) type!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @IsOptional() @IsInt() maxLength?: number;
  @IsOptional() @IsString() @MaxLength(200) helpText?: string;
}

export class ProductBase {
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(160) slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brandId?: string | null;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: string;
  @IsOptional() @IsString() @MaxLength(12) hsnCode?: string;
  @IsOptional() @IsNumber() gstRate?: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsBoolean() discountable?: boolean;
  @IsOptional() @IsString() @MaxLength(20) uom?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) variantAxes?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SpecDto) specifications?: SpecDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedProductIds?: string[];

  @IsOptional() @IsBoolean() isCustomizable?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CustomFieldDto) customizationFields?: CustomFieldDto[];

  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) metaDescription?: string;
  @IsOptional() @IsBoolean() returnable?: boolean;
  @IsOptional() @IsInt() @Min(0) returnWindowDays?: number;
  @IsOptional() @IsInt() @Min(1) minOrderQty?: number;
  @IsOptional() @IsInt() @Min(1) maxOrderQty?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaDto) media?: MediaDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) collectionIds?: string[];
}

export class CreateProductDto extends ProductBase {
  @IsString() sellerId!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
}

export class UpdateProductDto extends ProductBase {
  @IsOptional() @IsString() sellerId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
}

export class ListProductsDto extends PaginationDto {
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: string;
  @IsOptional() @IsString() sellerId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() storeId?: string;
}
