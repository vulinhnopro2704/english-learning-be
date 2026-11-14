import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to bypass global JWT authentication for public endpoints.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
