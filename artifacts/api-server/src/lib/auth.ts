import type { NextFunction, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";

export type AppUser = typeof users.$inferSelect;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: AppUser;
      sessionToken?: string;
    }
  }
}

const STAFF_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "production_lead",
  "store_clerk",
  "cashier",
  "accountant",
]);

export async function loadAppUser(req: Request): Promise<AppUser | null> {
  const auth = getAuth(req);
  const clerkUserId = auth.userId;
  if (!clerkUserId) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }

  let primaryEmail: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let phone: string | null = null;
  try {
    const cu = await clerkClient.users.getUser(clerkUserId);
    primaryEmail =
      cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
        ?.emailAddress ?? cu.emailAddresses[0]?.emailAddress ?? null;
    firstName = cu.firstName;
    lastName = cu.lastName;
    phone = cu.phoneNumbers[0]?.phoneNumber ?? null;
  } catch {
    // Clerk lookup failed; create minimal record from JWT
  }

  const adminCount = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "owner"));
  const role = adminCount.length === 0 ? "owner" : "customer";

  const nameAr =
    [firstName, lastName].filter(Boolean).join(" ") ||
    primaryEmail ||
    "مستخدم جديد";

  const inserted = await db
    .insert(users)
    .values({
      clerkUserId,
      email: primaryEmail,
      nameAr,
      nameEn: [firstName, lastName].filter(Boolean).join(" ") || null,
      phone,
      role,
    })
    .returning();
  return inserted[0] ?? null;
}

export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u = await loadAppUser(req);
    if (!u) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }
    req.appUser = u;
    next();
  };
}

export function requireStaff() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u = await loadAppUser(req);
    if (!u) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }
    if (!STAFF_ROLES.has(u.role)) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    if (!u.isActive) {
      res.status(403).json({ error: "INACTIVE" });
      return;
    }
    req.appUser = u;
    next();
  };
}

export function requireOwnerOrAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u = await loadAppUser(req);
    if (!u || (u.role !== "owner" && u.role !== "admin")) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    req.appUser = u;
    next();
  };
}

export function isStaff(u: AppUser | null | undefined): boolean {
  return !!u && STAFF_ROLES.has(u.role);
}

/**
 * Module names used for permission strings of the form `${module}:read` or
 * `${module}:write`.  Owners and admins always pass.
 */
export type ModuleName =
  | "products"
  | "categories"
  | "raw_materials"
  | "recipes"
  | "inventory"
  | "production"
  | "transfers"
  | "pos"
  | "orders"
  | "financial"
  | "reports"
  | "employees"
  | "users"
  | "cms"
  | "settings"
  | "media";

/**
 * Default per-role module permissions.  Written as a fallback when a user has
 * an empty `users.permissions` array.  Owners/admins always have all access.
 */
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  admin: ["*"],
  manager: [
    "products:read", "products:write",
    "categories:read", "categories:write",
    "raw_materials:read", "raw_materials:write",
    "recipes:read", "recipes:write",
    "inventory:read", "inventory:write",
    "production:read", "production:write",
    "transfers:read", "transfers:write",
    "pos:read", "pos:write",
    "orders:read", "orders:write",
    "financial:read", "financial:write",
    "reports:read",
    "employees:read", "employees:write",
    "cms:read", "cms:write",
    "settings:read",
    "media:read", "media:write",
  ],
  production_lead: [
    "products:read",
    "raw_materials:read", "raw_materials:write",
    "recipes:read", "recipes:write",
    "inventory:read",
    "production:read", "production:write",
    "transfers:read", "transfers:write",
    "media:read",
  ],
  store_clerk: [
    "products:read",
    "inventory:read",
    "transfers:read",
    "orders:read", "orders:write",
    "media:read",
  ],
  cashier: [
    "products:read",
    "pos:read", "pos:write",
    "orders:read",
    "media:read",
  ],
  accountant: [
    "products:read",
    "orders:read",
    "financial:read", "financial:write",
    "reports:read",
    "employees:read",
    "media:read",
  ],
  customer: [],
};

function effectivePermissions(u: AppUser): Set<string> {
  const fromRow = (u.permissions ?? []) as string[];
  const list = fromRow.length ? fromRow : (ROLE_DEFAULT_PERMISSIONS[u.role] ?? []);
  return new Set(list);
}

function hasModulePermission(u: AppUser, module: ModuleName, action: "read" | "write"): boolean {
  if (u.role === "owner" || u.role === "admin") return true;
  const perms = effectivePermissions(u);
  if (perms.has("*")) return true;
  if (perms.has(`${module}:${action}`)) return true;
  // write implies read access for the same module
  if (action === "read" && perms.has(`${module}:write`)) return true;
  return false;
}

/**
 * Express middleware: require the caller to be an active staff member with
 * `${module}:${action}` permission.  Owners/admins always pass.
 */
export function requirePermission(module: ModuleName, action: "read" | "write" = "read") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u = await loadAppUser(req);
    if (!u) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }
    if (!STAFF_ROLES.has(u.role)) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    if (!u.isActive) {
      res.status(403).json({ error: "INACTIVE" });
      return;
    }
    if (!hasModulePermission(u, module, action)) {
      res.status(403).json({ error: "FORBIDDEN_MODULE", module, action });
      return;
    }
    req.appUser = u;
    next();
  };
}
