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
    const safe = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const lines = ["module,type,category,amount_minor,currency"];
    for (const row of production.byCategory) {
      lines.push(
        `production,${safe(row.type)},${safe(row.category)},${row.amountMinor},SYP`,
      );
    }
    for (const row of store.byCategory) {
      lines.push(
        `store,${safe(row.type)},${safe(row.category)},${row.amountMinor},SYP`,
      );
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

async function topProducts(days: number, limit: number) {
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
  return rows.rows.map((r) => ({
    productId: r.product_id,
    productNameAr: r.name_ar,
    unitsSold: Number(r.quantity),
    revenueMinor: Number(r.revenue),
  }));
}

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
    res.json(await topProducts(days, limit));
  },
);

router.get(
  "/reports/top-products.csv",
  requirePermission("reports", "read"),
  async (req, res) => {
    const days = Math.min(
      typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30,
      90,
    );
    const rows = await topProducts(days, 50);
    const lines = ["product_id,product_name_ar,units_sold,revenue_minor,currency"];
    for (const r of rows) {
      const safe = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
      lines.push(`${r.productId},${safe(r.productNameAr)},${r.unitsSold},${r.revenueMinor},SYP`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=top-products-${days}d.csv`,
    );
    res.send(lines.join("\n"));
  },
);

router.get(
  "/reports/sales-trend.csv",
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
    const lines = ["date,sales_minor,orders,currency"];
    for (const r of rows.rows) {
      lines.push(`${r.date},${r.total},${r.count},SYP`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-trend-${days}d.csv`,
    );
    res.send(lines.join("\n"));
  },
);

router.get(
  "/reports/cogs",
  requirePermission("reports", "read"),
  async (req, res) => {
    const fromDate =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const toDate =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const conds = [sql`so.status in ('paid','completed','delivered')`];
    if (fromDate) conds.push(sql`so.placed_at >= ${fromDate}::date`);
    if (toDate) conds.push(sql`so.placed_at < (${toDate}::date + interval '1 day')`);
    const where = sql.join(conds, sql` and `);
    const totals = await db.execute<{ revenue: string; cogs: string; orders: string }>(sql`
      select
        coalesce(sum(soi.total_minor), 0)::text as revenue,
        coalesce(sum(soi.unit_cost_minor * soi.quantity), 0)::text as cogs,
        coalesce(count(distinct so.id), 0)::text as orders
      from sales_orders so
      join sales_order_items soi on soi.order_id = so.id
      where ${where}
    `);
    const byProduct = await db.execute<{
      product_id: string;
      name_ar: string;
      revenue: string;
      cogs: string;
      units: string;
    }>(sql`
      select soi.product_id, soi.product_name_ar as name_ar,
        coalesce(sum(soi.total_minor), 0)::text as revenue,
        coalesce(sum(soi.unit_cost_minor * soi.quantity), 0)::text as cogs,
        coalesce(sum(soi.quantity), 0)::text as units
      from sales_orders so
      join sales_order_items soi on soi.order_id = so.id
      where ${where}
      group by soi.product_id, soi.product_name_ar
      order by sum(soi.total_minor) desc
      limit 50
    `);
    const t = totals.rows[0]!;
    const revenue = Number(t.revenue);
    const cogs = Number(t.cogs);
    res.json({
      revenueMinor: revenue,
      cogsMinor: cogs,
      grossProfitMinor: revenue - cogs,
      grossMarginBasisPoints: revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 10000) : 0,
      orders: Number(t.orders),
      currency: "SYP",
      byProduct: byProduct.rows.map((r) => ({
        productId: r.product_id,
        productNameAr: r.name_ar,
        revenueMinor: Number(r.revenue),
        cogsMinor: Number(r.cogs),
        grossProfitMinor: Number(r.revenue) - Number(r.cogs),
        unitsSold: Number(r.units),
      })),
    });
  },
);

