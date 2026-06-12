/**
 * Creates an in-memory presence registry for connected players.
 */
function createPresenceService() {
  const usersById = new Map();
  const socketUsers = new Map();

  /**
   * Returns the stable user identifier for a socket.
   */
  function getUserId(socket) {
    return String(
      (socket.user && (socket.user.sub || socket.user.id || socket.user.email)) ||
        socket.id
    );
  }

  /**
   * Builds a display name from authenticated user data.
   */
  function getDisplayName(user) {
    return user.name || (user.email && user.email.split("@")[0]) || "Player";
  }

  /**
   * Creates or updates a presence entry for the socket.
   */
  function ensureUser(socket) {
    const userId = getUserId(socket);
    const now = Date.now();
    let entry = usersById.get(userId);

    if (!entry) {
      entry = {
        id: userId,
        email: socket.user.email,
        name: getDisplayName(socket.user),
        connectedAt: now,
        lastSeenAt: now,
        socketIds: new Set(),
        lobbySocketIds: new Set(),
        matchSocketIds: new Set(),
      };
      usersById.set(userId, entry);
    }

    entry.email = socket.user.email || entry.email;
    entry.name = getDisplayName(socket.user);
    entry.lastSeenAt = now;
    entry.socketIds.add(socket.id);
    socketUsers.set(socket.id, userId);

    return entry;
  }

  /**
   * Marks a socket as connected.
   */
  function connect(socket) {
    ensureUser(socket);
  }

  /**
   * Marks a socket as visible in the lobby.
   */
  function joinLobby(socket) {
    const entry = ensureUser(socket);
    entry.matchSocketIds.delete(socket.id);
    entry.lobbySocketIds.add(socket.id);
    entry.lastSeenAt = Date.now();
  }

  /**
   * Removes a socket from lobby visibility.
   */
  function leaveLobby(socket) {
    const userId = socketUsers.get(socket.id);
    const entry = userId && usersById.get(userId);
    if (!entry) return;

    entry.lobbySocketIds.delete(socket.id);
    entry.lastSeenAt = Date.now();
  }

  /**
   * Marks a socket as busy in a match.
   */
  function markInMatch(socket) {
    const entry = ensureUser(socket);
    entry.lobbySocketIds.delete(socket.id);
    entry.matchSocketIds.add(socket.id);
    entry.lastSeenAt = Date.now();
  }

  /**
   * Marks a socket as available outside a match.
   */
  function markAvailable(socket) {
    const entry = ensureUser(socket);
    entry.matchSocketIds.delete(socket.id);
    entry.lastSeenAt = Date.now();
  }

  /**
   * Returns public user data for a socket.
   */
  function getUserForSocket(socket) {
    if (!socket) return null;
    const userId = socketUsers.get(socket.id);
    const entry = userId && usersById.get(userId);
    if (!entry) return null;

    return {
      id: entry.id,
      email: entry.email,
      name: entry.name,
    };
  }

  /**
   * Finds any available opponent for a socket.
   */
  function getAvailableOpponent(socket) {
    const currentUserId = getUserId(socket);
    const opponent = Array.from(usersById.values()).find(
      (entry) =>
        entry.id !== currentUserId &&
        entry.socketIds.size > 0 &&
        entry.matchSocketIds.size === 0
    );

    if (!opponent) return null;

    const [socketId] = Array.from(opponent.socketIds);
    return {
      id: opponent.id,
      email: opponent.email,
      name: opponent.name,
      socketId,
    };
  }

  /**
   * Finds a requested available opponent by user id.
   */
  function getAvailablePlayerById(socket, playerId) {
    const currentUserId = getUserId(socket);
    const targetId = String(playerId || "");
    if (!targetId || targetId === currentUserId) return null;

    const player = usersById.get(targetId);
    if (!player || player.socketIds.size === 0 || player.matchSocketIds.size > 0) {
      return null;
    }

    const [socketId] = Array.from(player.socketIds);
    return {
      id: player.id,
      email: player.email,
      name: player.name,
      socketId,
    };
  }

  /**
   * Removes a disconnected socket from presence.
   */
  function removeSocket(socket) {
    const userId = socketUsers.get(socket.id);
    if (!userId) return;

    const entry = usersById.get(userId);
    socketUsers.delete(socket.id);

    if (!entry) return;

    entry.socketIds.delete(socket.id);
    entry.lobbySocketIds.delete(socket.id);
    entry.matchSocketIds.delete(socket.id);
    entry.lastSeenAt = Date.now();

    if (entry.socketIds.size === 0) {
      usersById.delete(userId);
    }
  }

  /**
   * Checks whether a socket is currently in the lobby.
   */
  function isInLobby(socket) {
    const userId = socketUsers.get(socket.id);
    const entry = userId && usersById.get(userId);
    return Boolean(entry && entry.lobbySocketIds.has(socket.id));
  }

  /**
   * Returns the lobby player list from a socket's perspective.
   */
  function getSnapshot(socket) {
    const currentUserId = getUserId(socket);
    const players = Array.from(usersById.values())
      .filter((entry) => entry.id !== currentUserId && entry.matchSocketIds.size === 0)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        status: "available",
        connectedAt: entry.connectedAt,
        isYou: false,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));

    return {
      players,
      totalOnline: usersById.size,
      availableCount: players.length,
      opponentCount: players.length,
      updatedAt: Date.now(),
    };
  }

  return {
    connect,
    getAvailableOpponent,
    getAvailablePlayerById,
    getSnapshot,
    getUserForSocket,
    isInLobby,
    joinLobby,
    leaveLobby,
    markAvailable,
    markInMatch,
    removeSocket,
  };
}

module.exports = createPresenceService;
