"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/admin-users.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db")); // MySQL connection
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// ดึงรายชื่อผู้ใช้ทั้งหมดพร้อม role
router.get("/users", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    try {
        const [rows] = await db_1.default.query("SELECT id, username, role FROM users");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// ดึงธุรกรรมของ user คนเดียว
// GET /wallet/admin/user/:userId
router.get("/wallet/admin/user/:userId", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    const userId = req.params.userId;
    try {
        const [rows] = await db_1.default.query(`SELECT t.type, t.amount, t.created_at AS date, 
              u.id AS userId, u.username 
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE u.id = ?`, [userId]);
        // แปลง row ให้ตรงกับ interface Transaction ของ frontend
        const transactions = rows.map((row) => ({
            user: { id: row.userId, username: row.username },
            type: row.type,
            amount: row.amount,
            date: row.date,
        }));
        res.json(transactions);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
