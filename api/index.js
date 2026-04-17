/**
 * api/index.js
 *
 * Express app exported as a Vercel serverless function.
 * Includes Queue-it waiting room validation on all routes.
 */

const express      = require("express");
const cookieParser = require("cookie-parser");
const path         = require("path");

const queueItMiddleware = require("./queueitMiddleware");

const app = express();

// ── Core middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Queue-it: validate every request before reaching your routes ───────────
app.use(queueItMiddleware);

// ── Page routes ────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/tv", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "tv.html"));
});

app.get("/ac", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "ac.html"));
});

// ── API routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/product
 *
 * Receives product view data from the frontend on page load.
 * The Referer header tells you which page sent the request:
 *   - Referer: .../tv  -> TV page view
 *   - Referer: .../ac  -> AC page view
 */
app.post("/api/product", (req, res) => {
  const product = req.body;
  const referer = req.headers["referer"] || req.headers["referrer"] || "unknown";

  if (!product || !product.name) {
    return res.status(400).json({ error: "Missing product data" });
  }

  console.log("📦 Product view received:", {
    id:       product.id,
    name:     product.name,
    category: product.category,
    price:    product.priceUSD,
    viewedAt: product.viewedAt,
    referer,
  });

  return res.status(200).json({
    success:   true,
    message:   `Product "${product.name}" received by server.`,
    timestamp: new Date().toISOString(),
    referer,
    received:  product,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = app;
