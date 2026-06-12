const env = require("../config/env");

let MongoClient;
try {
  ({ MongoClient } = require("mongodb"));
} catch (error) {
  MongoClient = null;
}

let mongoClient;
let mongoDb;

/**
 * Rewrites common MongoDB errors into actionable messages.
 */
function formatMongoError(error) {
  if (error.message && error.message.includes("bad auth")) {
    return new Error(
      "MongoDB Atlas authentication failed. Check the username/password in MONGODB_URI, URL-encode special characters in the password, and confirm the database user has read/write access."
    );
  }

  if (
    error.message &&
    (error.message.includes("tlsv1 alert internal error") ||
      error.message.includes("secure TLS connection was established") ||
      error.message.includes("SSL routines"))
  ) {
    return new Error(
      "MongoDB Atlas TLS connection failed before authentication. Check Atlas Network Access for this machine's public IP, restart the server with npm start, and use Node 20/22 LTS if the issue continues."
    );
  }

  return error;
}

/**
 * Returns a cached MongoDB database connection and ensures indexes exist.
 */
async function getDb() {
  if (!MongoClient) {
    throw new Error("The mongodb package is not installed. Run npm install before using auth.");
  }

  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required for MongoDB Atlas auth.");
  }

  if (!mongoClient) {
    const client = new MongoClient(env.mongoUri, {
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
    });

    try {
      await client.connect();
      mongoDb = client.db(env.mongoDbName);
      await Promise.all([
        mongoDb.collection("users").createIndex({ email: 1 }, { unique: true }),
        mongoDb.collection("refreshSessions").createIndex({ tokenHash: 1 }, { unique: true }),
        mongoDb.collection("refreshSessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]);
      mongoClient = client;
    } catch (error) {
      mongoClient = null;
      mongoDb = null;
      await client.close().catch(() => {});
      throw formatMongoError(error);
    }
  }

  return mongoDb;
}

module.exports = {
  getDb,
};
