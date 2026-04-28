import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  salesOrders,
  salesOrderItems,
  products,
  financialEntries,
} from "@workspace/db";
import { requireStaff } from "../lib/auth";
import { applyLedgerEntry, getLocationByCode, getStockQuantity } from "../lib/inventory";
import { nextOrderNumber } from "../lib/sequences";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

function serialize(o: typeof salesOrders.$inferSelect) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    channel: o.channel,
    status: o.status,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    deliveryAddress: o.deliveryAddress,
    paymentMethod: o.paymentMethod,
    paymentReference: o.paymentReference,
    subtotalMinor: o.subtotalMinor,
    discountMinor: o.discountMinor,
    taxMinor: o.taxMinor,
    deliveryFeeMinor: o.deliveryFeeMinor,
    totalMinor: o.totalMinor,
    notesAr: o.notesAr,
    placedAt: o.placedAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
  };
}

router.get("/sales-orders", requireStaff(), async (req, res) => {
  const { channel, status, fromDate, toDate, limit } = req.query;
  const filters = [];
  if (typeof channel === "string")
    filters.push(eq(salesOrders.channel, channel as "pos" | "online"));
  if (typeof status === "string")
    filters.push(eq(salesOrders.status, status as typeof salesOrders.$inferSelect.status));
  if (typeof fromDate === "string") filters.push(gte(salesOrders.placedAt, new Date(fromDate)));
  if (typeof toDate === "string") filters.push(lte(salesOrders.placedAt, new Date(toDate)));
  const lim = Math.min(typeof limit === "string" ? parseInt(limit, 10) || 50 : 50, 200);
  const rows = await db
    .select()
    .from(salesOrders)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(salesOrders.placedAt))
    .limit(lim);
  res.json(rows.map(serialize));
});

export async function createSalesOrderInternal(args: {
  channel: "pos" | "online";
  customerUserId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  deliveryAddress?: string | null;
  paymentMethod: typeof salesOrders.$inferSelect.paymentMethod;
  items: { productId: string; quantity: number }[];
  discountMinor?: number;
  deliveryFeeMinor?: number;
  taxMinor?: number;
  notesAr?: string | null;
  cashReceivedMinor?: number | null;
  cashierUserId?: string | null;
}) {
  if (args.items.length === 0) throw new Error("EMPTY_ORDER");
  const orderNumber = await nextOrderNumber(args.channel);
  const storeLoc = await getLocationByCode("STORE");
  const finishedLoc = await getLocationByCode("PROD-FIN");
  const sourceLoc = args.channel === "pos" ? storeLoc : finishedLoc;
  if (!sourceLoc) throw new Error("LOCATIONS_NOT_SEEDED");

  const productRows = await Promise.all(
    args.items.map(async (it) => {
      const p = (
        await db.select().from(products).where(eq(products.id, it.productId)).limit(1)
      )[0];
      if (!p) throw new Error("PRODUCT_NOT_FOUND");
      const stock = await getStockQuantity(sourceLoc.id, "product", p.id);
      return { p, stock, qty: it.quantity };
    }),
  );

  const subtotal = productRows.reduce(
    (sum, r) => sum + r.p.priceMinor * r.qty,
    0,
  );
  const cost = productRows.reduce(
    (sum, r) => sum + r.stock.avgCostMinor * r.qty,
    0,
  );
  const discount = args.discountMinor || 0;
  const tax = args.taxMinor || 0;
  const delivery = args.deliveryFeeMinor || 0;
  const total = Math.max(0, subtotal - discount + tax + delivery);

  const insertedOrder = await db
    .insert(salesOrders)
    .values({
      orderNumber,
      channel: args.channel,
      status: args.channel === "pos" ? "completed" : "pending",
      customerUserId: args.customerUserId ?? null,
      customerName: args.customerName ?? null,
      customerPhone: args.customerPhone ?? null,
      customerEmail: args.customerEmail ?? null,
      deliveryAddress: args.deliveryAddress ?? null,
      paymentMethod: args.paymentMethod,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: tax,
      deliveryFeeMinor: delivery,
      totalMinor: total,
      costMinor: cost,
      notesAr: args.notesAr ?? null,
      cashReceivedMinor: args.cashReceivedMinor ?? null,
      changeMinor:
        args.cashReceivedMinor != null ? args.cashReceivedMinor - total : null,
      cashierUserId: args.cashierUserId ?? null,
      completedAt: args.channel === "pos" ? new Date() : null,
    })
    .returning();
  const order = insertedOrder[0]!;

  for (const r of productRows) {
    await db.insert(salesOrderItems).values({
      orderId: order.id,
      productId: r.p.id,
      productNameAr: r.p.nameAr,
      quantity: r.qty,
      unitPriceMinor: r.p.priceMinor,
      unitCostMinor: r.stock.avgCostMinor,
      totalMinor: r.p.priceMinor * r.qty,
    });
    await applyLedgerEntry({
      locationId: sourceLoc.id,
      itemType: "product",
      productId: r.p.id,
      quantityDelta: -r.qty,
      unitCostMinor: r.stock.avgCostMinor,
      reason: "sale",
      referenceType: "sales_order",
      referenceId: order.id,
      createdByUserId: args.cashierUserId ?? null,
    });
  }

  // Financial entry: book in store module (POS sales) or store module (online sales fulfilled from store)
  await db.insert(financialEntries).values({
    module: "store",
    type: "income",
    category: args.channel === "pos" ? "مبيعات نقطة البيع" : "مبيعات الموقع",
    descriptionAr: `طلب ${orderNumber}`,
    amountMinor: total,
    referenceType: "sales_order",
    referenceId: order.id,
    createdByUserId: args.cashierUserId ?? null,
  });

  await logActivity({
    kind: "order_placed",
    titleAr: `طلب جديد ${orderNumber}`,
    descriptionAr:
      args.customerName ||
      (args.channel === "pos" ? "بيع مباشر" : "طلب أونلاين"),
    referenceType: "sales_order",
    referenceId: order.id,
    metadata: { totalMinor: total, channel: args.channel },
  });

  return order;
}

