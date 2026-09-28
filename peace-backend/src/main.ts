import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { resolve } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.get<number>('app.port')!;
  const apiPrefix = config.get<string>('app.apiPrefix')!;
  const corsOrigins = config.get<string[]>('app.corsOrigins')!;

  // Behind Nginx on the same machine: take the visitor's IP from X-Forwarded-For
  // (rate limiting and the audit log need the real IP, not 127.0.0.1).
  app.set('trust proxy', 'loopback');

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  // Local driver: serve uploads at /uploads (on the VPS Nginx serves this folder directly).
  if (config.get<string>('media.driver') === 'local') {
    app.useStaticAssets(
      resolve(process.cwd(), config.get<string>('media.dir') ?? 'uploads'),
      {
        prefix: '/uploads',
      },
    );
  }

  app.setGlobalPrefix(apiPrefix);

  // Validate & sanitise all incoming payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Graceful shutdown hooks (closes Prisma etc.)
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(
    `🚀 ${config.get('app.name')} running on http://localhost:${port}/${apiPrefix}`,
  );
}

void bootstrap();
