import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, mediaAssets } from "@workspace/db";
import { requireStaff, requirePermission } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function serialize(m: typeof mediaAssets.$inferSelect) {
  return {
    id: m.id,
    name: m.titleAr ?? "",
    url: m.url,
    objectPath: m.url,
    kind: m.kind,
    sizeBytes: m.sizeBytes ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/media", requirePermission("media", "read"), async (_req, res) => {
  const rows = await db
    .select()
    .from(mediaAssets)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/media", requirePermission("media", "write"), async (req, res) => {
  const b = req.body ?? {};
  const sourceUrl = b.uploadURL || b.url;
  if (!sourceUrl || !b.name) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  let normalized: string;
  if (
    typeof sourceUrl === "string" &&
    sourceUrl.startsWith("https://storage.googleapis.com")
  ) {
    normalized = await objectStorage.trySetObjectEntityAclPolicy(sourceUrl, {
      owner: req.appUser?.id ?? "system",
      visibility: "public",
    });
  } else {
    normalized = sourceUrl;
  }
  const inserted = await db
    .insert(mediaAssets)
    .values({
      kind: b.kind || "image",
      url: normalized,
      titleAr: b.name,
      alt: b.alt ?? null,
      sizeBytes: b.sizeBytes ?? null,
      mimeType: b.mimeType ?? null,
      uploadedByUserId: req.appUser?.id ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.delete("/media/:id", requirePermission("media", "write"), async (req, res) => {
  await db.delete(mediaAssets).where(eq(mediaAssets.id, String(req.params.id)));
  res.status(204).send();
});

router.post("/media/upload-url", requirePermission("media", "write"), async (_req, res) => {
  const uploadURL = await objectStorage.getObjectEntityUploadURL();
  const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
  res.json({ uploadURL, objectPath });
});

export default router;