router.get(
  "/reports/cogs.csv",
  requirePermission("reports", "read"),
  async (req, res) => {
    const fromDate =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const toDate =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const conds = [sql`so.status in ('paid','completed','delivered')`];
    if (fromDate) conds.push(sql`so.placed_at >= ${fromDate}::date`);
    if (toDate) conds.push(sql`so.placed_at < (${toDate}::date + interval '1 day')`);
    const where = sql.join(conds, sql` and `);
    const byProduct = await db.execute<{
      product_id: string;
      name_ar: string;
      revenue: string;
      cogs: string;
      units: string;
    }>(sql`
      select soi.product_id, soi.product_name_ar as name_ar,
        coalesce(sum(soi.total_minor), 0)::text as revenue,
        coalesce(sum(soi.unit_cost_minor * soi.quantity), 0)::text as cogs,
        coalesce(sum(soi.quantity), 0)::text as units
      from sales_orders so
      join sales_order_items soi on soi.order_id = so.id
      where ${where}
      group by soi.product_id, soi.product_name_ar
      order by sum(soi.total_minor) desc
    `);
    const safe = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const lines = ["product_id,product_name_ar,units_sold,revenue_minor,cogs_minor,gross_profit_minor,currency"];
    for (const r of byProduct.rows) {
      const rev = Number(r.revenue);
      const cogs = Number(r.cogs);
      lines.push(`${r.product_id},${safe(r.name_ar)},${r.units},${rev},${cogs},${rev - cogs},SYP`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=cogs-${fromDate ?? "all"}-${toDate ?? "all"}.csv`,
    );
    res.send(lines.join("\n"));
  },
);

router.get(
  "/reports/material-spend",
  requirePermission("reports", "read"),
  async (req, res) => {
    const fromDate =
      typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
    const toDate =
      typeof req.query.toDate === "string" ? req.query.toDate : undefined;
    const where = sql`po.status = 'completed'
      ${fromDate ? sql` and po.completed_at >= ${fromDate}::date` : sql``}
      ${toDate ? sql` and po.completed_at < (${toDate}::date + interval '1 day')` : sql``}`;
    const totalRow = await db.execute<{ total: string }>(sql`
      select coalesce(sum(poi.total_cost_minor), 0)::text as total
      from production_order_items poi
      join production_orders po on po.id = poi.production_order_id
      where ${where}
    `);
    const byMaterial = await db.execute<{
      material_id: string;
      name_ar: string;
      qty_thousandths: string;
      unit: string;
      total: string;
    }>(sql`
      select poi.material_id as material_id,
             rm.name_ar as name_ar,
             rm.unit as unit,
             coalesce(sum(poi.quantity_consumed_thousandths), 0)::text as qty_thousandths,
             coalesce(sum(poi.total_cost_minor), 0)::text as total
      from production_order_items poi
      join production_orders po on po.id = poi.production_order_id
      join raw_materials rm on rm.id = poi.material_id
      where ${where}
      group by poi.material_id, rm.name_ar, rm.unit
      order by sum(poi.total_cost_minor) desc
      limit 50
    `);
    res.json({
      currency: "SYP",
      totalSpendMinor: Number(totalRow.rows[0]!.total),
      byMaterial: byMaterial.rows.map((r) => ({
        materialId: r.material_id,
        nameAr: r.name_ar,
        unit: r.unit,
        quantityThousandths: Number(r.qty_thousandths),
        spendMinor: Number(r.total),
      })),
    });
  },
);

router.get(
  "/reports/store-kpis",
  requirePermission("reports", "read"),
  async (req, res) => {
    const fromDate =
      typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
    const toDate =
      typeof req.query.toDate === "string" ? req.query.toDate : undefined;
    const where = sql`status not in ('cancelled', 'refunded')
      ${fromDate ? sql` and placed_at >= ${fromDate}::date` : sql``}
      ${toDate ? sql` and placed_at < (${toDate}::date + interval '1 day')` : sql``}`;
    const channels = await db.execute<{
      channel: string;
      orders: string;
      total: string;
    }>(sql`
      select channel, count(*)::text as orders, coalesce(sum(total_minor), 0)::text as total
      from sales_orders
      where ${where}
      group by channel
    `);
    const payments = await db.execute<{
      payment_method: string;
      orders: string;
      total: string;
    }>(sql`
      select payment_method, count(*)::text as orders, coalesce(sum(total_minor), 0)::text as total
      from sales_orders
      where ${where}
      group by payment_method
      order by sum(total_minor) desc
    `);
    const overall = await db.execute<{
      orders: string;
      total: string;
      avg: string;
    }>(sql`
      select count(*)::text as orders,
             coalesce(sum(total_minor), 0)::text as total,
             coalesce(avg(total_minor), 0)::text as avg
      from sales_orders
      where ${where}
    `);
    res.json({
      currency: "SYP",
      totalOrders: Number(overall.rows[0]!.orders),
      totalRevenueMinor: Number(overall.rows[0]!.total),
      avgOrderValueMinor: Math.round(Number(overall.rows[0]!.avg)),
      byChannel: channels.rows.map((r) => ({
        channel: r.channel,
        orders: Number(r.orders),
        revenueMinor: Number(r.total),
      })),
      byPaymentMethod: payments.rows.map((r) => ({
        paymentMethod: r.payment_method,
        orders: Number(r.orders),
        revenueMinor: Number(r.total),
      })),
    });
  },
);

export default router;
