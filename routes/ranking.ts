import express from "express";
import pool from "../db";
import { verifyToken, isAdmin } from "./middleware-auth";

const router = express.Router();

/**
 * จัดอันดับเกมขายดี
 * เฉพาะแอดมินเท่านั้น
 */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        g.id,
        g.title,
        g.image,
        g.price,
        c.name AS category_name,
        COUNT(t.id) AS total_sales,
        SUM(t.amount) AS total_revenue
      FROM games g
      JOIN transactions t ON g.id = t.game_id
      JOIN categories c ON g.category_id = c.id
      WHERE t.type = 'purchase'
      GROUP BY g.id
      HAVING total_sales > 0
      ORDER BY total_sales DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (error) {
    console.error("จัดอันดับเกมขายดีล้มเหลว:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
});

export default router;
