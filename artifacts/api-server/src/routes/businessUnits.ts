import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, businessUnits } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { serializeBusinessUnit } from "../lib/businessUnit";

const router: IRouter = Router();

router.get("/business-units", requireAuth(), async (_req, res) => {
  const rows = await db
    .select()
    .from(businessUnits)
    .orderBy(asc(businessUnits.displayOrder), asc(businessUnits.nameAr));
  res.json(rows.map(serializeBusinessUnit));
});

export default router;
