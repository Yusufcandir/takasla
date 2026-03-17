import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const AUTH_LIMIT = 100;
const AUTH_WINDOW_MS = 60_000;

const attempts = new Map<string, { count: number; resetAt: number }>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
}, 5 * 60_000);

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = attempts.get(ip);

    if (!entry || now > entry.resetAt) {
      attempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
      return next();
    }

    entry.count++;
    if (entry.count > AUTH_LIMIT) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: 429,
        message: 'Too many authentication attempts. Please try again later.',
      });
    }

    return next();
  }
}
