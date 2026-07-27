import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import type { StorageProvider, StoredObject } from './storage-provider.interface';

export const MEDIA_FOLDERS = [
  'products',
  'categories',
  'collections',
  'sellers',
  'banners',
  'avatars',
  'reviews',
  'misc',
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

const ALLOWED_IMAGE = /^image\/(jpe?g|png|webp|avif|gif|svg\+xml)$/;
const ALLOWED_VIDEO = /^video\/(mp4|webm|ogg|quicktime)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 64 * 1024 * 1024; // 64 MB

export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class MediaService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  private validate(file: UploadFile) {
    if (!file?.buffer) throw new BadRequestException('No file provided');
    const isImage = ALLOWED_IMAGE.test(file.mimetype);
    const isVideo = ALLOWED_VIDEO.test(file.mimetype);
    if (!isImage && !isVideo) throw new BadRequestException('Unsupported file type (images or video only)');
    const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > max) throw new BadRequestException(`File too large (max ${max / 1024 / 1024} MB)`);
  }

  // Structured key: folder/[entityId | yyyy/mm]/uuid.ext
  private buildKey(folder: MediaFolder, originalName: string, entityId?: string): string {
    if (!MEDIA_FOLDERS.includes(folder)) throw new BadRequestException('Invalid folder');
    const ext = (extname(originalName).slice(1) || 'bin').toLowerCase();
    const now = new Date();
    const scope = entityId
      ? `${folder}/${entityId}`
      : `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `${scope}/${randomUUID()}.${ext}`;
  }

  async upload(folder: MediaFolder, file: UploadFile, entityId?: string): Promise<StoredObject> {
    this.validate(file);
    const key = this.buildKey(folder, file.originalname, entityId);
    return this.storage.put(key, file.buffer, file.mimetype);
  }

  async remove(key?: string | null): Promise<void> {
    if (key) await this.storage.remove(key);
  }

  // Uploads the new file, then removes the old one — so updates never orphan objects.
  async replace(
    oldKey: string | null | undefined,
    folder: MediaFolder,
    file: UploadFile,
    entityId?: string,
  ): Promise<StoredObject> {
    const asset = await this.upload(folder, file, entityId);
    if (oldKey && oldKey !== asset.key) await this.remove(oldKey);
    return asset;
  }

  url(key: string): string {
    return this.storage.url(key);
  }
}
