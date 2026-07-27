import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

@Global()
@Module({
  controllers: [MediaController],
  providers: [
    S3StorageProvider,
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, S3StorageProvider, LocalStorageProvider],
      useFactory: (config: ConfigService, s3: S3StorageProvider, local: LocalStorageProvider) =>
        config.get<string>('media.provider') === 's3' ? s3 : local,
    },
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
