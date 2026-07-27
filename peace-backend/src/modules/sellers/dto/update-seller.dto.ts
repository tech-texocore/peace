import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  businessType?: string;

  @ValidateIf((o) => !!o.gstin)
  @Matches(GSTIN, { message: 'Enter a valid 15-character GSTIN' })
  gstin?: string;

  @ValidateIf((o) => !!o.pan)
  @Matches(PAN, { message: 'Enter a valid 10-character PAN' })
  pan?: string;

  @ValidateIf((o) => !!o.email)
  @IsEmail({}, { message: 'Enter a valid email' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @ValidateIf((o) => !!o.supportEmail)
  @IsEmail({}, { message: 'Enter a valid support email' })
  supportEmail?: string;

  @IsOptional() @IsString() supportPhone?: string;

  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @IsOptional() @IsString() logoUrl?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @IsOptional()
  @IsBoolean()
  isFirstParty?: boolean;

  @IsOptional() @IsBoolean() returnable?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(365) returnWindowDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) replacementDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) dispatchDays?: number;
  @IsOptional() @IsBoolean() codAvailable?: boolean;
  @IsOptional() @IsString() @MaxLength(500) warrantyInfo?: string;

  @IsOptional() @IsString() pickupName?: string;
  @IsOptional() @IsString() pickupPhone?: string;
  @IsOptional() @IsString() pickupLine1?: string;
  @IsOptional() @IsString() pickupLine2?: string;
  @IsOptional() @IsString() pickupLandmark?: string;
  @IsOptional() @IsString() pickupCity?: string;
  @IsOptional() @IsString() pickupDistrict?: string;
  @IsOptional() @IsString() pickupState?: string;
  @IsOptional() @IsString() pickupPostalCode?: string;
  @IsOptional() @IsString() pickupCountry?: string;

  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsString() bankAccountNumber?: string;

  @ValidateIf((o) => !!o.bankIfsc)
  @Matches(IFSC, { message: 'Enter a valid IFSC code' })
  bankIfsc?: string;
}
