"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("multer"));
const middleware_auth_1 = require("./middleware-auth");
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(__dirname, "..", "uploads", "games");
        if (!fs_1.default.existsSync(uploadPath))
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
    },
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
/** 📌 GET รายการประเภทเกมทั้งหมด (User/Admin) - วางก่อน /:id */
router.get("/categories/list", async (req, res) => {
    try {
        const [rows] = await db_1.default.query("SELECT * FROM categories ORDER BY name");
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** 🟢 GET เกมทั้งหมด + ค้นหา */
router.get("/", async (req, res) => {
    try {
        const { search, category } = req.query;
        let sql = `SELECT g.*, c.name AS category_name FROM games g JOIN categories c ON g.category_id = c.id`;
        const params = [];
        const conditions = [];
        if (search) {
            conditions.push("g.title LIKE ?");
            params.push(`%${search}%`);
        }
        if (category) {
            conditions.push("c.name = ?");
            params.push(category);
        }
        if (conditions.length > 0) {
            sql += " WHERE " + conditions.join(" AND ");
        }
        const [rows] = await db_1.default.query(sql, params);
        const games = rows.map((g) => ({
            ...g,
            image_url: g.image
                ? `${req.protocol}://${req.get("host")}/uploads/games/${g.image}`
                : null,
        }));
        res.json(games);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** 📝 GET รายละเอียดเกมตาม ID */
router.get("/:id", async (req, res) => {
    try {
        const gameId = req.params.id;
        const [rows] = await db_1.default.query(`SELECT g.*, c.name AS category_name FROM games g JOIN categories c ON g.category_id = c.id WHERE g.id = ?`, [gameId]);
        if (rows.length === 0)
            return res.status(404).json({ message: "ไม่พบเกม" });
        const game = rows[0];
        if (game.image) {
            game.image_url = `${req.protocol}://${req.get("host")}/uploads/games/${game.image}`;
        }
        res.json(game);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** 🟡 เพิ่มเกม (Admin) */
router.post("/add-games", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, upload.single("image"), async (req, res) => {
    try {
        const { title, description, category_id, price } = req.body;
        const image = req.file ? req.file.filename : null;
        if (!title || !category_id || !price) {
            return res
                .status(400)
                .json({ message: "กรุณากรอกข้อมูลให้ครบ: ชื่อเกม, ประเภท, และราคา" });
        }
        await db_1.default.query("INSERT INTO games (title, description, category_id, price, image, release_date) VALUES (?, ?, ?, ?, ?, NOW())", [title, description, category_id, price, image]);
        res.json({ message: "เพิ่มเกมสำเร็จ" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** 🟠 แก้ไขเกม (Admin) */
router.put("/:id", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, upload.single("image"), async (req, res) => {
    try {
        const gameId = req.params.id;
        const { title, description, category_id, price } = req.body;
        const newImage = req.file ? req.file.filename : null;
        const [rows] = await db_1.default.query("SELECT * FROM games WHERE id = ?", [
            gameId,
        ]);
        if (rows.length === 0)
            return res.status(404).json({ message: "ไม่พบเกม" });
        const oldImage = rows[0].image;
        if (oldImage && newImage) {
            const oldPath = path_1.default.join(__dirname, "..", "uploads", "games", oldImage);
            if (fs_1.default.existsSync(oldPath))
                fs_1.default.unlinkSync(oldPath);
        }
        await db_1.default.query("UPDATE games SET title=?, description=?, category_id=?, price=?, image=? WHERE id=?", [title, description, category_id, price, newImage || oldImage, gameId]);
        res.json({ message: "อัปเดตเกมเรียบร้อย" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** 🔴 ลบเกม (Admin) */
router.delete("/:id", middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, async (req, res) => {
    try {
        const gameId = req.params.id;
        const [rows] = await db_1.default.query("SELECT * FROM games WHERE id = ?", [
            gameId,
        ]);
        if (rows.length === 0)
            return res.status(404).json({ message: "ไม่พบเกม" });
        const oldImage = rows[0].image;
        if (oldImage) {
            const oldPath = path_1.default.join(__dirname, "..", "uploads", "games", oldImage);
            if (fs_1.default.existsSync(oldPath))
                fs_1.default.unlinkSync(oldPath);
        }
        await db_1.default.query("DELETE FROM games WHERE id = ?", [gameId]);
        res.json({ message: "ลบเกมเรียบร้อย" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
