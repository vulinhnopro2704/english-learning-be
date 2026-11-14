import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ApiException } from '../exceptions/api.exception';
import type { CurrentUser } from '../types/api.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    const user = request.user;

    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication required for role verification',
      });
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ApiException({
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'FORBIDDEN_ROLE',
        message: `User with role '${user.role}' lacks permission for this resource`,
      });
    }

    return true;
  }
}
