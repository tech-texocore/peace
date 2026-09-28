import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaUrlInterceptor } from './media-url.interceptor';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

// MEDIA_DRIVER picks where uploads live: 'local' (server disk / VPS) or 's3'.
@Global()
@Module({
  controllers: [MediaController],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
      ) => {
        const driver = config.get<string>('media.driver');
        if (driver === 'local') return local;
        if (driver === 's3') {
          s3.assertConfigured();
          return s3;
        }
        throw new Error(
          `MEDIA_DRIVER must be 'local' or 's3' (got '${driver}')`,
        );
      },
    },
    MediaService,
    { provide: APP_INTERCEPTOR, useClass: MediaUrlInterceptor },
  ],
  exports: [MediaService],
})
export class MediaModule {}
