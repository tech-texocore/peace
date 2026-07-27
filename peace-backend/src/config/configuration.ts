export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'peace-backend',
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  platform: {
    setupSecret: process.env.SETUP_SECRET ?? 'change-me-setup-secret',
    defaultStoreSlug: process.env.DEFAULT_STORE_SLUG ?? 'peace',
    defaultStoreName: process.env.DEFAULT_STORE_NAME ?? 'Peace',
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

  // Media storage — swappable provider (s3 for prod, local for dev).
  media: {
    provider: process.env.MEDIA_PROVIDER ?? 'local',
    // Public base used to build asset URLs (CDN domain, or the API for local).
    publicUrl: process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:4000',
    local: {
      dir: process.env.MEDIA_LOCAL_DIR ?? 'uploads',
    },
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_S3_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      // Optional CloudFront/CDN base; falls back to the S3 URL.
      cdnUrl: process.env.AWS_S3_CDN_URL,
    },
  },

  // Product search — 'postgres' (default, FREE: built-in full-text + pg_trgm, no
  // external service). Swappable to a self-hosted engine later via SEARCH_PROVIDER.
  search: {
    provider: process.env.SEARCH_PROVIDER ?? 'postgres',
  },

  // Where storefront "Contact us" messages are emailed.
  contact: {
    email: process.env.CONTACT_EMAIL ?? 'support@peace.local',
  },

  // Notification channels — each swappable via its own provider.
  notifications: {
    sms: { provider: process.env.SMS_PROVIDER ?? 'console' },
    whatsapp: { provider: process.env.WHATSAPP_PROVIDER ?? 'console' },
    email: {
      provider: process.env.EMAIL_PROVIDER ?? 'console',
      from: process.env.EMAIL_FROM ?? 'Peace <no-reply@peace.local>',
    },
    push: { provider: process.env.PUSH_PROVIDER ?? 'console' },
  },

  // Transactional integrations (client-supplied). SMS/WhatsApp/Email live under `notifications`.
  integrations: {
    payments: {
      provider: process.env.PAYMENTS_PROVIDER ?? 'razorpay',
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
      },
    },
    courier: {
      provider: process.env.COURIER_PROVIDER ?? 'bluedart',
      bluedart: {
        licenseKey: process.env.BLUEDART_LICENSE_KEY,
        loginId: process.env.BLUEDART_LOGIN_ID,
        apiBase: process.env.BLUEDART_API_BASE,
      },
    },
  },
});
