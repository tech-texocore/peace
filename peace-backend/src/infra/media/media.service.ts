import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import type {
  StorageProvider,
  StoredObject,
} from './storage-provider.interface';

export const MEDIA_FOLDERS = [
  'products',
  'brands',
  'categories',
  'collections',
  'sellers',
  'banners',
  'avatars',
  'reviews',
  'customizations',
  'misc',
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const MEDIA_REF = 'media:';

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
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private validate(file: UploadFile) {
    if (!file?.buffer) throw new BadRequestException('No file provided');
    const isImage = ALLOWED_IMAGE.test(file.mimetype);
    const isVideo = ALLOWED_VIDEO.test(file.mimetype);
    if (!isImage && !isVideo)
      throw new BadRequestException(
        'Unsupported file type (images or video only)',
      );
    const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > max)
      throw new BadRequestException(
        `File too large (max ${max / 1024 / 1024} MB)`,
      );
  }

  // Structured key: folder/[entityId | yyyy/mm]/uuid.ext
  private buildKey(
    folder: MediaFolder,
    originalName: string,
    entityId?: string,
  ): string {
    if (!MEDIA_FOLDERS.includes(folder))
      throw new BadRequestException('Invalid folder');
    const ext = (extname(originalName).slice(1) || 'bin').toLowerCase();
    const now = new Date();
    const scope = entityId
      ? `${folder}/${entityId}`
      : `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `${scope}/${randomUUID()}.${ext}`;
  }

  async upload(
    folder: MediaFolder,
    file: UploadFile,
    entityId?: string,
  ): Promise<StoredObject> {
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

  removeFolder(folder: MediaFolder): Promise<void> {
    return this.storage.removeFolder(folder);
  }

  // Our uploads are stored as "media:<key>" — never with a domain — and turned
  // into full links on the way out. External links are left untouched.
  toRef(value: string): string {
    const base = this.storage.url('');
    return value.startsWith(base) && value.length > base.length
      ? MEDIA_REF + value.slice(base.length)
      : value;
  }

  resolve(value: string): string {
    return value.startsWith(MEDIA_REF)
      ? this.storage.url(value.slice(MEDIA_REF.length))
      : value;
  }

  // Applies toRef / resolve to every string inside a request or response body.
  mapStrings<T>(data: T, fn: (s: string) => string): T {
    if (typeof data === 'string') return fn(data) as T;
    if (Array.isArray(data))
      return data.map((v: unknown) => this.mapStrings(v, fn)) as T;
    if (data && typeof data === 'object') {
      const proto = Object.getPrototypeOf(data) as unknown;
      if (proto !== Object.prototype && proto !== null) return data;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data))
        out[k] = this.mapStrings(v, fn);
      return out as T;
    }
    return data;
  }
}
