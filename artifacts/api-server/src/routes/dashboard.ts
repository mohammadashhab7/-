import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, activityLog } from "@workspace/db";
import { requirePermission } from "../lib/auth";
import { CURRENCY_CODE } from "../lib/region";
import { getActiveBusinessUnit } from "../lib/businessUnit";

const router: IRouter = Router();

router.get(
  "/dashboard/kpis",
  requirePermission("reports", "read"),
  async (req, res) => {
    let activeBu;
    try {
      activeBu = await getActiveBusinessUnit(req);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === "BU_REQUIRED" || code === "INVALID_BUSINESS_UNIT") {
        res.status(400).json({ error: code });
        return;
      }
      throw err;
    }
    const buId = activeBu?.id ?? null;
    // Inline SQL fragments scoped by business_unit_id when set. They are
    // prefixed with `and` because they always follow an existing WHERE clause.
    const buSales: SQL = buId ? sql`and business_unit_id = ${buId}` : sql``;
    const buFinancial: SQL = buId ? sql`and business_unit_id = ${buId}` : sql``;
    const buProduction: SQL = buId ? sql`and business_unit_id = ${buId}` : sql``;
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
    from sales_orders where placed_at::date = now()::date ${buSales}
  `);
    const thisWeek = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders
    where placed_at >= date_trunc('week', now())
      and placed_at < date_trunc('week', now()) + interval '7 days'
      ${buSales}
  `);
    const lastWeek = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders
    where placed_at >= date_trunc('week', now()) - interval '7 days'
      and placed_at < date_trunc('week', now())
      ${buSales}
  `);
    const month = await db.execute<{ total: string; count: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total,
           count(*)::text as count
    from sales_orders where date_trunc('month', placed_at) = date_trunc('month', now())
      ${buSales}
  `);
    const pending = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from sales_orders
    where channel='online' and status in ('pending', 'pending_payment', 'paid', 'confirmed', 'preparing', 'ready', 'out_for_delivery')
      ${buSales}
  `);
    const lowStock = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from stock_levels sl
    join products p on p.id = sl.product_id
    join inventory_locations il on il.id = sl.location_id
    where sl.item_type='product' and p.reorder_threshold > 0 and sl.quantity_thousandths < p.reorder_threshold
      ${buId ? sql`and il.business_unit_id = ${buId}` : sql``}
  `);
    const openProd = await db.execute<{ count: string }>(sql`
    select count(*)::text as count from production_orders
    where status in ('planned', 'in_progress') ${buProduction}
  `);
    const cashOnHand = await db.execute<{ total: string }>(sql`
    select coalesce(sum(total_minor), 0)::text as total from sales_orders
    where channel='pos' and payment_method='cash'
      and placed_at::date = now()::date
      ${buSales}
  `);
    const workshopMonthExpense = await db.execute<{ total: string }>(sql`
    select coalesce(sum(amount_minor), 0)::text as total
    from financial_entries
    where module = 'production'
      and type = 'expense'
      and date_trunc('month', occurred_at) = date_trunc('month', now())
      ${buFinancial}
  `);
    const workshopMonthProd = await db.execute<{ count: string }>(sql`
    select count(*)::text as count
    from production_orders
    where status = 'completed'
      and date_trunc('month', completed_at) = date_trunc('month', now())
      ${buProduction}
  `);
    const workshopRawLowStock = await db.execute<{ count: string }>(sql`
    select count(*)::text as count
    from stock_levels sl
    join raw_materials rm on rm.id = sl.material_id
    join inventory_locations il on il.id = sl.location_id
    where sl.item_type = 'raw_material'
      and rm.reorder_threshold > 0
      and sl.quantity_thousandths < rm.reorder_threshold
      ${buId ? sql`and il.business_unit_id = ${buId}` : sql``}
  `);
    const thisWeekTotal = Number(thisWeek.rows[0]!.total);
    const lastWeekTotal = Number(lastWeek.rows[0]!.total);
    const wowDeltaPct =
      lastWeekTotal > 0
        ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
        : null;
    res.json({
      currency: CURRENCY_CODE,
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
      workshopMonthExpenseMinor: Number(workshopMonthExpense.rows[0]!.total),
      workshopMonthProductionOrders: Number(workshopMonthProd.rows[0]!.count),
      workshopRawMaterialLowStockCount: Number(workshopRawLowStock.rows[0]!.count),
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
  async (req, res) => {
    let activeBu;
    try {
      activeBu = await getActiveBusinessUnit(req);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === "BU_REQUIRED" || code === "INVALID_BUSINESS_UNIT") {
        res.status(400).json({ error: code });
        return;
      }
      throw err;
    }
    // When a BU is active, show activities tagged with that BU OR untagged
    // (NULL — for legacy rows or cross-BU events that should surface
    // everywhere). Privileged users on the global view see everything.
    const buFilter =
      activeBu === null
        ? undefined
        : or(
            eq(activityLog.businessUnitId, activeBu.id),
            isNull(activityLog.businessUnitId),
          );
    const rows = await db
      .select()
      .from(activityLog)
      .where(buFilter ? and(buFilter) : undefined)
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
