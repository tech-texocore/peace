import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './infra/prisma/prisma.module';
import { FirebaseModule } from './infra/firebase/firebase.module';
import { MediaModule } from './infra/media/media.module';
import { NotificationsModule } from './infra/notifications/notifications.module';
import { FirebaseService } from './infra/firebase/firebase.service';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

import { AppController } from './app.controller';
import { AccessModule } from './modules/access/access.module';
import { AuditModule } from './modules/audit/audit.module';
import { StoresModule } from './modules/stores/stores.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { SiteConfigModule } from './modules/site-config/site-config.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { OtpModule } from './modules/otp/otp.module';
import { AccountModule } from './modules/account/account.module';
import { GeoModule } from './modules/geo/geo.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { MastersModule } from './modules/masters/masters.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { ProductsModule } from './modules/products/products.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomerGroupsModule } from './modules/customer-groups/customer-groups.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { ContactModule } from './modules/contact/contact.module';

@Module({
  imports: [
    // Global, validated, typed configuration from .env
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // Rate limiting, configurable via env
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl')! * 1000,
          limit: config.get<number>('throttle.limit')!,
        },
      ],
    }),

    // In-process scheduler (abandoned-cart scan, etc.)
    ScheduleModule.forRoot(),

    // Infrastructure
    PrismaModule,
    FirebaseModule,
    MediaModule,
    NotificationsModule,
    OtpModule,

    // Platform modules
    AccessModule,
    AuditModule,
    StoresModule,
    AdminUsersModule,
    SiteConfigModule,
    BootstrapModule,

    // Domain modules
    AccountModule,
    GeoModule,
    SellersModule,
    MastersModule,
    CategoriesModule,
    BrandsModule,
    StorefrontModule,
    ProductsModule,
    CollectionsModule,
    CartModule,
    OrdersModule,
    CustomerGroupsModule,
    DiscountsModule,
    WishlistModule,
    ReviewsModule,
    InventoryModule,
    AnalyticsModule,
    CustomersModule,
    SubscriptionsModule,
    CampaignsModule,
    EngagementModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [
    // Auth is enforced globally; browse routes opt out with @Public()
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, firebase: FirebaseService) =>
        new FirebaseAuthGuard(reflector, firebase),
      inject: [Reflector, FirebaseService],
    },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
