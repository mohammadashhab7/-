import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, financialEntries } from "@workspace/db";
import { requireStaff } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

function serialize(e: typeof financialEntries.$inferSelect) {
  return {
    id: e.id,
    module: e.module,
    type: e.type,
    category: e.category,
    descriptionAr: e.descriptionAr,
    amountMinor: e.amountMinor,
    currency: e.currency,
    occurredAt: e.occurredAt.toISOString(),
    referenceType: e.referenceType,
    referenceId: e.referenceId,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/financial-entries", requireStaff(), async (req, res) => {
  const { module, type, fromDate, toDate, limit } = req.query;
  const filters = [];
  if (typeof module === "string")
    filters.push(eq(financialEntries.module, module as "production" | "store"));
  if (typeof type === "string")
    filters.push(eq(financialEntries.type, type as "income" | "expense"));
  if (typeof fromDate === "string") filters.push(gte(financialEntries.occurredAt, new Date(fromDate)));
  if (typeof toDate === "string") filters.push(lte(financialEntries.occurredAt, new Date(toDate)));
  const lim = Math.min(typeof limit === "string" ? parseInt(limit, 10) || 100 : 100, 500);
  const rows = await db
    .select()
    .from(financialEntries)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(financialEntries.occurredAt))
    .limit(lim);
  res.json(rows.map(serialize));
});

router.post("/financial-entries", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.module || !b.type || !b.category || typeof b.amountMinor !== "number") {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const inserted = await db
    .insert(financialEntries)
    .values({
      module: b.module,
      type: b.type,
      category: b.category,
      descriptionAr: b.descriptionAr || b.category,
      amountMinor: b.amountMinor,
      currency: b.currency || "SYP",
      occurredAt: b.occurredAt ? new Date(b.occurredAt) : new Date(),
      createdByUserId: req.appUser?.id ?? null,
    })
    .returning();
  await logActivity({
    kind: "financial_entry",
    titleAr: `قيد مالي: ${b.descriptionAr || b.category}`,
    descriptionAr: `${b.module === "production" ? "المصنع" : "المتجر"} • ${b.type === "income" ? "إيراد" : "مصروف"} • ${b.amountMinor} ل.س`,
    referenceType: "financial_entry",
    referenceId: inserted[0]!.id,
    actor: req.appUser,
  });
  res.status(201).json(serialize(inserted[0]!));
});

export default router;
