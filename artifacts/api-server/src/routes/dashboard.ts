import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, activityLog } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/kpis", requireStaff(), async (_req, res) => {
  const today = await db.execute<{
    total: string;
    count: string;
  }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders where placed_at::date = now()::date
  `);
  const month = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders where date_trunc('month', placed_at) = date_trunc('month', now())
  `);
  const pending = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from sales_orders
    where channel='online' and status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery')
  `);
  const lowStock = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from stock_levels sl
    join products p on p.id = sl.product_id
    where sl.item_type='product' and p.reorder_threshold > 0 and sl.quantity_thousandths < p.reorder_threshold
  `);
  const products = await db.execute<{ count: string }>(
    sql`select count(*)::text as count from products where is_active = true`,
  );
  const customers = await db.execute<{ count: string }>(
    sql`select count(*)::text as count from users where role = 'customer'`,
  );
  res.json({
    todaySalesMinor: Number(today.rows[0]!.total),
    todayOrderCount: Number(today.rows[0]!.count),
    monthSalesMinor: Number(month.rows[0]!.total),
    monthOrderCount: Number(month.rows[0]!.count),
    pendingOnlineOrders: Number(pending.rows[0]!.count),
    lowStockCount: Number(lowStock.rows[0]!.count),
    activeProductCount: Number(products.rows[0]!.count),
    customerCount: Number(customers.rows[0]!.count),
  });
});

router.get("/dashboard/recent-activity", requireStaff(), async (_req, res) => {
  const rows = await db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(20);
  res.json(
    rows.map((a) => ({
      id: a.id,
      kind: a.kind,
      titleAr: a.titleAr,
      descriptionAr: a.descriptionAr,
      actorNameAr: a.actorNameAr,
      referenceType: a.referenceType,
      referenceId: a.referenceId,
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

export default router;
