"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
// GET /api/user/discounts
// สำหรับผู้ใช้ปกติ ดูโค้ดส่วนลดที่ใช้ได้
router.get("/", middleware_auth_1.verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // 1️⃣ ดึงโค้ดที่ยังไม่หมดอายุและยังไม่ใช้ครบ
        const [discounts] = await db_1.default.query(`SELECT id, code, discount_percent, max_uses, used_count, expires_at
       FROM discounts
       WHERE (expires_at IS NULL OR expires_at > NOW())
         AND used_count < max_uses`);
        // 2️⃣ ดึงโค้ดที่ user เคยใช้แล้ว
        const [used] = await db_1.default.query("SELECT discount_id FROM user_discounts WHERE user_id = ?", [userId]);
        const usedIds = used.map((u) => u.discount_id);
        // 3️⃣ กรองโค้ดที่ user ยังไม่เคยใช้
        const available = discounts.filter((d) => !usedIds.includes(d.id));
        res.json(available);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "โหลดโค้ดส่วนลดไม่สำเร็จ" });
    }
});
exports.default = router;
