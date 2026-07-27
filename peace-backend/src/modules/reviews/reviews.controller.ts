import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MediaService, type UploadFile } from '../../infra/media/media.service';
import { ReviewsService } from './reviews.service';
import { AnswerQuestionDto, AskQuestionDto, CreateReviewDto, ListReviewsDto, ModerateReviewDto } from './dto/review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly media: MediaService,
  ) {}

  // ---------------- Storefront (public read) ----------------
  @Public()
  @Get('product/:productId')
  findForProduct(
    @Param('productId') productId: string,
    @Query('sort') sort?: string,
    @Query('rating') rating?: string,
    @Query('withPhotos') withPhotos?: string,
    @Query('verified') verified?: string,
  ) {
    return this.reviews.findForProduct(productId, {
      sort, rating: rating ? +rating : undefined,
      withPhotos: withPhotos === 'true', verified: verified === 'true',
    });
  }

  @Public()
  @Get('product/:productId/questions')
  questions(@Param('productId') productId: string) {
    return this.reviews.questions(productId);
  }

  // ---------------- Storefront (auth: signed-in shopper) ----------------
  @Get('product/:productId/eligibility')
  eligibility(@CurrentUser('uid') uid: string, @Param('productId') productId: string) {
    return this.reviews.eligibility(uid, productId);
  }

  @Post()
  create(@CurrentUser('uid') uid: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(uid, dto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadPhoto(@UploadedFile() file: UploadFile) {
    if (!file) throw new BadRequestException('No file uploaded');
    const asset = await this.media.upload('reviews', file);
    return { url: asset.url };
  }

  @Post(':id/helpful')
  helpful(@CurrentUser('uid') uid: string, @Param('id') id: string) {
    return this.reviews.voteHelpful(uid, id);
  }

  @Post('questions')
  ask(@CurrentUser('uid') uid: string, @Body() dto: AskQuestionDto) {
    return this.reviews.ask(uid, dto.productId, dto.body);
  }

  @Post('questions/:id/answers')
  answer(@CurrentUser('uid') uid: string, @Param('id') id: string, @Body() dto: AnswerQuestionDto) {
    return this.reviews.answerQuestion(uid, id, dto.body);
  }

  // ---------------- Admin moderation ----------------
  @RequirePermissions('reviews.read')
  @Get()
  adminList(@CurrentUser() user: AuthUser, @Query() query: ListReviewsDto, @Query('storeId') storeId?: string) {
    return this.reviews.adminList(this.resolveStoreId(user, storeId), query);
  }

  @RequirePermissions('reviews.update')
  @Audit('reviews.moderate', 'review')
  @Patch(':id/status')
  moderate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerateReviewDto, @Query('storeId') storeId?: string) {
    return this.reviews.moderate(this.resolveStoreId(user, storeId), id, dto.status);
  }

  @RequirePermissions('reviews.delete')
  @Audit('reviews.delete', 'review')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.reviews.remove(this.resolveStoreId(user, storeId), id);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
