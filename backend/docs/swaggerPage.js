/**
 * Renders the Swagger UI HTML shell for the API docs route.
 */
function renderSwaggerPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rook's Move API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; background: #f8fafc; }
    .topbar { display: none; }
    .docs-header {
      padding: 18px 28px;
      background: #0b1220;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    }
    .docs-header h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
    }
    .docs-header p {
      margin: 6px 0 0;
      color: #cbd5e1;
    }
    .docs-header a {
      color: #34d399;
      font-weight: 800;
      text-decoration: none;
    }
    #swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <header class="docs-header">
    <h1>Rook's Move API Docs</h1>
    <p>Interactive Swagger UI. Raw OpenAPI JSON: <a href="/api/docs/openapi.json">/api/docs/openapi.json</a></p>
  </header>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.addEventListener("load", function () {
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    });
  </script>
</body>
</html>`;
}

module.exports = {
  renderSwaggerPage,
};
