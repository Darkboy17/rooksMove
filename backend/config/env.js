const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const isProduction = process.env.NODE_ENV === "production";

/**
 * Parses an optional boolean environment variable.
 */
function parseOptionalBoolean(value) {
  if (value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  throw new Error(`Invalid boolean value: ${value}`);
}

/**
 * Normalizes SameSite values for Express cookie options.
 */
function parseSameSite(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();

  if (["lax", "strict", "none"].includes(normalized)) return normalized;
  throw new Error("REFRESH_COOKIE_SAME_SITE must be one of: lax, strict, none.");
}

const refreshCookieSameSite = parseSameSite(
  process.env.REFRESH_COOKIE_SAME_SITE,
  isProduction ? "none" : "lax"
);
const configuredRefreshCookieSecure = parseOptionalBoolean(
  process.env.REFRESH_COOKIE_SECURE
);
const configuredRefreshCookiePartitioned = parseOptionalBoolean(
  process.env.REFRESH_COOKIE_PARTITIONED
);
const refreshCookiePartitioned =
  configuredRefreshCookiePartitioned ?? refreshCookieSameSite === "none";
const refreshCookieSecure =
  refreshCookieSameSite === "none" || refreshCookiePartitioned
    ? true
    : configuredRefreshCookieSecure ?? isProduction;

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: process.env.PORT || 3000,
  host: process.env.HOST || "0.0.0.0",
  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB_NAME || "rooks_move",
  jwtSecret: process.env.JWT_SECRET || "change-this-rooks-move-secret",
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  refreshCookieName: "rooks_refresh_token",
  refreshCookieSameSite,
  refreshCookieSecure,
  refreshCookiePartitioned,
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
};

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required when NODE_ENV=production.");
}

module.exports = env;
