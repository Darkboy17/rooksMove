const path = require("path");

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
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      {
        context: ["/socket.io"],
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    ],
  },
};
