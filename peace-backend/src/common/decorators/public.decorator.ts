import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marks a route as public (no auth) — used for free browsing.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
