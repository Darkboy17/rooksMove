const express = require("express");
const cors = require("cors");
const aiRoutes = require("./routes/aiRoutes");
const authRoutes = require("./routes/authRoutes");
const apiRoutes = require("./routes/apiRoutes");

/**
 * Creates the API-only Express application.
 */
function createApp() {
  const app = express();
  app.locals.apiOnly = true;

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", apiRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/auth", authRoutes);

  app.get("/", (req, res) => res.redirect("/api"));

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message =
      status >= 500 ? "Internal Server Error" : err.message || "Request failed";

    if (status >= 500) console.error("API error:", err);
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = createApp;
