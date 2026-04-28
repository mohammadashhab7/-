import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let counters: Record<string, number> = {};

async function nextCounter(prefix: string, seedFromCol: string, table: string): Promise<number> {
  if (counters[prefix] !== undefined) {
    counters[prefix] += 1;
    return counters[prefix];
  }
  const result = await db.execute<{ max: string | null }>(
    sql.raw(
      `select max(cast(substring(${seedFromCol} from '[0-9]+$') as int)) as max from ${table} where ${seedFromCol} like '${prefix}-%'`,
    ),
  );
  const max = Number(result.rows[0]?.max ?? 0);
  counters[prefix] = max + 1;
  return counters[prefix];
}

function pad(n: number, width: number) {
  return n.toString().padStart(width, "0");
}

export async function nextOrderNumber(channel: "pos" | "online") {
  const prefix = channel === "pos" ? "POS" : "ONL";
  const year = new Date().getFullYear();
  const seq = await nextCounter(`${prefix}-${year}`, "order_number", "sales_orders");
  return `${prefix}-${year}-${pad(seq, 5)}`;
}

export async function nextProductionNumber() {
  const year = new Date().getFullYear();
  const seq = await nextCounter(`PRD-${year}`, "order_number", "production_orders");
  return `PRD-${year}-${pad(seq, 4)}`;
}

export async function nextTransferNumber() {
  const year = new Date().getFullYear();
  const seq = await nextCounter(`TRF-${year}`, "transfer_number", "transfers");
  return `TRF-${year}-${pad(seq, 4)}`;
}

export async function nextEmployeeNumber() {
  const seq = await nextCounter(`EMP`, "employee_number", "employees");
  return `EMP-${pad(seq, 4)}`;
}
