import { Router, type IRouter } from "express";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  db,
  inventoryLocations,
  inventoryLedger,
  stockLevels,
  rawMaterials,
  products,
} from "@workspace/db";
import { requireStaff, requirePermission } from "../lib/auth";
import { applyLedgerEntry } from "../lib/inventory";

const router: IRouter = Router();

router.get("/inventory/locations", requirePermission("inventory", "read"), async (_req, res) => {
  const rows = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.isActive, true));
  res.json(
    rows.map((l) => ({
      id: l.id,
      code: l.code,
      nameAr: l.nameAr,
      kind: l.kind,
      isActive: l.isActive,
    })),
  );
});

router.get("/inventory/stock", requirePermission("inventory", "read"), async (req, res) => {
  const { locationId, itemType } = req.query;
  const filters = [];
  if (typeof locationId === "string") filters.push(eq(stockLevels.locationId, locationId));
  if (typeof itemType === "string")
    filters.push(eq(stockLevels.itemType, itemType as "raw_material" | "product"));
  const rows = await db
    .select({
      s: stockLevels,
      loc: inventoryLocations,
      mat: rawMaterials,
      prod: products,
    })
    .from(stockLevels)
    .innerJoin(inventoryLocations, eq(stockLevels.locationId, inventoryLocations.id))
    .leftJoin(rawMaterials, eq(stockLevels.materialId, rawMaterials.id))
    .leftJoin(products, eq(stockLevels.productId, products.id))
    .where(filters.length ? and(...filters) : undefined);
  res.json(
    rows.map((r) => ({
      id: r.s.id,
      locationId: r.s.locationId,
      locationNameAr: r.loc.nameAr,
      itemType: r.s.itemType,
      itemId: r.s.itemType === "raw_material" ? r.s.materialId : r.s.productId,
      itemNameAr:
        r.s.itemType === "raw_material" ? r.mat?.nameAr ?? null : r.prod?.nameAr ?? null,
      itemUnit:
        r.s.itemType === "raw_material" ? r.mat?.unit ?? null : r.prod?.unit ?? null,
      quantity: r.s.quantity,
      avgCostMinor: r.s.avgCostMinor,
    })),
  );
});

router.get("/inventory/ledger", requirePermission("inventory", "read"), async (req, res) => {
  const { locationId, itemType, itemId, limit } = req.query;
  const filters = [];
  if (typeof locationId === "string") filters.push(eq(inventoryLedger.locationId, locationId));
  if (typeof itemType === "string")
    filters.push(eq(inventoryLedger.itemType, itemType as "raw_material" | "product"));
  if (typeof itemId === "string") {
    if (itemType === "raw_material") filters.push(eq(inventoryLedger.materialId, itemId));
    else filters.push(eq(inventoryLedger.productId, itemId));
  }
  const lim = Math.min(typeof limit === "string" ? parseInt(limit, 10) || 100 : 100, 500);
  const rows = await db
    .select({
      l: inventoryLedger,
      loc: inventoryLocations,
      mat: rawMaterials,
      prod: products,
    })
    .from(inventoryLedger)
    .innerJoin(inventoryLocations, eq(inventoryLedger.locationId, inventoryLocations.id))
    .leftJoin(rawMaterials, eq(inventoryLedger.materialId, rawMaterials.id))
    .leftJoin(products, eq(inventoryLedger.productId, products.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(inventoryLedger.createdAt))
    .limit(lim);
  res.json(
    rows.map((r) => ({
      id: r.l.id,
      locationId: r.l.locationId,
      locationNameAr: r.loc.nameAr,
      itemType: r.l.itemType,
      itemId: r.l.itemType === "raw_material" ? r.l.materialId : r.l.productId,
      itemNameAr:
        r.l.itemType === "raw_material" ? r.mat?.nameAr ?? null : r.prod?.nameAr ?? null,
      quantityDelta: r.l.quantityDelta,
      unitCostMinor: r.l.unitCostMinor,
      reason: r.l.reason,
      referenceType: r.l.referenceType,
      referenceId: r.l.referenceId,
      notesAr: r.l.notesAr,
      createdAt: r.l.createdAt.toISOString(),
    })),
  );
});

router.post("/inventory/adjustments", requirePermission("inventory", "write"), async (req, res) => {
  const b = req.body ?? {};
  if (!b.locationId || !b.itemType || typeof b.quantityDelta !== "number") {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const entry = await applyLedgerEntry({
    locationId: b.locationId,
    itemType: b.itemType,
    materialId: b.itemType === "raw_material" ? b.itemId : null,
    productId: b.itemType === "product" ? b.itemId : null,
    quantityDelta: b.quantityDelta,
    unitCostMinor: typeof b.unitCostMinor === "number" ? b.unitCostMinor : 0,
    reason: b.reason || "adjustment",
    notesAr: b.notesAr ?? null,
    createdByUserId: req.appUser?.id ?? null,
  });
  res.status(201).json({
    id: entry.id,
    locationId: entry.locationId,
    itemType: entry.itemType,
    itemId: entry.materialId || entry.productId,
    quantityDelta: entry.quantityDelta,
    reason: entry.reason,
    notesAr: entry.notesAr,
    createdAt: entry.createdAt.toISOString(),
  });
});

router.get("/inventory/low-stock", requirePermission("inventory", "read"), async (_req, res) => {
  // Aggregate stock per item across all locations; flag items at/below reorder threshold.
  const lowProducts = await db.execute<{
    item_id: string;
    item_name_ar: string;
    total_quantity: string;
    reorder: number;
    unit: string;
  }>(sql`
    select p.id as item_id,
           p.name_ar as item_name_ar,
           coalesce(sum(sl.quantity_thousandths), 0)::text as total_quantity,
           p.reorder_threshold as reorder,
           p.unit as unit
    from products p
    left join stock_levels sl on sl.product_id = p.id and sl.item_type = 'product'
    where p.reorder_threshold > 0
    group by p.id, p.name_ar, p.reorder_threshold, p.unit
    having coalesce(sum(sl.quantity_thousandths), 0) <= p.reorder_threshold
  `);
  const lowMaterials = await db.execute<{
    item_id: string;
    item_name_ar: string;
    total_quantity: string;
    reorder: number;
    unit: string;
  }>(sql`
    select rm.id as item_id,
           rm.name_ar as item_name_ar,
           coalesce(sum(sl.quantity_thousandths), 0)::text as total_quantity,
           rm.reorder_threshold as reorder,
           rm.unit as unit
    from raw_materials rm
    left join stock_levels sl on sl.material_id = rm.id and sl.item_type = 'raw_material'
    where rm.reorder_threshold > 0
    group by rm.id, rm.name_ar, rm.reorder_threshold, rm.unit
    having coalesce(sum(sl.quantity_thousandths), 0) <= rm.reorder_threshold
  `);
  const out = [
    ...lowProducts.rows.map((r) => ({
      itemType: "product" as const,
      itemId: r.item_id,
      itemNameAr: r.item_name_ar,
      totalQuantity: Number(r.total_quantity),
      reorderThreshold: Number(r.reorder),
      unit: r.unit,
    })),
    ...lowMaterials.rows.map((r) => ({
      itemType: "material" as const,
      itemId: r.item_id,
      itemNameAr: r.item_name_ar,
      totalQuantity: Number(r.total_quantity),
      reorderThreshold: Number(r.reorder),
      unit: r.unit,
    })),
  ];
  res.json(out);
});

export default router;
