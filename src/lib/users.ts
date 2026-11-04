import { all, batch, one, run } from './db';
import { hashPassword } from './password';
import { destroyUserSessions, type Role } from './auth';

export interface User {
  id: number;
  username: string;
  name: string;
  phone: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const map = (r: any): User => ({
  id: Number(r.id),
  username: String(r.username),
  name: String(r.name),
  phone: String(r.phone ?? ''),
  role: r.role as Role,
  active: !!Number(r.active),
  createdAt: String(r.created_at),
});

export async function listUsers(): Promise<User[]> {
  const rows = await all(
    `SELECT * FROM users ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name COLLATE NOCASE`,
  );
  return rows.map(map);
}

export async function getUser(id: number): Promise<User | null> {
  const r = await one('SELECT * FROM users WHERE id = ?', [id]);
  return r ? map(r) : null;
}

export interface UserInput {
  name: string;
  username: string;
  phone: string;
  password: string;
  active: boolean;
}

export function parseUserInput(body: any, requirePassword: boolean): { data?: UserInput; errors: string[] } {
  const errors: string[] = [];
  const data: UserInput = {
    name: String(body?.name ?? '').trim().slice(0, 80),
    username: String(body?.username ?? '').trim().toLowerCase().slice(0, 40),
    phone: String(body?.phone ?? '').trim().slice(0, 30),
    password: String(body?.password ?? ''),
    active: body?.active === undefined ? true : !!body.active,
  };
  if (!data.name) errors.push('El nombre es obligatorio.');
  if (!/^[a-z0-9._-]{3,40}$/.test(data.username))
    errors.push('El usuario debe tener al menos 3 caracteres (letras, números, punto, guion).');
  if (requirePassword || data.password) {
    if (data.password.length < 6) errors.push('La contraseña debe tener al menos 6 caracteres.');
  }
  return errors.length ? { errors } : { data, errors };
}

async function usernameTaken(username: string, exceptId = 0) {
  const r = await one('SELECT id FROM users WHERE username = ? AND id != ?', [username, exceptId]);
  return !!r;
}

export async function createSeller(d: UserInput): Promise<string | null> {
  if (await usernameTaken(d.username)) return 'Ese nombre de usuario ya existe.';
  await run(
    `INSERT INTO users (username, name, phone, password_hash, role, active) VALUES (?, ?, ?, ?, 'seller', ?)`,
    [d.username, d.name, d.phone, await hashPassword(d.password), d.active ? 1 : 0],
  );
  return null;
}

export async function updateUser(id: number, d: UserInput): Promise<string | null> {
  if (await usernameTaken(d.username, id)) return 'Ese nombre de usuario ya existe.';
  await run(`UPDATE users SET username = ?, name = ?, phone = ?, active = ? WHERE id = ?`, [
    d.username,
    d.name,
    d.phone,
    d.active ? 1 : 0,
    id,
  ]);
  if (d.password) await setPassword(id, d.password);
  if (!d.active) await destroyUserSessions(id);
  return null;
}

export async function setPassword(id: number, password: string) {
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(password), id]);
}

/**
 * Elimina un vendedor. Sus vehículos sin vender pasan al administrador que lo elimina
 * y sus ventas se conservan en los reportes (con su nombre).
 */
export async function deleteSeller(id: number, adminId: number) {
  await batch([
    { sql: 'UPDATE vehicles SET owner_id = ? WHERE owner_id = ?', args: [adminId, id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] },
    { sql: `DELETE FROM users WHERE id = ? AND role = 'seller'`, args: [id] },
  ]);
}
