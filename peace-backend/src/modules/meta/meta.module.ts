import { Global, Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { MetaAudiencesService } from './meta-audiences.service';
import { MetaCapiService } from './meta-capi.service';
import { MetaCatalogService } from './meta-catalog.service';
import { MetaController } from './meta.controller';
import { MetaPublicController } from './meta-public.controller';

// Global so orders can report purchases without an import cycle.
@Global()
@Module({
  imports: [CampaignsModule],
  controllers: [MetaController, MetaPublicController],
  providers: [MetaCapiService, MetaCatalogService, MetaAudiencesService],
  exports: [MetaCapiService],
})
export class MetaModule {}
