import { Router, type IRouter } from "express";
import { and, eq, gte, lt, sum, sql } from "drizzle-orm";
import { db, salesOrders, dailyClosings, financialEntries } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

function dayBounds(dateStr: string): { from: Date; to: Date } {
  const from = new Date(`${dateStr}T00:00:00.000Z`);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

router.get("/pos/daily-closing/:date", requireStaff(), async (req, res) => {
  const date = req.params.date;
  const { from, to } = dayBounds(date);
  const existing = await db
    .select()
    .from(dailyClosings)
    .where(eq(dailyClosings.closingDate, date))
    .limit(1);

  const totalsRow = await db.execute<{
    total: string;
    cash: string;
    card: string;
    count: string;
  }>(sql`
    select
      coalesce(sum(total_minor), 0)::text as total,
      coalesce(sum(case when payment_method = 'cash' then total_minor else 0 end), 0)::text as cash,
      coalesce(sum(case when payment_method = 'card' then total_minor else 0 end), 0)::text as card,
      count(*)::text as count
    from sales_orders
    where channel = 'pos' and placed_at >= ${from} and placed_at < ${to}
  `);
  const t = totalsRow.rows[0]!;
  res.json({
    date,
    isClosed: !!existing[0],
    totalSalesMinor: Number(t.total),
    cashSalesMinor: Number(t.cash),
    cardSalesMinor: Number(t.card),
    orderCount: Number(t.count),
    expectedCashMinor: Number(t.cash),
    countedCashMinor: existing[0]?.countedCashMinor ?? 0,
    varianceMinor: existing[0]?.varianceMinor ?? 0,
    notesAr: existing[0]?.notesAr ?? null,
    closedAt: existing[0]?.closedAt?.toISOString() ?? null,
  });
});

router.post("/pos/daily-closing/:date", requireStaff(), async (req, res) => {
  const date = req.params.date;
  const { countedCashMinor, notesAr } = req.body ?? {};
  const { from, to } = dayBounds(date);
  const totalsRow = await db.execute<{
    total: string;
    cash: string;
    card: string;
  }>(sql`
    select
      coalesce(sum(total_minor), 0)::text as total,
      coalesce(sum(case when payment_method = 'cash' then total_minor else 0 end), 0)::text as cash,
      coalesce(sum(case when payment_method = 'card' then total_minor else 0 end), 0)::text as card
    from sales_orders
    where channel = 'pos' and placed_at >= ${from} and placed_at < ${to}
  `);
  const t = totalsRow.rows[0]!;
  const expectedCash = Number(t.cash);
  const counted = typeof countedCashMinor === "number" ? countedCashMinor : expectedCash;
  const variance = counted - expectedCash;

  const existing = await db
    .select()
    .from(dailyClosings)
    .where(eq(dailyClosings.closingDate, date))
    .limit(1);

  let row;
  if (existing[0]) {
    row = (
      await db
        .update(dailyClosings)
        .set({
          totalSalesMinor: Number(t.total),
          cashSalesMinor: expectedCash,
          cardSalesMinor: Number(t.card),
          expectedCashMinor: expectedCash,
          countedCashMinor: counted,
          varianceMinor: variance,
          notesAr: notesAr ?? null,
          closedAt: new Date(),
          closedByUserId: req.appUser?.id ?? null,
        })
        .where(eq(dailyClosings.id, existing[0].id))
        .returning()
    )[0]!;
  } else {
    row = (
      await db
        .insert(dailyClosings)
        .values({
          closingDate: date,
          totalSalesMinor: Number(t.total),
          cashSalesMinor: expectedCash,
          cardSalesMinor: Number(t.card),
          expectedCashMinor: expectedCash,
          countedCashMinor: counted,
          varianceMinor: variance,
          notesAr: notesAr ?? null,
          closedByUserId: req.appUser?.id ?? null,
        })
        .returning()
    )[0]!;
  }

  res.json({
    date,
    isClosed: true,
    totalSalesMinor: row.totalSalesMinor,
    cashSalesMinor: row.cashSalesMinor,
    cardSalesMinor: row.cardSalesMinor,
    expectedCashMinor: row.expectedCashMinor,
    countedCashMinor: row.countedCashMinor,
    varianceMinor: row.varianceMinor,
    notesAr: row.notesAr,
    closedAt: row.closedAt.toISOString(),
  });
});

export default router;
