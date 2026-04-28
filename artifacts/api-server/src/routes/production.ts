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
  inventoryLocations,
} from "@workspace/db";
import { requireStaff } from "../lib/auth";
import { applyLedgerEntry, getLocationByCode } from "../lib/inventory";
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

  const orderNumber = await nextProductionNumber();
  const unitsProduced = recipe.yieldQuantity * b.batchCount;
  let totalCost = 0;

  const created = await db
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
    await db.insert(productionOrderItems).values({
      productionOrderId: order.id,
      materialId: it.mat.id,
      quantityConsumed: consumeQty,
      unitCostMinor: it.mat.unitCostMinor,
      totalCostMinor: lineCost,
    });
    await applyLedgerEntry({
      locationId: rawLoc.id,
      itemType: "raw_material",
      materialId: it.mat.id,
      quantityDelta: -consumeQty,
      unitCostMinor: it.mat.unitCostMinor,
      reason: "production_consume",
      referenceType: "production_order",
      referenceId: order.id,
      createdByUserId: req.appUser?.id ?? null,
    });
  }

  const unitCost = unitsProduced > 0 ? Math.round(totalCost / unitsProduced) : 0;

  await applyLedgerEntry({
    locationId: finishedLoc.id,
    itemType: "product",
    productId: product.id,
    quantityDelta: unitsProduced,
    unitCostMinor: unitCost,
    reason: "production_output",
    referenceType: "production_order",
    referenceId: order.id,
    createdByUserId: req.appUser?.id ?? null,
  });

  const updated = await db
    .update(productionOrders)
    .set({
      totalCostMinor: totalCost,
      unitCostMinor: unitCost,
      updatedAt: new Date(),
    })
    .where(eq(productionOrders.id, order.id))
    .returning();

  await logActivity({
    kind: "production_completed",
    titleAr: `إنتاج ${product.nameAr}`,
    descriptionAr: `${unitsProduced} وحدة بتكلفة ${totalCost} ل.س`,
    referenceType: "production_order",
    referenceId: order.id,
    actor: req.appUser,
  });

  res.status(201).json(serialize(updated[0]!, product.nameAr));
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
