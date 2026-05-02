import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const seeded = new Set<string>();

async function seedFromExisting(
  prefix: string,
  seedFromCol: string,
  table: string,
): Promise<void> {
  if (seeded.has(prefix)) return;
  const result = await db.execute<{ max: string | null }>(
    sql.raw(
      `select max(cast(substring(${seedFromCol} from '[0-9]+$') as int)) as max from ${table} where ${seedFromCol} like '${prefix}-%'`,
    ),
  );
  const max = Number(result.rows[0]?.max ?? 0);
  if (max > 0) {
    await db.execute(sql`
      insert into id_counters (prefix, value) values (${prefix}, ${max})
      on conflict (prefix) do update set value = greatest(id_counters.value, excluded.value)
    `);
  }
  seeded.add(prefix);
}

async function nextCounter(
  prefix: string,
  seedFromCol: string,
  table: string,
): Promise<number> {
  await seedFromExisting(prefix, seedFromCol, table);
  const r = await db.execute<{ value: number }>(sql`
    insert into id_counters (prefix, value) values (${prefix}, 1)
    on conflict (prefix) do update set value = id_counters.value + 1
    returning value
  `);
  const v = Number(r.rows[0]?.value);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`Sequence ${prefix} returned invalid value`);
  }
  return v;
}

function pad(n: number, width: number) {
  return n.toString().padStart(width, "0");
}

export async function nextOrderNumber(channel: "pos" | "online") {
  const prefix = channel === "pos" ? "POS" : "ONL";
  const year = new Date().getFullYear();
  const seq = await nextCounter(
    `${prefix}-${year}`,
    "order_number",
    "sales_orders",
  );
  return `${prefix}-${year}-${pad(seq, 5)}`;
}

export async function nextProductionNumber() {
  const year = new Date().getFullYear();
  const seq = await nextCounter(
    `PRD-${year}`,
    "order_number",
    "production_orders",
  );
  return `PRD-${year}-${pad(seq, 4)}`;
}

export async function nextTransferNumber() {
  const year = new Date().getFullYear();
  const seq = await nextCounter(
    `TRF-${year}`,
    "transfer_number",
    "transfers",
  );
  return `TRF-${year}-${pad(seq, 4)}`;
}

export async function nextWholesaleNumber() {
  const year = new Date().getFullYear();
  const seq = await nextCounter(
    `WH-${year}`,
    "order_number",
    "wholesale_orders",
  );
  return `WH-${year}-${pad(seq, 4)}`;
}

export async function nextEmployeeNumber() {
  const seq = await nextCounter(`EMP`, "employee_number", "employees");
  return `EMP-${pad(seq, 4)}`;
}
