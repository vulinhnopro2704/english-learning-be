import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const userIdHeader = request.header('x-user-id');

    if (!userIdHeader) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'MISSING_TRUSTED_USER_HEADERS',
        message: 'Missing trusted user headers',
      });
    }

    const requestWithUser = request as Request & {
      user?: {
        id: string;
        email: string;
        role: string;
        jti: string;
      };
    };

    requestWithUser.user = {
      id: userIdHeader,
      email: request.header('x-user-email') ?? '',
      role: request.header('x-user-role') ?? 'user',
      jti: request.header('x-user-jti') ?? '',
    };

    return true;
  }
}
