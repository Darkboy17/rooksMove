import {
  getAccessToken,
  getCurrentUser,
  initializeAuth,
  logout,
  refreshSession,
} from "./auth/authClient";
import { createGame, destroyGame } from "./game/rooksmoveGame";
import socket, {
  connectSocket,
  disconnectSocket,
  setSocketToken,
} from "./network/socketManager";
import {
  hideGameShell,
  hideModeMenu,
  hideChallengeDialog,
  initializeModeMenu,
  setLobbyConnectionStatus,
  showChallengeDialog,
  showGameShell,
  showModeHome,
  showModeMenu,
  updateOnlineLobby,
} from "./ui/modeMenu";

const appState = {
  activeMode: "online",
  lobbyActive: false,
  presenceAnnounceQueued: false,
};

/**
 * Replaces an existing socket listener with a fresh handler.
 */
function bindSocketEvent(eventName, handler) {
  socket.off(eventName, handler);
  socket.on(eventName, handler);
}

/**
 * Handles auth failures from Socket.IO by silently refreshing once.
 */
async function handleSocketConnectError(error) {
  if (error.message === "Authentication required.") {
    const refreshed = await refreshSession({ silent: true });
    if (refreshed) {
      setSocketToken(getAccessToken());
      connectSocket(getAccessToken());
      return;
    }

    if (refreshed === null) return;

    logout({ skipConfirmation: true });
  }
}

/**
 * Attaches the Socket.IO auth recovery guard.
 */
function attachSocketAuthGuard() {
  socket.off("connect_error", handleSocketConnectError);
  socket.on("connect_error", handleSocketConnectError);
}

/**
 * Renders the latest online lobby player snapshot.
 */
function handleLobbyPlayers(snapshot) {
  updateOnlineLobby(snapshot);
}

/**
 * Starts the online Phaser scene once matchmaking succeeds.
 */
function handleMatchmakingMatched(match) {
  appState.activeMode = "online";
  appState.lobbyActive = false;
  hideChallengeDialog();
  destroyGame();
  hideModeMenu();
  showGameShell();
  createGame({ mode: "online", user: getCurrentUser(), match });
}

/**
 * Shows pending challenge feedback while the opponent decides.
 */
function handleChallengePending(data = {}) {
  setLobbyConnectionStatus(data.message || "Waiting for player to confirm.");
}

/**
 * Opens the challenge dialog for inbound challenge events.
 */
function handleChallengeReceived(data = {}) {
  showChallengeDialog(data);
}

/**
 * Restores lobby feedback after a challenge is declined.
 */
function handleChallengeDeclined(data = {}) {
  setLobbyConnectionStatus(data.message || "Your match request was declined.");
  socket.emit("lobby:requestPlayers");
}

/**
 * Forwards rematch pending feedback into the active game scene.
 */
function handleRematchPending(data = {}) {
  window.dispatchEvent(
    new CustomEvent("rooks:game-status", {
      detail: { message: data.message || "Waiting for opponent to accept rematch." },
    })
  );
}

/**
 * Opens the rematch dialog for inbound rematch requests.
 */
function handleRematchReceived(data = {}) {
  showChallengeDialog({
    type: "rematch",
    message: data.message || "Your opponent wants a rematch.",
  });
}

/**
 * Returns to the menu after a declined rematch message is shown.
 */
function handleRematchDeclined(data = {}) {
  window.dispatchEvent(
    new CustomEvent("rooks:game-status", {
      detail: { message: data.message || "Rematch declined. Returning to main menu." },
    })
  );
  setTimeout(() => {
    returnToModeMenu();
  }, 1600);
}

/**
 * Tears down gameplay UI and restores the mode menu.
 */
function returnToModeMenu({ announce = true } = {}) {
  appState.lobbyActive = false;
  hideChallengeDialog();
  setLobbyConnectionStatus("");
  destroyGame();
  hideGameShell();
  showModeMenu(getCurrentUser());
  showModeHome();
  if (announce) announceAvailable();
}

/**
 * Announces this signed-in user as available for online play.
 */
function emitAvailablePresence() {
  socket.emit("presence:available");
  if (appState.lobbyActive) {
    socket.emit("lobby:requestPlayers");
  }
}

/**
 * Ensures the socket is connected before announcing availability.
 */
function announceAvailable() {
  if (!getAccessToken()) return;

  connectSocket(getAccessToken());

  if (socket.connected) {
    emitAvailablePresence();
    return;
  }

  if (appState.presenceAnnounceQueued) return;
  appState.presenceAnnounceQueued = true;
  socket.once("connect", () => {
    appState.presenceAnnounceQueued = false;
    emitAvailablePresence();
  });
}

