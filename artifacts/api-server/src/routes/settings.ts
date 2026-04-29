import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settings } from "@workspace/db";
import { requireStaff, requirePermission } from "../lib/auth";

const router: IRouter = Router();

function serialize(s: typeof settings.$inferSelect) {
  const meta = (s.metadata ?? {}) as Record<string, unknown>;
  return {
    storeNameAr: s.storeNameAr,
    storeNameEn: s.storeNameEn,
    taglineAr: s.taglineAr,
    addressAr: s.addressAr,
    phone: s.phone,
    email: s.email,
    currency: "SYP",
    currencySymbol: s.currencySymbol,
    taxPercent: s.taxPercent,
    deliveryFeeMinor: s.deliveryFeeMinor,
    freeDeliveryThresholdMinor: s.freeDeliveryThresholdMinor,
    facebookUrl: s.socialFacebook,
    instagramUrl: s.socialInstagram,
    whatsappNumber: s.socialWhatsapp,
    logoUrl: typeof meta.logoUrl === "string" ? meta.logoUrl : undefined,
  };
}

async function getOrCreate() {
  const rows = await db.select().from(settings).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(settings).values({ id: 1 }).returning();
  return inserted[0]!;
}

router.get("/settings", async (_req, res) => {
  const s = await getOrCreate();
  res.json(serialize(s));
});

router.put("/settings", requirePermission("settings", "write"), async (req, res) => {
  await getOrCreate();
  const b = req.body ?? {};
  const updates: Partial<typeof settings.$inferInsert> = { updatedAt: new Date() };
  const directFields = [
    "storeNameAr",
    "storeNameEn",
    "taglineAr",
    "addressAr",
    "phone",
    "email",
    "currencySymbol",
    "deliveryFeeMinor",
    "freeDeliveryThresholdMinor",
  ] as const;
  for (const k of directFields) {
    if (b[k] !== undefined) (updates as Record<string, unknown>)[k] = b[k];
  }
  if (typeof b.taxPercent === "number") updates.taxPercent = b.taxPercent;
  if (b.facebookUrl !== undefined) updates.socialFacebook = b.facebookUrl;
  if (b.instagramUrl !== undefined) updates.socialInstagram = b.instagramUrl;
  if (b.whatsappNumber !== undefined) updates.socialWhatsapp = b.whatsappNumber;
  if (b.logoUrl !== undefined) {
    const current = await db.select({ metadata: settings.metadata }).from(settings).where(eq(settings.id, 1)).limit(1);
    const existingMeta = (current[0]?.metadata ?? {}) as Record<string, unknown>;
    updates.metadata = { ...existingMeta, logoUrl: b.logoUrl };
  }
  const updated = await db.update(settings).set(updates).where(eq(settings.id, 1)).returning();
  res.json(serialize(updated[0]!));
});

export default router;
