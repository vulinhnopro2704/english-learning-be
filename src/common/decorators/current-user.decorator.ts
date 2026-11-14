import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from '../types/api.types';

/**
 * Parameter decorator to extract the authenticated user from the request.
 * Usage: `@CurrentUser() user: CurrentUser` or `@CurrentUser('id') userId: string`
 */
export const GetCurrentUser = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext): CurrentUser | CurrentUser[keyof CurrentUser] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    if (!request.user) {
      return undefined;
    }
    return data ? request.user[data] : request.user;
  },
);
