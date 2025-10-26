"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
/**
 * จัดอันดับเกมขายดี
 * เฉพาะแอดมินเท่านั้น
 */
router.get("/", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    try {
        const [rows] = await db_1.default.query(`
      SELECT 
        g.id,
        g.title,
        g.image,
        g.price,
        c.name AS category_name,
        COUNT(t.id) AS total_sales,
        SUM(t.amount) AS total_revenue
      FROM games g
      JOIN transactions t ON g.id = t.game_id
      JOIN categories c ON g.category_id = c.id
      WHERE t.type = 'purchase'
      GROUP BY g.id
      HAVING total_sales > 0
      ORDER BY total_sales DESC
      LIMIT 5
    `);
        res.json(rows);
    }
    catch (error) {
        console.error("จัดอันดับเกมขายดีล้มเหลว:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
    }
});
exports.default = router;
