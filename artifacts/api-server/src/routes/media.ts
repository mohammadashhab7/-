import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, mediaAssets } from "@workspace/db";
import { requireStaff } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function serialize(m: typeof mediaAssets.$inferSelect) {
  return {
    id: m.id,
    kind: m.kind,
    url: m.url,
    titleAr: m.titleAr,
    alt: m.alt,
    sizeBytes: m.sizeBytes,
    mimeType: m.mimeType,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/media", requireStaff(), async (_req, res) => {
  const rows = await db
    .select()
    .from(mediaAssets)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/media", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.url) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const normalized = b.url.startsWith("https://storage.googleapis.com")
    ? objectStorage.normalizeObjectEntityPath(b.url)
    : b.url;
  const inserted = await db
    .insert(mediaAssets)
    .values({
      kind: b.kind || "image",
      url: normalized,
      titleAr: b.titleAr ?? null,
      alt: b.alt ?? null,
      sizeBytes: b.sizeBytes ?? null,
      mimeType: b.mimeType ?? null,
      uploadedByUserId: req.appUser?.id ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.delete("/media/:id", requireStaff(), async (req, res) => {
  await db.delete(mediaAssets).where(eq(mediaAssets.id, req.params.id));
  res.status(204).send();
});

router.post("/media/upload-url", requireStaff(), async (_req, res) => {
  const uploadURL = await objectStorage.getObjectEntityUploadURL();
  const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
  res.json({ uploadURL, objectPath });
});

export default router;
