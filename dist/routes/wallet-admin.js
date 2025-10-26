"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// Admin ดูประวัติธุรกรรมของผู้ใช้คนใดก็ได้
router.get("/user/:userId", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    const userId = req.params.userId;
    try {
        const [rows] = (await db_1.default.query(`SELECT t.*, g.title AS game_name
       FROM transactions t
       LEFT JOIN games g ON t.game_id = g.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`, [userId]));
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
