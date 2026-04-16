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
app.use(cookieParser()); // Required by Queue-it to read/write cookies
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Queue-it: validate every request before reaching your routes ───────────
app.use(queueItMiddleware);

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/product
 *
 * Receives product view data from the frontend on page load.
 * Only reached if the user has passed the Queue-it waiting room.
 */
app.post("/api/product", (req, res) => {
  const product = req.body;

  if (!product || !product.name) {
    return res.status(400).json({ error: "Missing product data" });
  }

  // Log to server console (visible in Vercel's function logs)
  console.log("📦 Product view received:", {
    id:        product.id,
    name:      product.name,
    price:     product.priceUSD,
    viewedAt:  product.viewedAt,
  });

  return res.status(200).json({
    success:   true,
    message:   `Product "${product.name}" received by server.`,
    timestamp: new Date().toISOString(),
    received:  product,
  });
});

/**
 * GET /api/health
 * Simple health-check endpoint.
 */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Fallback: serve index.html for any unmatched GET (SPA-style) ──────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── Export for Vercel (serverless) ────────────────────────────────────────
module.exports = app;
