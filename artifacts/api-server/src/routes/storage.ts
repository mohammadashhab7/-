import { Router, type IRouter, type Request, type Response } from "express";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { loadAppUser } from "../lib/auth";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

/**
 * Pipe a Fetch API Response (returned by GCS download) to an Express Response.
 * Intentionally types the first argument as `globalThis.Response` to avoid
 * collision with Express' `Response` type alias imported above.
 */
async function pipeFetchResponse(
  webResponse: globalThis.Response,
  expressRes: Response,
) {
  webResponse.headers.forEach((value: string, key: string) => {
    expressRes.setHeader(key, value);
  });
  expressRes.status(webResponse.status);
  if (!webResponse.body) {
    expressRes.end();
    return;
  }
  const reader = webResponse.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    expressRes.write(Buffer.from(value));
  }
  expressRes.end();
}

/**
 * Uppy presigned upload URL endpoint. Called by ObjectUploader from
 * @workspace/object-storage-web.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response) => {
    try {
      const u = await loadAppUser(req);
      if (!u) {
        res.status(401).json({ error: "UNAUTHENTICATED" });
        return;
      }
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      const { name, size, contentType } = req.body ?? {};
      res.json({
        uploadURL,
        objectPath,
        metadata: {
          name: typeof name === "string" ? name : null,
          size: typeof size === "number" ? size : null,
          contentType: typeof contentType === "string" ? contentType : null,
        },
      });
    } catch (err) {
      req.log.error({ err }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath as string | string[] | undefined;
      const filePath = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
      const file = await objectStorage.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      const webRes = await objectStorage.downloadObject(file);
      await pipeFetchResponse(webRes, res);
    } catch (err) {
      req.log.error({ err }, "Error serving public object");
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal error" });
      }
    }
  },
);

router.get(
  "/storage/objects/*objectPath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.objectPath as string | string[] | undefined;
      const objectPath = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
      const objectFile = await objectStorage.getObjectEntityFile(
        `/objects/${objectPath}`,
      );
      const u = await loadAppUser(req);
      const allowed = await objectStorage.canAccessObjectEntity({
        userId: u?.id,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      if (!allowed) {
        res.status(u ? 403 : 401).json({ error: u ? "FORBIDDEN" : "UNAUTHENTICATED" });
        return;
      }
      const webRes = await objectStorage.downloadObject(objectFile);
      await pipeFetchResponse(webRes, res);
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err }, "Error serving object");
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal error" });
      }
    }
  },
);

export default router;
