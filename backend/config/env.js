const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const isProduction = process.env.NODE_ENV === "production";

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
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
};

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required when NODE_ENV=production.");
}

module.exports = env;
