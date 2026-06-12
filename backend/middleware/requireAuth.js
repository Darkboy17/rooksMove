const { verifyAccessToken } = require("../utils/tokens");

/**
 * Requires a valid bearer access token for protected routes.
 */
function requireAuth(req, res, next) {
  const [, token] = String(req.headers.authorization || "").split(" ");
  const user = verifyAccessToken(token);
  if (!user) return res.status(401).json({ error: "Authentication required." });

  req.authUser = user;
  next();
}

module.exports = requireAuth;
