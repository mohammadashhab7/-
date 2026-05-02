import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import {
  db,
  wholesaleOrders,
  wholesaleOrderItems,
  inventoryLocations,
  products,
  businessUnits,
  financialEntries,
} from "@workspace/db";
import { requirePermission } from "../lib/auth";
import {
  applyLedgerEntry,
  getStockQuantity,
  InsufficientStockError,
} from "../lib/inventory";
import { nextWholesaleNumber } from "../lib/sequences";
import { logActivity } from "../lib/activity";
import { getActiveBusinessUnit } from "../lib/businessUnit";
import { CURRENCY_CODE } from "../lib/region";

const router: IRouter = Router();

type WholesaleStatus = "draft" | "confirmed" | "delivered" | "cancelled";

const STATUS_LABEL_AR: Record<WholesaleStatus, string> = {
  draft: "مسودة",
  confirmed: "مؤكد",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

interface SerializedItem {
  id: string;
  productId: string;
  productNameAr: string;
  quantity: number;
  unitPriceMinor: number;
  unitCostMinor: number;
  lineTotalMinor: number;
}

async function fetchOrderItems(orderId: string): Promise<SerializedItem[]> {
  const items = await db
    .select()
    .from(wholesaleOrderItems)
    .where(eq(wholesaleOrderItems.wholesaleOrderId, orderId));
  return items.map((it) => ({
    id: it.id,
    productId: it.productId,
    productNameAr: it.productNameAr,
    quantity: it.quantity,
    unitPriceMinor: it.unitPriceMinor,
    unitCostMinor: it.unitCostMinor,
    lineTotalMinor: it.lineTotalMinor,
  }));
}

function serializeOrder(
  o: typeof wholesaleOrders.$inferSelect,
  items: SerializedItem[],
  sellerNameAr?: string | null,
  buyerNameAr?: string | null,
) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    sellerBusinessUnitId: o.sellerBusinessUnitId,
    sellerNameAr: sellerNameAr ?? null,
    buyerBusinessUnitId: o.buyerBusinessUnitId,
    buyerNameAr: buyerNameAr ?? null,
    fromLocationId: o.fromLocationId,
    toLocationId: o.toLocationId,
    status: o.status as WholesaleStatus,
    statusLabelAr: STATUS_LABEL_AR[o.status as WholesaleStatus],
    totalMinor: o.totalMinor,
    currency: o.currency,
    notesAr: o.notesAr,
    items,
    createdAt: o.createdAt.toISOString(),
    confirmedAt: o.confirmedAt ? o.confirmedAt.toISOString() : null,
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
  };
}

async function resolveActiveBu(req: Request, res: Response) {
  try {
    return { ok: true as const, bu: await getActiveBusinessUnit(req) };
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "BU_REQUIRED" || code === "INVALID_BUSINESS_UNIT") {
      res.status(400).json({ error: code });
      return { ok: false as const };
    }
    throw err;
  }
}

async function findFirstActiveLocation(
  businessUnitId: string,
  kinds: ("production_finished" | "store" | "warehouse" | "production_raw")[],
) {
  const rows = await db
    .select()
    .from(inventoryLocations)
    .where(
      and(
        eq(inventoryLocations.businessUnitId, businessUnitId),
        eq(inventoryLocations.isActive, true),
      ),
    )
    .orderBy(inventoryLocations.createdAt, inventoryLocations.code);
  for (const k of kinds) {
    const found = rows.find((r) => r.kind === k);
    if (found) return found;
  }
  return null;
}

