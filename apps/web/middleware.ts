import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Rutas excluidas del i18n: /api (health, etc.), internals de Next y archivos estáticos.
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
