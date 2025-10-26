import { Router } from "express";
import path from "path";
import fs from "fs";
import pool from "../db";
import multer from "multer";
import { verifyToken, AuthRequest, isAdmin } from "./middleware-auth";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "games");
    if (!fs.existsSync(uploadPath))
      fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});

const upload = multer({ storage });
const router = Router();

/** 📌 GET รายการประเภทเกมทั้งหมด (User/Admin) - วางก่อน /:id */
router.get("/categories/list", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM categories ORDER BY name"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 🟢 GET เกมทั้งหมด + ค้นหา */
router.get("/", async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = `SELECT g.*, c.name AS category_name FROM games g JOIN categories c ON g.category_id = c.id`;
    const params: any[] = [];
    const conditions: string[] = [];

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

    const [rows]: any = await pool.query(sql, params);
    const games = rows.map((g: any) => ({
      ...g,
      image_url: g.image
        ? `${req.protocol}://${req.get("host")}/uploads/games/${g.image}`
        : null,
    }));
    res.json(games);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 📝 GET รายละเอียดเกมตาม ID */
router.get("/:id", async (req, res) => {
  try {
    const gameId = req.params.id;
    const [rows]: any = await pool.query(
      `SELECT g.*, c.name AS category_name FROM games g JOIN categories c ON g.category_id = c.id WHERE g.id = ?`,
      [gameId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "ไม่พบเกม" });

    const game = rows[0];
    if (game.image) {
      game.image_url = `${req.protocol}://${req.get("host")}/uploads/games/${
        game.image
      }`;
    }
    res.json(game);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 🟡 เพิ่มเกม (Admin) */
router.post(
  "/add-games",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req: AuthRequest, res) => {
    try {
      const { title, description, category_id, price } = req.body;
      const image = req.file ? req.file.filename : null;

      if (!title || !category_id || !price) {
        return res
          .status(400)
          .json({ message: "กรุณากรอกข้อมูลให้ครบ: ชื่อเกม, ประเภท, และราคา" });
      }

      await pool.query(
        "INSERT INTO games (title, description, category_id, price, image, release_date) VALUES (?, ?, ?, ?, ?, NOW())",
        [title, description, category_id, price, image]
      );

      res.json({ message: "เพิ่มเกมสำเร็จ" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

/** 🟠 แก้ไขเกม (Admin) */
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req: AuthRequest, res) => {
    try {
      const gameId = req.params.id;
      const { title, description, category_id, price } = req.body;
      const newImage = req.file ? req.file.filename : null;

      const [rows]: any = await pool.query("SELECT * FROM games WHERE id = ?", [
        gameId,
      ]);
      if (rows.length === 0)
        return res.status(404).json({ message: "ไม่พบเกม" });

      const oldImage = rows[0].image;
      if (oldImage && newImage) {
        const oldPath = path.join(
          __dirname,
          "..",
          "uploads",
          "games",
          oldImage
        );
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await pool.query(
        "UPDATE games SET title=?, description=?, category_id=?, price=?, image=? WHERE id=?",
        [title, description, category_id, price, newImage || oldImage, gameId]
      );

      res.json({ message: "อัปเดตเกมเรียบร้อย" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

/** 🔴 ลบเกม (Admin) */
router.delete("/:id", verifyToken, isAdmin, async (req: AuthRequest, res) => {
  try {
    const gameId = req.params.id;
    const [rows]: any = await pool.query("SELECT * FROM games WHERE id = ?", [
      gameId,
    ]);
    if (rows.length === 0) return res.status(404).json({ message: "ไม่พบเกม" });

    const oldImage = rows[0].image;
    if (oldImage) {
      const oldPath = path.join(__dirname, "..", "uploads", "games", oldImage);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query("DELETE FROM games WHERE id = ?", [gameId]);
    res.json({ message: "ลบเกมเรียบร้อย" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
