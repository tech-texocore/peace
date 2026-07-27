import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { StorefrontService } from './storefront.service';
import { QuoteDto } from './dto/quote.dto';

@Public()
@Controller('storefront/:slug')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Post('quote')
  quote(@Param('slug') slug: string, @Body() dto: QuoteDto) {
    return this.storefront.quote(slug, dto);
  }

  @Get('categories')
  categories(@Param('slug') slug: string) {
    return this.storefront.categories(slug);
  }

  @Get('offers')
  offers(@Param('slug') slug: string) {
    return this.storefront.offers(slug);
  }

  @Get('newsletter-offer')
  newsletterOffer(@Param('slug') slug: string) {
    return this.storefront.newsletterOffer(slug);
  }

  @Get('testimonials')
  testimonials(@Param('slug') slug: string) {
    return this.storefront.testimonials(slug);
  }

  @Post('subscribe')
  subscribe(@Param('slug') slug: string, @Body() body: { email?: string; source?: string }) {
    return this.storefront.subscribe(slug, body?.email ?? '', body?.source);
  }

  @Get('shipping-info')
  shippingInfo(@Param('slug') slug: string) {
    return this.storefront.shippingInfo(slug);
  }

  @Get('suggest')
  suggest(@Param('slug') slug: string, @Query('q') q?: string) {
    return this.storefront.suggest(slug, q ?? '');
  }

  @Get('cards')
  cards(@Param('slug') slug: string, @Query('ids') ids?: string) {
    return this.storefront.cardsByIds(slug, ids ? ids.split(',').map((s) => s.trim()).filter(Boolean) : []);
  }

  @Get('products')
  products(
    @Param('slug') slug: string,
    @Query('category') category?: string,
    @Query('collection') collection?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sizes') sizes?: string,
    @Query('colours') colours?: string,
    @Query('fabrics') fabrics?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
    @Query('discount') discount?: string,
  ) {
    const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
    return this.storefront.products(slug, {
      category, collection, search, sort,
      page: page ? +page : undefined, limit: limit ? +limit : undefined,
      sizes: list(sizes), colours: list(colours), fabrics: list(fabrics),
      minPrice: minPrice ? +minPrice : undefined, maxPrice: maxPrice ? +maxPrice : undefined,
      inStock: inStock === 'true', discount: discount === 'true',
    });
  }

  @Get('products/:productSlug')
  product(@Param('slug') slug: string, @Param('productSlug') productSlug: string) {
    return this.storefront.product(slug, productSlug);
  }
}