// GET /wholesale-orders
// - Factory BU selected → returns outgoing orders (seller = active BU)
// - Showroom BU selected → returns incoming orders (buyer = active BU) with status != draft
// - Admin / no BU → returns all orders
router.get(
  "/wholesale-orders",
  requirePermission("transfers", "read"),
  async (req, res) => {
    const r = await resolveActiveBu(req, res);
    if (!r.ok) return;
    const activeBu = r.bu;

    const filters = [];
    if (activeBu) {
      if (activeBu.kind === "factory") {
        filters.push(eq(wholesaleOrders.sellerBusinessUnitId, activeBu.id));
      } else if (activeBu.kind === "showroom") {
        // Showroom should not see drafts the factory hasn't confirmed yet.
        filters.push(eq(wholesaleOrders.buyerBusinessUnitId, activeBu.id));
        filters.push(
          or(
            eq(wholesaleOrders.status, "confirmed"),
            eq(wholesaleOrders.status, "delivered"),
            eq(wholesaleOrders.status, "cancelled"),
          )!,
        );
      } else {
        res.json([]);
        return;
      }
    }

    const rows = await db
      .select({
        o: wholesaleOrders,
        sellerNameAr: businessUnits.nameAr,
      })
      .from(wholesaleOrders)
      .innerJoin(
        businessUnits,
        eq(wholesaleOrders.sellerBusinessUnitId, businessUnits.id),
      )
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(wholesaleOrders.createdAt))
      .limit(200);

    // Fetch buyer names in a second pass (avoids needing two joins on businessUnits)
    const buyerIds = Array.from(new Set(rows.map((r) => r.o.buyerBusinessUnitId)));
    const buyerRows = buyerIds.length
      ? await db
          .select()
          .from(businessUnits)
          .where(or(...buyerIds.map((id) => eq(businessUnits.id, id)))!)
      : [];
    const buyerMap = new Map(buyerRows.map((b) => [b.id, b.nameAr]));

    const out = await Promise.all(
      rows.map(async (r) => {
        const items = await fetchOrderItems(r.o.id);
        return serializeOrder(
          r.o,
          items,
          r.sellerNameAr,
          buyerMap.get(r.o.buyerBusinessUnitId) ?? null,
        );
      }),
    );
    res.json(out);
  },
);

