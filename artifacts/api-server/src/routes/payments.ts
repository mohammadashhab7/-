import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, payments, salesOrders } from "@workspace/db";
import { loadAppUser, requirePermission } from "../lib/auth";

const router: IRouter = Router();

type ProviderName = "stripe" | "paypal" | "cod" | "cash" | "bank_transfer" | "card_terminal";

/**
 * Provider adapter contract.  Each adapter is a thin stub that records the
 * intended provider call.  Real activation requires the corresponding
 * integration (Stripe, PayPal) and environment secrets to be configured —
 * see replit.md "Payments" for setup instructions.
 */
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

const stripeAdapter: PaymentAdapter = {
  name: "stripe",
  isActive: () => Boolean(process.env.STRIPE_SECRET_KEY),
  async createIntent({ orderId, amountMinor, currency }) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        providerIntentId: null,
        providerClientSecret: null,
        payload: { provider: "stripe", activated: false, orderId, amountMinor, currency },
      };
    }
    // Real Stripe call would go here. Stub records intent so order can be
    // linked once the integration is enabled.
    return {
      providerIntentId: `stripe_stub_${orderId}`,
      providerClientSecret: null,
      payload: { provider: "stripe", activated: true, stub: true, orderId, amountMinor, currency },
    };
  },
};

const paypalAdapter: PaymentAdapter = {
  name: "paypal",
  isActive: () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET),
  async createIntent({ orderId, amountMinor, currency }) {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
      return {
        providerIntentId: null,
        providerClientSecret: null,
        payload: { provider: "paypal", activated: false, orderId, amountMinor, currency },
      };
    }
    return {
      providerIntentId: `paypal_stub_${orderId}`,
      providerClientSecret: null,
      payload: { provider: "paypal", activated: true, stub: true, orderId, amountMinor, currency },
    };
  },
};

const codAdapter: PaymentAdapter = {
  name: "cod",
  isActive: () => true,
  async createIntent({ orderId, amountMinor, currency }) {
    return {
      providerIntentId: null,
      providerClientSecret: null,
      payload: { provider: "cod", orderId, amountMinor, currency, requiresCollection: true },
    };
  },
};

const cashAdapter: PaymentAdapter = {
  name: "cash",
  isActive: () => true,
  async createIntent({ orderId, amountMinor, currency }) {
    return {
      providerIntentId: null,
      providerClientSecret: null,
      payload: { provider: "cash", orderId, amountMinor, currency },
    };
  },
};

export const adapters: Record<ProviderName, PaymentAdapter> = {
  stripe: stripeAdapter,
  paypal: paypalAdapter,
  cod: codAdapter,
  cash: cashAdapter,
  bank_transfer: {
    name: "bank_transfer",
    isActive: () => true,
    async createIntent({ orderId, amountMinor, currency }) {
      return {
        providerIntentId: null,
        providerClientSecret: null,
        payload: { provider: "bank_transfer", orderId, amountMinor, currency },
      };
    },
  },
  card_terminal: {
    name: "card_terminal",
    isActive: () => true,
    async createIntent({ orderId, amountMinor, currency }) {
      return {
        providerIntentId: null,
        providerClientSecret: null,
        payload: { provider: "card_terminal", orderId, amountMinor, currency },
      };
    },
  },
};

/**
 * Persist a payment record for an order.  Uses the appropriate provider
 * adapter; for inactive providers, status is set to "pending" with a
 * descriptive payload so the UI can show the activation requirement.
 */
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
    const updated = await db
      .update(payments)
      .set({ status: "succeeded", updatedAt: new Date() })
      .where(eq(payments.id, String(req.params.id)))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    await db
      .update(salesOrders)
      .set({ paymentStatus: "succeeded", status: "paid", updatedAt: new Date() })
      .where(eq(salesOrders.id, updated[0].orderId));
    res.json({ ok: true });
  },
);

export default router;
