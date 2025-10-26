import express from "express";
import pool from "../db";
import { verifyToken } from "./middleware-auth";

const router = express.Router();

// GET /api/user/discounts
// สำหรับผู้ใช้ปกติ ดูโค้ดส่วนลดที่ใช้ได้
router.get("/", verifyToken, async (req: any, res) => {
  const userId = req.user.id;

  try {
    // 1️⃣ ดึงโค้ดที่ยังไม่หมดอายุและยังไม่ใช้ครบ
    const [discounts] = await pool.query(
      `SELECT id, code, discount_percent, max_uses, used_count, expires_at
       FROM discounts
       WHERE (expires_at IS NULL OR expires_at > NOW())
         AND used_count < max_uses`
    );

    // 2️⃣ ดึงโค้ดที่ user เคยใช้แล้ว
    const [used] = await pool.query(
      "SELECT discount_id FROM user_discounts WHERE user_id = ?",
      [userId]
    );

    const usedIds = (used as any[]).map((u) => u.discount_id);

    // 3️⃣ กรองโค้ดที่ user ยังไม่เคยใช้
    const available = (discounts as any[]).filter(
      (d) => !usedIds.includes(d.id)
    );

    res.json(available);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดโค้ดส่วนลดไม่สำเร็จ" });
  }
});

export default router;
