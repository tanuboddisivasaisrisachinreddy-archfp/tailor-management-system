import "dotenv/config";
import cors from "cors";
import express from "express";

import { connectDatabase } from "./config/db.js";
import { requireAuth } from "./middleware/auth.js";
import { Customer } from "./models/Customer.js";
import { Measurement } from "./models/Measurement.js";
import { Order } from "./models/Order.js";
import { Payment } from "./models/Payment.js";
import { User } from "./models/User.js";
import { seedDatabase } from "./data/seed.js";
import { clearToken, createToken, resolveToken } from "./utils/auth.js";

const app = express();
const port = Number(process.env.PORT || 5001);

app.use(cors());
app.use(express.json());

function calcPaymentState(price, totalPaid) {
  const balanceDue = Math.max(Number(price) - Number(totalPaid || 0), 0);
  const paymentStatus = totalPaid <= 0 ? "Unpaid" : balanceDue <= 0 ? "Paid" : "Partial";
  return { balanceDue, paymentStatus };
}

async function buildOrderView(order) {
  const payments = await Payment.find({ orderId: order._id }).sort({ paidOn: -1, createdAt: -1 }).lean();
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const { balanceDue, paymentStatus } = calcPaymentState(order.price, totalPaid);
  return {
    ...order,
    payments,
    totalPaid,
    balanceDue,
    paymentStatus,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/session", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = resolveToken(token);
  if (!session) {
    return res.json({ authenticated: false });
  }
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

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const search = String(req.query.search || "").trim();
  const filter = search
    ? {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const [customers, orders, payments] = await Promise.all([
    Customer.find(filter).sort({ fullName: 1 }).lean(),
    Order.find({}).sort({ deliveryDate: 1, createdAt: -1 }).lean(),
    Payment.find({}).lean(),
  ]);

  const orderCounts = orders.reduce((map, order) => {
    map[String(order.customerId)] = (map[String(order.customerId)] || 0) + 1;
    return map;
  }, {});

  const customersWithCounts = customers.map((customer) => ({
    ...customer,
    orderCount: orderCounts[String(customer._id)] || 0,
  }));

  const customerMap = new Map(customers.map((customer) => [String(customer._id), customer.fullName]));
  const upcomingOrders = orders.slice(0, 8).map((order) => ({
    ...order,
    customerName: customerMap.get(String(order.customerId)) || "Unknown customer",
  }));

  const stats = {
    totalCustomers: await Customer.countDocuments(),
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => order.status === "Pending").length,
    inProgressOrders: orders.filter((order) => order.status === "In Progress").length,
    completedOrders: orders.filter((order) => order.status === "Completed").length,
    deliveredOrders: orders.filter((order) => order.status === "Delivered").length,
    collectedRevenue: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
  };

  res.json({ stats, customers: customersWithCounts, upcomingOrders });
});

app.get("/api/customers/:id", requireAuth, async (req, res) => {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const [measurement, orders] = await Promise.all([
    Measurement.findOne({ customerId: customer._id }).lean(),
    Order.find({ customerId: customer._id }).sort({ deliveryDate: 1, createdAt: -1 }).lean(),
  ]);

  const orderViews = await Promise.all(orders.map((order) => buildOrderView(order)));
  return res.json({
    customer,
    measurements: measurement || {},
    orders: orderViews,
  });
});

app.post("/api/customers", requireAuth, async (req, res) => {
  const { fullName, phone, address, gender = "Not specified", notes = "" } = req.body || {};
  if (!fullName || !phone || !address) {
    return res.status(400).json({ error: "Name, phone, and address are required" });
  }

  const customer = await Customer.create({ fullName, phone, address, gender, notes });
  await Measurement.create({ customerId: customer._id });
  res.status(201).json({ message: "Customer created", customerId: customer._id });
});

app.put("/api/customers/:id/measurements", requireAuth, async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const payload = {
    chest: Number(req.body.chest || 0),
    waist: Number(req.body.waist || 0),
    shoulder: Number(req.body.shoulder || 0),
    sleeveLength: Number(req.body.sleeveLength || 0),
    hip: Number(req.body.hip || 0),
    neck: Number(req.body.neck || 0),
    length: Number(req.body.length || 0),
    notes: String(req.body.notes || ""),
  };

  await Measurement.findOneAndUpdate({ customerId: customer._id }, payload, { upsert: true, new: true });
  res.json({ message: "Measurements saved" });
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const { customerId, clothingType, stitchingDetails, deliveryDate, price, status = "Pending" } = req.body || {};
  if (!customerId || !clothingType || !stitchingDetails || !deliveryDate || !price) {
    return res.status(400).json({ error: "Customer, clothing type, stitching details, delivery date, and price are required" });
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const order = await Order.create({
    customerId,
    clothingType,
    stitchingDetails,
    deliveryDate,
    price: Number(price),
    status,
  });

  res.status(201).json({ message: "Order created", orderId: order._id });
});

app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!["Pending", "In Progress", "Completed", "Delivered"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json({ message: "Order status updated" });
});

app.post("/api/orders/:id/payments", requireAuth, async (req, res) => {
  const { amount, method, notes = "" } = req.body || {};
  if (!amount || !method) {
    return res.status(400).json({ error: "Payment amount and method are required" });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  await Payment.create({
    orderId: order._id,
    amount: Number(amount),
    method: String(method),
    notes: String(notes),
  });

  res.json({ message: "Payment recorded" });
});

async function start() {
  const mongoUri = await connectDatabase();
  await seedDatabase();
  app.listen(port, () => {
    console.log(`Tailor API running on http://127.0.0.1:${port}`);
    console.log(`Connected to ${mongoUri}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server");
  console.error(error);
  process.exit(1);
});
