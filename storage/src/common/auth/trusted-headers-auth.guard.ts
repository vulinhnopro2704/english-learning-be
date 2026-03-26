import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
      throw new UnauthorizedException('Missing trusted user headers');
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
