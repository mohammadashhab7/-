import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, financialEntries } from "@workspace/db";
import { requirePermission } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { CURRENCY_CODE, CURRENCY_SYMBOL } from "../lib/region";
import { getActiveBusinessUnit } from "../lib/businessUnit";

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
    businessUnitId: e.businessUnitId,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/financial-entries", requirePermission("financial", "read"), async (req, res) => {
  const { module, type, fromDate, toDate, limit } = req.query;
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
  const filters = [];
  if (typeof module === "string")
    filters.push(eq(financialEntries.module, module as "production" | "store"));
  if (typeof type === "string")
    filters.push(eq(financialEntries.type, type as "income" | "expense"));
  if (typeof fromDate === "string") filters.push(gte(financialEntries.occurredAt, new Date(fromDate)));
  if (typeof toDate === "string") filters.push(lte(financialEntries.occurredAt, new Date(toDate)));
  if (activeBu) filters.push(eq(financialEntries.businessUnitId, activeBu.id));
  const lim = Math.min(typeof limit === "string" ? parseInt(limit, 10) || 100 : 100, 500);
  const rows = await db
    .select()
    .from(financialEntries)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(financialEntries.occurredAt))
    .limit(lim);
  res.json(rows.map(serialize));
});

router.post("/financial-entries", requirePermission("financial", "write"), async (req, res) => {
  const b = req.body ?? {};
  if (!b.module || !b.type || !b.category || typeof b.amountMinor !== "number") {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
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
  const inserted = await db
    .insert(financialEntries)
    .values({
      module: b.module,
      type: b.type,
      category: b.category,
      descriptionAr: b.descriptionAr || b.category,
      amountMinor: b.amountMinor,
      currency: b.currency || CURRENCY_CODE,
      occurredAt: b.occurredAt ? new Date(b.occurredAt) : new Date(),
      businessUnitId: activeBu?.id ?? null,
      createdByUserId: req.appUser?.id ?? null,
    })
    .returning();
  await logActivity({
    kind: "financial_entry",
    titleAr: `قيد مالي: ${b.descriptionAr || b.category}`,
    descriptionAr: `${b.module === "production" ? "المصنع" : "المتجر"} • ${b.type === "income" ? "إيراد" : "مصروف"} • ${b.amountMinor} ${CURRENCY_SYMBOL}`,
    referenceType: "financial_entry",
    referenceId: inserted[0]!.id,
    actor: req.appUser,
  });
  res.status(201).json(serialize(inserted[0]!));
});

export default router;
