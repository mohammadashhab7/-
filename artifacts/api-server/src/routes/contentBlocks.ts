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
  // Always revalidate so the public site never shows stale CMS content.
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
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
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.json(serialize(rows[0]));
});

router.put("/content-blocks/:key", requirePermission("cms", "write"), async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const b = body as {
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

  // Metadata: REPLACE wholesale when provided in body. The admin form holds
  // the complete latest state, so removed keys must actually go away.
  const newMeta: Meta =
    "metadata" in body ? { ...asMeta(b.metadata) } : asMeta(existing?.metadata);

  // Mirror ctaLabel / ctaHref into metadata for backward compatibility.
  if ("ctaLabel" in body) {
    if (typeof b.ctaLabel === "string" && b.ctaLabel.length > 0) {
      newMeta.ctaLabel = b.ctaLabel;
    } else {
      delete newMeta.ctaLabel;
    }
  }
  if ("ctaHref" in body) {
    if (typeof b.ctaHref === "string" && b.ctaHref.length > 0) {
      newMeta.ctaHref = b.ctaHref;
    } else {
      delete newMeta.ctaHref;
    }
  }

  // Column field semantics:
  //   field absent from body  → keep existing
  //   field null / empty str  → clear (null)
  //   non-empty string        → set
  const pickStr = (
    field: string,
    existingVal: string | null | undefined,
  ): string | null => {
    if (!(field in body)) return existingVal ?? null;
    const v = body[field];
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v.length > 0 ? v : null;
    return null;
  };

  const page =
    "page" in body && typeof b.page === "string" && b.page.length > 0
      ? b.page
      : existing?.page ?? "general";
  const titleAr = pickStr("titleAr", existing?.titleAr);
  const bodyAr = pickStr("contentAr", existing?.bodyAr);
  const imageUrl = pickStr("imageUrl", existing?.imageUrl);

  let row;
  if (existing) {
    row = (
      await db
        .update(contentBlocks)
        .set({
          page,
          titleAr,
          bodyAr,
          imageUrl,
          metadata: newMeta,
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
          page,
          titleAr,
          bodyAr,
          imageUrl,
          metadata: newMeta,
        })
        .returning()
    )[0]!;
  }
  // Prevent stale CMS data being served from intermediary caches/browsers.
  res.setHeader("Cache-Control", "no-store");
  res.json(serialize(row));
});

export default router;
