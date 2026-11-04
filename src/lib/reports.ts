import { all, one } from './db';

export type Period = 'all' | '30d' | 'month' | 'year';

export const PERIOD_LABELS: Record<Period, string> = {
  all: 'Todo el tiempo',
  '30d': 'Últimos 30 días',
  month: 'Este mes',
  year: 'Este año',
};

export const parsePeriod = (v: string | null): Period =>
  v && v in PERIOD_LABELS ? (v as Period) : 'all';

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Range {
  from: string | null;
  to: string | null; // exclusivo
}

function ranges(period: Period, now = new Date()): { current: Range; previous: Range | null } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const tomorrow = iso(new Date(Date.UTC(y, m, now.getUTCDate() + 1)));
  switch (period) {
    case '30d': {
      const from = new Date(Date.UTC(y, m, now.getUTCDate() - 29));
      const prevFrom = new Date(Date.UTC(y, m, now.getUTCDate() - 59));
      return { current: { from: iso(from), to: tomorrow }, previous: { from: iso(prevFrom), to: iso(from) } };
    }
    case 'month': {
      const from = iso(new Date(Date.UTC(y, m, 1)));
      const prevFrom = iso(new Date(Date.UTC(y, m - 1, 1)));
      return { current: { from, to: tomorrow }, previous: { from: prevFrom, to: from } };
    }
    case 'year': {
      const from = `${y}-01-01`;
      return { current: { from, to: tomorrow }, previous: { from: `${y - 1}-01-01`, to: from } };
    }
    default:
      return { current: { from: null, to: null }, previous: null };
  }
}

