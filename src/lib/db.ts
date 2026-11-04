// Conexión a la base de datos (libSQL).
// - Local: archivo .data/velocita.db (no requiere configuración).
// - Producción: Turso (DATABASE_URL=libsql://... + DATABASE_AUTH_TOKEN).
import { createClient, type Client, type InArgs, type Row } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { hashPassword } from './password';
import { demoVehicles } from './seed';

const url = process.env.DATABASE_URL || 'file:.data/velocita.db';

if (url.startsWith('file:')) {
  if (process.env.VERCEL) {
    throw new Error(
      'Falta DATABASE_URL: en Vercel la base de datos debe ser Turso (libsql://...). Revisa el README.',
    );
  }
  mkdirSync('.data', { recursive: true });
}

export const db: Client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '',
  vin TEXT NOT NULL DEFAULT '',
  owners INTEGER NOT NULL DEFAULT 0,
  purchase_place TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cost_purchase REAL NOT NULL DEFAULT 0,
  cost_taxes REAL NOT NULL DEFAULT 0,
  cost_mechanical REAL NOT NULL DEFAULT 0,
  cost_parts REAL NOT NULL DEFAULT 0,
  cost_repair REAL NOT NULL DEFAULT 0,
  extra_expenses TEXT NOT NULL DEFAULT '[]',
  sale_price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  sold_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

CREATE TABLE IF NOT EXISTS vehicle_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_images_vehicle ON vehicle_images(vehicle_id);

-- Las ventas guardan una "foto" de los datos (vehículo, vendedor, gastos) para que
-- el historial se mantenga aunque luego se elimine el vehículo o el vendedor.
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER,
  seller_id INTEGER,
  registered_by INTEGER,
  seller_name TEXT NOT NULL,
  vehicle_label TEXT NOT NULL,
  vin TEXT NOT NULL DEFAULT '',
  buyer_name TEXT NOT NULL DEFAULT '',
  buyer_phone TEXT NOT NULL DEFAULT '',
  list_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL,
  total_expenses REAL NOT NULL,
  profit REAL NOT NULL,
  sold_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sold_at);
`;

let ready: Promise<void> | null = null;

/** Crea las tablas y el primer administrador (una sola vez por proceso). */
export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = init().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

async function init() {
  await db.executeMultiple(SCHEMA);

  const { rows } = await db.execute('SELECT COUNT(*) AS n FROM users');
  if (Number(rows[0].n) > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Administrador';
  const res = await db.execute({
    sql: `INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, 'admin')`,
    args: [username, name, await hashPassword(password)],
  });
  const adminId = Number(res.lastInsertRowid);

  if ((process.env.SEED_DEMO ?? 'true') !== 'false') {
    for (const v of demoVehicles) {
      const r = await db.execute({
        sql: `INSERT INTO vehicles (owner_id, make, model, version, year, mileage, color, vin, owners,
                purchase_place, description, cost_purchase, cost_taxes, cost_mechanical, cost_parts,
                cost_repair, sale_price)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          adminId, v.make, v.model, v.version, v.year, v.mileage, v.color, v.vin, v.owners,
          v.purchasePlace, v.description, v.costs.purchase, v.costs.taxes, v.costs.mechanical,
          v.costs.parts, v.costs.repair, v.salePrice,
        ],
      });
      const vehicleId = Number(r.lastInsertRowid);
      await db.batch(
        v.images.map((url, i) => ({
          sql: 'INSERT INTO vehicle_images (vehicle_id, url, position) VALUES (?, ?, ?)',
          args: [vehicleId, url, i],
        })),
        'write',
      );
    }
  }
}

// ---------- helpers ----------

export async function all<T = Row>(sql: string, args: InArgs = []): Promise<T[]> {
  await ensureDb();
  const { rows } = await db.execute({ sql, args });
  return rows as unknown as T[];
}

export async function one<T = Row>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: InArgs = []) {
  await ensureDb();
  return db.execute({ sql, args });
}
