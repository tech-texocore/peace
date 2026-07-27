import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ModerationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateReviewDto {
  @IsString()
  productId!: string;

  @IsInt() @Min(1) @Max(5)
  rating!: number;

  @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true })
  media?: string[];
}

export class AskQuestionDto {
  @IsString()
  productId!: string;

  @IsString() @MinLength(3) @MaxLength(500)
  body!: string;
}

export class AnswerQuestionDto {
  @IsString() @MinLength(1) @MaxLength(1000)
  body!: string;
}

export class ModerateReviewDto {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status!: ModerationStatus;
}

export class ListReviewsDto extends PaginationDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: ModerationStatus;

  @IsOptional() @IsString()
  productId?: string;

  @IsOptional() @IsString()
  storeId?: string;
}
