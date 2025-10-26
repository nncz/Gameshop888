import express from "express";
import pool from "../db";
import { AuthRequest, verifyToken } from "./middleware-auth";
import { RowDataPacket } from "mysql2/promise";

const router = express.Router();

// ดูยอดคงเหลือ
router.get("/balance", verifyToken, async (req: AuthRequest, res) => {
  try {
    const [rows] = (await pool.query(
      "SELECT balance FROM wallets WHERE user_id = ?",
      [req.user!.id]
    )) as [RowDataPacket[], any];
    if (!rows.length) return res.json({ balance: 0 });
    res.json(rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// เติมเงิน
// เติมเงิน
router.post("/topup", verifyToken, async (req: AuthRequest, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  try {
    // เช็คว่า user มี wallet หรือยัง
    const [[wallet]] = (await pool.query(
      "SELECT * FROM wallets WHERE user_id = ?",
      [req.user!.id]
    )) as [RowDataPacket[], any];

    // ถ้าไม่มี wallet ให้สร้างใหม่
    if (!wallet) {
      await pool.query("INSERT INTO wallets (user_id, balance) VALUES (?, ?)", [
        req.user!.id,
        0,
      ]);
    }

    // เพิ่มยอดเงิน
    await pool.query(
      "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
      [amount, req.user!.id]
    );

    // บันทึก transaction
    await pool.query(
      'INSERT INTO transactions (user_id, type, amount) VALUES (?, "topup", ?)',
      [req.user!.id, amount]
    );

    // ดึงยอดเงินล่าสุดจาก wallets
    const [[updatedWallet]] = (await pool.query(
      "SELECT balance FROM wallets WHERE user_id = ?",
      [req.user!.id]
    )) as [RowDataPacket[], any];

    res.json({ message: "Topup success", balance: updatedWallet.balance });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ประวัติการทำรายการ
// ประวัติการทำรายการ
router.get("/history", verifyToken, async (req: AuthRequest, res) => {
  try {
    const [rows] = (await pool.query(
      `SELECT t.id, t.type, t.amount, t.created_at, g.title AS game_title
       FROM transactions t
       LEFT JOIN games g ON t.game_id = g.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [req.user!.id]
    )) as [RowDataPacket[], any];

    // แปลงข้อความ type ให้เข้าใจง่าย
    const formatted = rows.map((tx) => {
      let description = "";
      if (tx.type === "topup") description = "เติมเงินเข้า";
      else if (tx.type === "purchase")
        description = `ซื้อเกม (${tx.game_title})`;
      return {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        date: tx.created_at,
        description,
      };
    });

    res.json(formatted);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/purchase/:gameId", verifyToken, async (req: AuthRequest, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[game]] = (await conn.query("SELECT * FROM games WHERE id = ?", [
      req.params.gameId,
    ])) as [any[], any];
    if (!game) throw new Error("Game not found");

    const [[owned]] = (await conn.query(
      "SELECT * FROM user_games WHERE user_id = ? AND game_id = ?",
      [req.user!.id, game.id]
    )) as [any[], any];
    if (owned) throw new Error("You already own this game");

    const [[wallet]] = (await conn.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [req.user!.id]
    )) as [any[], any];
    if (!wallet) throw new Error("Wallet not found");
    if (wallet.balance < game.price) throw new Error("Insufficient balance");

    await conn.query(
      "UPDATE wallets SET balance = balance - ? WHERE user_id = ?",
      [game.price, req.user!.id]
    );

    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, game_id) VALUES (?, "purchase", ?, ?)',
      [req.user!.id, game.price, game.id]
    );

    await conn.query(
      "INSERT INTO user_games (user_id, game_id) VALUES (?, ?)",
      [req.user!.id, game.id]
    );

    await conn.commit();

    const [[{ balance }]] = (await conn.query(
      "SELECT balance FROM wallets WHERE user_id = ?",
      [req.user!.id]
    )) as [any[], any];

    res.json({ message: "Purchase success", balance });
  } catch (err: any) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ error: err.message || "Purchase failed" });
  } finally {
    conn.release();
  }
});

export default router;
