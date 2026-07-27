import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.get<number>('app.port')!;
  const apiPrefix = config.get<string>('app.apiPrefix')!;
  const corsOrigins = config.get<string[]>('app.corsOrigins')!;

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  // Serve locally-stored media (dev provider) at /uploads.
  app.useStaticAssets(join(process.cwd(), config.get<string>('media.local.dir') ?? 'uploads'), {
    prefix: '/uploads',
  });

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
  logger.log(`🚀 ${config.get('app.name')} running on http://localhost:${port}/${apiPrefix}`);
}

void bootstrap();
