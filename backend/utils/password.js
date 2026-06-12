const crypto = require("crypto");

/**
 * Hashes a password with a random scrypt salt.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored scrypt hash.
 */
function verifyPassword(password, storedPassword) {
  const [salt, storedHash] = String(storedPassword || "").split(":");
  if (!salt || !storedHash) return false;

  const suppliedHash = crypto.scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(storedHash, "base64url");
  return (
    suppliedHash.length === storedHashBuffer.length &&
    crypto.timingSafeEqual(suppliedHash, storedHashBuffer)
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
};
