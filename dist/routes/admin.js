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
 * 🧭 Admin Dashboard
 */
router.get("/dashboard", (req, res) => {
    res.json({ message: "Welcome to Admin Dashboard" });
});
/**
 * 👥 แสดงผู้ใช้ทั้งหมด
 */
router.get("/users", async (req, res) => {
    try {
        const [rows] = await db_1.default.query("SELECT id, username, email, role, created_at FROM users");
        res.json(rows);
    }
    catch (err) {
        if (err instanceof Error)
            res.status(500).json({ error: err.message });
        else
            res.status(500).json({ error: "Unknown error" });
    }
});
/**
 * 💳 แสดงประวัติธุรกรรมของผู้ใช้ทั้งหมด (เฉพาะ Admin)
 * Endpoint: GET /api/admin/transactions?search=ชื่อผู้ใช้
 */
router.get("/transactions", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    try {
        const search = req.query.search ? `%${req.query.search}%` : "%%";
        const [rows] = await db_1.default.query(`
        SELECT 
          u.username,
          t.type,
          t.amount,
          g.title AS game_title,
          DATE_FORMAT(t.created_at, '%d/%m/%Y') AS date
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN games g ON t.game_id = g.id
        WHERE u.username LIKE ?
        ORDER BY t.created_at DESC
        `, [search]);
        res.json(rows);
    }
    catch (err) {
        if (err instanceof Error)
            res.status(500).json({ error: err.message });
        else
            res.status(500).json({ error: "Unknown error" });
    }
});
exports.default = router;
