import { and, eq, isNull } from "drizzle-orm";
import { db, stockLevels, inventoryLedger, inventoryLocations } from "@workspace/db";

export type LedgerInput = {
  locationId: string;
  itemType: "raw_material" | "product";
  materialId?: string | null;
  productId?: string | null;
  quantityDelta: number;
  unitCostMinor?: number;
  reason:
    | "purchase"
    | "production_consume"
    | "production_output"
    | "transfer_out"
    | "transfer_in"
    | "sale"
    | "adjustment"
    | "waste"
    | "return"
    | "opening";
  referenceType?: string | null;
  referenceId?: string | null;
  notesAr?: string | null;
  createdByUserId?: string | null;
  allowNegative?: boolean;
};

export class InsufficientStockError extends Error {
  constructor(
    public locationId: string,
    public itemType: "raw_material" | "product",
    public itemId: string,
    public available: number,
    public requested: number,
  ) {
    super(
      `INSUFFICIENT_STOCK: location=${locationId} ${itemType}=${itemId} available=${available} requested=${requested}`,
    );
    this.name = "InsufficientStockError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inventory model: event-sourced ledger with a transactional projection.
 *
 *   inventory_movements ── append-only event log (the source of truth).
 *   stock_levels        ── derived projection (current quantity + WAC) maintained
 *                          in the SAME transaction as the ledger insert below.
 *
 * Stock is therefore always equal to SUM(quantity_delta) over all movements for
 * a (location, item) tuple. The projection exists for read performance and
 * concurrency-safe stock checks; it is NEVER updated outside this function.
 * The /inventory/stock-from-ledger endpoint reconstructs stock from the ledger
 * to verify the invariant at any time.
 *
 * Rejects when the resulting quantity would be negative unless `allowNegative`
 * is true (used only for adjustments). Pass an outer `tx` to participate in a
 * larger transaction.
 */
export async function applyLedgerEntry(input: LedgerInput, tx?: Tx) {
  const exec = async (txx: Tx) => {
    const {
      locationId,
      itemType,
      materialId,
      productId,
      quantityDelta,
      unitCostMinor = 0,
      reason,
      referenceType,
      referenceId,
      notesAr,
      createdByUserId,
      allowNegative = false,
    } = input;

    const cond = and(
      eq(stockLevels.locationId, locationId),
      eq(stockLevels.itemType, itemType),
      materialId
        ? eq(stockLevels.materialId, materialId)
        : isNull(stockLevels.materialId),
      productId
        ? eq(stockLevels.productId, productId)
        : isNull(stockLevels.productId),
    );

    // Lock the row (or absence of row) for the rest of the transaction so
    // concurrent decrements cannot lose updates. Drizzle's .for("update")
    // emits SELECT ... FOR UPDATE; rows that don't yet exist are protected
    // by a transactional INSERT below — the unique index on
    // (location_id, item_type, material_id, product_id) makes the second
    // INSERT fail and forces a retry.
    const existing = await txx
      .select()
      .from(stockLevels)
      .where(cond)
      .limit(1)
      .for("update");

    if (existing.length === 0) {
      if (quantityDelta < 0 && !allowNegative) {
        throw new InsufficientStockError(
          locationId,
          itemType,
          (materialId ?? productId)!,
          0,
          -quantityDelta,
        );
      }
      await txx.insert(stockLevels).values({
        locationId,
        itemType,
        materialId: materialId ?? null,
        productId: productId ?? null,
        quantity: quantityDelta,
        avgCostMinor: unitCostMinor,
      });
    } else {
      const cur = existing[0]!;
      const oldQty = cur.quantity;
      const oldCost = cur.avgCostMinor;
      const newQty = oldQty + quantityDelta;
      if (newQty < 0 && !allowNegative) {
        throw new InsufficientStockError(
          locationId,
          itemType,
          (materialId ?? productId)!,
          oldQty,
          -quantityDelta,
        );
      }
      let newAvg = oldCost;
      if (quantityDelta > 0 && unitCostMinor > 0) {
        const oldValue = oldQty * oldCost;
        const newValue = quantityDelta * unitCostMinor;
        const totalQty = oldQty + quantityDelta;
        if (totalQty > 0) {
          newAvg = Math.round((oldValue + newValue) / totalQty);
        }
      }
      await txx
        .update(stockLevels)
        .set({ quantity: newQty, avgCostMinor: newAvg, updatedAt: new Date() })
        .where(cond);
    }

    const inserted = await txx
      .insert(inventoryLedger)
      .values({
        locationId,
        itemType,
        materialId: materialId ?? null,
        productId: productId ?? null,
        quantityDelta,
        unitCostMinor,
        reason,
        referenceType: referenceType ?? null,
        referenceId: referenceId ?? null,
        notesAr: notesAr ?? null,
        createdByUserId: createdByUserId ?? null,
      })
      .returning();
    return inserted[0]!;
  };

  if (tx) return await exec(tx);
  return await db.transaction(exec);
}

export async function getStockQuantity(
  locationId: string,
  itemType: "raw_material" | "product",
  itemId: string,
  tx?: Tx,
): Promise<{ quantity: number; avgCostMinor: number }> {
  const runner = tx ?? db;
  const rows = await runner
    .select()
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.locationId, locationId),
        eq(stockLevels.itemType, itemType),
        itemType === "raw_material"
          ? eq(stockLevels.materialId, itemId)
          : eq(stockLevels.productId, itemId),
      ),
    )
    .limit(1);
  if (!rows[0]) return { quantity: 0, avgCostMinor: 0 };
  return { quantity: rows[0].quantity, avgCostMinor: rows[0].avgCostMinor };
}

export async function getLocationByCode(code: string) {
  const rows = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.code, code))
    .limit(1);
  return rows[0] ?? null;
}
