/**
 * Builds a reusable JSON schema reference.
 */
function ref(schemaName) {
  return { $ref: `#/components/schemas/${schemaName}` };
}

/**
 * Returns the OpenAPI contract for the backend REST API.
 */
function getOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Rook's Move API",
      version: "1.0.0",
      description:
        "REST API for Rook's Move authentication, health checks, and AI move generation. Socket.IO powers realtime matchmaking and gameplay.",
    },
    servers: [
      {
        url: "/",
        description: "Current host",
      },
      {
        url: "http://localhost:3000",
        description: "Local backend",
      },
    ],
    tags: [
      { name: "Meta", description: "API metadata and health checks" },
      { name: "Auth", description: "Account and session endpoints" },
      { name: "AI", description: "AI move generation endpoints" },
    ],
    paths: {
      "/api": {
        get: {
          tags: ["Meta"],
          summary: "API landing page",
          responses: {
            "200": {
              description: "HTML API landing page",
              content: {
                "text/html": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["Meta"],
          summary: "Health check",
          responses: {
            "200": {
              description: "Backend is healthy",
              content: {
                "application/json": {
                  schema: ref("HealthResponse"),
                  example: { status: "ok" },
                },
              },
            },
          },
        },
      },
      "/api/docs/openapi.json": {
        get: {
          tags: ["Meta"],
          summary: "OpenAPI JSON document",
          responses: {
            "200": {
              description: "OpenAPI 3.0 JSON document",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a user",
          description:
            "Creates a user, sets an HTTP-only refresh cookie, and returns an access token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("RegisterRequest"),
                example: {
                  name: "Player One",
                  email: "player@example.com",
                  password: "password123",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Created session",
              headers: {
                "Set-Cookie": {
                  schema: { type: "string" },
                  description: "HTTP-only refresh token cookie",
                },
              },
              content: {
                "application/json": {
                  schema: ref("SessionResponse"),
                },
              },
            },
            "400": {
              description: "Invalid input",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
            "409": {
              description: "Email already exists",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
            "503": {
              description: "Auth storage unavailable",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login a user",
          description:
            "Validates credentials, sets an HTTP-only refresh cookie, and returns an access token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("LoginRequest"),
                example: {
                  email: "player@example.com",
                  password: "password123",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Authenticated session",
              headers: {
                "Set-Cookie": {
                  schema: { type: "string" },
                  description: "HTTP-only refresh token cookie",
                },
              },
              content: {
                "application/json": {
                  schema: ref("SessionResponse"),
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
            "503": {
              description: "Auth storage unavailable",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh an access token",
          description:
            "Uses the HTTP-only refresh cookie to issue a fresh access token.",
          responses: {
            "200": {
              description: "Refreshed session",
              content: {
                "application/json": {
                  schema: ref("SessionResponse"),
                },
              },
            },
            "401": {
              description: "Missing or expired refresh session",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
            "503": {
              description: "Auth storage unavailable",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout a user",
          description:
            "Deletes the current refresh session when present and clears the refresh cookie.",
          responses: {
            "204": {
              description: "Logged out",
            },
            "503": {
              description: "Auth storage unavailable",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get the current user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Current user profile",
              content: {
                "application/json": {
                  schema: ref("CurrentUserResponse"),
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
          },
        },
      },
      "/api/ai/move": {
        post: {
          tags: ["AI"],
          summary: "Get an AI move",
          description:
            "Returns a legal move for the provided board position. Uses Groq when configured, otherwise uses the local strategic fallback.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("AiMoveRequest"),
                example: {
                  position: { col: 8, row: 1 },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "AI move result",
              content: {
                "application/json": {
                  schema: ref("AiMoveResponse"),
                  examples: {
                    local: {
                      value: {
                        move: { col: 1, row: 1 },
                        source: "local",
                        model: "llama-3.3-70b-versatile",
                      },
                    },
                    groq: {
                      value: {
                        move: { col: 4, row: 1 },
                        source: "groq",
                        model: "llama-3.3-70b-versatile",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid board position or no legal move",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
            "503": {
              description: "AI provider unavailable",
              content: { "application/json": { schema: ref("ErrorResponse") } },
            },
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
          description: "Use the access token returned by login, register, or refresh.",
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
          },
          required: ["status"],
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Authentication required." },
          },
          required: ["error"],
        },
        RegisterRequest: {
          type: "object",
          properties: {
            name: { type: "string", example: "Player One" },
            email: { type: "string", format: "email", example: "player@example.com" },
            password: {
              type: "string",
              format: "password",
              minLength: 8,
              example: "password123",
            },
          },
          required: ["email", "password", "name"],
        },
        LoginRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", example: "player@example.com" },
            password: {
              type: "string",
              format: "password",
              minLength: 8,
              example: "password123",
            },
          },
          required: ["email", "password"],
        },
        PublicUser: {
          type: "object",
          properties: {
            id: { type: "string", example: "665f4e9b4c2a7d0013d8cabc" },
            email: { type: "string", format: "email", example: "player@example.com" },
            name: { type: "string", example: "Player One" },
          },
          required: ["id", "email", "name"],
        },
        SessionResponse: {
          type: "object",
          properties: {
            accessToken: {
              type: "string",
              description: "Short-lived bearer token",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            accessTokenExpiresIn: {
              type: "integer",
              example: 900,
            },
            user: ref("PublicUser"),
          },
          required: ["accessToken", "accessTokenExpiresIn", "user"],
        },
        CurrentUserResponse: {
          type: "object",
          properties: {
            user: ref("PublicUser"),
            accessTokenExpiresIn: {
              type: "integer",
              example: 900,
            },
          },
          required: ["user", "accessTokenExpiresIn"],
        },
        BoardPosition: {
          type: "object",
          properties: {
            col: {
              type: "integer",
              minimum: 1,
              maximum: 8,
              example: 8,
            },
            row: {
              type: "integer",
              minimum: 1,
              maximum: 8,
              example: 1,
            },
          },
          required: ["col", "row"],
        },
        AiMoveRequest: {
          type: "object",
          properties: {
            position: ref("BoardPosition"),
          },
          required: ["position"],
        },
        AiMoveResponse: {
          type: "object",
          properties: {
            move: ref("BoardPosition"),
            source: {
              type: "string",
              enum: ["groq", "fallback", "local"],
              example: "local",
            },
            model: {
              type: "string",
              example: "llama-3.3-70b-versatile",
            },
          },
          required: ["move", "source", "model"],
        },
      },
    },
  };
}

module.exports = {
  getOpenApiSpec,
};
