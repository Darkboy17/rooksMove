const crypto = require("crypto");
const env = require("../config/env");

/**
 * Encodes a value using base64url for JWT segments.
 */
function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

/**
 * Returns the browser-safe user shape.
 */
function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
  };
}

/**
 * Signs a short-lived HS256 access token.
 */
function signAccessToken(user) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      sub: String(user._id),
      email: user.email,
      name: user.name,
      iat: now,
      exp: now + env.accessTokenTtlSeconds,
    })
  );
  const signature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies and decodes an access token.
 */
function verifyAccessToken(token) {
  const [header, payload, signature] = String(token || "").split(".");
  if (!header || !payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Creates a cryptographically strong refresh token.
 */
function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Hashes a refresh token before database storage.
 */
function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  createRefreshToken,
  hashRefreshToken,
  publicUser,
  signAccessToken,
  verifyAccessToken,
};
