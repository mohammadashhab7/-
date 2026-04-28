import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settings } from "@workspace/db";
import { requireStaff } from "../lib/auth";

const router: IRouter = Router();

function serialize(s: typeof settings.$inferSelect) {
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

router.patch("/settings", requireStaff(), async (req, res) => {
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
  const updated = await db.update(settings).set(updates).where(eq(settings.id, 1)).returning();
  res.json(serialize(updated[0]!));
});

export default router;