// GET /wholesale-orders/:id
router.get(
  "/wholesale-orders/:id",
  requirePermission("transfers", "read"),
  async (req, res) => {
    const r = await resolveActiveBu(req, res);
    if (!r.ok) return;
    const activeBu = r.bu;
    const id = req.params.id as string;

    const rows = await db
      .select()
      .from(wholesaleOrders)
      .where(eq(wholesaleOrders.id, id))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const o = rows[0];
    if (activeBu) {
      const isSeller = o.sellerBusinessUnitId === activeBu.id;
      const isBuyer = o.buyerBusinessUnitId === activeBu.id;
      if (!isSeller && !isBuyer) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      // Buyer cannot see drafts.
      if (isBuyer && !isSeller && o.status === "draft") {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
    }
    const [seller, buyer] = await Promise.all([
      db.select().from(businessUnits).where(eq(businessUnits.id, o.sellerBusinessUnitId)).limit(1),
      db.select().from(businessUnits).where(eq(businessUnits.id, o.buyerBusinessUnitId)).limit(1),
    ]);
    const items = await fetchOrderItems(o.id);
    res.json(serializeOrder(o, items, seller[0]?.nameAr, buyer[0]?.nameAr));
  },
);

// POST /wholesale-orders — factory creates a draft invoice for a showroom buyer.
// Active BU MUST be the seller (factory). Admin/owner with no BU may pass
// `sellerBusinessUnitId` explicitly.
router.post(
  "/wholesale-orders",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const r = await resolveActiveBu(req, res);
    if (!r.ok) return;
    const activeBu = r.bu;
    const b = req.body ?? {};

    if (
      !b.buyerBusinessUnitId ||
      !Array.isArray(b.items) ||
      b.items.length === 0
    ) {
      res.status(400).json({ error: "VALIDATION" });
      return;
    }
    for (const it of b.items as { productId?: string; quantity?: number; unitPriceMinor?: number }[]) {
      if (
        !it.productId ||
        typeof it.quantity !== "number" ||
        it.quantity <= 0 ||
        typeof it.unitPriceMinor !== "number" ||
        it.unitPriceMinor < 0
      ) {
        res.status(400).json({ error: "VALIDATION", detail: "items" });
        return;
      }
    }

    // Resolve seller BU
    let sellerBuId: string | null = null;
    if (activeBu) {
      if (activeBu.kind !== "factory") {
        res.status(403).json({ error: "FACTORY_ONLY" });
        return;
      }
      sellerBuId = activeBu.id;
    } else if (typeof b.sellerBusinessUnitId === "string") {
      sellerBuId = b.sellerBusinessUnitId;
    } else {
      // Admin without active BU and without explicit seller — try to auto-pick the
      // single factory BU if there is one.
      const factories = await db
        .select()
        .from(businessUnits)
        .where(and(eq(businessUnits.kind, "factory"), eq(businessUnits.isActive, true)));
      if (factories.length === 1) sellerBuId = factories[0]!.id;
    }
    if (!sellerBuId) {
      res.status(400).json({ error: "SELLER_REQUIRED" });
      return;
    }

    const [sellerRow, buyerRow] = await Promise.all([
      db.select().from(businessUnits).where(eq(businessUnits.id, sellerBuId)).limit(1),
      db.select().from(businessUnits).where(eq(businessUnits.id, b.buyerBusinessUnitId)).limit(1),
    ]);
    const seller = sellerRow[0];
    const buyer = buyerRow[0];
    if (!seller || seller.kind !== "factory" || !seller.isActive) {
      res.status(400).json({ error: "INVALID_SELLER" });
      return;
    }
    if (!buyer || buyer.kind !== "showroom" || !buyer.isActive) {
      res.status(400).json({ error: "INVALID_BUYER" });
      return;
    }

    // Resolve from/to locations: factory finished-goods, buyer's store.
    const fromLoc = await findFirstActiveLocation(seller.id, ["production_finished"]);
    if (!fromLoc) {
      res.status(500).json({ error: "FACTORY_FINISHED_LOCATION_MISSING" });
      return;
    }
    const toLoc = await findFirstActiveLocation(buyer.id, ["store", "warehouse"]);
    if (!toLoc) {
      res.status(500).json({ error: "BUYER_LOCATION_MISSING" });
      return;
    }

    // Snapshot product names + costs.
    const productIds = (b.items as { productId: string }[]).map((i) => i.productId);
    const productRows = await db
      .select()
      .from(products)
      .where(or(...productIds.map((id) => eq(products.id, id)))!);
    const productMap = new Map(productRows.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) {
        res.status(400).json({ error: "PRODUCT_NOT_FOUND", detail: id });
        return;
      }
    }

    try {
      const created = await db.transaction(async (tx) => {
        const orderNumber = await nextWholesaleNumber();
        let total = 0;
        const inserted = await tx
          .insert(wholesaleOrders)
          .values({
            orderNumber,
            sellerBusinessUnitId: seller.id,
            buyerBusinessUnitId: buyer.id,
            fromLocationId: fromLoc.id,
            toLocationId: toLoc.id,
            status: "draft",
            totalMinor: 0,
            currency: CURRENCY_CODE,
            notesAr: b.notesAr ?? null,
            createdByUserId: req.appUser?.id ?? null,
          })
          .returning();
        const orderRow = inserted[0]!;

        for (const it of b.items as {
          productId: string;
          quantity: number;
          unitPriceMinor: number;
        }[]) {
          const product = productMap.get(it.productId)!;
          // Snapshot weighted-average cost from finished-goods location.
          const stock = await getStockQuantity(
            fromLoc.id,
            "product",
            it.productId,
            tx,
          );
          const lineTotal = it.quantity * it.unitPriceMinor;
          total += lineTotal;
          await tx.insert(wholesaleOrderItems).values({
            wholesaleOrderId: orderRow.id,
            productId: it.productId,
            productNameAr: product.nameAr,
            quantity: it.quantity,
            unitPriceMinor: it.unitPriceMinor,
            unitCostMinor: stock.avgCostMinor,
            lineTotalMinor: lineTotal,
          });
        }

        const updated = await tx
          .update(wholesaleOrders)
          .set({ totalMinor: total, updatedAt: new Date() })
          .where(eq(wholesaleOrders.id, orderRow.id))
          .returning();
        return updated[0]!;
      });

      await logActivity({
        kind: "wholesale_order",
        titleAr: `فاتورة بيع للمعرض ${created.orderNumber}`,
        descriptionAr: `${seller.nameAr} ← ${buyer.nameAr} (مسودة)`,
        referenceType: "wholesale_order",
        referenceId: created.id,
        actor: req.appUser,
      });

      const items = await fetchOrderItems(created.id);
      res
        .status(201)
        .json(serializeOrder(created, items, seller.nameAr, buyer.nameAr));
    } catch (err) {
      req.log.error({ err }, "wholesale create failed");
      res.status(500).json({ error: "INTERNAL" });
    }
  },
);

