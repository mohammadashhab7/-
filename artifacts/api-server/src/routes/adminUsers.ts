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
    assignedBusinessUnitId: u.assignedBusinessUnitId ?? null,
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

// Roles that operate within a single business unit and therefore MUST have
// `assignedBusinessUnitId` set. Owner/admin are explicitly cross-BU and MUST
// leave it null. Customer is an end-user account, also null.
const SCOPED_ROLES = new Set<AllowedRole>([
  "manager",
  "production_lead",
  "store_clerk",
  "cashier",
  "accountant",
]);
const GLOBAL_ROLES = new Set<AllowedRole>(["owner", "admin", "customer"]);

router.patch("/admin/users/:id", requireOwnerOrAdmin(), async (req, res) => {
  const id = String(req.params.id);
  const existing = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  if (!existing) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const { role, permissions, isActive, assignedBusinessUnitId } = req.body ?? {};
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (assignedBusinessUnitId !== undefined) {
    if (assignedBusinessUnitId === null) {
      updates.assignedBusinessUnitId = null;
    } else if (
      typeof assignedBusinessUnitId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        assignedBusinessUnitId,
      )
    ) {
      updates.assignedBusinessUnitId = assignedBusinessUnitId;
    } else {
      res.status(400).json({ error: "INVALID_BUSINESS_UNIT_ID" });
      return;
    }
  }
  if (role !== undefined) {
    if (typeof role !== "string" || !ALLOWED_ROLES.includes(role as AllowedRole)) {
      res.status(400).json({ error: "INVALID_ROLE", allowed: ALLOWED_ROLES });
      return;
    }
    updates.role = role as AllowedRole;
  }
  if (Array.isArray(permissions)) updates.permissions = permissions as string[];
  if (typeof isActive === "boolean") updates.isActive = isActive;

  // Enforce BU-assignment policy across the merged final state. Scoped staff
  // roles must have an assigned BU; global roles must have none. This prevents
  // a staff user from ending up cross-BU after a partial update, which would
  // otherwise let getActiveBusinessUnit's privileged-only branch leak data.
  const finalRole = (updates.role ?? existing.role) as AllowedRole;
  const finalBu =
    updates.assignedBusinessUnitId !== undefined
      ? updates.assignedBusinessUnitId
      : existing.assignedBusinessUnitId;
  if (SCOPED_ROLES.has(finalRole) && !finalBu) {
    res.status(400).json({ error: "BUSINESS_UNIT_REQUIRED_FOR_ROLE" });
    return;
  }
  if (GLOBAL_ROLES.has(finalRole) && finalBu) {
    res.status(400).json({ error: "BUSINESS_UNIT_NOT_ALLOWED_FOR_ROLE" });
    return;
  }

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
