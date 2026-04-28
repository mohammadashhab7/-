import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, categories } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .slice(0, 100) || `c-${Date.now()}`;
}

function serialize(c: typeof categories.$inferSelect) {
  return {
    id: c.id,
    slug: c.slug,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    descriptionAr: c.descriptionAr,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/categories", async (_req, res) => {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.nameAr));
  res.json(rows.map(serialize));
});

router.post("/categories", requireStaff(), async (req, res) => {
  const { nameAr, nameEn, descriptionAr, imageUrl, sortOrder, isActive, slug } =
    req.body ?? {};
  if (!nameAr) {
    res.status(400).json({ error: "VALIDATION", details: "nameAr required" });
    return;
  }
  const inserted = await db
    .insert(categories)
    .values({
      nameAr,
      nameEn: nameEn ?? null,
      descriptionAr: descriptionAr ?? null,
      imageUrl: imageUrl ?? null,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
      slug: slug || slugify(nameEn || nameAr),
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.patch("/categories/:id", requireStaff(), async (req, res) => {
  const id = req.params.id;
  const { nameAr, nameEn, descriptionAr, imageUrl, sortOrder, isActive, slug } =
    req.body ?? {};
  const updates: Partial<typeof categories.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (nameAr !== undefined) updates.nameAr = nameAr;
  if (nameEn !== undefined) updates.nameEn = nameEn;
  if (descriptionAr !== undefined) updates.descriptionAr = descriptionAr;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = isActive;
  if (slug !== undefined) updates.slug = slug;
  const updated = await db
    .update(categories)
    .set(updates)
    .where(eq(categories.id, id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(updated[0]));
});

router.delete("/categories/:id", requireStaff(), async (req, res) => {
  await db.delete(categories).where(eq(categories.id, req.params.id));
  res.status(204).send();
});

export default router;
