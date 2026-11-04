import type { AstroCookies } from 'astro';
import { all, one, run } from './db';
import { verifyPassword } from './password';

export type Role = 'admin' | 'seller';

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE = 'velocita_session';
const SESSION_DAYS = 14;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function login(username: string, password: string): Promise<SessionUser | null> {
  const row = await one<{
    id: number;
    username: string;
    name: string;
    role: Role;
    password_hash: string;
    active: number;
  }>('SELECT id, username, name, role, password_hash, active FROM users WHERE username = ?', [
    username.trim(),
  ]);
  if (!row || !row.active) return null;
  if (!(await verifyPassword(password, String(row.password_hash)))) return null;
  return { id: Number(row.id), username: String(row.username), name: String(row.name), role: row.role };
}

export async function createSession(userId: number, cookies: AstroCookies, secure: boolean) {
  const token = randomToken();
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [
    await sha256(token),
    userId,
    expires,
  ]);
  // Limpieza ocasional de sesiones vencidas
  await run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expires),
  });
}

export async function getSessionUser(cookies: AstroCookies): Promise<SessionUser | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await all<{ id: number; username: string; name: string; role: Role; expires_at: number }>(
    `SELECT u.id, u.username, u.name, u.role, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND u.active = 1`,
    [await sha256(token)],
  );
  const row = rows[0];
  if (!row || Number(row.expires_at) < Date.now()) return null;
  return { id: Number(row.id), username: String(row.username), name: String(row.name), role: row.role };
}

export async function destroySession(cookies: AstroCookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await run('DELETE FROM sessions WHERE id = ?', [await sha256(token)]);
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function destroyUserSessions(userId: number) {
  await run('DELETE FROM sessions WHERE user_id = ?', [userId]);
}
