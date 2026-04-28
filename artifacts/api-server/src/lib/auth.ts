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
