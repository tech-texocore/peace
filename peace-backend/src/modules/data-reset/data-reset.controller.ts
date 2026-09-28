import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsString, Length } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import {
  DataResetService,
  RESET_SCOPES,
  type ResetScope,
} from './data-reset.service';

class SendCodeDto {
  @IsIn(RESET_SCOPES) scope!: ResetScope;
}

class RunResetDto {
  @IsIn(RESET_SCOPES) scope!: ResetScope;
  @IsString() @Length(4, 8) code!: string;
  @IsIn(['DELETE']) confirm!: string;
}

@Roles('SUPER_ADMIN')
@Controller('data-reset')
export class DataResetController {
  constructor(private readonly reset: DataResetService) {}

  @Get('summary')
  summary() {
    return this.reset.summary();
  }

  @Post('send-code')
  sendCode(@CurrentUser() user: AuthUser, @Body() dto: SendCodeDto) {
    return this.reset.sendCode(dto.scope, user.email);
  }

  @Post('run')
  run(@CurrentUser() user: AuthUser, @Body() dto: RunResetDto) {
    return this.reset.run(dto.scope, dto.code, user.email);
  }
}
