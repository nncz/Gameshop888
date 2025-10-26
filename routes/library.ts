// routes/library.ts
import express from "express";
import pool from "../db";
import { verifyToken } from "./middleware-auth";

const router = express.Router();

router.get("/", verifyToken, async (req: any, res) => {
  const userId = req.user.id;

  try {
    const [games] = await pool.query(
      `SELECT g.id, g.title, g.description, g.price, g.image
       FROM user_games ug
       JOIN games g ON ug.game_id = g.id
       WHERE ug.user_id = ?`,
      [userId]
    );

    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดคลังเกมไม่สำเร็จ" });
  }
});

export default router;
