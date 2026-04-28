import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, dailyClosings } from "@workspace/db";
import { requirePermission } from "../lib/auth";

const router: IRouter = Router();

function dayBounds(dateStr: string): { from: Date; to: Date } {
  const from = new Date(`${dateStr}T00:00:00.000Z`);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

type PosTotalsRow = {
  total: string;
  cash: string;
  card: string;
  cod: string;
  bank_transfer: string;
  stripe: string;
  paypal: string;
  count: string;
  [key: string]: unknown;
};

async function fetchPosTotals(from: Date, to: Date): Promise<PosTotalsRow> {
  const rows = await db.execute<PosTotalsRow>(sql`
    select
      coalesce(sum(total_minor), 0)::text as total,
      coalesce(sum(case when payment_method = 'cash'          then total_minor else 0 end), 0)::text as cash,
      coalesce(sum(case when payment_method = 'card'          then total_minor else 0 end), 0)::text as card,
      coalesce(sum(case when payment_method = 'cod'           then total_minor else 0 end), 0)::text as cod,
      coalesce(sum(case when payment_method = 'bank_transfer' then total_minor else 0 end), 0)::text as bank_transfer,
      coalesce(sum(case when payment_method = 'stripe'        then total_minor else 0 end), 0)::text as stripe,
      coalesce(sum(case when payment_method = 'paypal'        then total_minor else 0 end), 0)::text as paypal,
      count(*)::text as count
    from sales_orders
    where channel = 'pos' and placed_at >= ${from} and placed_at < ${to}
  `);
  return rows.rows[0]!;
}

router.get(
  "/pos/daily-closing/:date",
  requirePermission("pos", "read"),
  async (req, res) => {
    const date = String(req.params.date);
    const { from, to } = dayBounds(date);
    const existing = await db
      .select()
      .from(dailyClosings)
      .where(eq(dailyClosings.closingDate, date))
      .limit(1);

    const t = await fetchPosTotals(from, to);
    res.json({
      date,
      isClosed: !!existing[0],
      salesTotalMinor: Number(t.total),
      cashTotalMinor: Number(t.cash),
      cardTotalMinor: Number(t.card),
      otherTotalMinor:
        Number(t.cod) +
        Number(t.bank_transfer) +
        Number(t.stripe) +
        Number(t.paypal),
      breakdown: {
        cash: Number(t.cash),
        card: Number(t.card),
        cod: Number(t.cod),
        bank_transfer: Number(t.bank_transfer),
        stripe: Number(t.stripe),
        paypal: Number(t.paypal),
      },
      completedCount: Number(t.count),
      // Only physical cash needs counting at close — everything else is
      // already reconciled by the payment provider.
      expectedCashMinor: Number(t.cash),
      countedCashMinor: existing[0]?.countedCashMinor ?? 0,
      varianceMinor: existing[0]?.varianceMinor ?? 0,
      note: existing[0]?.notesAr ?? null,
      closedAt: existing[0]?.closedAt?.toISOString() ?? null,
    });
  },
);

router.post(
  "/pos/daily-closing/:date",
  requirePermission("pos", "write"),
  async (req, res) => {
    const date = String(req.params.date);
    const body = req.body ?? {};
    const counted_in =
      typeof body.countedCash === "number"
        ? body.countedCash
        : typeof body.countedCashMinor === "number"
          ? body.countedCashMinor
          : null;
    const note_in =
      typeof body.note === "string"
        ? body.note
        : typeof body.notesAr === "string"
          ? body.notesAr
          : null;
    const { from, to } = dayBounds(date);
    const t = await fetchPosTotals(from, to);
    const expectedCash = Number(t.cash);
    const counted = counted_in ?? expectedCash;
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
            notesAr: note_in,
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
            notesAr: note_in,
            closedByUserId: req.appUser?.id ?? null,
          })
          .returning()
      )[0]!;
    }

    res.json({
      date,
      isClosed: true,
      completedCount: Number(t.count),
      salesTotalMinor: row.totalSalesMinor,
      cashTotalMinor: row.cashSalesMinor,
      cardTotalMinor: row.cardSalesMinor,
      otherTotalMinor:
        Number(t.cod) +
        Number(t.bank_transfer) +
        Number(t.stripe) +
        Number(t.paypal),
      breakdown: {
        cash: Number(t.cash),
        card: Number(t.card),
        cod: Number(t.cod),
        bank_transfer: Number(t.bank_transfer),
        stripe: Number(t.stripe),
        paypal: Number(t.paypal),
      },
      expectedCashMinor: row.expectedCashMinor,
      countedCashMinor: row.countedCashMinor,
      varianceMinor: row.varianceMinor,
      note: row.notesAr,
      closedAt: row.closedAt.toISOString(),
    });
  },
);

export default router;
