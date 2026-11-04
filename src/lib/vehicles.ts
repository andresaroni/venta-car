import { all, db, ensureDb, one, run } from './db';
import { deleteImage } from './storage';
import type { SessionUser } from './auth';

export type VehicleStatus = 'available' | 'sold';

export interface ExtraExpense {
  concept: string;
  amount: number;
}

export interface Costs {
  purchase: number;
  taxes: number;
  mechanical: number;
  parts: number;
  repair: number;
}

export interface Vehicle {
  id: number;
  ownerId: number;
  ownerName: string;
  make: string;
  model: string;
  version: string;
  year: number;
  mileage: number;
  color: string;
  vin: string;
  owners: number;
  purchasePlace: string;
  description: string;
  costs: Costs;
  extraExpenses: ExtraExpense[];
  /** GASTOS: suma de todos los costos registrados */
  totalExpenses: number;
  salePrice: number;
  profit: number;
  status: VehicleStatus;
  soldAt: string | null;
  createdAt: string;
  images: string[];
  sale?: { salePrice: number; profit: number; buyerName: string; soldAt: string };
}

export interface VehicleInput {
  make: string;
  model: string;
  version: string;
  year: number;
  mileage: number;
  color: string;
  vin: string;
  owners: number;
  purchasePlace: string;
  description: string;
  costs: Costs;
  extraExpenses: ExtraExpense[];
  salePrice: number;
  images: string[];
}

