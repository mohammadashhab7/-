import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";

const router: IRouter = Router();

router.get("/bootstrap-status", async (_req, res) => {
  const owners = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "owner"))
    .limit(1);
  const hasOwner = owners.length > 0;
  res.json({
    hasOwner,
    bootstrapMessageAr: hasOwner
      ? "النظام جاهز. سجّل الدخول للمتابعة."
      : "لم يتم إنشاء حساب المسؤول الأول بعد. أول مستخدم يسجّل عبر إنشاء حساب سيصبح المسؤول الأعلى تلقائياً (دور: owner) مع صلاحيات كاملة على /admin.",
    bootstrapMessageEn: hasOwner
      ? "System is ready. Sign in to continue."
      : "No Super Admin has been created yet. The first user to sign up will be auto-promoted to owner (full /admin access).",
  });
});

export default router;
