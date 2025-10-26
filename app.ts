import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import games from './routes/games';
import wallet from './routes/wallet';
import adminRoutes from "./routes/admin";
import walletAdmin from './routes/wallet-admin';
import shop from './routes/shop';
import cart from './routes/cart';
import library from './routes/library';
import userDiscounts from './routes/user-discounts';
import users from './routes/users';
import ranking from './routes/ranking';


const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use("/api/games",games);
app.use("/api/wallet", wallet);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", wallet);
app.use("/api/admin/wallet", walletAdmin);
app.use("/api", users);
app.use("/api/shop", shop);
app.use("/api/discounts", userDiscounts);
app.use("/api/cart", cart);
app.use("/api/library", library);
app.use("/api/user/discounts", userDiscounts);

app.use("/api/ranking", ranking);
export default app;
