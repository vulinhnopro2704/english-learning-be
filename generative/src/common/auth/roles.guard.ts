import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '@english-learning/nest-error-handler';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ApiException({
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }
    return true;
  }
}
