import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth';

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname.replace(/\/+$/, '') || '/';
  context.locals.user = null;

  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) return next();

  const user = await getSessionUser(context.cookies);
  context.locals.user = user;

  // Login
  if (path === '/admin') {
    return user ? context.redirect('/admin/resumen') : next();
  }

  if (!user) {
    return isAdminApi ? json(401, 'Sesión expirada. Vuelve a iniciar sesión.') : context.redirect('/admin');
  }

  // Secciones solo para administradores
  const adminOnly = path.startsWith('/admin/equipo') || path.startsWith('/api/admin/users');
  if (adminOnly && user.role !== 'admin') {
    return isAdminApi ? json(403, 'No tienes permiso para esta acción.') : context.redirect('/admin/resumen');
  }

  const response = await next();
  response.headers.set('cache-control', 'no-store');
  return response;
});
