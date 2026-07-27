import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListSellersDto extends PaginationDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  // Super admin targets a store via ?storeId; whitelisted so validation passes.
  @IsOptional()
  @IsString()
  storeId?: string;
}
