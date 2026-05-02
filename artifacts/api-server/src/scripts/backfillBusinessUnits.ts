/**
 * Backfill script: create the 4 default business units (factory + 3 showrooms),
 * assign existing rows to the right unit, and create dedicated inventory
 * locations for showroom B and C if they do not already exist.
 *
 * Safe to run repeatedly: every step is idempotent.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/backfillBusinessUnits.ts
 */
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  db,
  businessUnits,
  inventoryLocations,
  financialEntries,
  employees,
  productionOrders,
  salesOrders,
  transfers,
  dailyClosings,
} from "@workspace/db";

const log = (...args: unknown[]) => console.log("[bu-backfill]", ...args);

type BusUnit = typeof businessUnits.$inferSelect;

async function ensureBusinessUnit(
  slug: string,
  kind: "factory" | "showroom",
  nameAr: string,
  nameEn: string,
  displayOrder: number,
): Promise<BusUnit> {
  const existing = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.slug, slug))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(businessUnits)
    .values({ slug, kind, nameAr, nameEn, displayOrder })
    .returning();
  log(`created business unit ${slug}`);
  return inserted[0]!;
}

async function ensureLocation(
  code: string,
  nameAr: string,
  kind: "store",
  businessUnitId: string,
) {
  const existing = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.code, code))
    .limit(1);
  if (existing[0]) {
    if (!existing[0].businessUnitId) {
      await db
        .update(inventoryLocations)
        .set({ businessUnitId })
        .where(eq(inventoryLocations.id, existing[0].id));
      log(`linked existing location ${code} to BU ${businessUnitId}`);
    }
    return existing[0];
  }
  const inserted = await db
    .insert(inventoryLocations)
    .values({ code, nameAr, kind, businessUnitId })
    .returning();
  log(`created location ${code}`);
  return inserted[0]!;
}

async function main() {
  log("starting backfill...");

  const factory = await ensureBusinessUnit("factory", "factory", "المعمل", "Factory", 10);
  const showroomA = await ensureBusinessUnit("showroom_a", "showroom", "معرض الميدان", "Showroom A", 20);
  const showroomB = await ensureBusinessUnit("showroom_b", "showroom", "معرض الإرسال", "Showroom B", 30);
  const showroomC = await ensureBusinessUnit("showroom_c", "showroom", "معرض البيرة", "Showroom C", 40);

  // Locations: PROD-RAW + PROD-FIN -> factory; STORE -> showroomA;
  // create STORE-B / STORE-C for the new showrooms.
  for (const code of ["PROD-RAW", "PROD-FIN"]) {
    const r = await db
      .update(inventoryLocations)
      .set({ businessUnitId: factory.id })
      .where(and(eq(inventoryLocations.code, code), isNull(inventoryLocations.businessUnitId)))
      .returning({ id: inventoryLocations.id });
    if (r.length) log(`linked ${code} to factory`);
  }
  await db
    .update(inventoryLocations)
    .set({ businessUnitId: showroomA.id })
    .where(and(eq(inventoryLocations.code, "STORE"), isNull(inventoryLocations.businessUnitId)));

  await ensureLocation("STORE-B", "مخزن معرض الإرسال", "store", showroomB.id);
  await ensureLocation("STORE-C", "مخزن معرض البيرة", "store", showroomC.id);

  // Financial entries: module='production' -> factory, module='store' -> showroomA.
  const finProd = await db
    .update(financialEntries)
    .set({ businessUnitId: factory.id })
    .where(and(eq(financialEntries.module, "production"), isNull(financialEntries.businessUnitId)))
    .returning({ id: financialEntries.id });
  log(`financial entries (production -> factory): ${finProd.length}`);
  const finStore = await db
    .update(financialEntries)
    .set({ businessUnitId: showroomA.id })
    .where(and(eq(financialEntries.module, "store"), isNull(financialEntries.businessUnitId)))
    .returning({ id: financialEntries.id });
  log(`financial entries (store -> showroom_a): ${finStore.length}`);

  // Production orders & transfers always belong to the factory in the legacy model.
  const po = await db
    .update(productionOrders)
    .set({ businessUnitId: factory.id })
    .where(isNull(productionOrders.businessUnitId))
    .returning({ id: productionOrders.id });
  log(`production orders -> factory: ${po.length}`);

  const tr = await db
    .update(transfers)
    .set({ businessUnitId: factory.id })
    .where(isNull(transfers.businessUnitId))
    .returning({ id: transfers.id });
  log(`transfers -> factory: ${tr.length}`);

  // Sales orders + daily closings always belonged to the legacy single store.
  const so = await db
    .update(salesOrders)
    .set({ businessUnitId: showroomA.id })
    .where(isNull(salesOrders.businessUnitId))
    .returning({ id: salesOrders.id });
  log(`sales orders -> showroom_a: ${so.length}`);

  const dc = await db
    .update(dailyClosings)
    .set({ businessUnitId: showroomA.id })
    .where(isNull(dailyClosings.businessUnitId))
    .returning({ id: dailyClosings.id });
  log(`daily closings -> showroom_a: ${dc.length}`);

  // Employees: department-based mapping.
  const empProd = await db
    .update(employees)
    .set({ businessUnitId: factory.id })
    .where(and(eq(employees.department, "production"), isNull(employees.businessUnitId)))
    .returning({ id: employees.id });
  log(`employees (production -> factory): ${empProd.length}`);
  const empStore = await db
    .update(employees)
    .set({ businessUnitId: showroomA.id })
    .where(
      and(
        sql`${employees.department} in ('store','delivery')`,
        isNull(employees.businessUnitId),
      ),
    )
    .returning({ id: employees.id });
  log(`employees (store/delivery -> showroom_a): ${empStore.length}`);
  // 'admin' department deliberately left null (cross-cutting).

  log("backfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bu-backfill] failed:", err);
  process.exit(1);
});
