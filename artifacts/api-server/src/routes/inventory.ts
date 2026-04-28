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
import { requireStaff } from "../lib/auth";
import { applyLedgerEntry } from "../lib/inventory";

const router: IRouter = Router();

router.get("/inventory/locations", requireStaff(), async (_req, res) => {
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

router.get("/inventory/stock", requireStaff(), async (req, res) => {
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

router.get("/inventory/ledger", requireStaff(), async (req, res) => {
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

router.post("/inventory/adjustments", requireStaff(), async (req, res) => {
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

router.get("/inventory/low-stock", requireStaff(), async (_req, res) => {
  // products with stock_levels.quantity < products.reorderThreshold
  const lowProducts = await db.execute<{
    item_id: string;
    item_name_ar: string;
    quantity: number;
    reorder: number;
    location_id: string;
    location_name_ar: string;
  }>(sql`
    select p.id as item_id, p.name_ar as item_name_ar, sl.quantity_thousandths as quantity,
           p.reorder_threshold as reorder, l.id as location_id, l.name_ar as location_name_ar
    from stock_levels sl
    join products p on p.id = sl.product_id
    join inventory_locations l on l.id = sl.location_id
    where sl.item_type = 'product' and p.reorder_threshold > 0 and sl.quantity_thousandths < p.reorder_threshold
  `);
  const lowMaterials = await db.execute<{
    item_id: string;
    item_name_ar: string;
    quantity: number;
    reorder: number;
    location_id: string;
    location_name_ar: string;
  }>(sql`
    select rm.id as item_id, rm.name_ar as item_name_ar, sl.quantity_thousandths as quantity,
           rm.reorder_threshold as reorder, l.id as location_id, l.name_ar as location_name_ar
    from stock_levels sl
    join raw_materials rm on rm.id = sl.material_id
    join inventory_locations l on l.id = sl.location_id
    where sl.item_type = 'raw_material' and rm.reorder_threshold > 0 and sl.quantity_thousandths < rm.reorder_threshold
  `);
  const out = [
    ...lowProducts.rows.map((r) => ({
      itemType: "product" as const,
      itemId: r.item_id,
      itemNameAr: r.item_name_ar,
      quantity: Number(r.quantity),
      reorderThreshold: Number(r.reorder),
      locationId: r.location_id,
      locationNameAr: r.location_name_ar,
    })),
    ...lowMaterials.rows.map((r) => ({
      itemType: "raw_material" as const,
      itemId: r.item_id,
      itemNameAr: r.item_name_ar,
      quantity: Number(r.quantity),
      reorderThreshold: Number(r.reorder),
      locationId: r.location_id,
      locationNameAr: r.location_name_ar,
    })),
  ];
  res.json(out);
});

export default router;
