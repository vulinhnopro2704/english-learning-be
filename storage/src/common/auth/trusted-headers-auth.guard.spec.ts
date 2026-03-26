import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { TrustedHeadersAuthGuard } from './trusted-headers-auth.guard';

type HeaderRequest = {
  header: (name: string) => string | undefined;
  user?: {
    id: string;
    role: string;
    email: string;
    jti: string;
  };
};

const createExecutionContext = (
  request: HeaderRequest,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

describe('TrustedHeadersAuthGuard', () => {
  let guard: TrustedHeadersAuthGuard;

  beforeEach(() => {
    guard = new TrustedHeadersAuthGuard();
  });

  it('should reject request without x-user-id', () => {
    const context = createExecutionContext({
      header: () => undefined,
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should attach user from trusted headers', () => {
    const req: HeaderRequest = {
      header: (name: string) =>
        ({
          'x-user-id': '2f5c2f52-8dbf-48f2-bf48-4fc0111d4f36',
          'x-user-role': 'admin',
          'x-user-email': 'user@example.com',
          'x-user-jti': 'jti-123',
        })[name.toLowerCase()],
    };
    const context = createExecutionContext(req);

    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toEqual({
      id: '2f5c2f52-8dbf-48f2-bf48-4fc0111d4f36',
      role: 'admin',
      email: 'user@example.com',
      jti: 'jti-123',
    });
  });
});
