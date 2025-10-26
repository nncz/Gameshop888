import express from "express";
import pool from "../db";
import { verifyToken, AuthRequest } from "./middleware-auth";

const router = express.Router();

// โหลดตะกร้า
router.get("/", verifyToken, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id as cart_id, g.* 
       FROM carts c 
       JOIN games g ON c.game_id = g.id
       WHERE c.user_id = ?`,
      [req.user!.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// เพิ่มเกม
router.post("/add", verifyToken, async (req: AuthRequest, res) => {
  const { game_id } = req.body;
  if (!game_id) return res.status(400).json({ error: "Missing game_id" });

  try {
    await pool.query(
      "INSERT INTO carts (user_id, game_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP",
      [req.user!.id, game_id]
    );
    res.json({ message: "Added to cart" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ลบเกม
router.post("/remove", verifyToken, async (req: AuthRequest, res) => {
  const { game_id } = req.body;
  try {
    await pool.query("DELETE FROM carts WHERE user_id = ? AND game_id = ?", [
      req.user!.id,
      game_id,
    ]);
    res.json({ message: "Removed from cart" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
