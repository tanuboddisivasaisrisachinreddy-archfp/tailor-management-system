import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import path from "path";

import { requireAuth } from "./middleware/auth.js";
import { Customer } from "./models/Customer.js";
import { Measurement } from "./models/Measurement.js";
import { Order } from "./models/Order.js";
import { Payment } from "./models/Payment.js";
import { User } from "./models/User.js";
import { clearToken, createToken, resolveToken } from "./utils/auth.js";

const app = express();
const port = Number(process.env.PORT || 5000);

// Middleware
app.use(cors());
app.use(express.json());

// ================= HELPERS =================

function calcPaymentState(price, totalPaid) {
  const balanceDue = Math.max(Number(price) - Number(totalPaid || 0), 0);
  const paymentStatus =
    totalPaid <= 0 ? "Unpaid" : balanceDue <= 0 ? "Paid" : "Partial";
  return { balanceDue, paymentStatus };
}

async function buildOrderView(order) {
  const payments = await Payment.find({ orderId: order._id })
    .sort({ paidOn: -1, createdAt: -1 })
    .lean();

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  const { balanceDue, paymentStatus } = calcPaymentState(
    order.price,
    totalPaid
  );

  return {
    ...order,
    payments,
    totalPaid,
    balanceDue,
    paymentStatus,
  };
}

// ================= ROUTES =================

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// AUTH
app.get("/api/auth/session", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = resolveToken(token);

  if (!session) return res.json({ authenticated: false });

  return res.json({
    authenticated: true,
    user: {
      id: session.userId,
      fullName: session.fullName,
      username: session.username,
    },
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { username = "", password = "" } = req.body || {};
  const user = await User.findOne({ username: String(username).trim() });

  if (!user || user.passwordHash !== User.hashPassword(String(password))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = createToken(user);

  return res.json({
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      username: user.username,
    },
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  clearToken(req.authToken);
  res.json({ message: "Logged out" });
});

// ================= SERVER START =================

async function start() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) throw new Error("MONGODB_URI not found");

    await mongoose.connect(uri);
    console.log("MongoDB Connected ✅");

    // Serve frontend
    const __dirname = path.resolve();
    app.use(express.static(path.join(__dirname, "dist")));

    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });

    // Start server (Render compatible)
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server start failed ❌");
    console.error(error);
    process.exit(1);
  }
}

start();
