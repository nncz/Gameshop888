"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// โหลดตะกร้า
router.get("/", middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`SELECT c.id as cart_id, g.* 
       FROM carts c 
       JOIN games g ON c.game_id = g.id
       WHERE c.user_id = ?`, [req.user.id]);
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// เพิ่มเกม
router.post("/add", middleware_auth_1.verifyToken, async (req, res) => {
    const { game_id } = req.body;
    if (!game_id)
        return res.status(400).json({ error: "Missing game_id" });
    try {
        await db_1.default.query("INSERT INTO carts (user_id, game_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP", [req.user.id, game_id]);
        res.json({ message: "Added to cart" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// ลบเกม
router.post("/remove", middleware_auth_1.verifyToken, async (req, res) => {
    const { game_id } = req.body;
    try {
        await db_1.default.query("DELETE FROM carts WHERE user_id = ? AND game_id = ?", [
            req.user.id,
            game_id,
        ]);
        res.json({ message: "Removed from cart" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