export const COST_LABELS: Record<keyof Costs, string> = {
  purchase: 'Precio de compra',
  taxes: 'Impuestos y trámites',
  mechanical: 'Mecánica',
  parts: 'Repuestos',
  repair: 'Reparaciones y estética',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumExpenses(costs: Costs, extra: ExtraExpense[]): number {
  const base = Object.values(costs).reduce((a, b) => a + (Number(b) || 0), 0);
  const more = extra.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  return round2(base + more);
}

export const vehicleLabel = (v: Pick<Vehicle, 'year' | 'make' | 'model' | 'version'>) =>
  [v.year, v.make, v.model, v.version].filter(Boolean).join(' ');

// ---------- validación ----------

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const validImageUrl = (u: string) => u.startsWith('/uploads/') || /^https:\/\/[^\s"'<>]+$/.test(u);

export function parseVehicleInput(body: any): { data?: VehicleInput; errors: string[] } {
  const errors: string[] = [];
  const currentYear = new Date().getFullYear();

  const data: VehicleInput = {
    make: str(body?.make, 60),
    model: str(body?.model, 80),
    version: str(body?.version, 80),
    year: Math.trunc(num(body?.year)),
    mileage: Math.max(0, Math.trunc(num(body?.mileage))),
    color: str(body?.color, 60),
    vin: str(body?.vin, 40).toUpperCase(),
    owners: Math.max(0, Math.trunc(num(body?.owners))),
    purchasePlace: str(body?.purchasePlace, 120),
    description: str(body?.description, 1500),
    costs: {
      purchase: round2(num(body?.costs?.purchase)),
      taxes: round2(num(body?.costs?.taxes)),
      mechanical: round2(num(body?.costs?.mechanical)),
      parts: round2(num(body?.costs?.parts)),
      repair: round2(num(body?.costs?.repair)),
    },
    extraExpenses: (Array.isArray(body?.extraExpenses) ? body.extraExpenses : [])
      .map((e: any) => ({ concept: str(e?.concept, 80), amount: round2(num(e?.amount)) }))
      .filter((e: ExtraExpense) => e.concept || e.amount)
      .slice(0, 30),
    salePrice: round2(num(body?.salePrice)),
    images: (Array.isArray(body?.images) ? body.images : [])
      .map((u: unknown) => str(u, 600))
      .filter(validImageUrl)
      .slice(0, 20),
  };

  if (!data.make) errors.push('La marca es obligatoria.');
  if (!data.model) errors.push('El modelo es obligatorio.');
  if (data.year < 1900 || data.year > currentYear + 1) errors.push('El año no es válido.');
  if (data.salePrice <= 0) errors.push('El precio de venta debe ser mayor a 0.');
  if (Object.values(data.costs).some((c) => c < 0) || data.extraExpenses.some((e) => e.amount < 0))
    errors.push('Los gastos no pueden ser negativos.');
  if (data.extraExpenses.some((e) => !e.concept)) errors.push('Cada gasto adicional necesita un concepto.');

  return errors.length ? { errors } : { data, errors };
}

// ---------- lectura ----------

function mapRow(r: any, images: string[]): Vehicle {
  const costs: Costs = {
    purchase: Number(r.cost_purchase),
    taxes: Number(r.cost_taxes),
    mechanical: Number(r.cost_mechanical),
    parts: Number(r.cost_parts),
    repair: Number(r.cost_repair),
  };
  let extraExpenses: ExtraExpense[] = [];
  try {
    extraExpenses = JSON.parse(String(r.extra_expenses || '[]'));
  } catch {}
  const totalExpenses = sumExpenses(costs, extraExpenses);
  const salePrice = Number(r.sale_price);
  const v: Vehicle = {
    id: Number(r.id),
    ownerId: Number(r.owner_id),
    ownerName: String(r.owner_name ?? '—'),
    make: String(r.make),
    model: String(r.model),
    version: String(r.version ?? ''),
    year: Number(r.year),
    mileage: Number(r.mileage),
    color: String(r.color ?? ''),
    vin: String(r.vin ?? ''),
    owners: Number(r.owners ?? 0),
    purchasePlace: String(r.purchase_place ?? ''),
    description: String(r.description ?? ''),
    costs,
    extraExpenses,
    totalExpenses,
    salePrice,
    profit: round2(salePrice - totalExpenses),
    status: r.status as VehicleStatus,
    soldAt: r.sold_at ? String(r.sold_at) : null,
    createdAt: String(r.created_at),
    images,
  };
  if (r.sale_sale_price != null) {
    v.sale = {
      salePrice: Number(r.sale_sale_price),
      profit: Number(r.sale_profit),
      buyerName: String(r.sale_buyer ?? ''),
      soldAt: String(r.sale_date),
    };
  }
  return v;
}

const SELECT = `
  SELECT v.*, u.name AS owner_name,
         s.sale_price AS sale_sale_price, s.profit AS sale_profit,
         s.buyer_name AS sale_buyer, s.sold_at AS sale_date
    FROM vehicles v
    LEFT JOIN users u ON u.id = v.owner_id
    LEFT JOIN sales s ON s.id = (SELECT id FROM sales WHERE vehicle_id = v.id ORDER BY id DESC LIMIT 1)`;

async function imagesFor(ids: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (!ids.length) return map;
  const rows = await all<any>(
    `SELECT vehicle_id, url FROM vehicle_images WHERE vehicle_id IN (${ids.map(() => '?').join(',')})
      ORDER BY position, id`,
    ids,
  );
  for (const r of rows) {
    const id = Number(r.vehicle_id);
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(String(r.url));
  }
  return map;
}

export async function listVehicles(opts: { ownerId?: number; status?: VehicleStatus } = {}) {
  const where: string[] = [];
  const args: any[] = [];
  if (opts.ownerId) {
    where.push('v.owner_id = ?');
    args.push(opts.ownerId);
  }
  if (opts.status) {
    where.push('v.status = ?');
    args.push(opts.status);
  }
  const rows = await all<any>(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY CASE v.status WHEN 'available' THEN 0 ELSE 1 END, v.created_at DESC, v.id DESC`,
    args,
  );
  const imgs = await imagesFor(rows.map((r) => Number(r.id)));
  return rows.map((r) => mapRow(r, imgs.get(Number(r.id)) ?? []));
}

export async function getVehicle(id: number): Promise<Vehicle | null> {
  const r = await one<any>(`${SELECT} WHERE v.id = ?`, [id]);
  if (!r) return null;
  const imgs = await imagesFor([id]);
  return mapRow(r, imgs.get(id) ?? []);
}

/** Vehículos disponibles (de todos los usuarios) para la página pública. */
export async function getPublicCars(): Promise<import('../data/cars').Car[]> {
  const list = await listVehicles({ status: 'available' });
  return list.map((v) => ({
    id: String(v.id),
    make: v.make,
    model: [v.model, v.version].filter(Boolean).join(' '),
    year: v.year,
    mileage: v.mileage,
    price: v.salePrice,
    color: v.color,
    vin: v.vin,
    status: 'available',
    description: v.description,
    images: v.images,
  }));
}

export const canManage =(user: SessionUser, v: Pick<Vehicle, 'ownerId'>) =>
  user.role === 'admin' || v.ownerId === user.id;

// ---------- escritura ----------

async function setImages(vehicleId: number, urls: string[]) {
  await db.batch(
    [
      { sql: 'DELETE FROM vehicle_images WHERE vehicle_id = ?', args: [vehicleId] },
      ...urls.map((url, i) => ({
        sql: 'INSERT INTO vehicle_images (vehicle_id, url, position) VALUES (?, ?, ?)',
        args: [vehicleId, url, i],
      })),
    ],
    'write',
  );
}

const vehicleArgs = (d: VehicleInput) => [
  d.make, d.model, d.version, d.year, d.mileage, d.color, d.vin, d.owners, d.purchasePlace,
  d.description, d.costs.purchase, d.costs.taxes, d.costs.mechanical, d.costs.parts, d.costs.repair,
  JSON.stringify(d.extraExpenses), d.salePrice,
];

export async function createVehicle(ownerId: number, d: VehicleInput): Promise<number> {
  const res = await run(
    `INSERT INTO vehicles (make, model, version, year, mileage, color, vin, owners, purchase_place,
        description, cost_purchase, cost_taxes, cost_mechanical, cost_parts, cost_repair,
        extra_expenses, sale_price, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...vehicleArgs(d), ownerId],
  );
  const id = Number(res.lastInsertRowid);
  await setImages(id, d.images);
  return id;
}

export async function updateVehicle(existing: Vehicle, d: VehicleInput) {
  await run(
    `UPDATE vehicles SET make = ?, model = ?, version = ?, year = ?, mileage = ?, color = ?, vin = ?,
        owners = ?, purchase_place = ?, description = ?, cost_purchase = ?, cost_taxes = ?,
        cost_mechanical = ?, cost_parts = ?, cost_repair = ?, extra_expenses = ?, sale_price = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [...vehicleArgs(d), existing.id],
  );
  await setImages(existing.id, d.images);
  const removed = existing.images.filter((u) => !d.images.includes(u));
  await Promise.all(removed.map(deleteImage));
}

/** Elimina el vehículo y sus fotos. Las ventas registradas se conservan para los reportes. */
export async function deleteVehicle(v: Vehicle) {
  await ensureDb();
  await db.batch(
    [
      { sql: 'DELETE FROM vehicle_images WHERE vehicle_id = ?', args: [v.id] },
      { sql: 'DELETE FROM vehicles WHERE id = ?', args: [v.id] },
    ],
    'write',
  );
  await Promise.all(v.images.map(deleteImage));
}

export interface SaleInput {
  salePrice: number;
  buyerName: string;
  buyerPhone: string;
  soldAt: string;
  notes: string;
}

export function parseSaleInput(body: any): { data?: SaleInput; errors: string[] } {
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const soldAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.soldAt ?? '')) ? String(body.soldAt) : today;
  const data: SaleInput = {
    salePrice: round2(num(body?.salePrice)),
    buyerName: str(body?.buyerName, 120),
    buyerPhone: str(body?.buyerPhone, 40),
    soldAt,
    notes: str(body?.notes, 500),
  };
  if (data.salePrice <= 0) errors.push('El precio final de venta debe ser mayor a 0.');
  if (!data.buyerName) errors.push('Indica el nombre del comprador.');
  return errors.length ? { errors } : { data, errors };
}

export async function sellVehicle(v: Vehicle, s: SaleInput, registeredBy: SessionUser) {
  await ensureDb();
  const profit = round2(s.salePrice - v.totalExpenses);
  await db.batch(
    [
      {
        sql: `INSERT INTO sales (vehicle_id, seller_id, registered_by, seller_name, vehicle_label, vin,
                buyer_name, buyer_phone, list_price, sale_price, total_expenses, profit, sold_at, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          v.id, v.ownerId, registeredBy.id, v.ownerName, vehicleLabel(v), v.vin, s.buyerName,
          s.buyerPhone, v.salePrice, s.salePrice, v.totalExpenses, profit, s.soldAt, s.notes,
        ],
      },
      {
        sql: `UPDATE vehicles SET status = 'sold', sold_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [s.soldAt, v.id],
      },
    ],
    'write',
  );
}
