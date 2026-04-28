import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, payments, salesOrders } from "@workspace/db";
import { loadAppUser, requirePermission } from "../lib/auth";
import { postSaleRevenue } from "./salesOrders";

const router: IRouter = Router();

type ProviderName = "stripe" | "paypal" | "cod" | "cash" | "bank_transfer" | "card_terminal";

interface PaymentAdapter {
  name: ProviderName;
  isActive: () => boolean;
  createIntent: (input: {
    orderId: string;
    amountMinor: number;
    currency: string;
  }) => Promise<{
    providerIntentId: string | null;
    providerClientSecret: string | null;
    payload: Record<string, unknown>;
  }>;
}

function inertAdapter(name: ProviderName): PaymentAdapter {
  return {
    name,
    isActive: () => true,
    async createIntent({ orderId, amountMinor, currency }) {
      return {
        providerIntentId: null,
        providerClientSecret: null,
        payload: { provider: name, orderId, amountMinor, currency },
      };
    },
  };
}

const stripeAdapter: PaymentAdapter = {
  name: "stripe",
  isActive: () => Boolean(process.env.STRIPE_SECRET_KEY),
  async createIntent({ orderId, amountMinor, currency }) {
    const activated = Boolean(process.env.STRIPE_SECRET_KEY);
    return {
      providerIntentId: activated ? `stripe_stub_${orderId}` : null,
      providerClientSecret: null,
      payload: { provider: "stripe", activated, stub: activated, orderId, amountMinor, currency },
    };
  },
};

const paypalAdapter: PaymentAdapter = {
  name: "paypal",
  isActive: () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET),
  async createIntent({ orderId, amountMinor, currency }) {
    const activated = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
    return {
      providerIntentId: activated ? `paypal_stub_${orderId}` : null,
      providerClientSecret: null,
      payload: { provider: "paypal", activated, stub: activated, orderId, amountMinor, currency },
    };
  },
};

export const adapters: Record<ProviderName, PaymentAdapter> = {
  stripe: stripeAdapter,
  paypal: paypalAdapter,
  cod: inertAdapter("cod"),
  cash: inertAdapter("cash"),
  bank_transfer: inertAdapter("bank_transfer"),
  card_terminal: inertAdapter("card_terminal"),
};

export async function recordPayment(input: {
  orderId: string;
  provider: ProviderName;
  amountMinor: number;
  currency: string;
  createdByUserId?: string | null;
  initialStatus?: "pending" | "succeeded" | "not_required";
}) {
  const adapter = adapters[input.provider];
  if (!adapter) throw new Error("UNKNOWN_PROVIDER");
  const intent = await adapter.createIntent({
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  let status: typeof payments.$inferInsert.status = input.initialStatus ?? "pending";
  if ((input.provider === "stripe" || input.provider === "paypal") && !adapter.isActive()) {
    status = "pending";
  }
  const inserted = await db
    .insert(payments)
    .values({
      orderId: input.orderId,
      provider: input.provider,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status,
      providerIntentId: intent.providerIntentId,
      providerClientSecret: intent.providerClientSecret,
      providerPayload: intent.payload,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return inserted[0]!;
}

router.get("/payments/order/:orderId", async (req, res) => {
  const u = await loadAppUser(req);
  if (!u) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }
  const order = (
    await db.select().from(salesOrders).where(eq(salesOrders.id, String(req.params.orderId))).limit(1)
  )[0];
  if (!order) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  // Customers may only see payments for their own orders; staff may see all.
  const STAFF = new Set(["owner", "admin", "manager", "production_lead", "store_clerk", "cashier", "accountant"]);
  if (!STAFF.has(u.role) && order.customerUserId !== u.id) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id));
  res.json(
    rows.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      provider: p.provider,
      status: p.status,
      amountMinor: p.amountMinor,
      currency: p.currency,
      providerIntentId: p.providerIntentId,
      providerActive: adapters[p.provider as ProviderName]?.isActive() ?? false,
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

router.patch(
  "/payments/:id/mark-succeeded",
  requirePermission("financial", "write"),
  async (req, res) => {
    const result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(payments)
        .set({ status: "succeeded", updatedAt: new Date() })
        .where(eq(payments.id, String(req.params.id)))
        .returning();
      if (!updated[0]) return null;
      const orderRow = (
        await tx
          .update(salesOrders)
          .set({ paymentStatus: "succeeded", status: "paid", updatedAt: new Date() })
          .where(eq(salesOrders.id, updated[0].orderId))
          .returning()
      )[0];
      if (orderRow) {
        await postSaleRevenue(tx, orderRow, req.appUser?.id ?? null);
      }
      return { ok: true };
    });
    if (!result) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(result);
  },
);

export default router;
