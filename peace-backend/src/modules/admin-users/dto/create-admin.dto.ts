import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { AdminRole } from '../../../common/decorators/current-user.decorator';

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsIn(['SUPER_ADMIN', 'ADMIN', 'STAFF'])
  role!: AdminRole;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;
}
