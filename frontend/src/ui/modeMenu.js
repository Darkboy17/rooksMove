/**
 * Returns the DOM nodes used by the mode menu.
 */
function getElements() {
  return {
    menuPage: document.getElementById("mode-menu"),
    modeHome: document.getElementById("mode-home"),
    menuUserName: document.getElementById("mode-user-name"),
    menuStatus: document.getElementById("mode-status"),
    playAiButton: document.getElementById("play-ai-button"),
    findOnlineButton: document.getElementById("find-online-button"),
    onlineLobby: document.getElementById("online-lobby"),
    lobbyBackButton: document.getElementById("lobby-back-button"),
    lobbyPlayerList: document.getElementById("lobby-player-list"),
    lobbyEmpty: document.getElementById("lobby-empty"),
    lobbyCount: document.getElementById("lobby-count"),
    lobbyStatus: document.getElementById("lobby-status"),
    challengeDialog: document.getElementById("challenge-dialog"),
    challengeText: document.getElementById("challenge-text"),
    challengeAcceptButton: document.getElementById("challenge-accept-button"),
    challengeDeclineButton: document.getElementById("challenge-decline-button"),
    gameShell: document.getElementById("game-shell"),
  };
}

let requestPlayHandler = null;
let currentChallengeId = null;
let currentDialogType = "challenge";

/**
 * Creates short initials for a player avatar.
 */
function getInitials(name) {
  return String(name || "P")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "P";
}

/**
 * Formats the secondary text for a lobby player row.
 */
function formatPlayerMeta(player) {
  return "Ready for matchmaking";
}

/**
 * Wires menu, lobby, challenge, and rematch controls.
 */
export function initializeModeMenu({
  onFindOnline,
  onLeaveOnlineLobby,
  onPlayAi,
  onAcceptChallenge,
  onDeclineChallenge,
  onAcceptRematch,
  onDeclineRematch,
  onRequestPlay,
}) {
  const {
    findOnlineButton,
    challengeAcceptButton,
    challengeDeclineButton,
    lobbyBackButton,
    playAiButton,
  } = getElements();
  requestPlayHandler = onRequestPlay;

  findOnlineButton.addEventListener("click", () => {
    showOnlineLobby();
    if (onFindOnline) onFindOnline();
  });

  playAiButton.addEventListener("click", () => {
    hideModeMenu();
    showGameShell();
    if (onPlayAi) onPlayAi();
  });

  lobbyBackButton.addEventListener("click", () => {
    showModeHome();
    if (onLeaveOnlineLobby) onLeaveOnlineLobby();
  });

  challengeAcceptButton.addEventListener("click", () => {
    if (currentDialogType === "rematch") {
      if (onAcceptRematch) onAcceptRematch();
    } else if (onAcceptChallenge) {
      onAcceptChallenge(currentChallengeId);
    }
    hideChallengeDialog();
  });

  challengeDeclineButton.addEventListener("click", () => {
    if (currentDialogType === "rematch") {
      if (onDeclineRematch) onDeclineRematch();
    } else if (onDeclineChallenge) {
      onDeclineChallenge(currentChallengeId);
    }
    hideChallengeDialog();
  });
}

/**
 * Shows the mode menu for the signed-in user.
 */
export function showModeMenu(user) {
  const { gameShell, menuPage, menuStatus, menuUserName } = getElements();
  gameShell.style.display = "none";
  menuPage.style.display = "grid";
  menuStatus.textContent = "";
  if (menuUserName) {
    menuUserName.textContent = user?.name || user?.email || "";
  }
  showModeHome();
}

/**
 * Shows the top-level mode selection view.
 */
export function showModeHome() {
  const { lobbyStatus, modeHome, onlineLobby } = getElements();
  modeHome.style.display = "block";
  onlineLobby.style.display = "none";
  lobbyStatus.textContent = "";
}

/**
 * Shows the online lobby loading state.
 */
export function showOnlineLobby() {
  const { lobbyEmpty, lobbyPlayerList, lobbyStatus, modeHome, onlineLobby } = getElements();
  modeHome.style.display = "none";
  onlineLobby.style.display = "grid";
  lobbyPlayerList.innerHTML = "";
  lobbyEmpty.style.display = "block";
  lobbyEmpty.textContent = "No one is here";
  lobbyStatus.textContent = "Connecting to online lobby...";
}

/**
 * Updates the lobby status text.
 */
export function setLobbyConnectionStatus(message) {
  const { lobbyStatus } = getElements();
  lobbyStatus.textContent = message || "";
}

/**
 * Opens the challenge/rematch confirmation dialog.
 */
export function showChallengeDialog({ challengeId, message, type = "challenge" }) {
  const { challengeDialog, challengeText } = getElements();
  currentChallengeId = challengeId;
  currentDialogType = type;
  challengeText.textContent = message || "A player wants to play against you.";
  challengeDialog.style.display = "flex";
}

/**
 * Hides and resets the challenge/rematch dialog.
 */
export function hideChallengeDialog() {
  const { challengeDialog } = getElements();
  currentChallengeId = null;
  currentDialogType = "challenge";
  challengeDialog.style.display = "none";
}

/**
 * Renders the current list of available online opponents.
 */
export function updateOnlineLobby(snapshot = {}) {
  const {
    lobbyCount,
    lobbyEmpty,
    lobbyPlayerList,
    lobbyStatus,
  } = getElements();
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];

  lobbyCount.textContent = `${snapshot.availableCount || players.length} online`;
  lobbyPlayerList.innerHTML = "";
  lobbyEmpty.style.display = players.length ? "none" : "block";

  players.forEach((player) => {
    const item = document.createElement("li");
    item.className = "lobby-player";

    const avatar = document.createElement("span");
    avatar.className = "lobby-player-avatar";
    avatar.textContent = getInitials(player.name);

    const identity = document.createElement("span");
    identity.className = "lobby-player-identity";

    const name = document.createElement("strong");
    name.textContent = player.name || "Player";

    const meta = document.createElement("small");
    meta.textContent = formatPlayerMeta(player);

    const status = document.createElement("span");
    status.className = "lobby-player-status";
    status.textContent = "Available";

    const requestButton = document.createElement("button");
    requestButton.className = "lobby-request-button";
    requestButton.type = "button";
    requestButton.textContent = "Request to Play";
    requestButton.addEventListener("click", () => {
      if (requestPlayHandler) requestPlayHandler(player);
    });

    identity.append(name, meta);
    item.append(avatar, identity, status, requestButton);
    lobbyPlayerList.appendChild(item);
  });

  if (!players.length) {
    lobbyEmpty.textContent = "No one is here";
    lobbyStatus.textContent = "No one is here.";
    return;
  }

  lobbyStatus.textContent =
    snapshot.opponentCount > 0
      ? `${snapshot.opponentCount} opponent${snapshot.opponentCount === 1 ? "" : "s"} available now.`
      : "No one is here.";
}

/**
 * Hides the mode menu.
 */
export function hideModeMenu() {
  const { menuPage } = getElements();
  menuPage.style.display = "none";
}

/**
 * Shows the Phaser game shell.
 */
export function showGameShell() {
  const { gameShell } = getElements();
  gameShell.style.display = "block";
}

/**
 * Hides the Phaser game shell.
 */
export function hideGameShell() {
  const { gameShell } = getElements();
  gameShell.style.display = "none";
}
