import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AccountService } from './account.service';
import {
  CreateAddressDto,
  SendOtpDto,
  UpdateAddressDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/account.dto';

// Customer self-service. Any authenticated user (no admin role needed).
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.account.getOrCreateProfile(user);
  }

  @Patch('me')
  update(@CurrentUser('uid') uid: string, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(uid, dto);
  }

  @Get('preferences')
  preferences(@CurrentUser('uid') uid: string) {
    return this.account.getPreferences(uid);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser('uid') uid: string, @Body() dto: UpdatePreferencesDto) {
    return this.account.updatePreferences(uid, dto);
  }

  @Post('phone/send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.account.sendPhoneOtp(dto.phone);
  }

  @Post('phone/verify-otp')
  verifyOtp(@CurrentUser('uid') uid: string, @Body() dto: VerifyOtpDto) {
    return this.account.verifyPhoneOtp(uid, dto.phone, dto.code);
  }

  @Get('notifications')
  notifications(@CurrentUser('uid') uid: string) {
    return this.account.notifications(uid);
  }

  @Get('notifications/unread-count')
  notificationCount(@CurrentUser('uid') uid: string) {
    return this.account.notificationCount(uid);
  }

  @Patch('notifications/:id/read')
  markRead(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.account.markNotificationRead(uid, id);
  }

  @Post('notifications/read-all')
  markAllRead(@CurrentUser('uid') uid: string) {
    return this.account.markAllNotificationsRead(uid);
  }

  @Get('addresses')
  addresses(@CurrentUser('uid') uid: string) {
    return this.account.listAddresses(uid);
  }

  @Post('addresses')
  addAddress(@CurrentUser('uid') uid: string, @Body() dto: CreateAddressDto) {
    return this.account.createAddress(uid, dto);
  }

  @Patch('addresses/:id')
  editAddress(@CurrentUser('uid') uid: string, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.account.updateAddress(uid, id, dto);
  }

  @Post('addresses/:id/default')
  makeDefault(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.account.setDefaultAddress(uid, id);
  }

  @Delete('addresses/:id')
  removeAddress(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.account.removeAddress(uid, id);
  }
}
