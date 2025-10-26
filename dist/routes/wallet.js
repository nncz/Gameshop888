"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = (0, express_1.Router)();
/**
 * 🟢 GET /api/wallet
 * ดึงยอดเงิน + ข้อมูลผู้ใช้ปัจจุบัน
 */
router.get("/", middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const [rows] = await db_1.default.query(`
      SELECT 
        u.id AS user_id,
        u.username,
        u.email,
        u.role,
        u.profile_image,
        w.balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = ?
      `, [userId]);
        // ถ้ายังไม่มี wallet → สร้างใหม่
        if (rows.length === 0 || rows[0].balance === null) {
            await db_1.default.query("INSERT INTO wallets (user_id, balance) VALUES (?, 0)", [
                userId,
            ]);
            return res.json({
                user_id: userId,
                username: req.user?.username,
                email: req.user?.email,
                role: req.user?.role,
                profile_image: req.user?.profile_image || null,
                balance: 0,
            });
        }
        const walletData = rows[0];
        res.json({
            user_id: walletData.user_id,
            username: walletData.username,
            email: walletData.email,
            role: walletData.role,
            profile_image: walletData.profile_image,
            balance: Number(walletData.balance),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * 🟡 POST /api/wallet/topup
 * เติมเงินเข้ากระเป๋า (user เติมเงินเองได้)
 * body: { amount: number }
 */
router.post("/topup", middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user?.id;
        if (!amount || amount <= 0)
            return res.status(400).json({ message: "จำนวนเงินไม่ถูกต้อง" });
        // ตรวจว่ามี wallet ของ user หรือยัง
        const [existing] = await db_1.default.query("SELECT * FROM wallets WHERE user_id = ?", [userId]);
        if (existing.length === 0) {
            await db_1.default.query("INSERT INTO wallets (user_id, balance) VALUES (?, ?)", [
                userId,
                amount,
            ]);
        }
        else {
            await db_1.default.query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [amount, userId]);
        }
        // บันทึกธุรกรรม
        await db_1.default.query("INSERT INTO transactions (user_id, type, amount) VALUES (?, 'topup', ?)", [userId, amount]);
        // ส่งยอดล่าสุดกลับ
        const [[wallet]] = await db_1.default.query("SELECT balance FROM wallets WHERE user_id = ?", [userId]);
        res.json({
            message: "เติมเงินสำเร็จ",
            user_id: userId,
            balance: Number(wallet.balance),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * 🧑‍💼 POST /api/wallet/admin/topup
 * (ADMIN เท่านั้น) เติมเงินให้ user คนอื่น
 * body: { user_id: number, amount: number }
 */
router.post("/admin/topup", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    try {
        const { user_id, amount } = req.body;
        if (!user_id || !amount || amount <= 0)
            return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
        // ตรวจว่ามี wallet ของ user หรือยัง
        const [existing] = await db_1.default.query("SELECT * FROM wallets WHERE user_id = ?", [user_id]);
        if (existing.length === 0) {
            await db_1.default.query("INSERT INTO wallets (user_id, balance) VALUES (?, ?)", [
                user_id,
                amount,
            ]);
        }
        else {
            await db_1.default.query("UPDATE wallets SET balance = balance + ? WHERE user_id = ?", [amount, user_id]);
        }
        await db_1.default.query("INSERT INTO transactions (user_id, type, amount) VALUES (?, 'topup', ?)", [user_id, amount]);
        const [[wallet]] = await db_1.default.query("SELECT balance FROM wallets WHERE user_id = ?", [user_id]);
        res.json({
            message: "เติมเงินให้ผู้ใช้สำเร็จ",
            user_id,
            balance: Number(wallet.balance),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * 🔴 POST /api/wallet/purchase
 * ซื้อเกม (หักเงิน)
 * body: { game_id: number, price: number }
 */
/**
 * 🔴 POST /api/wallet/purchase
 * ซื้อหลายเกม (หักเงินรวม)
 * body: { game_ids: number[] }
 */
router.post("/purchase", middleware_auth_1.verifyToken, async (req, res) => {
    const connection = await db_1.default.getConnection();
    try {
        const { game_ids } = req.body;
        const userId = req.user?.id;
        if (!game_ids || !Array.isArray(game_ids) || game_ids.length === 0) {
            return res.status(400).json({ message: "ต้องระบุรหัสเกมอย่างน้อย 1 เกม" });
        }
        // ✅ ดึงราคาของทุกเกมที่เลือก
        const [games] = await connection.query(`SELECT id, title, price FROM games WHERE id IN (${game_ids.map(() => "?").join(",")})`, game_ids);
        if (games.length !== game_ids.length) {
            return res.status(404).json({ message: "มีบางเกมที่ไม่พบในระบบ" });
        }
        // ✅ คำนวณราคารวม
        const totalPrice = games.reduce((sum, g) => sum + Number(g.price), 0);
        await connection.beginTransaction();
        // ✅ ตรวจสอบว่ามี wallet หรือยัง
        const [walletCheck] = await connection.query("SELECT * FROM wallets WHERE user_id = ?", [userId]);
        if (walletCheck.length === 0) {
            await connection.query("INSERT INTO wallets (user_id, balance) VALUES (?, 0)", [userId]);
        }
        // ✅ ตรวจสอบยอดเงิน
        const [[wallet]] = await connection.query("SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE", [userId]);
        if (!wallet || wallet.balance < totalPrice) {
            await connection.rollback();
            return res.status(400).json({ message: "ยอดเงินไม่เพียงพอ" });
        }
        // ✅ ตรวจสอบเกมที่มีอยู่แล้ว
        const [ownedGames] = await connection.query("SELECT game_id FROM user_games WHERE user_id = ? AND game_id IN (?)", [userId, game_ids]);
        const ownedIds = ownedGames.map((g) => g.game_id);
        const newGames = games.filter((g) => !ownedIds.includes(g.id));
        if (newGames.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "คุณมีเกมทั้งหมดนี้อยู่แล้ว" });
        }
        // ✅ หักยอดรวม
        await connection.query("UPDATE wallets SET balance = balance - ? WHERE user_id = ?", [totalPrice, userId]);
        // ✅ เพิ่มธุรกรรมรวม
        await connection.query("INSERT INTO transactions (user_id, type, amount) VALUES (?, 'purchase', ?)", [userId, totalPrice]);
        // ✅ เพิ่มเกมใหม่ในคลัง
        const insertValues = newGames.map((g) => [userId, g.id]);
        await connection.query("INSERT INTO user_games (user_id, game_id) VALUES ?", [insertValues]);
        await connection.commit();
        const [[updatedWallet]] = await db_1.default.query("SELECT balance FROM wallets WHERE user_id = ?", [userId]);
        res.json({
            message: "ซื้อเกมสำเร็จ",
            total_spent: totalPrice,
            purchased_games: newGames.map((g) => g.title),
            balance: Number(updatedWallet.balance),
        });
    }
    catch (err) {
        await connection.rollback();
        console.error("❌ Purchase error:", err.message);
        res.status(500).json({ error: err.message });
    }
    finally {
        connection.release();
    }
});
/**
 * 📜 GET /api/wallet/transactions
 * แสดงประวัติธุรกรรมทั้งหมดของผู้ใช้
 */
router.get("/transactions", middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`SELECT 
        t.id,
        t.type,
        t.amount,
        g.title AS game_title,
        DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') AS date
      FROM transactions t
      LEFT JOIN games g ON t.game_id = g.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC`, [req.user?.id]);
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
