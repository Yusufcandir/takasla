import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = req;
    const userId = (req as any).user?.sub || 'anonymous';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const duration = Date.now() - start;
          this.logger.log(
            JSON.stringify({
              method,
              url: originalUrl,
              status: res.statusCode,
              duration,
              userId,
            }),
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.error(
            JSON.stringify({
              method,
              url: originalUrl,
              status: err.status || 500,
              duration,
              userId,
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}
