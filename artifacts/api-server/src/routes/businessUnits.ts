import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, businessUnits } from "@workspace/db";
import { requireStaff } from "../lib/auth";
import { serializeBusinessUnit } from "../lib/businessUnit";

const router: IRouter = Router();

router.get("/business-units", requireStaff(), async (_req, res) => {
  const rows = await db
    .select()
    .from(businessUnits)
    .where(eq(businessUnits.isActive, true))
    .orderBy(asc(businessUnits.displayOrder), asc(businessUnits.nameAr));
  res.json(rows.map(serializeBusinessUnit));
});

export default router;
