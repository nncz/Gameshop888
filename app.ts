import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import games from './routes/games';
import wallet from './routes/wallet';
import adminRoutes from "./routes/admin";


const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use("/api/games",games);
app.use("/api/wallet", wallet);
app.use("/api/admin", adminRoutes);
export default app;
