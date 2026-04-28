import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  productionOrders,
  productionOrderItems,
  recipes,
  recipeItems,
  rawMaterials,
  products,
} from "@workspace/db";
import { requireStaff } from "../lib/auth";
import {
  applyLedgerEntry,
  getLocationByCode,
  getStockQuantity,
  InsufficientStockError,
} from "../lib/inventory";
import { nextProductionNumber } from "../lib/sequences";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

function serialize(o: typeof productionOrders.$inferSelect, productNameAr?: string) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    recipeId: o.recipeId,
    productId: o.productId,
    productNameAr: productNameAr ?? null,
    batchCount: o.batchCount,
    unitsProduced: o.unitsProduced,
    totalCostMinor: o.totalCostMinor,
    unitCostMinor: o.unitCostMinor,
    status: o.status,
    notesAr: o.notesAr,
    startedAt: o.startedAt?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

router.get("/production-orders", requireStaff(), async (req, res) => {
  const { status, limit } = req.query;
  const lim = Math.min(typeof limit === "string" ? parseInt(limit, 10) || 50 : 50, 200);
  const filters = [];
  if (typeof status === "string")
    filters.push(eq(productionOrders.status, status as typeof productionOrders.$inferSelect.status));
  const rows = await db
    .select({ o: productionOrders, name: products.nameAr })
    .from(productionOrders)
    .innerJoin(products, eq(productionOrders.productId, products.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(productionOrders.createdAt))
    .limit(lim);
  res.json(rows.map((r) => serialize(r.o, r.name)));
});

router.post("/production-orders", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.recipeId || typeof b.batchCount !== "number" || b.batchCount <= 0) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const r = await db.select().from(recipes).where(eq(recipes.id, b.recipeId)).limit(1);
  if (!r[0]) {
    res.status(404).json({ error: "RECIPE_NOT_FOUND" });
    return;
  }
  const recipe = r[0];
  const product = (
    await db.select().from(products).where(eq(products.id, recipe.productId)).limit(1)
  )[0]!;
  const items = await db
    .select({ it: recipeItems, mat: rawMaterials })
    .from(recipeItems)
    .innerJoin(rawMaterials, eq(recipeItems.materialId, rawMaterials.id))
    .where(eq(recipeItems.recipeId, recipe.id));

  const rawLoc = await getLocationByCode("PROD-RAW");
  const finishedLoc = await getLocationByCode("PROD-FIN");
  if (!rawLoc || !finishedLoc) {
    res.status(500).json({ error: "LOCATIONS_NOT_SEEDED" });
    return;
  }

  try {
    const finalOrder = await db.transaction(async (tx) => {
      // Pre-check raw material availability before any write
      for (const it of items) {
        const need = it.it.quantity * b.batchCount;
        const stock = await getStockQuantity(rawLoc.id, "raw_material", it.mat.id, tx);
        if (stock.quantity < need) {
          throw new InsufficientStockError(rawLoc.id, "raw_material", it.mat.id, stock.quantity, need);
        }
      }

      const orderNumber = await nextProductionNumber();
      const unitsProduced = recipe.yieldQuantity * b.batchCount;
      let totalCost = 0;

      const created = await tx
        .insert(productionOrders)
        .values({
          orderNumber,
          recipeId: recipe.id,
          productId: product.id,
          batchCount: b.batchCount,
          unitsProduced,
          totalCostMinor: 0,
          unitCostMinor: 0,
          status: "completed",
          notesAr: b.notesAr ?? null,
          startedAt: new Date(),
          completedAt: new Date(),
          createdByUserId: req.appUser?.id ?? null,
        })
        .returning();
      const order = created[0]!;

      for (const it of items) {
        const consumeQty = it.it.quantity * b.batchCount;
        const lineCost = Math.round((consumeQty * it.mat.unitCostMinor) / 1000);
        totalCost += lineCost;
        await tx.insert(productionOrderItems).values({
          productionOrderId: order.id,
          materialId: it.mat.id,
          quantityConsumed: consumeQty,
          unitCostMinor: it.mat.unitCostMinor,
          totalCostMinor: lineCost,
        });
        await applyLedgerEntry(
          {
            locationId: rawLoc.id,
            itemType: "raw_material",
            materialId: it.mat.id,
            quantityDelta: -consumeQty,
            unitCostMinor: it.mat.unitCostMinor,
            reason: "production_consume",
            referenceType: "production_order",
            referenceId: order.id,
            createdByUserId: req.appUser?.id ?? null,
          },
          tx,
        );
      }

      const unitCost = unitsProduced > 0 ? Math.round(totalCost / unitsProduced) : 0;

      await applyLedgerEntry(
        {
          locationId: finishedLoc.id,
          itemType: "product",
          productId: product.id,
          quantityDelta: unitsProduced,
          unitCostMinor: unitCost,
          reason: "production_output",
          referenceType: "production_order",
          referenceId: order.id,
          createdByUserId: req.appUser?.id ?? null,
        },
        tx,
      );

      const updated = await tx
        .update(productionOrders)
        .set({
          totalCostMinor: totalCost,
          unitCostMinor: unitCost,
          updatedAt: new Date(),
        })
        .where(eq(productionOrders.id, order.id))
        .returning();
      return { o: updated[0]!, totalCost, unitsProduced };
    });

    await logActivity({
      kind: "production_completed",
      titleAr: `إنتاج ${product.nameAr}`,
      descriptionAr: `${finalOrder.unitsProduced} وحدة بتكلفة ${finalOrder.totalCost} ل.س`,
      referenceType: "production_order",
      referenceId: finalOrder.o.id,
      actor: req.appUser,
    });

    res.status(201).json(serialize(finalOrder.o, product.nameAr));
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: "INSUFFICIENT_STOCK", detail: err.message });
      return;
    }
    req.log.error({ err }, "production create failed");
    res.status(500).json({ error: "INTERNAL" });
  }
});

router.get("/production-orders/:id", requireStaff(), async (req, res) => {
  const rows = await db
    .select({ o: productionOrders, name: products.nameAr })
    .from(productionOrders)
    .innerJoin(products, eq(productionOrders.productId, products.id))
    .where(eq(productionOrders.id, req.params.id))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const items = await db
    .select({ poi: productionOrderItems, mat: rawMaterials })
    .from(productionOrderItems)
    .innerJoin(rawMaterials, eq(productionOrderItems.materialId, rawMaterials.id))
    .where(eq(productionOrderItems.productionOrderId, req.params.id));
  res.json({
    ...serialize(rows[0].o, rows[0].name),
    items: items.map((x) => ({
      materialId: x.poi.materialId,
      materialNameAr: x.mat.nameAr,
      quantityConsumed: x.poi.quantityConsumed,
      unitCostMinor: x.poi.unitCostMinor,
      totalCostMinor: x.poi.totalCostMinor,
    })),
  });
});

export default router;