/**
 * Joins the online lobby and requests its current player list.
 */
function joinOnlineLobby() {
  appState.activeMode = "online";
  appState.lobbyActive = true;
  connectSocket(getAccessToken());
  socket.emit("lobby:join");
  setLobbyConnectionStatus(socket.connected ? "Lobby synced." : "Connecting to online lobby...");
}

/**
 * Leaves the online lobby and optionally closes the socket connection.
 */
function leaveOnlineLobby({ disconnect = true } = {}) {
  if (!appState.lobbyActive) return;

  appState.lobbyActive = false;
  socket.emit("lobby:leave");
  setLobbyConnectionStatus("");

  if (disconnect) {
    disconnectSocket();
  } else {
    socket.emit("presence:available");
  }
}

/**
 * Sends a challenge request to the selected online player.
 */
function requestOnlineMatch(player) {
  appState.activeMode = "online";
  connectSocket(getAccessToken());
  setLobbyConnectionStatus(`Waiting for ${player.name || "player"} to confirm.`);
  socket.emit("challenge:request", { playerId: player.id });
}

/**
 * Registers app-level Socket.IO handlers.
 */
function attachSocketHandlers() {
  attachSocketAuthGuard();
  bindSocketEvent("lobby:players", handleLobbyPlayers);
  bindSocketEvent("connect", handleSocketConnect);
  bindSocketEvent("disconnect", handleSocketDisconnect);
  bindSocketEvent("matchmaking:matched", handleMatchmakingMatched);
  bindSocketEvent("challenge:pending", handleChallengePending);
  bindSocketEvent("challenge:received", handleChallengeReceived);
  bindSocketEvent("challenge:declined", handleChallengeDeclined);
  bindSocketEvent("rematch:pending", handleRematchPending);
  bindSocketEvent("rematch:received", handleRematchReceived);
  bindSocketEvent("rematch:declined", handleRematchDeclined);
}

/**
 * Resyncs presence and lobby state after reconnecting.
 */
function handleSocketConnect() {
  emitAvailablePresence();

  if (!appState.lobbyActive) return;
  socket.emit("lobby:join");
  socket.emit("lobby:requestPlayers");
  setLobbyConnectionStatus("Lobby synced.");
}

/**
 * Shows reconnecting feedback if the lobby socket drops.
 */
function handleSocketDisconnect() {
  if (!appState.lobbyActive) return;
  setLobbyConnectionStatus("Reconnecting lobby...");
}

attachSocketHandlers();

initializeModeMenu({
  onFindOnline: joinOnlineLobby,
  onLeaveOnlineLobby: () => leaveOnlineLobby({ disconnect: false }),
  onRequestPlay: requestOnlineMatch,
  onAcceptChallenge: (challengeId) => {
    socket.emit("challenge:accept", { challengeId });
  },
  onDeclineChallenge: (challengeId) => {
    socket.emit("challenge:decline", { challengeId });
  },
  onAcceptRematch: () => {
    socket.emit("rematch:accept");
  },
  onDeclineRematch: () => {
    socket.emit("rematch:decline");
  },
  onPlayAi: () => {
    appState.activeMode = "ai";
    leaveOnlineLobby();
    disconnectSocket();
    createGame({ mode: "ai", user: getCurrentUser() });
  },
});

window.addEventListener("rooks:restart-game", (event) => {
  appState.activeMode = (event.detail && event.detail.mode) || appState.activeMode;

  if (appState.activeMode === "online") {
    socket.emit("rematch:request");
    return;
  }

  destroyGame();

  createGame({ mode: appState.activeMode, user: getCurrentUser() });
});

window.addEventListener("rooks:main-menu", (event) => {
  const shouldNotifyOpponent =
    !event.detail || event.detail.notifyOpponent !== false;

  if (appState.activeMode === "online" && shouldNotifyOpponent && socket.connected) {
    socket.emit("match:leave");
  }

  returnToModeMenu();
});

initializeAuth({
  onAuthenticated: ({ user }) => {
    showModeMenu(user);
    announceAvailable();
  },
  onTokenChanged: (accessToken) => {
    setSocketToken(accessToken || getAccessToken());
    if (accessToken) announceAvailable();
  },
  onLogout: () => {
    appState.lobbyActive = false;
    hideModeMenu();
    hideGameShell();
    disconnectSocket();
    socket.removeAllListeners();
    hideChallengeDialog();
    attachSocketHandlers();
    destroyGame();
  },
});
