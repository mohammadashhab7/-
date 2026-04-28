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
};

/**
 * Append-only ledger entry + atomic stock_levels update with weighted-average cost.
 */
export async function applyLedgerEntry(input: LedgerInput) {
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
  } = input;

  return await db.transaction(async (tx) => {
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

    const existing = await tx
      .select()
      .from(stockLevels)
      .where(cond)
      .limit(1);

    if (existing.length === 0) {
      await tx.insert(stockLevels).values({
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
      let newAvg = oldCost;
      if (quantityDelta > 0 && unitCostMinor > 0) {
        const oldValue = oldQty * oldCost;
        const newValue = quantityDelta * unitCostMinor;
        const totalQty = oldQty + quantityDelta;
        if (totalQty > 0) {
          newAvg = Math.round((oldValue + newValue) / totalQty);
        }
      }
      if (newQty < 0) {
        // Allow negative for now (warn via logs); production should enforce check separately
      }
      await tx
        .update(stockLevels)
        .set({ quantity: newQty, avgCostMinor: newAvg, updatedAt: new Date() })
        .where(cond);
    }

    const inserted = await tx
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
  });
}

export async function getStockQuantity(
  locationId: string,
  itemType: "raw_material" | "product",
  itemId: string,
): Promise<{ quantity: number; avgCostMinor: number }> {
  const rows = await db
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
