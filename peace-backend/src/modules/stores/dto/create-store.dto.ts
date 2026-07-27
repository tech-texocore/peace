import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers and hyphens' })
  slug!: string;

  @IsOptional()
  @IsString()
  domain?: string;
}
