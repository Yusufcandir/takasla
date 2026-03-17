import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthValidationMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    // No token provided — pass through; backend @Public()/@UseGuards will decide
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = jwt.verify(token, secret);
      (req as any).user = payload;
    } catch {
      // Token invalid/expired — still forward the request.
      // Backend JwtAuthGuard will reject protected routes;
      // public routes will work regardless.
    }
    next();
  }
}