function whereFor(range: Range, sellerId?: number) {
  const where: string[] = [];
  const args: any[] = [];
  if (range.from) {
    where.push('sold_at >= ?');
    args.push(range.from);
  }
  if (range.to) {
    where.push('sold_at < ?');
    args.push(range.to);
  }
  if (sellerId) {
    where.push('seller_id = ?');
    args.push(sellerId);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

export interface Totals {
  units: number;
  gross: number;
  expenses: number;
  profit: number;
}

async function totals(range: Range, sellerId?: number): Promise<Totals> {
  const w = whereFor(range, sellerId);
  const r = await one<any>(
    `SELECT COUNT(*) AS units, COALESCE(SUM(sale_price), 0) AS gross,
            COALESCE(SUM(total_expenses), 0) AS expenses, COALESCE(SUM(profit), 0) AS profit
       FROM sales ${w.sql}`,
    w.args,
  );
  return {
    units: Number(r?.units ?? 0),
    gross: Number(r?.gross ?? 0),
    expenses: Number(r?.expenses ?? 0),
    profit: Number(r?.profit ?? 0),
  };
}

export interface Sale {
  id: number;
  vehicleId: number | null;
  sellerId: number | null;
  sellerName: string;
  vehicleLabel: string;
  vin: string;
  buyerName: string;
  buyerPhone: string;
  listPrice: number;
  salePrice: number;
  totalExpenses: number;
  profit: number;
  soldAt: string;
}

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string;
  gross: number;
  profit: number;
  units: number;
}

export interface SellerStat {
  id: number | null;
  name: string;
  units: number;
  gross: number;
  profit: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function getReport(opts: { period: Period; sellerId?: number; ownerScope?: number }) {
  const { current, previous } = ranges(opts.period);
  // ownerScope: un vendedor solo ve lo suyo. sellerId: filtro del admin.
  const seller = opts.ownerScope ?? opts.sellerId;

  const [now, prev] = await Promise.all([
    totals(current, seller),
    previous ? totals(previous, seller) : Promise.resolve(null),
  ]);

  // Inventario disponible (no depende del periodo)
  const stockArgs: any[] = [];
  let stockWhere = `WHERE status = 'available'`;
  if (seller) {
    stockWhere += ' AND owner_id = ?';
    stockArgs.push(seller);
  }
  const stockRows = await all<any>(
    `SELECT cost_purchase + cost_taxes + cost_mechanical + cost_parts + cost_repair AS base,
            extra_expenses, sale_price
       FROM vehicles ${stockWhere}`,
    stockArgs,
  );
  let stockExpenses = 0;
  let stockValue = 0;
  for (const r of stockRows) {
    let extra = 0;
    try {
      extra = (JSON.parse(String(r.extra_expenses || '[]')) as { amount: number }[]).reduce(
        (a, e) => a + (Number(e.amount) || 0),
        0,
      );
    } catch {}
    stockExpenses += Number(r.base) + extra;
    stockValue += Number(r.sale_price);
  }
  const stock = {
    count: stockRows.length,
    expenses: stockExpenses,
    value: stockValue,
    projectedProfit: stockValue - stockExpenses,
  };

  // Tendencia: últimos 12 meses
  const today = new Date();
  const months: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push({
      key: d.toISOString().slice(0, 7),
      label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      gross: 0,
      profit: 0,
      units: 0,
    });
  }
  const trendW = whereFor({ from: `${months[0].key}-01`, to: null }, seller);
  const trendRows = await all<any>(
    `SELECT substr(sold_at, 1, 7) AS ym, COUNT(*) AS units, SUM(sale_price) AS gross, SUM(profit) AS profit
       FROM sales ${trendW.sql} GROUP BY ym`,
    trendW.args,
  );
  for (const r of trendRows) {
    const p = months.find((m) => m.key === r.ym);
    if (p) {
      p.units = Number(r.units);
      p.gross = Number(r.gross);
      p.profit = Number(r.profit);
    }
  }

  // Ranking de vendedores (incluye usuarios activos sin ventas)
  const w = whereFor(current);
  const sellerRows = await all<any>(
    `SELECT seller_id, seller_name, COUNT(*) AS units, SUM(sale_price) AS gross, SUM(profit) AS profit
       FROM sales ${w.sql} GROUP BY seller_id, seller_name`,
    w.args,
  );
  const users = await all<any>('SELECT id, name FROM users WHERE active = 1');
  const sellers: SellerStat[] = sellerRows.map((r) => ({
    id: r.seller_id == null ? null : Number(r.seller_id),
    name: String(users.find((u) => Number(u.id) === Number(r.seller_id))?.name ?? r.seller_name),
    units: Number(r.units),
    gross: Number(r.gross),
    profit: Number(r.profit),
  }));
  for (const u of users) {
    if (!sellers.some((s) => s.id === Number(u.id)))
      sellers.push({ id: Number(u.id), name: String(u.name), units: 0, gross: 0, profit: 0 });
  }
  sellers.sort((a, b) => b.units - a.units || b.profit - a.profit);

  // Libro de ventas
  const lw = whereFor(current, seller);
  const ledger = (
    await all<any>(`SELECT * FROM sales ${lw.sql} ORDER BY sold_at DESC, id DESC`, lw.args)
  ).map(
    (r): Sale => ({
      id: Number(r.id),
      vehicleId: r.vehicle_id == null ? null : Number(r.vehicle_id),
      sellerId: r.seller_id == null ? null : Number(r.seller_id),
      sellerName: String(r.seller_name),
      vehicleLabel: String(r.vehicle_label),
      vin: String(r.vin ?? ''),
      buyerName: String(r.buyer_name ?? ''),
      buyerPhone: String(r.buyer_phone ?? ''),
      listPrice: Number(r.list_price),
      salePrice: Number(r.sale_price),
      totalExpenses: Number(r.total_expenses),
      profit: Number(r.profit),
      soldAt: String(r.sold_at),
    }),
  );

  return { totals: now, previous: prev, stock, months, sellers, ledger };
}

/** Estadísticas por usuario para la página de equipo (histórico completo). */
export async function statsByUser(): Promise<Map<number, Totals & { available: number }>> {
  const rows = await all<any>(
    `SELECT seller_id, COUNT(*) AS units, SUM(sale_price) AS gross, SUM(total_expenses) AS expenses,
            SUM(profit) AS profit
       FROM sales WHERE seller_id IS NOT NULL GROUP BY seller_id`,
  );
  const stock = await all<any>(
    `SELECT owner_id, COUNT(*) AS n FROM vehicles WHERE status = 'available' GROUP BY owner_id`,
  );
  const map = new Map<number, Totals & { available: number }>();
  for (const r of rows)
    map.set(Number(r.seller_id), {
      units: Number(r.units),
      gross: Number(r.gross),
      expenses: Number(r.expenses),
      profit: Number(r.profit),
      available: 0,
    });
  for (const r of stock) {
    const id = Number(r.owner_id);
    const cur = map.get(id) ?? { units: 0, gross: 0, expenses: 0, profit: 0, available: 0 };
    cur.available = Number(r.n);
    map.set(id, cur);
  }
  return map;
}
