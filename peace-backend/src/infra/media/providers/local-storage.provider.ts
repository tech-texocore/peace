import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { StorageProvider, StoredObject } from '../storage-provider.interface';

// Dev provider — writes to a local folder served at /uploads (same key layout as S3).
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly config: ConfigService) {}

  private get dir(): string {
    return join(process.cwd(), this.config.get<string>('media.local.dir')!);
  }

  url(key: string): string {
    const base = this.config.get<string>('media.publicUrl')!.replace(/\/$/, '');
    return `${base}/uploads/${key}`;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<StoredObject> {
    const filePath = join(this.dir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return { key, url: this.url(key) };
  }

  async remove(key: string): Promise<void> {
    await unlink(join(this.dir, key)).catch(() => undefined);
  }
}
