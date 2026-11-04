// Base de datos: Cloudflare D1 (binding "DB" en wrangler.jsonc).
// En local, `pnpm dev` usa una copia de D1 guardada en .wrangler/state.
import { env } from 'cloudflare:workers';
import { hashPassword } from './password';
import { demoVehicles } from './seed';

type Args = unknown[];
export interface Statement {
  sql: string;
  args?: Args;
}

const d1 = (): D1Database => env.DB;

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
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sold_at)
`;
// Nota: las ventas guardan una copia de los datos (vehículo, vendedor, gastos) para que
// el historial se mantenga aunque luego se elimine el vehículo o el vendedor.

const prepare = (s: Statement) => d1().prepare(s.sql).bind(...(s.args ?? []).map((a) => (a === undefined ? null : a)));

// En Workers no se puede compartir una promesa de I/O entre peticiones, así que solo
// se recuerda que ya se inicializó. La inicialización es idempotente.
let initialized = false;

/** Crea las tablas y el primer administrador (una vez por instancia del Worker). */
export async function ensureDb(): Promise<void> {
  if (initialized) return;
  await init();
  initialized = true;
}

async function init() {
  const statements = SCHEMA.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  await d1().batch(statements.map((sql) => d1().prepare(sql)));

  const row = await d1().prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  if (Number(row?.n ?? 0) > 0) return;

  const vars = env as unknown as Record<string, string | undefined>;
  // OR IGNORE: si dos peticiones arrancan a la vez, solo una crea el admin y los demos.
  const res = await d1()
    .prepare(`INSERT OR IGNORE INTO users (username, name, password_hash, role) VALUES (?, ?, ?, 'admin')`)
    .bind(
      vars.ADMIN_USERNAME || 'admin',
      vars.ADMIN_NAME || 'Administrador',
      await hashPassword(vars.ADMIN_PASSWORD || 'admin123'),
    )
    .run();
  if (!Number(res.meta.changes)) return;
  const adminId = Number(res.meta.last_row_id);

  if ((vars.SEED_DEMO ?? 'true') !== 'false') {
    for (const v of demoVehicles) {
      const r = await d1()
        .prepare(
          `INSERT INTO vehicles (owner_id, make, model, version, year, mileage, color, vin, owners,
              purchase_place, description, cost_purchase, cost_taxes, cost_mechanical, cost_parts,
              cost_repair, sale_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          adminId, v.make, v.model, v.version, v.year, v.mileage, v.color, v.vin, v.owners,
          v.purchasePlace, v.description, v.costs.purchase, v.costs.taxes, v.costs.mechanical,
          v.costs.parts, v.costs.repair, v.salePrice,
        )
        .run();
      const vehicleId = Number(r.meta.last_row_id);
      // Ojo: aquí no se usa batch(), porque llamaría a ensureDb() durante la propia inicialización
      await d1().batch(
        v.images.map((url, i) =>
          prepare({
            sql: 'INSERT INTO vehicle_images (vehicle_id, url, position) VALUES (?, ?, ?)',
            args: [vehicleId, url, i],
          }),
        ),
      );
    }
  }
}

// ---------- helpers ----------

export async function all<T = Record<string, unknown>>(sql: string, args: Args = []): Promise<T[]> {
  await ensureDb();
  const { results } = await prepare({ sql, args }).all<T>();
  return results;
}

export async function one<T = Record<string, unknown>>(sql: string, args: Args = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: Args = []) {
  await ensureDb();
  const res = await prepare({ sql, args }).run();
  return { lastInsertRowid: Number(res.meta.last_row_id), changes: Number(res.meta.changes) };
}

/** Ejecuta varias sentencias en una sola transacción. */
export async function batch(statements: Statement[]) {
  if (!statements.length) return;
  await ensureDb();
  await d1().batch(statements.map(prepare));
}
