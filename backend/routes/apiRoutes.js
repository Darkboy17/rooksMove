const express = require("express");

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

/**
 * Builds a lightweight docs page that links to the OpenAPI JSON.
 */
function renderDocsPage() {
  return renderPage({
    title: "Rooks Move API Docs",
    body: `
      <h1>API Docs</h1>
      <p>The OpenAPI document is available as JSON.</p>
      <p><a href="/api/docs/swagger.json">Open swagger.json</a></p>
    `,
  });
}

/**
 * Returns the OpenAPI contract for the public REST routes.
 */
function getOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Rooks Move API",
      version: "1.0.0",
    },
    servers: [{ url: "/" }],
    tags: [{ name: "Health" }, { name: "Auth" }, { name: "AI" }],
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { status: { type: "string" } },
                    required: ["status"],
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                    name: { type: "string" },
                  },
                  required: ["email", "password", "name"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "409": { description: "Email already exists" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Authenticated session" },
            "401": { description: "Invalid credentials" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout user",
          responses: {
            "204": { description: "No Content" },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token from the refresh cookie",
          responses: {
            "200": { description: "Refreshed session" },
            "401": { description: "Missing or expired refresh session" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Current user" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/ai/move": {
        post: {
          tags: ["AI"],
          summary: "Get an AI move",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    position: {
                      type: "object",
                      properties: {
                        col: { type: "integer", minimum: 1, maximum: 8 },
                        row: { type: "integer", minimum: 1, maximum: 8 },
                      },
                      required: ["col", "row"],
                    },
                  },
                  required: ["position"],
                },
              },
            },
          },
          responses: {
            "200": { description: "AI move" },
            "400": { description: "Invalid board position" },
            "401": { description: "Unauthorized" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };
}

router.get("/", (req, res) => {
  res.status(200).type("html").send(renderWelcomePage());
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/docs", (req, res) => {
  res.status(200).type("html").send(renderDocsPage());
});

router.get("/docs/swagger.json", (req, res) => {
  res.status(200).json(getOpenApiSpec());
});

module.exports = router;
