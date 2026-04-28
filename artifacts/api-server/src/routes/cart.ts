import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, carts, cartItems, products } from "@workspace/db";
import { loadAppUser } from "../lib/auth";

const router: IRouter = Router();

const COOKIE = "dms_cart";

async function loadOrCreateCart(req: Request, res: Response) {
  const user = await loadAppUser(req);
  let cart = null as typeof carts.$inferSelect | null;
  if (user) {
    const found = await db.select().from(carts).where(eq(carts.userId, user.id)).limit(1);
    cart = found[0] ?? null;
  }
  if (!cart) {
    let token = req.cookies?.[COOKIE];
    if (token) {
      const found = await db
        .select()
        .from(carts)
        .where(eq(carts.sessionToken, token))
        .limit(1);
      cart = found[0] ?? null;
    }
    if (!cart) {
      token = randomUUID();
      const inserted = await db
        .insert(carts)
        .values({ sessionToken: token, userId: user?.id ?? null })
        .returning();
      cart = inserted[0]!;
      res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
    } else if (user && !cart.userId) {
      const upd = await db
        .update(carts)
        .set({ userId: user.id, updatedAt: new Date() })
        .where(eq(carts.id, cart.id))
        .returning();
      cart = upd[0]!;
    }
  }
  return cart!;
}

async function serializeCart(cart: typeof carts.$inferSelect) {
  const items = await db
    .select({ ci: cartItems, p: products })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cart.id));
  const lineItems = items.map((x) => ({
    id: x.ci.id,
    productId: x.p.id,
    productNameAr: x.p.nameAr,
    productImageUrl: x.p.imageUrl,
    productSlug: x.p.slug,
    quantity: x.ci.quantity,
    unitPriceMinor: x.p.priceMinor,
    totalMinor: x.p.priceMinor * x.ci.quantity,
  }));
  const subtotal = lineItems.reduce((s, it) => s + it.totalMinor, 0);
  const totalQuantity = lineItems.reduce((s, it) => s + it.quantity, 0);
  return {
    id: cart.id,
    items: lineItems,
    subtotalMinor: subtotal,
    totalQuantity,
  };
}

router.get("/cart", async (req, res) => {
  const cart = await loadOrCreateCart(req, res);
  res.json(await serializeCart(cart));
});

router.post("/cart/items", async (req, res) => {
  const { productId, quantity } = req.body ?? {};
  if (!productId) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const cart = await loadOrCreateCart(req, res);
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) {
    res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
    return;
  }
  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(cartItems)
      .set({ quantity: existing[0].quantity + qty })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({
      cartId: cart.id,
      productId,
      quantity: qty,
      unitPriceMinor: product.priceMinor,
    });
  }
  res.status(201).json(await serializeCart(cart));
});

router.patch("/cart/items/:itemId", async (req, res) => {
  const { quantity } = req.body ?? {};
  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const cart = await loadOrCreateCart(req, res);
  await db
    .update(cartItems)
    .set({ quantity: qty })
    .where(and(eq(cartItems.id, String(req.params.itemId)), eq(cartItems.cartId, cart.id)));
  res.json(await serializeCart(cart));
});

router.delete("/cart/items/:itemId", async (req, res) => {
  const cart = await loadOrCreateCart(req, res);
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, String(req.params.itemId)), eq(cartItems.cartId, cart.id)));
  res.json(await serializeCart(cart));
});

router.delete("/cart", async (req, res) => {
  const cart = await loadOrCreateCart(req, res);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  res.status(204).send();
});

export default router;
