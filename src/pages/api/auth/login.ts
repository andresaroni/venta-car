import type { APIRoute } from 'astro';
import { createSession, login } from '../../../lib/auth';
import { fail, json, readJson } from '../../../lib/http';

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const body = await readJson(request);
  const user = await login(String(body.username ?? ''), String(body.password ?? ''));
  if (!user) return fail('Usuario o contraseña incorrectos.', 401);
  await createSession(user.id, cookies, url.protocol === 'https:');
  return json({ ok: true });
};
