import { ArrayNotEmpty, IsArray, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  key!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions?: string[];
}
