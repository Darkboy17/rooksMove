const env = require("../config/env");

/**
 * Returns the refresh cookie lifetime in milliseconds.
 */
function getRefreshCookieMaxAge() {
  return env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
}

/**
 * Sets the refresh token cookie.
 */
function setRefreshCookie(res, token) {
  res.cookie(env.refreshCookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    maxAge: getRefreshCookieMaxAge(),
    path: "/",
  });
}

/**
 * Clears the refresh token cookie.
 */
function clearRefreshCookie(res) {
  res.clearCookie(env.refreshCookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    path: "/",
  });
}

/**
 * Reads a named cookie from the request header.
 */
function readCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

/**
 * Reads the configured refresh token cookie.
 */
function readRefreshCookie(req) {
  return readCookie(req, env.refreshCookieName);
}

module.exports = {
  clearRefreshCookie,
  getRefreshCookieMaxAge,
  readRefreshCookie,
  setRefreshCookie,
};
