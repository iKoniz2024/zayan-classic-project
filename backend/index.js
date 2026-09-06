const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");

dotenv.config();

const { connectDB } = require("./config/db");

const productRoutes = require("./routes/products.route");
const categoryRoutes = require("./routes/categories.route");
const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/users.route");
const cartRoutes = require("./routes/cart.route");
const orderRoutes = require("./routes/orders.route");
const settingsRoutes = require("./routes/settings.route");
const bannerRoutes = require("./routes/banner.route");

const app = express();
const port = process.env.PORT || 5000;

const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "";
const allowedOrigins = [
    clientUrl,
    "http://localhost:3000",
    "http://localhost:3001",
].filter(Boolean);

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            const cleanOrigin = origin.replace(/\/$/, "");
            if (allowedOrigins.includes(cleanOrigin) || process.env.NODE_ENV !== "production") {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    })
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (process.env.VERCEL) {
    app.use(async (req, res, next) => {
        try {
            await connectDB();
            next();
        } catch (error) {
            res.status(500).json({ message: "Database connection failed" });
        }
    });
}

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/banners", bannerRoutes);

app.get("/", (req, res) => {
    res.send("Zayan Classic Server is Running...");
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    startServer();
}

async function startServer() {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.log(error);
    }
}
