import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUser } from './current-user.interface';

export const CurrentUserDecorator = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUser }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
