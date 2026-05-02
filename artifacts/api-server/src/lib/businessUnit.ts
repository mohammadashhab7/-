import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, businessUnits } from "@workspace/db";

export type BusinessUnit = typeof businessUnits.$inferSelect;

const HEADER_NAME = "x-business-unit-id";
const QUERY_NAMES = ["bu", "businessUnitId"] as const;

/**
 * Resolve the active business unit for the request.
 *
 * Resolution order:
 *   1. Owner / admin overrides via `X-Business-Unit-Id` header or `?bu=`
 *      (alias `?businessUnitId=`) query string. Admin/owner can browse any unit.
 *   2. Non-admin users fall back to their `assignedBusinessUnitId`.
 *
 * Returns the BusinessUnit row when one was selected, or `null` when the caller
 * is an admin/owner who did not specify a unit (i.e. wants the global view).
 *
 * Throws { code: 'INVALID_BUSINESS_UNIT' } if a non-existent / inactive unit
 * was requested, or { code: 'BU_REQUIRED' } when a non-admin user has no
 * assigned unit and no override is provided.
 */
export async function getActiveBusinessUnit(
  req: Request,
): Promise<BusinessUnit | null> {
  // Mark this request as having consulted the active BU. The dev-mode guard
  // in routes/index.ts uses this flag to warn when a known BU-scoped route
  // forgot to call us — preventing the silent-global-data regression.
  (req as Request & { __buResolved?: boolean }).__buResolved = true;
  const role = req.appUser?.role ?? null;
  const isPrivileged = role === "owner" || role === "admin";

  const headerVal = req.header(HEADER_NAME);
  let queryVal: string | undefined;
  for (const name of QUERY_NAMES) {
    const v = req.query[name];
    if (typeof v === "string" && v.length > 0) {
      queryVal = v;
      break;
    }
  }
  const requested = (headerVal || queryVal || "").trim();

  if (requested) {
    const row = await loadById(requested);
    if (!row || !row.isActive) {
      const e = new Error("INVALID_BUSINESS_UNIT");
      (e as Error & { code?: string }).code = "INVALID_BUSINESS_UNIT";
      throw e;
    }
    // Non-admin users may only "select" their own assigned BU. Anything else
    // is a privilege-escalation attempt and must be rejected.
    if (!isPrivileged) {
      const assigned = req.appUser?.assignedBusinessUnitId ?? null;
      if (!assigned || assigned !== row.id) {
        const e = new Error("INVALID_BUSINESS_UNIT");
        (e as Error & { code?: string }).code = "INVALID_BUSINESS_UNIT";
        throw e;
      }
    }
    return row;
  }

  if (isPrivileged) {
    return null;
  }

  const assigned = req.appUser?.assignedBusinessUnitId ?? null;
  if (!assigned) {
    const e = new Error("BU_REQUIRED");
    (e as Error & { code?: string }).code = "BU_REQUIRED";
    throw e;
  }
  const row = await loadById(assigned);
  if (!row || !row.isActive) {
    const e = new Error("BU_REQUIRED");
    (e as Error & { code?: string }).code = "BU_REQUIRED";
    throw e;
  }
  return row;
}

async function loadById(id: string): Promise<BusinessUnit | null> {
  // Validate UUID shape cheaply to avoid DB error on bad header value.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const rows = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadBusinessUnitBySlug(
  slug: string,
): Promise<BusinessUnit | null> {
  const rows = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export function serializeBusinessUnit(b: BusinessUnit) {
  return {
    id: b.id,
    slug: b.slug,
    kind: b.kind,
    nameAr: b.nameAr,
    nameEn: b.nameEn,
    displayOrder: b.displayOrder,
    isActive: b.isActive,
  };
}
