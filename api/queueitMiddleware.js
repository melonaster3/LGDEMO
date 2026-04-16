/**
 * queueitMiddleware.js
 *
 * Express middleware that runs Queue-it KnownUser validation on every
 * request that isn't a static asset or an OPTIONS/HEAD preflight.
 *
 * HOW IT WORKS:
 *  1. Reads your published integration config JSON (downloaded from GO platform).
 *  2. Calls KnownUser.validateRequestByIntegrationConfig() for the request.
 *  3. If Queue-it says "redirect" → sends the user to the waiting room.
 *  4. If Queue-it says "ok" → calls next() so your route handles the request.
 *  5. On any error → logs it and calls next() (fail-open, keeps site live).
 */

const fs   = require("fs");
const path = require("path");
const QueueITConnector = require("@queue-it/connector-javascript");
const { buildContextProvider, stripQueueItToken } = require("./queueitContextProvider");

// ── Queue-it settings ──────────────────────────────────────────────────────
// Replace these with your real values from the GO platform, or load them
// from environment variables (recommended for production).
const QUEUEIT_SETTINGS = {
  customerId:               process.env.QUEUEIT_CUSTOMER_ID  || "YOUR_CUSTOMER_ID",
  secretKey:                process.env.QUEUEIT_SECRET_KEY   || "YOUR_72_CHAR_SECRET_KEY",
  enqueueTokenEnabled:      true,
  enqueueTokenValidityTime: 4 * 60 * 1000, // 4 minutes in ms
  enqueueTokenKeyEnabled:   false,
};

// ── Path to integration config JSON ───────────────────────────────────────
// Downloaded from GO Platform → Integration → Overview → Download config.
// Store it in /config/ — that folder is NOT served over HTTP.
const CONFIG_PATH = path.join(__dirname, "..", "config", "queueit_integration_config.json");

// ── Response headers ───────────────────────────────────────────────────────
const HEADER_CONNECTOR_EXECUTED = "x-queueit-connector";
const HEADER_FAILED             = "x-queueit-failed";
const CONNECTOR_NAME            = "nodejs";

// ── File extensions to skip (static assets) ───────────────────────────────
const STATIC_EXTENSIONS = new Set([
  ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg",
  ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map",
]);

function isStaticAsset(url) {
  const ext = path.extname(url.split("?")[0]).toLowerCase();
  return STATIC_EXTENSIONS.has(ext);
}

// ── Middleware ──────────────────────────────────────────────────────────────
async function queueItMiddleware(req, res, next) {
  // Skip HEAD/OPTIONS and static assets
  if (req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (isStaticAsset(req.path)) return next();

  // Mark that the connector ran (visible in response headers)
  res.set(HEADER_CONNECTOR_EXECUTED, CONNECTOR_NAME);

  // Read integration config (the JSON you downloaded from GO platform)
  let integrationsConfigString;
  try {
    integrationsConfigString = fs.readFileSync(CONFIG_PATH, "utf8");
  } catch {
    console.warn(
      "[Queue-it] Integration config not found at:",
      CONFIG_PATH,
      "\n           Download it from GO → Integration → Overview → Download config",
      "\n           and place it at config/queueit_integration_config.json"
    );
    // Fail-open: let the request through if the config file is missing
    return next();
  }

  try {
    const connector       = QueueITConnector.KnownUser;
    const contextProvider = buildContextProvider(req, res, QUEUEIT_SETTINGS);
    const queueitToken    = req.query[connector.QueueITTokenKey];
    const requestUrl      = contextProvider.getHttpRequest().getAbsoluteUri();
    const cleanUrl        = stripQueueItToken(requestUrl);

    // Run the Queue-it validation
    const result = await connector.validateRequestByIntegrationConfig(
      cleanUrl,
      queueitToken,
      integrationsConfigString,
      QUEUEIT_SETTINGS.customerId,
      QUEUEIT_SETTINGS.secretKey,
      contextProvider
    );

    if (result.doRedirect()) {
      // Tell browsers not to cache the redirect
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma":        "no-cache",
        "Expires":       "Fri, 01 Jan 1990 00:00:00 GMT",
      });

      if (result.isAjaxResult) {
        // AJAX request: return a custom header so the client-side JS redirects
        const headerKey = result.getAjaxQueueRedirectHeaderKey();
        res.set(headerKey, result.getAjaxRedirectUrl());
        res.set("Access-Control-Expose-Headers", headerKey);
        // Send an empty 200 — the browser JS will handle the redirect
        return res.status(200).end();
      }

      // Regular request: hard redirect to the waiting room
      return res.redirect(302, result.redirectUrl);
    }

    // User is cleared — clean the token from the URL if present
    if (requestUrl !== cleanUrl && result.actionType === "Queue") {
      return res.redirect(302, cleanUrl);
    }

    // All good — continue to the actual route handler
    next();
  } catch (err) {
    // Configuration or network error — log and fail-open to keep the site up
    console.error("[Queue-it] Validation error:", err);
    res.set(HEADER_FAILED, "true");
    next();
  }
}

module.exports = queueItMiddleware;
