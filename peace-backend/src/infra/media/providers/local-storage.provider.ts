import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { StorageProvider, StoredObject } from '../storage-provider.interface';

// Files on the server disk (MEDIA_DIR), served at /uploads — by Nginx on the VPS.
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly config: ConfigService) {}

  private get dir(): string {
    return resolve(process.cwd(), this.config.get<string>('media.dir')!);
  }

  url(key: string): string {
    const base =
      this.config.get<string>('media.publicUrl') ??
      `${this.config.get<string>('media.apiUrl')}/uploads`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  async put(
    key: string,
    body: Buffer,
    _contentType: string,
  ): Promise<StoredObject> {
    const filePath = join(this.dir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return { key, url: this.url(key) };
  }

  async remove(key: string): Promise<void> {
    await unlink(join(this.dir, key)).catch(() => undefined);
  }

  async removeFolder(folder: string): Promise<void> {
    await rm(join(this.dir, folder), { recursive: true, force: true });
  }
}
