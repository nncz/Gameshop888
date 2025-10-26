import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool  from '../db';
import upload from './multer';
import { verifyToken, isAdmin, AuthRequest } from './middleware-auth';
import path from 'path';
import fs from 'fs';

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  profile_image?: string;
}

const router = Router();

// Register (user)
router.post('/register', upload.single('profile_image'), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const image = req.file ? req.file.filename : null;

    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]) as [User[], any];
    if (existing.length) return res.status(400).json({ message: 'Email already registered' });

    await pool.query(
      'INSERT INTO users (username,email,password,profile_image,role) VALUES (?,?,?,?,?)',
      [username, email, hashed, image, 'user']
    );

    res.json({ message: 'Register success' });
  } catch (err: any) {
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
    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email หรือ Password ไม่ถูกต้อง' });
    }

    const user = rows[0];

    // 3️⃣ ตรวจสอบรหัสผ่าน
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Email หรือ Password ไม่ถูกต้อง' });
    }

    // 4️⃣ สร้าง Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1d' }
    );

    // 5️⃣ ตอบกลับ
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ', error: err.message });
  }
});

// Update profile
router.put('/profile', verifyToken, upload.single('profile_image'), async (req: AuthRequest, res) => {
  try {
    const { username } = req.body;
    const newImage = req.file ? req.file.filename : null;

    // ดึงข้อมูล user เก่า
    const [rows] = await pool.query(
      'SELECT profile_image FROM users WHERE id = ?',
      [req.user!.id]
    ) as [ { profile_image?: string }[], any ];

    const oldImage = rows[0]?.profile_image;

    // ถ้ามีไฟล์เก่าและ user อัปโหลดไฟล์ใหม่ ให้ลบไฟล์เก่า
    if (oldImage && newImage) {
      const oldPath = path.join(__dirname, '..', 'uploads', oldImage);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // อัปเดต username และ profile_image
    await pool.query(
      'UPDATE users SET username = ?, profile_image = ? WHERE id = ?',
      [username, newImage || oldImage, req.user!.id]
    );

    res.json({ message: 'Profile updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', verifyToken, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, email, role, profile_image FROM users WHERE id = ?', [req.user!.id]) as [User[], any];
    const user = rows[0];

    if (user && user.profile_image) {
      user.profile_image = `${req.protocol}://${req.get('host')}/uploads/${user.profile_image}`;
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/dashboard', verifyToken, isAdmin, (req, res) => {
  res.json({ message: 'Welcome Admin!' });
});



export default router;
