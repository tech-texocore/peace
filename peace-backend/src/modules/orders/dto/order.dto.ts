import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OrderItemInputDto {
  @IsString() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsObject() customization?: Record<string, unknown>;
}

export class CreateOrderDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsOptional() @IsArray() @IsString({ each: true })
  couponCodes?: string[];

  @IsString() addressId!: string;

  @IsOptional() @IsString() deliveryMethod?: string;

  @IsIn(['COD', 'RAZORPAY']) paymentMethod!: PaymentMethod;

  @IsOptional() @IsString() notes?: string;
}

export class VerifyPaymentDto {
  @IsString() paymentId!: string;
  @IsString() signature!: string;
}

export class CancelOrderDto {
  @IsOptional() @IsString() reason?: string;
}

export class RequestReturnDto {
  @IsIn(['RETURN', 'EXCHANGE']) type!: 'RETURN' | 'EXCHANGE';
  @IsString() @MinLength(3) reason!: string;
}

export class ResolveReturnDto {
  @IsIn(['APPROVE', 'REJECT', 'MARK_PICKED_UP', 'REFUND']) action!: 'APPROVE' | 'REJECT' | 'MARK_PICKED_UP' | 'REFUND';
  @IsOptional() @IsString() resolution?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'])
  status!: OrderStatus;

  @IsOptional() @IsString() note?: string;
}

export class ListOrdersDto extends PaginationDto {
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'])
  status?: OrderStatus;

  @IsOptional() @IsString() storeId?: string;

  @IsOptional() @IsIn(['UNPAID', 'PENDING', 'PAID', 'REFUNDED', 'FAILED']) paymentStatus?: string;
  @IsOptional() @IsIn(['COD', 'RAZORPAY']) paymentMethod?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
