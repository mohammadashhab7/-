import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, salesOrders } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/customer/orders", requireAuth(), async (req, res) => {
  const rows = await db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.customerUserId, req.appUser!.id))
    .orderBy(desc(salesOrders.placedAt))
    .limit(100);
  res.json(
    rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      totalMinor: o.totalMinor,
      createdAt: o.placedAt.toISOString(),
    })),
  );
});

export default router;
