const http = require("http");
const { Server } = require("socket.io");
const env = require("./config/env");
const createApp = require("./app");
const registerGameSocket = require("./realtime/gameSocket");

/**
 * Starts the HTTP API and attaches Socket.IO matchmaking/game channels.
 */
function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  registerGameSocket(io);

  server.listen(env.port, env.host, () => {
    console.log(`Server is running at http://localhost:${env.port}`);
  });
}

module.exports = startServer;

if (require.main === module) {
  startServer();
}
