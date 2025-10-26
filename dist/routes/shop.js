"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// --- เพิ่มเกมลงตะกร้า ---
router.post("/cart/add", middleware_auth_1.verifyToken, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId)
        return res.status(400).json({ error: "gameId required" });
    try {
        await db_1.default.query("INSERT INTO carts (user_id, game_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP", [req.user.id, gameId]);
        res.json({ message: "Added to cart" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// ลบเกมออกจากตะกร้า
// ลบเกมออกจากตะกร้า
router.post("/cart/remove", middleware_auth_1.verifyToken, async (req, res) => {
    const { gameId } = req.body;
    if (!gameId)
        return res.status(400).json({ error: "gameId required" });
    console.log("===== REMOVE CART START =====");
    console.log("Auth header:", req.headers.authorization);
    console.log("Decoded user:", req.user);
    console.log("Game to remove:", gameId);
    try {
        // แปลง gameId ให้เป็น number
        const gameIdNum = Number(gameId);
        // ลบ row จาก table carts
        const [result] = await db_1.default.query("DELETE FROM carts WHERE user_id = ? AND game_id = ?", [req.user.id, gameIdNum]);
        console.log("Delete result:", result);
        if (result.affectedRows === 0) {
            console.log("⚠️  No rows deleted (game not found in cart)");
            return res.status(404).json({ error: "Game not found in your cart" });
        }
        console.log("✅ Removed successfully");
        res.json({ message: "Removed from cart successfully", gameId });
    }
    catch (err) {
        console.error("❌ Cart remove error:", err);
        res.status(500).json({ error: "Server error" });
    }
    console.log("===== REMOVE CART END =====");
});
// --- ตรวจสอบโค้ดส่วนลด ---
router.post("/cart/validate-discount", middleware_auth_1.verifyToken, async (req, res) => {
    const { discountCode } = req.body;
    if (!discountCode)
        return res.status(400).json({ error: "No code provided" });
    try {
        const [[discount]] = (await db_1.default.query("SELECT * FROM discounts WHERE code = ?", [discountCode.trim()]));
        if (!discount)
            return res.json({ valid: false, message: "โค้ดไม่ถูกต้อง" });
        if (discount.expires_at && new Date(discount.expires_at) < new Date())
            return res.json({ valid: false, message: "โค้ดหมดอายุ" });
        if (discount.used_count >= discount.max_uses)
            return res.json({ valid: false, message: "โค้ดใช้ครบแล้ว" });
        const [[used]] = (await db_1.default.query("SELECT * FROM user_discounts WHERE user_id = ? AND discount_id = ?", [req.user.id, discount.id]));
        if (used)
            return res.json({ valid: false, message: "คุณเคยใช้โค้ดนี้แล้ว" });
        res.json({ valid: true, discount_percent: discount.discount_percent });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ valid: false, message: "Server error" });
    }
});
// --- ซื้อเกมทั้งหมดในตะกร้า พร้อมใช้โค้ดส่วนลด ---
router.post("/purchase", middleware_auth_1.verifyToken, async (req, res) => {
    const { discountCode } = req.body;
    const userId = req.user.id;
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        // 1️⃣ ดึงเกมทั้งหมดในตะกร้า
        const [cartRows] = (await conn.query(`SELECT c.game_id, g.price, g.title
       FROM carts c
       JOIN games g ON c.game_id = g.id
       WHERE c.user_id = ?`, [userId]));
        if (!cartRows.length)
            throw new Error("Cart is empty");
        // 2️⃣ ตรวจสอบว่าเกมถูกซื้อแล้วหรือยัง
        for (const game of cartRows) {
            const [[owned]] = (await conn.query("SELECT * FROM user_games WHERE user_id = ? AND game_id = ?", [userId, game.game_id]));
            if (owned)
                throw new Error(`You already own game: ${game.title}`);
        }
        // 3️⃣ ดึง wallet ของผู้ใช้
        const [[wallet]] = (await conn.query("SELECT * FROM wallets WHERE user_id = ? FOR UPDATE", [userId]));
        if (!wallet)
            throw new Error("Wallet not found");
        // 4️⃣ ตรวจสอบว่า user เคยใช้โค้ดส่วนลดใด ๆ แล้วหรือยัง
        if (discountCode) {
            const [[anyUsed]] = (await conn.query("SELECT * FROM user_discounts WHERE user_id = ?", [userId]));
            if (anyUsed)
                throw new Error("คุณได้ใช้โค้ดส่วนลดไปแล้ว ไม่สามารถใช้โค้ดใหม่ได้");
        }
        // 5️⃣ คำนวณราคารวม
        let totalPrice = cartRows.reduce((sum, game) => sum + parseFloat(game.price), 0);
        let discountId = null;
        let discountPercent = 0;
        // 6️⃣ ตรวจสอบและใช้โค้ดส่วนลด
        if (discountCode) {
            const [[discount]] = (await conn.query("SELECT * FROM discounts WHERE code = ? FOR UPDATE", [discountCode.trim()]));
            if (!discount)
                throw new Error("Discount code not found");
            if (discount.expires_at && new Date(discount.expires_at) < new Date())
                throw new Error("Discount code expired");
            if (discount.used_count >= discount.max_uses)
                throw new Error("Discount code usage limit reached");
            discountPercent = discount.discount_percent;
            discountId = discount.id;
            totalPrice = +(totalPrice * (1 - discountPercent / 100)).toFixed(2);
            // บันทึกว่า user ใช้โค้ดแล้ว
            await conn.query("INSERT INTO user_discounts (user_id, discount_id) VALUES (?, ?)", [userId, discountId]);
            // อัปเดตจำนวนครั้งที่ใช้โค้ด
            await conn.query("UPDATE discounts SET used_count = used_count + 1 WHERE id = ?", [discountId]);
        }
        // 7️⃣ ตรวจสอบ wallet balance
        if (wallet.balance < totalPrice)
            throw new Error("Insufficient balance");
        // 8️⃣ ลดเงินใน wallet
        await conn.query("UPDATE wallets SET balance = balance - ? WHERE user_id = ?", [totalPrice, userId]);
        // 9️⃣ เพิ่ม transactions และ user_games
        for (const game of cartRows) {
            const gamePrice = parseFloat(game.price);
            const finalGamePrice = discountPercent > 0
                ? +(gamePrice * (1 - discountPercent / 100)).toFixed(2)
                : gamePrice;
            await conn.query("INSERT INTO transactions (user_id, type, amount, game_id) VALUES (?, 'purchase', ?, ?)", [userId, finalGamePrice, game.game_id]);
            await conn.query("INSERT INTO user_games (user_id, game_id) VALUES (?, ?)", [userId, game.game_id]);
        }
        // 10️⃣ ลบสินค้าในตะกร้า
        await conn.query("DELETE FROM carts WHERE user_id = ?", [userId]);
        await conn.commit();
        // 11️⃣ ดึงยอดเงินล่าสุด
        const [[updatedWallet]] = (await conn.query("SELECT balance FROM wallets WHERE user_id = ?", [userId]));
        res.json({
            message: "Purchase success",
            balance: updatedWallet.balance,
            discountUsed: discountId ? discountCode : null,
        });
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
