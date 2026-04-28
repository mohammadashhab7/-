import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, rawMaterials } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

function serialize(m: typeof rawMaterials.$inferSelect) {
  return {
    id: m.id,
    sku: m.sku,
    nameAr: m.nameAr,
    nameEn: m.nameEn,
    unit: m.unit,
    unitCostMinor: m.unitCostMinor,
    currency: m.currency,
    reorderThreshold: m.reorderThreshold,
    supplierAr: m.supplierAr,
    notesAr: m.notesAr,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/raw-materials", requireStaff(), async (_req, res) => {
  const rows = await db
    .select()
    .from(rawMaterials)
    .orderBy(asc(rawMaterials.nameAr));
  res.json(rows.map(serialize));
});

router.post("/raw-materials", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.nameAr) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const inserted = await db
    .insert(rawMaterials)
    .values({
      nameAr: b.nameAr,
      nameEn: b.nameEn ?? null,
      unit: b.unit || "kg",
      unitCostMinor: typeof b.unitCostMinor === "number" ? b.unitCostMinor : 0,
      currency: b.currency || "SYP",
      reorderThreshold:
        typeof b.reorderThreshold === "number" ? b.reorderThreshold : 0,
      supplierAr: b.supplierAr ?? null,
      notesAr: b.notesAr ?? null,
      isActive: typeof b.isActive === "boolean" ? b.isActive : true,
      sku: b.sku || `RM-${Date.now()}`,
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.patch("/raw-materials/:id", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  const updates: Partial<typeof rawMaterials.$inferInsert> = {
    updatedAt: new Date(),
  };
  for (const k of [
    "nameAr",
    "nameEn",
    "unit",
    "unitCostMinor",
    "currency",
    "reorderThreshold",
    "supplierAr",
    "notesAr",
    "isActive",
    "sku",
  ] as const) {
    if (b[k] !== undefined) (updates as Record<string, unknown>)[k] = b[k];
  }
  const updated = await db
    .update(rawMaterials)
    .set(updates)
    .where(eq(rawMaterials.id, req.params.id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(updated[0]));
});

router.delete("/raw-materials/:id", requireStaff(), async (req, res) => {
  await db.delete(rawMaterials).where(eq(rawMaterials.id, req.params.id));
  res.status(204).send();
});

export default router;
