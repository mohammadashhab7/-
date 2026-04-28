import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, activityLog } from "@workspace/db";
import { requirePermission } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/dashboard/kpis",
  requirePermission("reports", "read"),
  async (_req, res) => {
    const today = await db.execute<{
      total: string;
      count: string;
      pos_total: string;
      pos_count: string;
      online_total: string;
      online_count: string;
    }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count,
           coalesce(sum(case when channel='pos' then total_minor else 0 end), 0)::text as pos_total,
           count(*) filter (where channel='pos')::text as pos_count,
           coalesce(sum(case when channel='online' then total_minor else 0 end), 0)::text as online_total,
           count(*) filter (where channel='online')::text as online_count
    from sales_orders where placed_at::date = now()::date
  `);
    const thisWeek = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders
    where placed_at >= date_trunc('week', now())
      and placed_at < date_trunc('week', now()) + interval '7 days'
  `);
    const lastWeek = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders
    where placed_at >= date_trunc('week', now()) - interval '7 days'
      and placed_at < date_trunc('week', now())
  `);
    const month = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders where date_trunc('month', placed_at) = date_trunc('month', now())
  `);
    const pending = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from sales_orders
    where channel='online' and status in ('pending', 'pending_payment', 'paid', 'confirmed', 'preparing', 'ready', 'out_for_delivery')
  `);
    const lowStock = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from stock_levels sl
    join products p on p.id = sl.product_id
    where sl.item_type='product' and p.reorder_threshold > 0 and sl.quantity_thousandths < p.reorder_threshold
  `);
    const openProd = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from production_orders
    where status in ('planned', 'in_progress')
      and (planned_for is null or planned_for::date <= now()::date)
  `);
    const cashOnHand = await db.execute<{ total: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total from sales_orders
    where channel='pos' and payment_method='cash'
      and placed_at::date = now()::date
  `);
    const thisWeekTotal = Number(thisWeek.rows[0]!.total);
    const lastWeekTotal = Number(lastWeek.rows[0]!.total);
    const wowDeltaPct =
      lastWeekTotal > 0
        ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
        : null;
    res.json({
      currency: "SYP",
      todaySalesMinor: Number(today.rows[0]!.total),
      todayOrders: Number(today.rows[0]!.count),
      todayPosSalesMinor: Number(today.rows[0]!.pos_total),
      todayPosOrders: Number(today.rows[0]!.pos_count),
      todayOnlineSalesMinor: Number(today.rows[0]!.online_total),
      todayOnlineOrders: Number(today.rows[0]!.online_count),
      monthSalesMinor: Number(month.rows[0]!.total),
      monthOrders: Number(month.rows[0]!.count),
      thisWeekSalesMinor: thisWeekTotal,
      lastWeekSalesMinor: lastWeekTotal,
      wowDeltaPct: wowDeltaPct === null ? null : Math.round(wowDeltaPct * 10) / 10,
      pendingOnlineOrders: Number(pending.rows[0]!.count),
      lowStockCount: Number(lowStock.rows[0]!.count),
      openProductionToday: Number(openProd.rows[0]!.count),
      cashOnHandMinor: Number(cashOnHand.rows[0]!.total),
    });
  },
);

function mapActivityKind(kind: string): string {
  if (kind.startsWith("order")) return "order";
  if (kind.startsWith("production")) return "production";
  if (kind.startsWith("transfer") || kind.startsWith("stock_transfer"))
    return "transfer";
  if (kind.startsWith("adjustment") || kind.startsWith("stock_adjust"))
    return "adjustment";
  if (
    kind.startsWith("financial") ||
    kind.startsWith("expense") ||
    kind.startsWith("income") ||
    kind.startsWith("payment")
  )
    return "financial";
  return "order";
}

router.get(
  "/dashboard/recent-activity",
  requirePermission("reports", "read"),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(20);
    res.json(
      rows.map((a) => {
        const meta = a.metadata ?? {};
        const amountMinor =
          typeof (meta as Record<string, unknown>).amountMinor === "number"
            ? ((meta as Record<string, unknown>).amountMinor as number)
            : undefined;
        return {
          id: a.id,
          kind: mapActivityKind(a.kind),
          titleAr: a.titleAr,
          subtitleAr: a.descriptionAr ?? undefined,
          amountMinor,
          occurredAt: a.createdAt.toISOString(),
        };
      }),
    );
  },
);

export default router;
