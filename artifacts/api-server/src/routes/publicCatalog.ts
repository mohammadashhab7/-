import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db, products, categories, stockLevels } from "@workspace/db";
import { getLocationByCode } from "../lib/inventory";

const router: IRouter = Router();

function publicProduct(
  p: typeof products.$inferSelect,
  categoryNameAr: string | null,
  inStock: boolean,
) {
  return {
    id: p.id,
    slug: p.slug,
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
    isFeatured: p.isFeatured,
    inStock,
  };
}

/** Returns a Set of product IDs that have positive STORE stock. */
async function inStockSet(productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const storeLoc = await getLocationByCode("STORE");
  if (!storeLoc) return new Set();
  const rows = await db
    .select({ pid: stockLevels.productId, qty: stockLevels.quantity })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.locationId, storeLoc.id),
        eq(stockLevels.itemType, "product"),
        inArray(stockLevels.productId, productIds),
      ),
    );
  const set = new Set<string>();
  for (const r of rows) {
    if (r.pid && r.qty > 0) set.add(r.pid);
  }
  return set;
}

router.get("/public/products", async (req, res) => {
  const { categoryId, search } = req.query;
  const filters = [eq(products.isActive, true)];
  if (typeof categoryId === "string") filters.push(eq(products.categoryId, categoryId));
  if (typeof search === "string" && search.length > 0) {
    filters.push(
      or(
        ilike(products.nameAr, `%${search}%`),
        ilike(products.nameEn, `%${search}%`),
      )!,
    );
  }
  const rows = await db
    .select({ p: products, catName: categories.nameAr })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...filters))
    .orderBy(desc(products.isFeatured), asc(products.sortOrder), asc(products.nameAr));
  const stockSet = await inStockSet(rows.map((r) => r.p.id));
  res.json(rows.map((r) => publicProduct(r.p, r.catName, stockSet.has(r.p.id))));
});

router.get("/public/products/:slug", async (req, res) => {
  const rows = await db
    .select({ p: products, catName: categories.nameAr })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, String(req.params.slug)), eq(products.isActive, true)))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const stockSet = await inStockSet([rows[0].p.id]);
  res.json(publicProduct(rows[0].p, rows[0].catName, stockSet.has(rows[0].p.id)));
});

router.get("/public/categories", async (_req, res) => {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.nameAr));
  res.json(
    rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      descriptionAr: c.descriptionAr,
      imageUrl: c.imageUrl,
    })),
  );
});

router.get("/public/featured", async (_req, res) => {
  const rows = await db
    .select({ p: products, catName: categories.nameAr })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.isActive, true), eq(products.isFeatured, true)))
    .orderBy(asc(products.sortOrder), asc(products.nameAr))
    .limit(12);
  const stockSet = await inStockSet(rows.map((r) => r.p.id));
  res.json(rows.map((r) => publicProduct(r.p, r.catName, stockSet.has(r.p.id))));
});

export default router;
