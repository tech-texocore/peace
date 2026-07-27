import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MasterFieldDto {
  @IsOptional() @IsString() @MaxLength(40) key?: string;
  @IsString() @MinLength(1) @MaxLength(40) label!: string;
  @IsIn(['text', 'number', 'color', 'select']) type!: 'text' | 'number' | 'color' | 'select';
  @IsOptional() @IsString() @MaxLength(12) unit?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}

export class CreateMasterListDto {
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'Key must be lowercase letters, numbers or underscores' })
  @MaxLength(40)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;
}

export class UpdateMasterListDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) label?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MasterFieldDto) fields?: MasterFieldDto[];
  @IsOptional() @IsArray() @IsIn(['variant', 'spec'], { each: true }) usage?: ('variant' | 'spec')[];
}

export class CreateMasterItemDto {
  @IsString() @MinLength(1) @MaxLength(80) value!: string;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateMasterItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) value?: string;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
