import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageProvider, StoredObject } from '../storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly logger = new Logger('S3Storage');
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  private get s3(): S3Client {
    if (!this.client) {
      const { region, accessKeyId, secretAccessKey } = this.config.get('media.s3');
      this.client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    }
    return this.client;
  }

  private get bucket(): string {
    return this.config.get<string>('media.s3.bucket')!;
  }

  url(key: string): string {
    const cdn = this.config.get<string>('media.s3.cdnUrl');
    if (cdn) return `${cdn.replace(/\/$/, '')}/${key}`;
    const region = this.config.get<string>('media.s3.region');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { key, url: this.url(key) };
  }

  async remove(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(`Failed to delete ${key}: ${(error as Error).message}`);
    }
  }
}
