import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ApiException } from '@english-learning/nest-error-handler';
import type { Request } from 'express';
import type { CurrentUser } from './current-user.interface';

@Injectable()
export class TrustedHeadersAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CurrentUser }>();

    const userIdHeader = request.header('x-user-id');
    if (!userIdHeader) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'MISSING_TRUSTED_USER_HEADERS',
        message: 'Missing trusted user headers',
      });
    }

    request.user = {
      id: userIdHeader,
      role: request.header('x-user-role') ?? 'user',
      email: request.header('x-user-email') ?? '',
      jti: request.header('x-user-jti') ?? '',
    };

    return true;
  }
}
