import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, carts, cartItems, settings } from "@workspace/db";
import { loadAppUser } from "../lib/auth";
import { createSalesOrderInternal } from "./salesOrders";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const COOKIE = "dms_cart";

router.post("/checkout", async (req, res) => {
  const user = await loadAppUser(req);
  const token = req.cookies?.[COOKIE];
  let cart = null as typeof carts.$inferSelect | null;
  if (user) {
    cart = (await db.select().from(carts).where(eq(carts.userId, user.id)).limit(1))[0] ?? null;
  }
  if (!cart && token) {
    cart = (await db.select().from(carts).where(eq(carts.sessionToken, token)).limit(1))[0] ?? null;
  }
  if (!cart) {
    res.status(400).json({ error: "EMPTY_CART" });
    return;
  }
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  if (items.length === 0) {
    res.status(400).json({ error: "EMPTY_CART" });
    return;
  }

  const b = req.body ?? {};
  if (!b.customerName || !b.customerPhone || !b.deliveryAddress) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }

  const cfg = (await db.select().from(settings).limit(1))[0];
  const subtotal = items.reduce((s, it) => s + it.unitPriceMinor * it.quantity, 0);
  const free = cfg?.freeDeliveryThresholdMinor ?? 0;
  const delivery =
    free > 0 && subtotal >= free ? 0 : Number(cfg?.deliveryFeeMinor ?? 0);
  const taxPercent = cfg?.taxPercent ?? 0;
  const tax = Math.round((subtotal * taxPercent) / 10000);

  try {
    const order = await createSalesOrderInternal({
      channel: "online",
      customerUserId: user?.id ?? null,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail ?? user?.email ?? null,
      deliveryAddress: b.deliveryAddress,
      paymentMethod: b.paymentMethod || "cod",
      items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      deliveryFeeMinor: delivery,
      taxMinor: tax,
      notesAr: b.notesAr ?? null,
    });
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    res.status(201).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalMinor: order.totalMinor,
      paymentMethod: order.paymentMethod,
    });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (msg.startsWith("INSUFFICIENT_STOCK")) {
      res.status(409).json({ error: "INSUFFICIENT_STOCK", detail: msg });
      return;
    }
    req.log.error({ err }, "Checkout failed");
    res.status(400).json({ error: msg });
  }
});

export default router;
