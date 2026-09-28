export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'peace-backend',
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.API_PORT ?? '4000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.WEB_URL ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  platform: {
    setupSecret: process.env.SETUP_SECRET ?? 'change-me-setup-secret',
    defaultStoreSlug: process.env.STORE_SLUG ?? 'peace',
    defaultStoreName: process.env.STORE_NAME ?? 'Peace',
  },

  // Encrypts integration keys stored in the database.
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-env',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },

  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
    length: parseInt(process.env.OTP_LENGTH ?? '6', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
  },

  // Media storage. The database keeps only keys ("media:products/…"); links
  // are built from here, so switching disk → S3 or changing domain needs no
  // data change.
  media: {
    driver: process.env.MEDIA_DRIVER ?? 'local',
    // Local folder — relative to the backend folder, or absolute (VPS: /var/www/peace/uploads).
    dir: process.env.MEDIA_DIR ?? 'uploads',
    // Base for image links. Empty = API_URL/uploads (local) or the bucket URL (s3).
    publicUrl: process.env.MEDIA_PUBLIC_URL || undefined,
    apiUrl: process.env.API_URL ?? 'http://localhost:4000',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || 'auto',
      // For S3-compatible services (Cloudflare R2, MinIO …); empty for AWS.
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },

  // Product search — 'postgres' (default, FREE: built-in full-text + pg_trgm, no
  // external service). Swappable to a self-hosted engine later via SEARCH_PROVIDER.
  search: {
    provider: process.env.SEARCH_PROVIDER ?? 'postgres',
  },
});
