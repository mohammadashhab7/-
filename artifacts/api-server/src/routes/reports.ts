import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, financialEntries } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

async function bookSummary(
  module: "production" | "store" | "all",
  fromDate?: string,
  toDate?: string,
) {
  const conds = [sql`true`];
  if (module !== "all") conds.push(sql`module = ${module}`);
  if (fromDate) conds.push(sql`occurred_at >= ${fromDate}`);
  if (toDate) conds.push(sql`occurred_at <= ${toDate}`);
  const where = sql.join(conds, sql` and `);

  const totals = await db.execute<{ income: string; expense: string }>(sql`
      select
        coalesce(sum(case when type='income' then amount_minor else 0 end), 0)::text as income,
        coalesce(sum(case when type='expense' then amount_minor else 0 end), 0)::text as expense
      from financial_entries where ${where}
    `);
  const cats = await db.execute<{
    type: string;
    category: string;
    amount: string;
  }>(sql`
      select type, category, coalesce(sum(amount_minor), 0)::text as amount
      from financial_entries where ${where}
      group by type, category
      order by sum(amount_minor) desc
      limit 30
    `);
  const t = totals.rows[0]!;
  const income = Number(t.income);
  const expense = Number(t.expense);
  return {
    module,
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: income - expense,
    byCategory: cats.rows.map((r) => ({
      type: r.type,
      category: r.category,
      amountMinor: Number(r.amount),
    })),
  };
}

router.get("/reports/financial", requireStaff(), async (req, res) => {
  const { module, fromDate, toDate } = req.query;
  const m =
    module === "production" || module === "store" || module === "all"
      ? module
      : "all";
  const summary = await bookSummary(
    m,
    typeof fromDate === "string" ? fromDate : undefined,
    typeof toDate === "string" ? toDate : undefined,
  );
  res.json(summary);
});

router.get("/reports/sales-trend", requireStaff(), async (req, res) => {
  const days = Math.min(
    Math.max(typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 14, 1),
    180,
  );
  const rows = await db.execute<{
    date: string;
    pos_total: string;
    online_total: string;
    pos_count: string;
    online_count: string;
  }>(sql`
    with d as (
      select generate_series((now()::date - (${days - 1})::int), now()::date, '1 day') as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as date,
      coalesce(sum(case when so.channel='pos' then so.total_minor else 0 end), 0)::text as pos_total,
      coalesce(sum(case when so.channel='online' then so.total_minor else 0 end), 0)::text as online_total,
      coalesce(sum(case when so.channel='pos' then 1 else 0 end), 0)::text as pos_count,
      coalesce(sum(case when so.channel='online' then 1 else 0 end), 0)::text as online_count
    from d
    left join sales_orders so on so.placed_at::date = d.day
    group by d.day
    order by d.day
  `);
  res.json(
    rows.rows.map((r) => ({
      date: r.date,
      posTotalMinor: Number(r.pos_total),
      onlineTotalMinor: Number(r.online_total),
      posOrderCount: Number(r.pos_count),
      onlineOrderCount: Number(r.online_count),
      totalMinor: Number(r.pos_total) + Number(r.online_total),
    })),
  );
});

router.get("/reports/top-products", requireStaff(), async (req, res) => {
  const limit = Math.min(
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 10,
    50,
  );
  const days = Math.min(
    typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30,
    365,
  );
  const rows = await db.execute<{
    product_id: string;
    name_ar: string;
    quantity: string;
    revenue: string;
  }>(sql`
    select soi.product_id, soi.product_name_ar as name_ar,
      sum(soi.quantity)::text as quantity,
      sum(soi.total_minor)::text as revenue
    from sales_order_items soi
    join sales_orders so on so.id = soi.order_id
    where so.placed_at >= now() - (${days} || ' days')::interval
    group by soi.product_id, soi.product_name_ar
    order by sum(soi.quantity) desc
    limit ${limit}
  `);
  res.json(
    rows.rows.map((r) => ({
      productId: r.product_id,
      productNameAr: r.name_ar,
      quantitySold: Number(r.quantity),
      revenueMinor: Number(r.revenue),
    })),
  );
});

export default router;
