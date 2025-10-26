// routes/admin-users.ts
import express from "express";
import pool from "../db"; // MySQL connection
import { isAdmin, verifyToken } from "./middleware-auth";

const router = express.Router();

// ดึงรายชื่อผู้ใช้ทั้งหมดพร้อม role
router.get("/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users");
    res.json(rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ดึงธุรกรรมของ user คนเดียว
// GET /wallet/admin/user/:userId
router.get(
  "/wallet/admin/user/:userId",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const userId = req.params.userId;
    try {
      const [rows] = await pool.query(
        `SELECT t.type, t.amount, t.created_at AS date, 
              u.id AS userId, u.username 
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE u.id = ?`,
        [userId]
      );

      // แปลง row ให้ตรงกับ interface Transaction ของ frontend
      const transactions = (rows as any[]).map((row) => ({
        user: { id: row.userId, username: row.username },
        type: row.type,
        amount: row.amount,
        date: row.date,
      }));

      res.json(transactions);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
