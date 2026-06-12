const { getDb } = require("../db/mongodb");
const env = require("../config/env");
const { hashPassword, verifyPassword } = require("../utils/password");
const {
  createRefreshToken,
  hashRefreshToken,
  publicUser,
  signAccessToken,
} = require("../utils/tokens");
const { getRefreshCookieMaxAge } = require("../utils/cookies");

/**
 * Normalizes an email address for storage and lookup.
 */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Builds the public auth payload sent to the browser.
 */
function createAuthPayload(user) {
  return {
    accessToken: signAccessToken(user),
    accessTokenExpiresIn: env.accessTokenTtlSeconds,
    user: publicUser(user),
  };
}

/**
 * Creates and stores a refresh session for a user.
 */
async function createRefreshSession(db, user) {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + getRefreshCookieMaxAge());

  await db.collection("refreshSessions").insertOne({
    userId: String(user._id),
    email: user.email,
    tokenHash: hashRefreshToken(refreshToken),
    createdAt: new Date(),
    expiresAt,
  });

  return refreshToken;
}

/**
 * Creates the complete session response with refresh and access tokens.
 */
async function createSessionResponse(db, user) {
  return {
    refreshToken: await createRefreshSession(db, user),
    body: createAuthPayload(user),
  };
}

/**
 * Registers a new user and starts their first session.
 */
async function registerUser({ email: rawEmail, name: rawName, password: rawPassword }) {
  const db = await getDb();
  const email = normalizeEmail(rawEmail);
  const name = String(rawName || "").trim() || email.split("@")[0];
  const password = String(rawPassword || "");

  if (!email || !email.includes("@")) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const user = {
    email,
    name,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await db.collection("users").insertOne(user);
    user._id = result.insertedId;
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = "An account already exists for that email.";
    }
    throw error;
  }

  return createSessionResponse(db, user);
}

/**
 * Validates credentials and starts a new session.
 */
async function loginUser({ email: rawEmail, password: rawPassword }) {
  const db = await getDb();
  const email = normalizeEmail(rawEmail);
  const password = String(rawPassword || "");
  const user = await db.collection("users").findOne({ email });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    const error = new Error("Email or password is incorrect.");
    error.status = 401;
    throw error;
  }

  return createSessionResponse(db, user);
}

/**
 * Refreshes an access token from a valid refresh token.
 */
async function refreshSession(refreshToken) {
  const db = await getDb();
  if (!refreshToken) {
    const error = new Error("No refresh session.");
    error.status = 401;
    throw error;
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const session = await db.collection("refreshSessions").findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    const error = new Error("Refresh session expired.");
    error.status = 401;
    error.clearCookie = true;
    throw error;
  }

  const user = await db.collection("users").findOne({ email: session.email });
  if (!user) {
    const error = new Error("User no longer exists.");
    error.status = 401;
    error.clearCookie = true;
    throw error;
  }

  await db.collection("refreshSessions").updateOne(
    { tokenHash },
    { $set: { lastUsedAt: new Date() } }
  );

  return {
    refreshToken,
    body: createAuthPayload(user),
  };
}

/**
 * Deletes a refresh session during logout.
 */
async function logoutUser(refreshToken) {
  const db = await getDb();
  if (refreshToken) {
    await db.collection("refreshSessions").deleteOne({
      tokenHash: hashRefreshToken(refreshToken),
    });
  }
}

module.exports = {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
};
