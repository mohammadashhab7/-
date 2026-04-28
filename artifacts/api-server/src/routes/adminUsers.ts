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

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "manager",
  "production_lead",
  "store_clerk",
  "cashier",
  "accountant",
  "customer",
] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

router.patch("/admin/users/:id", requireOwnerOrAdmin(), async (req, res) => {
  const id = String(req.params.id);
  const { role, permissions, isActive } = req.body ?? {};
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (role !== undefined) {
    if (typeof role !== "string" || !ALLOWED_ROLES.includes(role as AllowedRole)) {
      res.status(400).json({ error: "INVALID_ROLE", allowed: ALLOWED_ROLES });
      return;
    }
    updates.role = role as AllowedRole;
  }
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
