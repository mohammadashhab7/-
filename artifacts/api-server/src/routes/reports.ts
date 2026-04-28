import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requirePermission } from "../lib/auth";

const router: IRouter = Router();

interface BookSummary {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  currency: string;
  byCategory: Array<{ category: string; type: string; amountMinor: number }>;
}

async function bookSummary(
  module: "production" | "store" | "all",
  fromDate?: string,
  toDate?: string,
): Promise<BookSummary> {
  const conds = [sql`true`];
  if (module !== "all") conds.push(sql`module = ${module}`);
  if (fromDate) conds.push(sql`occurred_at >= ${fromDate}::date`);
  if (toDate) conds.push(sql`occurred_at < (${toDate}::date + interval '1 day')`);
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
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: income - expense,
    currency: "SYP",
    byCategory: cats.rows.map((r) => ({
      category: r.category,
      type: r.type,
      amountMinor: Number(r.amount),
    })),
  };
}

router.get(
  "/reports/financial",
  requirePermission("reports", "read"),
  async (req, res) => {
    const fromDate =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const toDate =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const [production, store, combined] = await Promise.all([
      bookSummary("production", fromDate, toDate),
      bookSummary("store", fromDate, toDate),
      bookSummary("all", fromDate, toDate),
    ]);
    res.json({ production, store, combined });
  },
);

router.get(
  "/reports/financial.csv",
  requirePermission("reports", "read"),
  async (req, res) => {
    const fromDate =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const toDate =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const [production, store] = await Promise.all([
      bookSummary("production", fromDate, toDate),
      bookSummary("store", fromDate, toDate),
    ]);
    const lines = ["module,type,category,amount_minor,currency"];
    for (const row of production.byCategory) {
      lines.push(
        `production,${row.type},${row.category},${row.amountMinor},SYP`,
      );
    }
    for (const row of store.byCategory) {
      lines.push(`store,${row.type},${row.category},${row.amountMinor},SYP`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=financial-${fromDate ?? "all"}-${toDate ?? "all"}.csv`,
    );
    res.send(lines.join("\n"));
  },
);

router.get(
  "/reports/sales-trend",
  requirePermission("reports", "read"),
  async (req, res) => {
    const days = Math.min(
      Math.max(
        typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 14,
        1,
      ),
      90,
    );
    const rows = await db.execute<{
      date: string;
      total: string;
      count: string;
    }>(sql`
    with d as (
      select generate_series((now()::date - (${days - 1})::int), now()::date, '1 day') as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as date,
      coalesce(sum(so.total_minor), 0)::text as total,
      coalesce(count(so.id), 0)::text as count
    from d
    left join sales_orders so on so.placed_at::date = d.day
    group by d.day
    order by d.day
  `);
    res.json(
      rows.rows.map((r) => ({
        date: r.date,
        salesMinor: Number(r.total),
        orders: Number(r.count),
      })),
    );
  },
);

router.get(
  "/reports/top-products",
  requirePermission("reports", "read"),
  async (req, res) => {
    const limit = Math.min(
      typeof req.query.limit === "string"
        ? parseInt(req.query.limit, 10)
        : 10,
      50,
    );
    const days = Math.min(
      typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30,
      90,
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
        unitsSold: Number(r.quantity),
        revenueMinor: Number(r.revenue),
      })),
    );
  },
);

export default router;
