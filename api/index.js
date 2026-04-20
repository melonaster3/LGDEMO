const express      = require("express");
const cookieParser = require("cookie-parser");
const path         = require("path");
const queueItMiddleware = require("./queueitMiddleware");

const app = express();

// Core middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

// Queue-it validation on all requests
app.use(queueItMiddleware);

// Page routes
app.get("/",          (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));
app.get("/tv",        (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "tv.html")));
app.get("/ac",        (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "ac.html")));
app.get("/buy",       (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "buy.html")));
app.get("/checkout",  (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "checkout.html")));

// POST /api/product — handles both page views and order placements
app.post("/api/product", (req, res) => {
  const body    = req.body;
  const referer = req.headers["referer"] || req.headers["referrer"] || "unknown";

  if (!body) return res.status(400).json({ error: "Empty request body" });

  if (body.event === "order_placed") {
    console.log("🛒 Order placed:", {
      model: body.model, colour: body.colour, install: body.install,
      price: body.price, customer: body.customer, orderedAt: body.orderedAt,
    });
    return res.status(200).json({
      success: true,
      message: `Order for "${body.model}" received.`,
      timestamp: new Date().toISOString(),
      received: body,
    });
  }

  if (!body.name) return res.status(400).json({ error: "Missing product name" });

  console.log("📦 Product view:", {
    id: body.id, name: body.name, category: body.category,
    price: body.priceUSD, viewedAt: body.viewedAt, referer,
  });

  return res.status(200).json({
    success: true,
    message: `Product "${body.name}" received by server.`,
    timestamp: new Date().toISOString(),
    referer,
    received: body,
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = app;
