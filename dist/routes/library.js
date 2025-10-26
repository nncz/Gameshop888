"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/library.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const middleware_auth_1 = require("./middleware-auth");
const router = express_1.default.Router();
router.get("/", middleware_auth_1.verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [games] = await db_1.default.query(`SELECT g.id, g.title, g.description, g.price, g.image
       FROM user_games ug
       JOIN games g ON ug.game_id = g.id
       WHERE ug.user_id = ?`, [userId]);
        res.json(games);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "โหลดคลังเกมไม่สำเร็จ" });
    }
});
exports.default = router;
