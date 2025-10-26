import express from "express";
import pool from "../db";
import { verifyToken, isAdmin } from "./middleware-auth";
import { RowDataPacket } from "mysql2/promise";

const router = express.Router();

// Admin ดูประวัติธุรกรรมของผู้ใช้คนใดก็ได้
router.get("/user/:userId", verifyToken, isAdmin, async (req, res) => {
  const userId = req.params.userId;

  try {
    const [rows] = (await pool.query(
      `SELECT t.*, g.title AS game_name
       FROM transactions t
       LEFT JOIN games g ON t.game_id = g.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    )) as [RowDataPacket[], any];

    res.json(rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
