import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { requireOwnerOrAdmin } from "../lib/auth";

const router: IRouter = Router();

function serialize(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    nameAr: u.nameAr,
    nameEn: u.nameEn,
    email: u.email,
    phone: u.phone,
    role: u.role,
    permissions: u.permissions,
    isActive: u.isActive,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/admin/users", requireOwnerOrAdmin(), async (_req, res) => {
  const rows = await db.select().from(users).where(ne(users.role, "customer"));
  res.json(rows.map(serialize));
});

router.patch("/admin/users/:id", requireOwnerOrAdmin(), async (req, res) => {
  const id = req.params.id;
  const { role, permissions, isActive } = req.body ?? {};
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (typeof role === "string") updates.role = role as typeof users.$inferSelect.role;
  if (Array.isArray(permissions)) updates.permissions = permissions as string[];
  if (typeof isActive === "boolean") updates.isActive = isActive;
  const updated = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(updated[0]));
});

export default router;
