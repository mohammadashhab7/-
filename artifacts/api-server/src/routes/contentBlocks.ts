import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, contentBlocks } from "@workspace/db";
import { requirePermission } from "../lib/auth";

const router: IRouter = Router();

type Meta = Record<string, unknown>;

function asMeta(v: unknown): Meta {
  return v && typeof v === "object" ? (v as Meta) : {};
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function serialize(b: typeof contentBlocks.$inferSelect) {
  const meta = asMeta(b.metadata);
  return {
    id: b.key,
    key: b.key,
    page: b.page,
    titleAr: b.titleAr ?? undefined,
    contentAr: b.bodyAr ?? "",
    imageUrl: b.imageUrl ?? undefined,
    ctaLabel: asString(meta.ctaLabel),
    ctaHref: asString(meta.ctaHref),
    metadata: meta,
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
    .where(eq(contentBlocks.key, String(req.params.key)))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(rows[0]));
});

router.put("/content-blocks/:key", requirePermission("cms", "write"), async (req, res) => {
  const b = (req.body ?? {}) as {
    page?: string;
    titleAr?: string | null;
    contentAr?: string | null;
    imageUrl?: string | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    metadata?: Meta;
  };
  const key = String(req.params.key);
  const existing = (
    await db.select().from(contentBlocks).where(eq(contentBlocks.key, key)).limit(1)
  )[0];

  const baseMeta = asMeta(existing?.metadata ?? b.metadata);
  const mergedMeta: Meta = {
    ...baseMeta,
    ...(b.metadata ?? {}),
  };
  if (b.ctaLabel !== undefined) mergedMeta.ctaLabel = b.ctaLabel ?? "";
  if (b.ctaHref !== undefined) mergedMeta.ctaHref = b.ctaHref ?? "";
  if (mergedMeta.ctaLabel === "") delete mergedMeta.ctaLabel;
  if (mergedMeta.ctaHref === "") delete mergedMeta.ctaHref;

  let row;
  if (existing) {
    row = (
      await db
        .update(contentBlocks)
        .set({
          page: b.page ?? existing.page,
          titleAr: b.titleAr ?? existing.titleAr ?? null,
          bodyAr: b.contentAr ?? existing.bodyAr ?? null,
          imageUrl: b.imageUrl ?? existing.imageUrl ?? null,
          metadata: mergedMeta,
          updatedAt: new Date(),
        })
        .where(eq(contentBlocks.key, key))
        .returning()
    )[0]!;
  } else {
    row = (
      await db
        .insert(contentBlocks)
        .values({
          key,
          page: b.page || "general",
          titleAr: b.titleAr ?? null,
          bodyAr: b.contentAr ?? null,
          imageUrl: b.imageUrl ?? null,
          metadata: mergedMeta,
        })
        .returning()
    )[0]!;
  }
  res.json(serialize(row));
});

export default router;
