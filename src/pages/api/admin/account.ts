import type { APIRoute } from 'astro';
import { login } from '../../../lib/auth';
import { setPassword } from '../../../lib/users';
import { fail, json, readJson } from '../../../lib/http';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readJson(request);
  const me = locals.user!;
  const current = String(body.current ?? '');
  const next = String(body.password ?? '');
  if (next.length < 6) return fail('La nueva contraseña debe tener al menos 6 caracteres.');
  if (!(await login(me.username, current))) return fail('La contraseña actual no es correcta.');
  await setPassword(me.id, next);
  return json({ ok: true });
};