router.post("/sales-orders", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  try {
    const order = await createSalesOrderInternal({
      channel: b.channel || "pos",
      customerName: b.customerName ?? null,
      customerPhone: b.customerPhone ?? null,
      customerEmail: b.customerEmail ?? null,
      deliveryAddress: b.deliveryAddress ?? null,
      paymentMethod: b.paymentMethod || "cash",
      items: b.items || [],
      discountMinor: b.discountMinor || 0,
      deliveryFeeMinor: b.deliveryFeeMinor || 0,
      taxMinor: b.taxMinor || 0,
      notesAr: b.notesAr ?? null,
      cashReceivedMinor: b.cashReceivedMinor ?? null,
      cashierUserId: req.appUser?.id ?? null,
    });
    res.status(201).json(serialize(order));
  } catch (err) {
    req.log.error({ err }, "createSalesOrder failed");
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/sales-orders/:id", requireStaff(), async (req, res) => {
  const rows = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, req.params.id))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const items = await db
    .select()
    .from(salesOrderItems)
    .where(eq(salesOrderItems.orderId, req.params.id));
  res.json({
    ...serialize(rows[0]),
    items: items.map((it) => ({
      productId: it.productId,
      productNameAr: it.productNameAr,
      quantity: it.quantity,
      unitPriceMinor: it.unitPriceMinor,
      totalMinor: it.totalMinor,
    })),
  });
});

router.patch("/sales-orders/:id/status", requireStaff(), async (req, res) => {
  const { status, notesAr } = req.body ?? {};
  const updated = await db
    .update(salesOrders)
    .set({
      status,
      notesAr: notesAr ?? undefined,
      updatedAt: new Date(),
      completedAt: status === "completed" ? new Date() : undefined,
    })
    .where(eq(salesOrders.id, req.params.id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  await logActivity({
    kind: "order_status_changed",
    titleAr: `تحديث حالة الطلب ${updated[0].orderNumber}`,
    descriptionAr: `الحالة الجديدة: ${status}`,
    referenceType: "sales_order",
    referenceId: updated[0].id,
    actor: req.appUser,
  });
  res.json(serialize(updated[0]));
});

export default router;
