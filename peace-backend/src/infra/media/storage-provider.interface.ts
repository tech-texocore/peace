export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredObject {
  key: string;
  url: string;
}

// Same key layout on every backend (folder/…/uuid.ext), so files can be copied
// between disk and a bucket as-is.
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  remove(key: string): Promise<void>;
  removeFolder(folder: string): Promise<void>;
  url(key: string): string;
}
