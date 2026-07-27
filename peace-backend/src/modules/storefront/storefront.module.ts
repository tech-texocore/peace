import { Module } from '@nestjs/common';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [DiscountsModule, ReviewsModule, SearchModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
