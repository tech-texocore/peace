import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { IntegrationsService } from '../../infra/integrations/integrations.service';
import { MetaCatalogService } from './meta-catalog.service';

@Public()
@Controller()
export class MetaPublicController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly catalog: MetaCatalogService,
  ) {}

  @Get('tracking/config')
  trackingConfig() {
    const { pixelId, domainVerification } = this.integrations.current.meta;
    return {
      metaPixelId: pixelId || null,
      metaDomainVerification: domainVerification || null,
    };
  }

  @Get('feeds/meta-catalog.csv')
  async catalogCsv(@Res() res: Response) {
    res
      .type('text/csv; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=900');
    res.send(await this.catalog.csv());
  }
}
