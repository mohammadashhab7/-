import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, products, categories } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .slice(0, 140) || `p-${Date.now()}`;
}

function serialize(
  p: typeof products.$inferSelect,
  categoryNameAr?: string | null,
) {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn,
    categoryId: p.categoryId,
    categoryNameAr: categoryNameAr ?? null,
    priceMinor: p.priceMinor,
    currency: p.currency,
    unit: p.unit,
    weightGrams: p.weightGrams,
    imageUrl: p.imageUrl,
    galleryUrls: p.galleryUrls,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    reorderThreshold: p.reorderThreshold,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/products", async (req, res) => {
  const { categoryId, search, isActive, isFeatured } = req.query;
  const filters = [] as ReturnType<typeof eq>[];
  if (typeof categoryId === "string") filters.push(eq(products.categoryId, categoryId));
  if (typeof isActive === "string")
    filters.push(eq(products.isActive, isActive === "true"));
  if (typeof isFeatured === "string")
    filters.push(eq(products.isFeatured, isFeatured === "true"));
  if (typeof search === "string" && search.length > 0) {
    filters.push(
      or(
        ilike(products.nameAr, `%${search}%`),
        ilike(products.nameEn, `%${search}%`),
        ilike(products.sku, `%${search}%`),
      )!,
    );
  }
  const rows = await db
    .select({ p: products, catName: categories.nameAr })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(products.isFeatured), asc(products.sortOrder), asc(products.nameAr));
  res.json(rows.map((r) => serialize(r.p, r.catName)));
});

router.post("/products", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.nameAr) {
    res.status(400).json({ error: "VALIDATION", details: "nameAr required" });
    return;
  }
  const sku = b.sku || `SKU-${Date.now()}`;
  const slug = b.slug || slugify(b.nameEn || b.nameAr);
  const inserted = await db
    .insert(products)
    .values({
      nameAr: b.nameAr,
      nameEn: b.nameEn ?? null,
      descriptionAr: b.descriptionAr ?? null,
      descriptionEn: b.descriptionEn ?? null,
      categoryId: b.categoryId ?? null,
      priceMinor: typeof b.priceMinor === "number" ? b.priceMinor : 0,
      currency: b.currency || "SYP",
      unit: b.unit || "piece",
      weightGrams: b.weightGrams ?? null,
      imageUrl: b.imageUrl ?? null,
      galleryUrls: Array.isArray(b.galleryUrls) ? b.galleryUrls : [],
      isActive: typeof b.isActive === "boolean" ? b.isActive : true,
      isFeatured: typeof b.isFeatured === "boolean" ? b.isFeatured : false,
      reorderThreshold:
        typeof b.reorderThreshold === "number" ? b.reorderThreshold : 0,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
      sku,
      slug,
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.get("/products/:id", async (req, res) => {
  const rows = await db
    .select({ p: products, catName: categories.nameAr })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, req.params.id))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(rows[0].p, rows[0].catName));
});

router.patch("/products/:id", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  const updates: Partial<typeof products.$inferInsert> = {
    updatedAt: new Date(),
  };
  for (const k of [
    "nameAr",
    "nameEn",
    "descriptionAr",
    "descriptionEn",
    "categoryId",
    "priceMinor",
    "currency",
    "unit",
    "weightGrams",
    "imageUrl",
    "galleryUrls",
    "isActive",
    "isFeatured",
    "reorderThreshold",
    "sortOrder",
    "sku",
    "slug",
  ] as const) {
    if (b[k] !== undefined) (updates as Record<string, unknown>)[k] = b[k];
  }
  const updated = await db
    .update(products)
    .set(updates)
    .where(eq(products.id, req.params.id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(updated[0]));
});

router.delete("/products/:id", requireStaff(), async (req, res) => {
  await db.delete(products).where(eq(products.id, req.params.id));
  res.status(204).send();
});

export default router;
