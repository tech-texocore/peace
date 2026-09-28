import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { StorageProvider, StoredObject } from '../storage-provider.interface';

type S3Settings = {
  bucket?: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

// Any S3-compatible bucket: AWS S3, Cloudflare R2, MinIO (self-hosted) …
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly logger = new Logger('S3Storage');
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  private get settings(): S3Settings {
    return this.config.get<S3Settings>('media.s3')!;
  }

  private get bucket(): string {
    return this.settings.bucket!;
  }

  private get s3(): S3Client {
    if (!this.client) {
      const { region, endpoint, accessKeyId, secretAccessKey } = this.settings;
      this.client = new S3Client({
        region,
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
    }
    return this.client;
  }

  // Checked at startup so a half-filled config fails loudly, not on first upload.
  assertConfigured() {
    const { bucket, accessKeyId, secretAccessKey, endpoint } = this.settings;
    const missing = [
      !bucket && 'S3_BUCKET',
      !accessKeyId && 'S3_ACCESS_KEY_ID',
      !secretAccessKey && 'S3_SECRET_ACCESS_KEY',
    ]
      .filter(Boolean)
      .join(', ');
    if (missing) throw new Error(`MEDIA_DRIVER=s3 needs ${missing}`);
    if (endpoint && !this.config.get<string>('media.publicUrl')) {
      throw new Error(
        "MEDIA_DRIVER=s3 with S3_ENDPOINT needs MEDIA_PUBLIC_URL (the bucket's public URL)",
      );
    }
  }

  url(key: string): string {
    const base =
      this.config.get<string>('media.publicUrl') ??
      `https://${this.bucket}.s3.${this.settings.region}.amazonaws.com`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  async put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key, url: this.url(key) };
  }

  async remove(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete ${key}: ${(error as Error).message}`);
    }
  }

  async removeFolder(folder: string): Promise<void> {
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${folder}/`,
          ContinuationToken: token,
        }),
      );
      const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length)
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys },
          }),
        );
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}
