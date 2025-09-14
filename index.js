const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secure-default";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// In-memory storage
const users = new Map();
const transactions = [];

// Demo accounts
(async () => {
  const alicePassword = await bcrypt.hash("password123", 10);
  const bobPassword = await bcrypt.hash("password123", 10);

  users.set("alice", {
    username: "alice",
    password: alicePassword,
    balance: 1000,
  });
  users.set("bob", { username: "bob", password: bobPassword, balance: 1500 });

  transactions.push(
    {
      id: 1,
      from: "system",
      to: "alice",
      amount: 1000,
      timestamp: new Date("2025-01-01T10:00:00Z"),
      type: "credit",
    },
    {
      id: 2,
      from: "system",
      to: "bob",
      amount: 1500,
      timestamp: new Date("2025-01-01T10:00:00Z"),
      type: "credit",
    }
  );
})();

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "Access token required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT Error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Register
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });
    if (users.has(username))
      return res.status(400).json({ error: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    users.set(username, { username, password: hashedPassword, balance: 1000 });

    transactions.push({
      id: transactions.length + 1,
      from: "system",
      to: username,
      amount: 1000,
      timestamp: new Date(),
      type: "credit",
    });

    res.status(201).json({ message: "User created", username });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const user = users.get(username);
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, username: user.username, balance: user.balance });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get balance
app.get("/balance", authenticateToken, (req, res) => {
  const user = users.get(req.user.username);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ balance: user.balance });
});

// Get transactions
app.get("/transactions", authenticateToken, (req, res) => {
  const username = req.user.username;
  const userTransactions = transactions
    .filter((tx) => tx.from === username || tx.to === username)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(userTransactions);
});

// Send money
app.post("/pay", authenticateToken, (req, res) => {
  try {
    const { to, amount } = req.body;
    const from = req.user.username;

    if (!to || !amount)
      return res.status(400).json({ error: "Recipient and amount required" });
    if (from === to)
      return res.status(400).json({ error: "Cannot send money to yourself" });
    if (amount <= 0)
      return res.status(400).json({ error: "Amount must be positive" });

    const sender = users.get(from);
    const receiver = users.get(to);

    if (!receiver)
      return res.status(404).json({ error: "Recipient not found" });
    if (sender.balance < amount)
      return res
        .status(400)
        .json({ error: `Insufficient balance (₹${sender.balance})` });

    sender.balance -= amount;
    receiver.balance += amount;

    const transaction = {
      id: transactions.length + 1,
      from,
      to,
      amount,
      timestamp: new Date(),
      type: "transfer",
    };
    transactions.push(transaction);

    res.json({
      message: "Payment successful",
      transaction,
      newBalance: sender.balance,
    });
  } catch (err) {
    console.error("Pay Error:", err);
    res.status(500).json({ error: "Transaction failed" });
  }
});

// Health check
app.get("/health", (req, res) =>
  res.json({ status: "OK", timestamp: new Date() })
);

// Catch-all for invalid routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FinPay running on http://localhost:${PORT}`);
  console.log("📊 Demo accounts: alice / bob (password123)");
});
