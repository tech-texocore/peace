import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ReturnStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CancelOrderDto, CreateOrderDto, ListOrdersDto, RequestReturnDto, ResolveReturnDto, UpdateOrderStatusDto, VerifyPaymentDto } from './dto/order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // ---------------- Razorpay webhook (public, signature-verified) ----------------
  @Public()
  @Post('webhook/razorpay')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    return this.orders.handleWebhook(raw, signature ?? '');
  }

  // ---------------- Customer (auth) ----------------
  @Get('checkout-config')
  checkoutConfig() {
    return this.orders.checkoutConfig();
  }

  @Get('mine')
  listMine(@CurrentUser('uid') uid: string) {
    return this.orders.listForUser(uid);
  }

  @Get('mine/returns')
  myReturns(@CurrentUser('uid') uid: string) {
    return this.orders.myReturns(uid);
  }

  @Audit('order.return-requested', 'order')
  @Post(':id/return')
  requestReturn(@CurrentUser('uid') uid: string, @Param('id') id: string, @Body() dto: RequestReturnDto) {
    return this.orders.requestReturn(uid, id, dto.type, dto.reason);
  }

  @Get('mine/:id')
  getMine(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.orders.getForUser(uid, id);
  }

  @Get('mine/:id/invoice')
  invoice(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.orders.invoiceFor(uid, id);
  }

  @Get('mine/:id/tracking')
  myTracking(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.orders.trackForUser(uid, id);
  }

  @Audit('order.placed', 'order')
  @Post()
  create(@CurrentUser('uid') uid: string, @Body() dto: CreateOrderDto) {
    return this.orders.create(uid, dto);
  }

  @Audit('payment.captured', 'order')
  @Post(':id/verify-payment')
  verifyPayment(@CurrentUser('uid') uid: string, @Param('id') id: string, @Body() dto: VerifyPaymentDto) {
    return this.orders.verifyPayment(uid, id, dto.paymentId, dto.signature);
  }

  @Audit('order.cancelled', 'order')
  @Post(':id/cancel')
  cancel(@CurrentUser('uid') uid: string, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(uid, id, dto.reason);
  }

  // ---------------- Admin ----------------
  @RequirePermissions('orders.read')
  @Get('admin/list')
  adminList(@CurrentUser() user: AuthUser, @Query() query: ListOrdersDto, @Query('storeId') storeId?: string) {
    return this.orders.adminList(this.resolveStoreId(user, storeId), query);
  }

  @RequirePermissions('orders.read')
  @Get('admin/returns')
  adminReturns(@CurrentUser() user: AuthUser, @Query('status') status?: ReturnStatus, @Query('storeId') storeId?: string) {
    return this.orders.adminReturns(this.resolveStoreId(user, storeId), status);
  }

  @RequirePermissions('orders.update')
  @Audit('orders.resolve-return', 'return')
  @Patch('admin/returns/:id')
  resolveReturn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResolveReturnDto, @Query('storeId') storeId?: string) {
    return this.orders.resolveReturn(this.resolveStoreId(user, storeId), id, dto.action, dto.resolution);
  }

  @RequirePermissions('orders.read')
  @Get('admin/:id')
  adminGet(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.orders.adminGet(this.resolveStoreId(user, storeId), id);
  }

  @RequirePermissions('orders.update')
  @Audit('orders.update-status', 'order')
  @Patch('admin/:id/status')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Query('storeId') storeId?: string) {
    return this.orders.updateStatus(this.resolveStoreId(user, storeId), id, dto.status, dto.note);
  }

  @RequirePermissions('orders.update')
  @Audit('shipping.ship-order', 'order')
  @Post('admin/:id/ship')
  ship(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.orders.shipOrder(this.resolveStoreId(user, storeId), id);
  }

  @RequirePermissions('orders.read')
  @Get('admin/:id/tracking')
  adminTracking(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.orders.trackForAdmin(this.resolveStoreId(user, storeId), id);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
