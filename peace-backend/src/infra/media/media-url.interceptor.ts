import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import { MediaService } from './media.service';

// Incoming: our upload links → "media:<key>" before anything is saved.
// Outgoing: "media:<key>" → full link for the current storage and domain.
@Injectable()
export class MediaUrlInterceptor implements NestInterceptor {
  constructor(private readonly media: MediaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const body = req?.body as unknown;
    if (body && typeof body === 'object') {
      req.body = this.media.mapStrings(body, (s) => this.media.toRef(s));
    }
    return next
      .handle()
      .pipe(
        map((data: unknown) =>
          this.media.mapStrings(data, (s) => this.media.resolve(s)),
        ),
      );
  }
}
