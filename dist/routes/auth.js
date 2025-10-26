"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("./multer"));
const middleware_auth_1 = require("./middleware-auth");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Register (user)
router.post('/register', multer_1.default.single('profile_image'), async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashed = await bcrypt_1.default.hash(password, 10);
        const image = req.file ? req.file.filename : null;
        const [existing] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length)
            return res.status(400).json({ message: 'Email already registered' });
        await db_1.default.query('INSERT INTO users (username,email,password,profile_image,role) VALUES (?,?,?,?,?)', [username, email, hashed, image, 'user']);
        res.json({ message: 'Register success' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // 1️⃣ ตรวจสอบข้อมูลเบื้องต้น
        if (!email || !password) {
            return res.status(400).json({ message: 'กรุณากรอก Email และ Password' });
        }
        // 2️⃣ ค้นหา user
        const [rows] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Email หรือ Password ไม่ถูกต้อง' });
        }
        const user = rows[0];
        // 3️⃣ ตรวจสอบรหัสผ่าน
        const match = await bcrypt_1.default.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Email หรือ Password ไม่ถูกต้อง' });
        }
        // 4️⃣ สร้าง Token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1d' });
        // 5️⃣ ตอบกลับ
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ', error: err.message });
    }
});
// Update profile
router.put('/profile', middleware_auth_1.verifyToken, multer_1.default.single('profile_image'), async (req, res) => {
    try {
        const { username } = req.body;
        const newImage = req.file ? req.file.filename : null;
        // ดึงข้อมูล user เก่า
        const [rows] = await db_1.default.query('SELECT profile_image FROM users WHERE id = ?', [req.user.id]);
        const oldImage = rows[0]?.profile_image;
        // ถ้ามีไฟล์เก่าและ user อัปโหลดไฟล์ใหม่ ให้ลบไฟล์เก่า
        if (oldImage && newImage) {
            const oldPath = path_1.default.join(__dirname, '..', 'uploads', oldImage);
            if (fs_1.default.existsSync(oldPath))
                fs_1.default.unlinkSync(oldPath);
        }
        // อัปเดต username และ profile_image
        await db_1.default.query('UPDATE users SET username = ?, profile_image = ? WHERE id = ?', [username, newImage || oldImage, req.user.id]);
        res.json({ message: 'Profile updated' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get current user
router.get('/me', middleware_auth_1.verifyToken, async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT id, username, email, role, profile_image FROM users WHERE id = ?', [req.user.id]);
        const user = rows[0];
        if (user && user.profile_image) {
            user.profile_image = `${req.protocol}://${req.get('host')}/uploads/${user.profile_image}`;
        }
        res.json(user);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/admin/dashboard', middleware_auth_1.verifyToken, middleware_auth_1.isAdmin, (req, res) => {
    res.json({ message: 'Welcome Admin!' });
});
exports.default = router;
