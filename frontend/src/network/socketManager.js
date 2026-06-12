import io from "socket.io-client";
import { SOCKET_BASE } from "./apiConfig";

const socket = io(SOCKET_BASE, {
  autoConnect: false,
});

/**
 * Connects the shared Socket.IO client with the latest access token.
 */
export function connectSocket(accessToken) {
  socket.auth = { token: accessToken };

  if (!socket.connected) {
    socket.connect();
  }
}

/**
 * Disconnects the shared Socket.IO client when realtime state is no longer needed.
 */
export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

/**
 * Updates Socket.IO authentication without forcing a connection.
 */
export function setSocketToken(accessToken) {
  socket.auth = accessToken ? { token: accessToken } : {};
}

export default socket;
