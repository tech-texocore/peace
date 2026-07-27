import { IsBoolean, IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

const PHONE_REGEX = /^\d{10,15}$/;
const PINCODE_REGEX = /^\d{6}$/;

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional() @IsEnum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

  @IsOptional() @IsDateString()
  dob?: string;

  @IsOptional() @IsBoolean() emailOptIn?: boolean;
  @IsOptional() @IsBoolean() smsOptIn?: boolean;
  @IsOptional() @IsBoolean() whatsappOptIn?: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional() @IsBoolean() emailOptIn?: boolean;
  @IsOptional() @IsBoolean() smsOptIn?: boolean;
  @IsOptional() @IsBoolean() whatsappOptIn?: boolean;
  @IsOptional() @IsObject() categories?: Record<string, boolean>;
}

export class SendOtpDto {
  @IsString() @Matches(PHONE_REGEX, { message: 'Enter a valid mobile number' })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString() @Matches(PHONE_REGEX, { message: 'Enter a valid mobile number' })
  phone!: string;

  @IsString() @Length(4, 8)
  code!: string;
}

export class CreateAddressDto {
  @IsString() @MinLength(2) recipientName!: string;
  @IsString() @Matches(PHONE_REGEX, { message: 'Enter a valid mobile number' }) recipientPhone!: string;
  @IsString() @MinLength(3) line1!: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsString() @MinLength(1) city!: string;
  @IsOptional() @IsString() district?: string;
  @IsString() @MinLength(1) state!: string;
  @IsString() @Matches(PINCODE_REGEX, { message: 'Enter a valid 6-digit PIN code' }) postalCode!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsEnum(['HOME', 'WORK', 'OTHER']) type?: 'HOME' | 'WORK' | 'OTHER';
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsString() recipientName?: string;
  @IsOptional() @IsString() recipientPhone?: string;
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsEnum(['HOME', 'WORK', 'OTHER']) type?: 'HOME' | 'WORK' | 'OTHER';
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
