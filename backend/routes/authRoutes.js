const express = require("express");
const env = require("../config/env");
const requireAuth = require("../middleware/requireAuth");
const {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} = require("../services/authService");
const {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} = require("../utils/cookies");

const router = express.Router();

/**
 * Sends session JSON and persists the refresh token cookie.
 */
function sendSession(res, session, status = 200) {
  setRefreshCookie(res, session.refreshToken);
  res.status(status).json(session.body);
}

/**
 * Converts auth service errors into HTTP responses.
 */
function handleAuthError(res, error) {
  if (error.clearCookie) clearRefreshCookie(res);

  const status = error.status || 503;
  if (status >= 500) console.error("Auth error:", error.message);
  res.status(status).json({ error: error.message });
}

router.post("/register", async (req, res) => {
  try {
    const session = await registerUser(req.body);
    sendSession(res, session, 201);
  } catch (error) {
    handleAuthError(res, error);
  }
});

router.post("/login", async (req, res) => {
  try {
    const session = await loginUser(req.body);
    sendSession(res, session);
  } catch (error) {
    handleAuthError(res, error);
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const session = await refreshSession(readRefreshCookie(req));
    sendSession(res, session);
  } catch (error) {
    handleAuthError(res, error);
  }
});

router.post("/logout", async (req, res) => {
  try {
    await logoutUser(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    handleAuthError(res, error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.authUser.sub,
      email: req.authUser.email,
      name: req.authUser.name,
    },
    accessTokenExpiresIn: env.accessTokenTtlSeconds,
  });
});

module.exports = router;
