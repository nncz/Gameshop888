"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const uploadPath = path_1.default.join(__dirname, '..', UPLOAD_DIR);
if (!fs_1.default.existsSync(uploadPath))
    fs_1.default.mkdirSync(uploadPath, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        console.log('Saving file at:', path_1.default.join(uploadPath, name)); // <-- log path ที่นี่
        cb(null, name);
    },
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png/;
        const mimetype = allowed.test(file.mimetype);
        const ext = allowed.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimetype && ext)
            return cb(null, true);
        cb(new Error('Only jpg/jpeg/png allowed'));
    },
});
exports.default = upload;
