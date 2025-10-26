"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// ดูยอดคงเหลือ
router.get("/balance", middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const [rows] = (await db_1.default.query("SELECT balance FROM wallets WHERE user_id = ?", [req.user.id]));
        if (!rows.length)
            return res.json({ balance: 0 });
        res.json(rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// เติมเงิน
// เติมเงิน
router.post("/topup", middleware_auth_1.verifyToken, async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0)
        return res.status(400).json({ error: "Invalid amount" });
    try {
        // เช็คว่า user มี wallet หรือยัง
        const [[wallet]] = (await db_1.default.query("SELECT * FROM wallets WHERE user_id = ?", [req.user.id]));
        // ถ้าไม่มี wallet ให้สร้างใหม่
        if (!wallet) {
            await db_1.default.query("INSERT INTO wallets (user_id, balance) VALUES (?, ?)", [
                req.user.id,
                0,
            ]);
        }
        // เพิ่มยอดเงิน
        await db_1.default.query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [amount, req.user.id]);
        // บันทึก transaction
        await db_1.default.query('INSERT INTO transactions (user_id, type, amount) VALUES (?, "topup", ?)', [req.user.id, amount]);
        // ดึงยอดเงินล่าสุดจาก wallets
        const [[updatedWallet]] = (await db_1.default.query("SELECT balance FROM wallets WHERE user_id = ?", [req.user.id]));
        res.json({ message: "Topup success", balance: updatedWallet.balance });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// ประวัติการทำรายการ
// ประวัติการทำรายการ
router.get("/history", middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const [rows] = (await db_1.default.query(`SELECT t.id, t.type, t.amount, t.created_at, g.title AS game_title
       FROM transactions t
       LEFT JOIN games g ON t.game_id = g.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`, [req.user.id]));
        // แปลงข้อความ type ให้เข้าใจง่าย
        const formatted = rows.map((tx) => {
            let description = "";
            if (tx.type === "topup")
                description = "เติมเงินเข้า";
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
router.post("/purchase/:gameId", middleware_auth_1.verifyToken, async (req, res) => {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const [[game]] = (await conn.query("SELECT * FROM games WHERE id = ?", [
            req.params.gameId,
        ]));
        if (!game)
            throw new Error("Game not found");
        const [[owned]] = (await conn.query("SELECT * FROM user_games WHERE user_id = ? AND game_id = ?", [req.user.id, game.id]));
        if (owned)
            throw new Error("You already own this game");
        const [[wallet]] = (await conn.query("SELECT * FROM wallets WHERE user_id = ? FOR UPDATE", [req.user.id]));
        if (!wallet)
            throw new Error("Wallet not found");
        if (wallet.balance < game.price)
            throw new Error("Insufficient balance");
        await conn.query("UPDATE wallets SET balance = balance - ? WHERE user_id = ?", [game.price, req.user.id]);
        await conn.query('INSERT INTO transactions (user_id, type, amount, game_id) VALUES (?, "purchase", ?, ?)', [req.user.id, game.price, game.id]);
        await conn.query("INSERT INTO user_games (user_id, game_id) VALUES (?, ?)", [req.user.id, game.id]);
        await conn.commit();
        const [[{ balance }]] = (await conn.query("SELECT balance FROM wallets WHERE user_id = ?", [req.user.id]));
        res.json({ message: "Purchase success", balance });
    }
    catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(400).json({ error: err.message || "Purchase failed" });
    }
    finally {
        conn.release();
    }
});
exports.default = router;
