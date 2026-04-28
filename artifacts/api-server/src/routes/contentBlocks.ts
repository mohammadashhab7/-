import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, contentBlocks } from "@workspace/db";
import { requireStaff, requirePermission } from "../lib/auth";

const router: IRouter = Router();

function serialize(b: typeof contentBlocks.$inferSelect) {
  return {
    key: b.key,
    page: b.page,
    titleAr: b.titleAr,
    bodyAr: b.bodyAr,
    imageUrl: b.imageUrl,
    metadata: b.metadata,
    updatedAt: b.updatedAt.toISOString(),
  };
}

router.get("/content-blocks", async (req, res) => {
  const { page } = req.query;
  const filters = [];
  if (typeof page === "string") filters.push(eq(contentBlocks.page, page));
  const rows = await db
    .select()
    .from(contentBlocks)
    .where(filters.length ? filters[0] : undefined)
    .orderBy(asc(contentBlocks.key));
  res.json(rows.map(serialize));
});

router.get("/content-blocks/:key", async (req, res) => {
  const rows = await db
    .select()
    .from(contentBlocks)
    .where(eq(contentBlocks.key, req.params.key))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(rows[0]));
});

router.put("/content-blocks/:key", requirePermission("cms", "write"), async (req, res) => {
  const b = req.body ?? {};
  const existing = await db
    .select()
    .from(contentBlocks)
    .where(eq(contentBlocks.key, req.params.key))
    .limit(1);
  let row;
  if (existing[0]) {
    row = (
      await db
        .update(contentBlocks)
        .set({
          page: b.page ?? existing[0].page,
          titleAr: b.titleAr ?? null,
          bodyAr: b.bodyAr ?? null,
          imageUrl: b.imageUrl ?? null,
          metadata: b.metadata ?? {},
          updatedAt: new Date(),
        })
        .where(eq(contentBlocks.key, req.params.key))
        .returning()
    )[0]!;
  } else {
    row = (
      await db
        .insert(contentBlocks)
        .values({
          key: req.params.key,
          page: b.page || "general",
          titleAr: b.titleAr ?? null,
          bodyAr: b.bodyAr ?? null,
          imageUrl: b.imageUrl ?? null,
          metadata: b.metadata ?? {},
        })
        .returning()
    )[0]!;
  }
  res.json(serialize(row));
});

export default router;