async function ensureCanMutate(
  req: Request,
  res: Response,
  id: string,
): Promise<{ ok: false } | { ok: true; row: typeof wholesaleOrders.$inferSelect }> {
  const r = await resolveActiveBu(req, res);
  if (!r.ok) return { ok: false };
  const activeBu = r.bu;
  const rows = await db
    .select()
    .from(wholesaleOrders)
    .where(eq(wholesaleOrders.id, id))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return { ok: false };
  }
  const row = rows[0];
  if (activeBu) {
    // Only the seller (factory) can confirm/deliver/cancel.
    if (row.sellerBusinessUnitId !== activeBu.id) {
      res.status(403).json({ error: "FORBIDDEN_NOT_SELLER" });
      return { ok: false };
    }
  }
  return { ok: true, row };
}

// POST /wholesale-orders/:id/confirm — draft → confirmed (no stock movement)
router.post(
  "/wholesale-orders/:id/confirm",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const id = req.params.id as string;
    const check = await ensureCanMutate(req, res, id);
    if (!check.ok) return;

    const updated = await db
      .update(wholesaleOrders)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedByUserId: req.appUser?.id ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(wholesaleOrders.id, id), eq(wholesaleOrders.status, "draft")))
      .returning();
    if (updated.length === 0) {
      res.status(409).json({ error: "INVALID_STATUS", detail: check.row.status });
      return;
    }
    await logActivity({
      kind: "wholesale_order",
      titleAr: `تأكيد فاتورة ${updated[0]!.orderNumber}`,
      referenceType: "wholesale_order",
      referenceId: id,
      actor: req.appUser,
    });
    res.json({ id, status: updated[0]!.status });
  },
);

