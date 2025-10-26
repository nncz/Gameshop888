import { Router, Request, Response } from "express";
import pool from "../db";
import { RowDataPacket } from "mysql2/promise";
import { verifyToken, isAdmin, AuthRequest } from "./middleware-auth";

const router = Router();

/**
 * 🧭 Admin Dashboard
 */
router.get("/dashboard", (req: Request, res: Response) => {
  res.json({ message: "Welcome to Admin Dashboard" });
});

/**
 * 👥 แสดงผู้ใช้ทั้งหมด
 */
router.get("/users", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, username, email, role, created_at FROM users"
    );
    res.json(rows);
  } catch (err: unknown) {
    if (err instanceof Error)
      res.status(500).json({ error: err.message });
    else
      res.status(500).json({ error: "Unknown error" });
  }
});

/**
 * 💳 แสดงประวัติธุรกรรมของผู้ใช้ทั้งหมด (เฉพาะ Admin)
 * Endpoint: GET /api/admin/transactions?search=ชื่อผู้ใช้
 */
router.get(
  "/transactions",
  verifyToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const search = req.query.search ? `%${req.query.search}%` : "%%";

      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT 
          u.username,
          t.type,
          t.amount,
          g.title AS game_title,
          DATE_FORMAT(t.created_at, '%d/%m/%Y') AS date
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN games g ON t.game_id = g.id
        WHERE u.username LIKE ?
        ORDER BY t.created_at DESC
        `,
        [search]
      );

      res.json(rows);
    } catch (err: unknown) {
      if (err instanceof Error)
        res.status(500).json({ error: err.message });
      else
        res.status(500).json({ error: "Unknown error" });
    }
  }
);

export default router;
