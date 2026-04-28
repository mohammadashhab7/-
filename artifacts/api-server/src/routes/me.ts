import { Router, type IRouter } from "express";
import { loadAppUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  const u = await loadAppUser(req);
  if (!u) {
    res.status(200).json({
      isAuthenticated: false,
      user: null,
    });
    return;
  }
  res.json({
    isAuthenticated: true,
    user: {
      id: u.id,
      nameAr: u.nameAr,
      nameEn: u.nameEn,
      email: u.email,
      phone: u.phone,
      role: u.role,
      permissions: u.permissions,
      isActive: u.isActive,
      avatarUrl: u.avatarUrl,
    },
  });
});

export default router;