// POST /wholesale-orders/:id/deliver — confirmed → delivered
// Atomic: ledger transfer_out (factory) + transfer_in (buyer) + financial entries
// (factory income, showroom expense).
router.post(
  "/wholesale-orders/:id/deliver",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const id = req.params.id as string;
    const check = await ensureCanMutate(req, res, id);
    if (!check.ok) return;

    try {
      const result = await db.transaction(async (tx) => {
        // Atomic conditional state transition first — claim the row.
        const claimed = await tx
          .update(wholesaleOrders)
          .set({
            status: "delivered",
            deliveredAt: new Date(),
            deliveredByUserId: req.appUser?.id ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(wholesaleOrders.id, id),
              eq(wholesaleOrders.status, "confirmed"),
            ),
          )
          .returning();
        if (claimed.length === 0) {
          const exists = await tx
            .select({ id: wholesaleOrders.id, status: wholesaleOrders.status })
            .from(wholesaleOrders)
            .where(eq(wholesaleOrders.id, id));
          if (exists.length === 0) return { notFound: true as const };
          return { invalid: exists[0]!.status };
        }
        const order = claimed[0]!;

        const items = await tx
          .select()
          .from(wholesaleOrderItems)
          .where(eq(wholesaleOrderItems.wholesaleOrderId, id));

        // Pre-check stock on factory finished-goods location.
        for (const it of items) {
          const stock = await getStockQuantity(
            order.fromLocationId,
            "product",
            it.productId,
            tx,
          );
          if (stock.quantity < it.quantity) {
            throw new InsufficientStockError(
              order.fromLocationId,
              "product",
              it.productId,
              stock.quantity,
              it.quantity,
            );
          }
        }

        let totalRevenue = 0;
        let totalCost = 0;

        for (const it of items) {
          totalRevenue += it.lineTotalMinor;
          totalCost += it.quantity * it.unitCostMinor;

          await applyLedgerEntry(
            {
              locationId: order.fromLocationId,
              itemType: "product",
              productId: it.productId,
              quantityDelta: -it.quantity,
              unitCostMinor: it.unitCostMinor,
              reason: "transfer_out",
              referenceType: "wholesale_order",
              referenceId: order.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
          await applyLedgerEntry(
            {
              locationId: order.toLocationId,
              itemType: "product",
              productId: it.productId,
              quantityDelta: it.quantity,
              // Showroom receives goods at the wholesale price (its cost basis).
              unitCostMinor: it.unitPriceMinor,
              reason: "transfer_in",
              referenceType: "wholesale_order",
              referenceId: order.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
        }

        // Factory revenue (module=production for back-compat with existing reports)
        if (totalRevenue > 0) {
          await tx.insert(financialEntries).values({
            module: "production",
            type: "income",
            category: "wholesale_sale",
            descriptionAr: `إيراد بيع جملة للمعرض (فاتورة ${order.orderNumber})`,
            amountMinor: totalRevenue,
            currency: order.currency,
            occurredAt: new Date(),
            referenceType: "wholesale_order",
            referenceId: order.id,
            businessUnitId: order.sellerBusinessUnitId,
            createdByUserId: req.appUser?.id ?? null,
          });
        }
        // Showroom expense (module=store)
        if (totalRevenue > 0) {
          await tx.insert(financialEntries).values({
            module: "store",
            type: "expense",
            category: "wholesale_purchase",
            descriptionAr: `مشتريات من المصنع (فاتورة ${order.orderNumber})`,
            amountMinor: totalRevenue,
            currency: order.currency,
            occurredAt: new Date(),
            referenceType: "wholesale_order",
            referenceId: order.id,
            businessUnitId: order.buyerBusinessUnitId,
            createdByUserId: req.appUser?.id ?? null,
          });
        }

        return {
          row: order,
          totalRevenue,
          totalCost,
        };
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      if ("invalid" in result) {
        res.status(409).json({ error: "INVALID_STATUS", detail: result.invalid });
        return;
      }

      await logActivity({
        kind: "wholesale_order",
        titleAr: `تسليم فاتورة ${result.row.orderNumber}`,
        descriptionAr: `إيراد ${result.totalRevenue} | تكلفة ${result.totalCost}`,
        referenceType: "wholesale_order",
        referenceId: id,
        actor: req.appUser,
      });
      res.json({ id, status: result.row.status });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        res
          .status(409)
          .json({ error: "INSUFFICIENT_STOCK", detail: err.message });
        return;
      }
      req.log.error({ err }, "wholesale deliver failed");
      res.status(500).json({ error: "INTERNAL" });
    }
  },
);

// POST /wholesale-orders/:id/cancel — draft|confirmed → cancelled
router.post(
  "/wholesale-orders/:id/cancel",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const id = req.params.id as string;
    const check = await ensureCanMutate(req, res, id);
    if (!check.ok) return;

    const updated = await db
      .update(wholesaleOrders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: req.appUser?.id ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wholesaleOrders.id, id),
          or(
            eq(wholesaleOrders.status, "draft"),
            eq(wholesaleOrders.status, "confirmed"),
          )!,
        ),
      )
      .returning();
    if (updated.length === 0) {
      res.status(409).json({ error: "INVALID_STATUS", detail: check.row.status });
      return;
    }
    await logActivity({
      kind: "wholesale_order",
      titleAr: `إلغاء فاتورة ${updated[0]!.orderNumber}`,
      referenceType: "wholesale_order",
      referenceId: id,
      actor: req.appUser,
    });
    res.json({ id, status: updated[0]!.status });
  },
);

export default router;
