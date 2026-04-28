import { Router, type IRouter } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  recipes,
  recipeItems,
  rawMaterials,
  products,
} from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

async function recomputeUnitCost(recipeId: string): Promise<number> {
  const items = await db
    .select({
      qty: recipeItems.quantity,
      cost: rawMaterials.unitCostMinor,
    })
    .from(recipeItems)
    .innerJoin(rawMaterials, eq(recipeItems.materialId, rawMaterials.id))
    .where(eq(recipeItems.recipeId, recipeId));
  const r = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  const yieldQty = r[0]?.yieldQuantity || 1;
  // quantity is stored in thousandths of a unit (e.g. kg ×1000 → grams)
  const totalCost = items.reduce(
    (sum, it) => sum + Math.round((it.qty * it.cost) / 1000),
    0,
  );
  const unit = Math.round(totalCost / yieldQty);
  await db
    .update(recipes)
    .set({ unitCostMinor: unit, updatedAt: new Date() })
    .where(eq(recipes.id, recipeId));
  return unit;
}

async function loadFull(recipeId: string) {
  const r = await db
    .select({
      r: recipes,
      productNameAr: products.nameAr,
    })
    .from(recipes)
    .innerJoin(products, eq(recipes.productId, products.id))
    .where(eq(recipes.id, recipeId))
    .limit(1);
  if (!r[0]) return null;
  const items = await db
    .select({
      it: recipeItems,
      mat: rawMaterials,
    })
    .from(recipeItems)
    .innerJoin(rawMaterials, eq(recipeItems.materialId, rawMaterials.id))
    .where(eq(recipeItems.recipeId, recipeId));
  return {
    id: r[0].r.id,
    productId: r[0].r.productId,
    productNameAr: r[0].productNameAr,
    yieldQuantity: r[0].r.yieldQuantity,
    unitCostMinor: r[0].r.unitCostMinor,
    notesAr: r[0].r.notesAr,
    isActive: r[0].r.isActive,
    items: items.map((x) => ({
      materialId: x.it.materialId,
      materialNameAr: x.mat.nameAr,
      quantity: x.it.quantity,
      unit: x.it.unit,
    })),
  };
}

router.get("/recipes", requireStaff(), async (_req, res) => {
  const rows = await db
    .select({
      r: recipes,
      productNameAr: products.nameAr,
    })
    .from(recipes)
    .innerJoin(products, eq(recipes.productId, products.id))
    .orderBy(asc(products.nameAr));
  res.json(
    rows.map((x) => ({
      id: x.r.id,
      productId: x.r.productId,
      productNameAr: x.productNameAr,
      yieldQuantity: x.r.yieldQuantity,
      unitCostMinor: x.r.unitCostMinor,
      notesAr: x.r.notesAr,
      isActive: x.r.isActive,
    })),
  );
});

router.post("/recipes", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.productId || !Array.isArray(b.items) || b.items.length === 0) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const created = await db
    .insert(recipes)
    .values({
      productId: b.productId,
      yieldQuantity: typeof b.yieldQuantity === "number" ? b.yieldQuantity : 1,
      notesAr: b.notesAr ?? null,
      isActive: typeof b.isActive === "boolean" ? b.isActive : true,
    })
    .returning();
  const recipe = created[0]!;
  await db.insert(recipeItems).values(
    b.items.map((it: { materialId: string; quantity: number; unit?: string }) => ({
      recipeId: recipe.id,
      materialId: it.materialId,
      quantity: it.quantity,
      unit: it.unit || "g",
    })),
  );
  await recomputeUnitCost(recipe.id);
  const full = await loadFull(recipe.id);
  res.status(201).json(full);
});

router.get("/recipes/:id", requireStaff(), async (req, res) => {
  const f = await loadFull(req.params.id);
  if (!f) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(f);
});

router.patch("/recipes/:id", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  const updates: Partial<typeof recipes.$inferInsert> = { updatedAt: new Date() };
  if (b.yieldQuantity !== undefined) updates.yieldQuantity = b.yieldQuantity;
  if (b.notesAr !== undefined) updates.notesAr = b.notesAr;
  if (b.isActive !== undefined) updates.isActive = b.isActive;
  await db.update(recipes).set(updates).where(eq(recipes.id, req.params.id));

  if (Array.isArray(b.items)) {
    await db.delete(recipeItems).where(eq(recipeItems.recipeId, req.params.id));
    if (b.items.length) {
      await db.insert(recipeItems).values(
        b.items.map((it: { materialId: string; quantity: number; unit?: string }) => ({
          recipeId: req.params.id,
          materialId: it.materialId,
          quantity: it.quantity,
          unit: it.unit || "g",
        })),
      );
    }
  }
  await recomputeUnitCost(req.params.id);
  const full = await loadFull(req.params.id);
  res.json(full);
});

router.delete("/recipes/:id", requireStaff(), async (req, res) => {
  await db.delete(recipes).where(eq(recipes.id, req.params.id));
  res.status(204).send();
});

export default router;
