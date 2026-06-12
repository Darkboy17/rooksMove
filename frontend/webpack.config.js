const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

const DEFAULT_BROWSER_API_BASE = "";
const DEFAULT_BROWSER_SOCKET_BASE = "";
const DEFAULT_DEV_PROXY_TARGET = "http://localhost:3000";

/**
 * Parses simple KEY=value frontend environment files.
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return env;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return env;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (key) env[key] = value;

      return env;
    }, {});
}

const frontendEnv = {
  ROOKS_API_BASE: DEFAULT_BROWSER_API_BASE,
  ROOKS_SOCKET_BASE: DEFAULT_BROWSER_SOCKET_BASE,
  ...parseEnvFile(path.resolve(__dirname, ".env")),
};

const apiProxyTarget = frontendEnv.ROOKS_API_BASE || DEFAULT_DEV_PROXY_TARGET;
const socketProxyTarget =
  frontendEnv.ROOKS_SOCKET_BASE || frontendEnv.ROOKS_API_BASE || DEFAULT_DEV_PROXY_TARGET;

/**
 * Builds the browser app and serves it with API/socket proxies in development.
 */
module.exports = {
  entry: path.resolve(__dirname, "src/main.js"),
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "public"),
    publicPath: "/",
    clean: false,
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.ROOKS_API_BASE": JSON.stringify(frontendEnv.ROOKS_API_BASE),
      "process.env.ROOKS_SOCKET_BASE": JSON.stringify(frontendEnv.ROOKS_SOCKET_BASE),
    }),
  ],
  devServer: {
    port: 5173,
    static: {
      directory: path.resolve(__dirname, "public"),
      publicPath: "/",
    },
    historyApiFallback: false,
    hot: true,
    client: {
      overlay: true,
    },
    proxy: [
      {
        context: ["/api"],
        target: apiProxyTarget,
        changeOrigin: true,
      },
      {
        context: ["/socket.io"],
        target: socketProxyTarget,
        ws: true,
        changeOrigin: true,
      },
    ],
  },
};
