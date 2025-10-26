"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// --- สร้างโค้ดส่วนลด (Admin) ---
router.post("/", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    const { code, discount_percent, max_uses, expires_at } = req.body;
    try {
        await db_1.default.query("INSERT INTO discounts (code, discount_percent, max_uses, expires_at, active, used_count) VALUES (?, ?, ?, ?, 1, 0)", [code.trim(), discount_percent, max_uses || 1, expires_at || null]);
        res.json({ message: "Discount created" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
// --- ดึงรายการโค้ดส่วนลดทั้งหมด (Admin) ---
router.get("/", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    try {
        const [rows] = await db_1.default.query("SELECT * FROM discounts WHERE active = 1");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot load discounts" });
    }
});
// --- แก้ไขโค้ดส่วนลด (Admin) ---
router.put("/:id", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    const { id } = req.params;
    const { code, discount_percent, max_uses, expires_at } = req.body;
    try {
        const [result] = await db_1.default.query("UPDATE discounts SET code = ?, discount_percent = ?, max_uses = ?, expires_at = ? WHERE id = ?", [code.trim(), discount_percent, max_uses || 1, expires_at || null, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Discount not found" });
        }
        res.json({ message: "Discount updated" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot update discount" });
    }
});
// --- ลบโค้ดส่วนลด (Admin) ---
router.delete("/:id", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db_1.default.query("DELETE FROM discounts WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Discount not found" });
        }
        res.json({ message: "Discount deleted" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot delete discount" });
    }
});
// --- ใช้โค้ดส่วนลด (Customer) ---
router.post("/use/:id", middleware_auth_1.verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [discounts] = await db_1.default.query("SELECT * FROM discounts WHERE id = ? AND active = 1", [id]);
        if (!discounts.length) {
            return res.status(404).json({ error: "Discount not found or expired" });
        }
        const discount = discounts[0];
        let used_count = discount.used_count + 1;
        let active = used_count >= discount.max_uses ? 0 : 1;
        await db_1.default.query("UPDATE discounts SET used_count = ?, active = ? WHERE id = ?", [used_count, active, id]);
        res.json({ message: "Discount applied", used_count, active });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot use discount" });
    }
});
exports.default = router;
