import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IntegrationsService } from '../../infra/integrations/integrations.service';
import { MetaAudiencesService } from './meta-audiences.service';
import {
  AudienceRuleDto,
  CreateMetaAudienceDto,
} from './dto/meta-audience.dto';

@Roles('SUPER_ADMIN')
@Controller('meta')
export class MetaController {
  constructor(
    private readonly audiences: MetaAudiencesService,
    private readonly integrations: IntegrationsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('overview')
  async overview(@Query('storeId') storeId?: string) {
    const id = this.storeId(storeId);
    const m = this.integrations.current.meta;
    const api = `${this.config.get<string>('media.apiUrl')}/${this.config.get<string>('app.apiPrefix')}`;
    const [catalogItems, audiences] = await Promise.all([
      this.prisma.productVariant.count({
        where: { isActive: true, product: { storeId: id, status: 'ACTIVE' } },
      }),
      this.prisma.metaAudience.count({ where: { storeId: id } }),
    ]);
    return {
      pixel: Boolean(m.pixelId),
      conversionsApi: Boolean(m.pixelId && m.accessToken),
      testMode: Boolean(m.testEventCode),
      domainVerification: Boolean(m.domainVerification),
      adAccount: Boolean(m.adAccountId && (m.audienceToken || m.accessToken)),
      catalog: { url: `${api}/feeds/meta-catalog.csv`, items: catalogItems },
      audiences,
    };
  }

  @Post('test-ad-account')
  testAdAccount() {
    return this.audiences.testAdAccount();
  }

  @Get('audiences')
  list(@Query('storeId') storeId?: string) {
    return this.audiences.list(this.storeId(storeId));
  }

  @Post('audiences/count')
  count(@Body() dto: AudienceRuleDto, @Query('storeId') storeId?: string) {
    return this.audiences.count(this.storeId(storeId), dto);
  }

  @Audit('meta.audience.create', 'meta-audience')
  @Post('audiences')
  create(
    @Body() dto: CreateMetaAudienceDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.audiences.create(this.storeId(storeId), dto);
  }

  @Audit('meta.audience.sync', 'meta-audience')
  @Post('audiences/:id/sync')
  sync(@Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.audiences.sync(this.storeId(storeId), id);
  }

  @Audit('meta.audience.delete', 'meta-audience')
  @Delete('audiences/:id')
  remove(@Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.audiences.remove(this.storeId(storeId), id);
  }

  private storeId(storeId?: string) {
    if (!storeId) throw new BadRequestException('storeId is required');
    return storeId;
  }
}
