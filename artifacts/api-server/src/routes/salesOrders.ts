import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  salesOrders,
  salesOrderItems,
  products,
  financialEntries,
  dailyClosings,
} from "@workspace/db";
import { requireStaff, requirePermission } from "../lib/auth";
import {
  applyLedgerEntry,
  getLocationByCode,
  getStockQuantity,
  InsufficientStockError,
} from "../lib/inventory";
import { nextOrderNumber } from "../lib/sequences";
import { logActivity } from "../lib/activity";

type OrderStatus = typeof salesOrders.$inferSelect.status;

// Allowed forward transitions. Terminal states (cancelled, refunded) cannot
// transition further. POS sales are created already in "completed" state.
// Online flow:
//   stripe/paypal: pending_payment → paid → confirmed → preparing → ready → ...
//   cod          : pending → confirmed → preparing → ready → ...
// Refunds reverse a completed order and write reversing financial entries.
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"],
  pending: ["confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"],
  confirmed: ["preparing", "ready", "out_for_delivery", "completed", "cancelled"],
  preparing: ["ready", "out_for_delivery", "completed", "cancelled"],
  ready: ["out_for_delivery", "completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

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

router.get("/sales-orders", requirePermission("orders", "read"), async (req, res) => {
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
  // Sales (POS + online) always reduce STORE stock per architecture.
  const sourceLoc = await getLocationByCode("STORE");
  if (!sourceLoc) throw new Error("LOCATIONS_NOT_SEEDED");

  // POS closing lock: once a day has been closed, no further POS sales for
  // that day can be created.  Online sales are unaffected.
  if (args.channel === "pos") {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const closed = await db
      .select()
      .from(dailyClosings)
      .where(eq(dailyClosings.closingDate, dateStr))
      .limit(1);
    if (closed[0]) {
      const e = new Error("POS_DAY_CLOSED");
      (e as Error & { code?: string }).code = "POS_DAY_CLOSED";
      throw e;
    }
  }

  const order = await db.transaction(async (tx) => {
    // Load products and stock inside the transaction; pre-check availability.
    const productRows: { p: typeof products.$inferSelect; stock: { quantity: number; avgCostMinor: number }; qty: number }[] = [];
    for (const it of args.items) {
      const p = (
        await tx.select().from(products).where(eq(products.id, it.productId)).limit(1)
      )[0];
      if (!p) throw new Error("PRODUCT_NOT_FOUND");
      const stock = await getStockQuantity(sourceLoc.id, "product", p.id, tx);
      if (stock.quantity < it.quantity) {
        throw new InsufficientStockError(
          sourceLoc.id,
          "product",
          p.id,
          stock.quantity,
          it.quantity,
        );
      }
      productRows.push({ p, stock, qty: it.quantity });
    }

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

    const orderNumber = await nextOrderNumber(args.channel);

    const insertedOrder = await tx
      .insert(salesOrders)
      .values({
        orderNumber,
        channel: args.channel,
        status:
          args.channel === "pos"
            ? "completed"
            : args.paymentMethod === "stripe" || args.paymentMethod === "paypal"
              ? "pending_payment"
              : "pending",
        paymentStatus:
          args.channel === "pos"
            ? "succeeded"
            : args.paymentMethod === "stripe" || args.paymentMethod === "paypal"
              ? "pending"
              : "not_required",
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
    const created = insertedOrder[0]!;

    for (const r of productRows) {
      await tx.insert(salesOrderItems).values({
        orderId: created.id,
        productId: r.p.id,
        productNameAr: r.p.nameAr,
        quantity: r.qty,
        unitPriceMinor: r.p.priceMinor,
        unitCostMinor: r.stock.avgCostMinor,
        totalMinor: r.p.priceMinor * r.qty,
      });
      await applyLedgerEntry(
        {
          locationId: sourceLoc.id,
          itemType: "product",
          productId: r.p.id,
          quantityDelta: -r.qty,
          unitCostMinor: r.stock.avgCostMinor,
          reason: "sale",
          referenceType: "sales_order",
          referenceId: created.id,
          createdByUserId: args.cashierUserId ?? null,
        },
        tx,
      );
    }

    await tx.insert(financialEntries).values({
      module: "store",
      type: "income",
      category: args.channel === "pos" ? "مبيعات نقطة البيع" : "مبيعات الموقع",
      descriptionAr: `طلب ${orderNumber}`,
      amountMinor: total,
      referenceType: "sales_order",
      referenceId: created.id,
      createdByUserId: args.cashierUserId ?? null,
    });

    return created;
  });

  await logActivity({
    kind: "order_placed",
    titleAr: `طلب جديد ${order.orderNumber}`,
    descriptionAr:
      args.customerName ||
      (args.channel === "pos" ? "بيع مباشر" : "طلب أونلاين"),
    referenceType: "sales_order",
    referenceId: order.id,
    metadata: { totalMinor: order.totalMinor, channel: args.channel },
  });

  return order;
}

router.post("/sales-orders", requirePermission("orders", "write"), async (req, res) => {
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
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: "INSUFFICIENT_STOCK", detail: err.message });
      return;
    }
    if ((err as Error & { code?: string }).code === "POS_DAY_CLOSED") {
      res.status(409).json({ error: "POS_DAY_CLOSED" });
      return;
    }
    req.log.error({ err }, "createSalesOrder failed");
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/sales-orders/:id", requirePermission("orders", "read"), async (req, res) => {
  const rows = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, String(req.params.id)))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const items = await db
    .select()
    .from(salesOrderItems)
    .where(eq(salesOrderItems.orderId, String(req.params.id)));
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

router.patch("/sales-orders/:id/status", requirePermission("orders", "write"), async (req, res) => {
  const { status, notesAr } = req.body ?? {};
  const ALL_STATUSES: OrderStatus[] = [
    "pending_payment",
    "paid",
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "completed",
    "cancelled",
    "refunded",
  ];
  if (!ALL_STATUSES.includes(status)) {
    res.status(400).json({ error: "INVALID_STATUS" });
    return;
  }

  try {
    const finalRow = await db.transaction(async (tx) => {
      const cur = (
        await tx.select().from(salesOrders).where(eq(salesOrders.id, String(req.params.id))).limit(1)
      )[0];
      if (!cur) {
        const e = new Error("NOT_FOUND");
        (e as Error & { code?: string }).code = "NOT_FOUND";
        throw e;
      }
      if (cur.status === status) {
        return cur;
      }
      const allowed = STATUS_TRANSITIONS[cur.status];
      if (!allowed.includes(status)) {
        const e = new Error(`INVALID_TRANSITION: ${cur.status} -> ${status}`);
        (e as Error & { code?: string }).code = "INVALID_TRANSITION";
        throw e;
      }

      // On cancellation or refund: append reversing inventory entries
      // (re-stock STORE) and reversing financial entry. Inventory is deducted
      // at order creation regardless of payment state, so all transitions to
      // cancelled/refunded must reverse it.
      if (status === "cancelled" || status === "refunded") {
        const sourceLoc = await getLocationByCode("STORE");
        if (!sourceLoc) throw new Error("LOCATIONS_NOT_SEEDED");
        const items = await tx
          .select()
          .from(salesOrderItems)
          .where(eq(salesOrderItems.orderId, cur.id));
        const refType = status === "refunded" ? "sales_order_refund" : "sales_order_cancel";
        for (const it of items) {
          await applyLedgerEntry(
            {
              locationId: sourceLoc.id,
              itemType: "product",
              productId: it.productId,
              quantityDelta: it.quantity,
              unitCostMinor: it.unitCostMinor,
              reason: "return",
              referenceType: refType,
              referenceId: cur.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
        }
        const categoryAr =
          status === "refunded"
            ? "استرداد طلب"
            : cur.channel === "pos"
              ? "إلغاء بيع نقطة البيع"
              : "إلغاء طلب أونلاين";
        const titleAr = status === "refunded" ? `استرداد طلب ${cur.orderNumber}` : `إلغاء طلب ${cur.orderNumber}`;
        await tx.insert(financialEntries).values({
          module: "store",
          type: "expense",
          category: categoryAr,
          descriptionAr: titleAr,
          amountMinor: cur.totalMinor,
          referenceType: refType,
          referenceId: cur.id,
          createdByUserId: req.appUser?.id ?? null,
        });
      }

      const updated = await tx
        .update(salesOrders)
        .set({
          status,
          notesAr: notesAr ?? undefined,
          updatedAt: new Date(),
          completedAt: status === "completed" ? new Date() : cur.completedAt ?? undefined,
        })
        .where(eq(salesOrders.id, cur.id))
        .returning();
      return updated[0]!;
    });

    await logActivity({
      kind: "order_status_changed",
      titleAr: `تحديث حالة الطلب ${finalRow.orderNumber}`,
      descriptionAr: `الحالة الجديدة: ${status}`,
      referenceType: "sales_order",
      referenceId: finalRow.id,
      actor: req.appUser,
    });
    res.json(serialize(finalRow));
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    if (code === "INVALID_TRANSITION") {
      res.status(409).json({ error: "INVALID_TRANSITION", detail: (err as Error).message });
      return;
    }
    req.log.error({ err }, "status patch failed");
    res.status(500).json({ error: "INTERNAL" });
  }
});

export default router;
