const express = require("express");
const { getOpenApiSpec } = require("../docs/openApiSpec");
const { renderSwaggerPage } = require("../docs/swaggerPage");

const router = express.Router();

/**
 * Wraps route metadata in a compact HTML shell for browser visits.
 */
function renderPage({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #0b1220;
      color: #f5f7fb;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    }
    main {
      width: min(760px, 100%);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 8px;
      background: rgba(255,255,255,.06);
      padding: 28px;
      box-shadow: 0 24px 70px rgba(0,0,0,.35);
    }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { color: #cbd5e1; line-height: 1.55; }
    a { color: #34d399; font-weight: 800; text-decoration: none; }
    code {
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 6px;
      background: rgba(0,0,0,.25);
      padding: 2px 6px;
    }
    ul { display: grid; gap: 10px; padding-left: 20px; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

/**
 * Builds the API landing page shown at GET /api.
 */
function renderWelcomePage() {
  return renderPage({
    title: "Rooks Move API",
    body: `
      <h1>Rooks Move API</h1>
      <p>The backend is running. Use these routes while testing the frontend.</p>
      <ul>
        <li><code>GET /api/health</code></li>
        <li><code>/api/auth/*</code></li>
        <li><code>/api/ai/*</code></li>
        <li><code>socket.io</code></li>
      </ul>
      <p><a href="/api/docs">Open API docs</a></p>
    `,
  });
}

router.get("/", (req, res) => {
  res.status(200).type("html").send(renderWelcomePage());
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/docs", (req, res) => {
  res.status(200).type("html").send(renderSwaggerPage());
});

router.get("/docs/openapi.json", (req, res) => {
  res.status(200).json(getOpenApiSpec());
});

router.get("/docs/swagger.json", (req, res) => {
  res.status(200).json(getOpenApiSpec());
});

module.exports = router;
