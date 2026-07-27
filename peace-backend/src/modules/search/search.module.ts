import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { PostgresSearchProvider } from './providers/postgres-search.provider';
import { SEARCH_PROVIDER } from './search-provider.interface';

@Module({
  providers: [
    SearchService,
    PostgresSearchProvider,
    {
      provide: SEARCH_PROVIDER,
      inject: [ConfigService, PostgresSearchProvider],
      useFactory: (config: ConfigService, postgres: PostgresSearchProvider) => {
        const provider = config.get<string>('search.provider') ?? 'postgres';
        if (provider === 'postgres') return postgres;
        throw new Error(`Unsupported SEARCH_PROVIDER "${provider}". Only 'postgres' is configured.`);
      },
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}
