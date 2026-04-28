import { Router, type IRouter } from "express";
import { loadAppUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  const u = await loadAppUser(req);
  if (!u) {
    res.status(200).json({ isAuthenticated: false });
    return;
  }
  res.json({
    isAuthenticated: true,
    id: u.id,
    email: u.email ?? undefined,
    name: u.nameAr ?? u.nameEn ?? undefined,
    imageUrl: u.avatarUrl ?? undefined,
    role: u.role,
    permissions: u.permissions ?? [],
  });
});

export default router;
