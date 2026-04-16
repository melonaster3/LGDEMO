/**
 * queueitContextProvider.js
 *
 * Adapts an Express req/res pair into the IConnectorContextProvider
 * interface expected by @queue-it/connector-javascript.
 */

const crypto = require("crypto");
const { Token, Payload } = require("@queue-it/queue-token");
const QueueITConnector = require("@queue-it/connector-javascript");

/**
 * Builds and returns an IConnectorContextProvider for the current request.
 *
 * @param {import("express").Request}  req
 * @param {import("express").Response} res
 * @param {object} settings  - Queue-it settings object (customerId, secretKey, etc.)
 * @returns {import("@queue-it/connector-javascript").IConnectorContextProvider}
 */
function buildContextProvider(req, res, settings) {
  return {
    // ── Crypto ──────────────────────────────────────────────────────────────
    getCryptoProvider() {
      return {
        getSha256Hash(secretKey, plaintext) {
          return crypto
            .createHmac("sha256", secretKey)
            .update(plaintext)
            .digest("hex");
        },
      };
    },

    // ── Enqueue token (optional) ─────────────────────────────────────────────
    getEnqueueTokenProvider() {
      if (!settings.enqueueTokenEnabled) return null;

      return new QueueITConnector.DefaultEnqueueTokenProvider(
        settings.customerId,
        settings.secretKey,
        settings.enqueueTokenValidityTime,
        req.ip,
        settings.enqueueTokenKeyEnabled,
        Token,
        Payload
      );
    },

    // ── HTTP Request ─────────────────────────────────────────────────────────
    getHttpRequest() {
      return {
        getUserAgent() {
          return req.get("user-agent") || "";
        },

        getHeader(name) {
          // Queue-it uses a special header name to get the real client IP
          if (name === "x-queueit-clientip") return req.ip;
          return req.get(name) || "";
        },

        getAbsoluteUri() {
          // When behind a proxy (Vercel/load balancer) trust x-forwarded headers
          const proto =
            req.get("x-forwarded-proto") || req.protocol || "https";
          const host = req.get("x-forwarded-host") || req.get("host");
          return `${proto}://${host}${req.originalUrl}`;
        },

        getUserHostAddress() {
          // Vercel forwards the real IP in x-forwarded-for
          return (
            req.get("x-forwarded-for")?.split(",")[0].trim() ||
            req.ip ||
            ""
          );
        },

        getCookieValue(cookieKey) {
          // req.cookies is populated by the cookie-parser middleware
          return req.cookies?.[cookieKey] || "";
        },
      };
    },

    // ── HTTP Response ────────────────────────────────────────────────────────
    getHttpResponse() {
      return {
        setCookie(
          cookieName,
          cookieValue,
          domain,
          expiration,   // seconds since epoch
          isCookieHttpOnly,
          isCookieSecure
        ) {
          res.cookie(cookieName, cookieValue, {
            expires: new Date(expiration * 1000), // convert to ms
            path: "/",
            domain: domain || undefined,
            secure: isCookieSecure,
            httpOnly: isCookieHttpOnly,
          });
        },
      };
    },
  };
}

/**
 * Strips the queueittoken query-string parameter from a URL so that
 * the user-specific token is never shared or cached.
 */
function stripQueueItToken(requestUrl) {
  try {
    const url = new URL(requestUrl);
    url.searchParams.delete(QueueITConnector.KnownUser.QueueITTokenKey);
    return url.toString();
  } catch {
    return requestUrl;
  }
}

module.exports = { buildContextProvider, stripQueueItToken };
