import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Logs method, path and response time for every request. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.log(`${method} ${url} - ${ms.toFixed(1)}ms`);
      }),
    );
  }
}
