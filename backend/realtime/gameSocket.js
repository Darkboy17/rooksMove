const { verifyAccessToken } = require("../utils/tokens");
const createPresenceService = require("../services/presenceService");

/**
 * Registers Socket.IO event handlers for matchmaking and gameplay.
 */
function registerGameSocket(io) {
  const matches = new Map();
  const pendingChallenges = new Map();
  const presence = createPresenceService();
  const lobbyRoom = "online-lobby";

  /**
   * Toggles the active player role for a match.
   */
  function switchTurn(match) {
    match.currentPlayerTurn =
      match.currentPlayerTurn === "Player1" ? "Player2" : "Player1";
  }

  /**
   * Returns the socket id for the player whose turn is active.
   */
  function getCurrentPlayerSocketId(match) {
    return Object.keys(match.players).find(
      (key) => match.players[key] === match.currentPlayerTurn
    );
  }

  /**
   * Returns the match associated with a socket.
   */
  function getSocketMatch(socket) {
    return socket.matchRoom ? matches.get(socket.matchRoom) : null;
  }

  /**
   * Emits an event to everyone in the socket's match room.
   */
  function emitToSocketMatch(socket, event, payload) {
    if (socket.matchRoom) {
      io.to(socket.matchRoom).emit(event, payload);
    }
  }

  /**
   * Broadcasts turn metadata to a match room.
   */
  function broadcastCurrentTurn(match) {
    if (!match) return;
    const currentPlayerSocketId = getCurrentPlayerSocketId(match);
    io.to(match.room).emit("updateTurnIndicator", {
      currentPlayerTurn: match.currentPlayerTurn,
      currentPlayerSocketId,
    });
    io.to(match.room).emit("showTurnMessage", {
      message: "Your Turn",
      currentPlayerSocketId,
    });
  }

  /**
   * Builds the shared match payload sent to both players.
   */
  function createMatchPayload(socket, opponentSocket, playerOneUser, playerTwoUser, match) {
    const playerNamesByRole = {
      Player1: playerOneUser.name,
      Player2: playerTwoUser.name,
    };
    const playerNamesBySocketId = {
      [socket.id]: playerOneUser.name,
      [opponentSocket.id]: playerTwoUser.name,
    };

    return {
      matchId: match.room,
      currentPlayerTurn: match.currentPlayerTurn,
      currentPlayerSocketId: getCurrentPlayerSocketId(match),
      playerNamesByRole,
      playerNamesBySocketId,
      socketRoles: {
        [socket.id]: "Player1",
        [opponentSocket.id]: "Player2",
      },
    };
  }

  /**
   * Creates a match room and notifies both players.
   */
  function startMatch(challengerSocket, opponentSocket) {
    const playerOneUser = presence.getUserForSocket(challengerSocket);
    const playerTwoUser = presence.getUserForSocket(opponentSocket);

    if (!playerOneUser || !playerTwoUser) return null;

    const room = `match:${challengerSocket.id}:${opponentSocket.id}`;
    const match = {
      room,
      players: {
        [challengerSocket.id]: "Player1",
        [opponentSocket.id]: "Player2",
      },
      currentPlayerTurn: "Player1",
    };

    matches.set(room, match);
    presence.markInMatch(challengerSocket);
    presence.markInMatch(opponentSocket);
    challengerSocket.leave(lobbyRoom);
    opponentSocket.leave(lobbyRoom);
    challengerSocket.join(room);
    opponentSocket.join(room);
    challengerSocket.matchRoom = room;
    opponentSocket.matchRoom = room;

    const payload = createMatchPayload(
      challengerSocket,
      opponentSocket,
      playerOneUser,
      playerTwoUser,
      match
    );

    challengerSocket.emit("matchmaking:matched", {
      ...payload,
      playerRole: "Player1",
    });
    opponentSocket.emit("matchmaking:matched", {
      ...payload,
      playerRole: "Player2",
    });
    io.to(room).emit("playersUpdated", payload);
    setTimeout(() => broadcastCurrentTurn(match), 500);
    broadcastLobbySnapshot();

    return match;
  }

  /**
   * Finds the opposing socket in a match.
   */
  function getMatchOpponent(socket, match) {
    if (!match) return null;

    const opponentSocketId = Object.keys(match.players).find(
      (socketId) => socketId !== socket.id
    );

    return opponentSocketId ? io.sockets.sockets.get(opponentSocketId) : null;
  }

  /**
   * Builds a match payload customized for one socket.
   */
  function getMatchPayloadForSocket(socket, match) {
    if (!match) return null;

    const socketIds = Object.keys(match.players);
    const playerOneSocket = io.sockets.sockets.get(
      socketIds.find((socketId) => match.players[socketId] === "Player1")
    );
    const playerTwoSocket = io.sockets.sockets.get(
      socketIds.find((socketId) => match.players[socketId] === "Player2")
    );
    const playerOneUser = presence.getUserForSocket(playerOneSocket);
    const playerTwoUser = presence.getUserForSocket(playerTwoSocket);

    if (!playerOneSocket || !playerTwoSocket || !playerOneUser || !playerTwoUser) {
      return null;
    }

    return {
      ...createMatchPayload(playerOneSocket, playerTwoSocket, playerOneUser, playerTwoUser, match),
      playerRole: match.players[socket.id],
    };
  }

  /**
   * Removes a socket from its current match room.
   */
  function leaveMatch(socket) {
    if (!socket.matchRoom) return;
    const room = socket.matchRoom;
    socket.leave(room);
    socket.matchRoom = null;

    const roomSockets = io.sockets.adapter.rooms.get(room);
    if (!roomSockets || roomSockets.size === 0) {
      matches.delete(room);
    }
  }

  /**
   * Leaves a match and returns the socket to available presence.
   */
  function leaveMatchAndBecomeAvailable(socket) {
    leaveMatch(socket);
    presence.markAvailable(socket);
    broadcastLobbySnapshot();
  }

  /**
   * Sends fresh lobby data to every socket in the lobby room.
   */
  function broadcastLobbySnapshot() {
    const lobbySockets = io.sockets.adapter.rooms.get(lobbyRoom) || new Set();

    lobbySockets.forEach((socketId) => {
      const lobbySocket = io.sockets.sockets.get(socketId);
      if (lobbySocket) {
        lobbySocket.emit("lobby:players", presence.getSnapshot(lobbySocket));
      }
    });
  }

  /**
   * Normalizes a board move payload before broadcasting it to opponents.
   */
  function normalizeMovePayload(position) {
    const col = Number(position && position.col);
    const row = Number(position && position.row);

    if (
      Number.isInteger(col) &&
      Number.isInteger(row) &&
      col >= 1 &&
      col <= 8 &&
      row >= 1 &&
      row <= 8
    ) {
      return { col, row };
    }

    return null;
  }

  io.use((socket, next) => {
    const user = verifyAccessToken(socket.handshake.auth && socket.handshake.auth.token);
    if (!user) return next(new Error("Authentication required."));
    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    presence.connect(socket);
    console.log(`${socket.user.email} connected. Waiting for the player to start the game.`);
    broadcastLobbySnapshot();

    socket.on("presence:available", () => {
      leaveMatchAndBecomeAvailable(socket);
    });

    socket.on("lobby:join", () => {
      presence.joinLobby(socket);
      socket.join(lobbyRoom);
      socket.emit("lobby:players", presence.getSnapshot(socket));
      broadcastLobbySnapshot();
    });

    socket.on("lobby:leave", () => {
      presence.leaveLobby(socket);
      socket.leave(lobbyRoom);
      broadcastLobbySnapshot();
    });

    socket.on("lobby:requestPlayers", () => {
      socket.emit("lobby:players", presence.getSnapshot(socket));
    });

    socket.on("challenge:request", ({ playerId } = {}) => {
      const opponent = presence.getAvailablePlayerById(socket, playerId);
      const challenger = presence.getUserForSocket(socket);

      if (!opponent || !challenger) {
        socket.emit("challenge:declined", {
          message: "That player is no longer available.",
        });
        broadcastLobbySnapshot();
        return;
      }

      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (!opponentSocket) {
        socket.emit("challenge:declined", {
          message: "That player is no longer available.",
        });
        broadcastLobbySnapshot();
        return;
      }

      const challengeId = `${socket.id}:${opponentSocket.id}:${Date.now()}`;
      pendingChallenges.set(challengeId, {
        id: challengeId,
        challengerSocketId: socket.id,
        opponentSocketId: opponentSocket.id,
      });

      socket.emit("challenge:pending", {
        challengeId,
        opponent,
        message: `Waiting for ${opponent.name} to confirm.`,
      });
      opponentSocket.emit("challenge:received", {
        challengeId,
        challenger,
        message: `${challenger.name} wants to play against you.`,
      });
    });

    socket.on("challenge:accept", ({ challengeId } = {}) => {
      const challenge = pendingChallenges.get(challengeId);
      if (!challenge || challenge.opponentSocketId !== socket.id) return;

      pendingChallenges.delete(challengeId);
      const challengerSocket = io.sockets.sockets.get(challenge.challengerSocketId);
      if (!challengerSocket) {
        socket.emit("challenge:declined", {
          message: "The challenger is no longer available.",
        });
        broadcastLobbySnapshot();
        return;
      }

      startMatch(challengerSocket, socket);
    });

    socket.on("challenge:decline", ({ challengeId } = {}) => {
      const challenge = pendingChallenges.get(challengeId);
      if (!challenge || challenge.opponentSocketId !== socket.id) return;

      pendingChallenges.delete(challengeId);
      const challengerSocket = io.sockets.sockets.get(challenge.challengerSocketId);
      const opponent = presence.getUserForSocket(socket);
      if (challengerSocket) {
        challengerSocket.emit("challenge:declined", {
          challengeId,
          message: `${opponent ? opponent.name : "The player"} declined your request.`,
        });
      }
    });

    socket.on("rookMoved", (position) => {
      const move = normalizeMovePayload(position);
      if (!move) return;

      if (socket.matchRoom) {
        socket.to(socket.matchRoom).emit("opponentRookMoved", move);
        return;
      }

      socket.broadcast.emit("opponentRookMoved", move);
    });

    socket.on("playerMoveCompleted", (data) => {
      const match = getSocketMatch(socket);
      if (match && data.playerSocketId === getCurrentPlayerSocketId(match)) {
        switchTurn(match);
        setTimeout(() => broadcastCurrentTurn(match), 1000);
      }
    });

    socket.on("gameOver", (data = {}) => {
      emitToSocketMatch(socket, "displayGameOverMessage", {
        message: data.message || "Game Over, Move not completed on time.",
      });
    });

    socket.on("gameWon", (data = {}) => {
      const winnerSocketId = data.winnerSocketId || socket.id;
      const winnerName =
        (presence.getUserForSocket(io.sockets.sockets.get(winnerSocketId)) || {})
          .name || "Opponent";

      setTimeout(() => {
        emitToSocketMatch(socket, "displayGameWonMessage", {
          winnerSocketId,
          winnerName,
        });
      }, 550);
    });

    socket.on("rematch:request", () => {
      const match = getSocketMatch(socket);
      const opponentSocket = getMatchOpponent(socket, match);
      const requester = presence.getUserForSocket(socket);

      if (!match || !opponentSocket || !requester) {
        socket.emit("rematch:declined", {
          message: "Rematch is no longer available.",
        });
        return;
      }
      const opponent = presence.getUserForSocket(opponentSocket);

      socket.emit("rematch:pending", {
        message: `Waiting for ${(opponent && opponent.name) || "opponent"} to accept rematch.`,
      });
      opponentSocket.emit("rematch:received", {
        requesterRole: match.players[socket.id],
        requesterName: requester.name,
        message: `${requester.name} wants a rematch.`,
      });
    });

    socket.on("rematch:accept", () => {
      const match = getSocketMatch(socket);
      const opponentSocket = getMatchOpponent(socket, match);
      if (!match || !opponentSocket) return;

      match.currentPlayerTurn = "Player1";
      [socket, opponentSocket].forEach((matchSocket) => {
        const payload = getMatchPayloadForSocket(matchSocket, match);
        if (payload) {
          matchSocket.emit("matchmaking:matched", payload);
        }
      });
      setTimeout(() => broadcastCurrentTurn(match), 500);
    });

    socket.on("rematch:decline", () => {
      const match = getSocketMatch(socket);
      if (!match) return;

      io.to(match.room).emit("rematch:declined", {
        message: "Rematch declined. Returning to main menu.",
      });
      matches.delete(match.room);
    });

    socket.on("match:leave", () => {
      const match = getSocketMatch(socket);
      const opponentSocket = getMatchOpponent(socket, match);
      const leaverRole = match && match.players[socket.id];
      const leaverName = (presence.getUserForSocket(socket) || {}).name || leaverRole || "Opponent";

      if (match && opponentSocket) {
        opponentSocket.emit("match:opponentLeft", {
          message: `${leaverRole || leaverName} left the game.`,
          playerRole: leaverRole,
          playerName: leaverName,
        });
      }

      leaveMatchAndBecomeAvailable(socket);
      if (match && (!io.sockets.adapter.rooms.get(match.room) || io.sockets.adapter.rooms.get(match.room).size === 0)) {
        matches.delete(match.room);
      }
    });

    socket.on("disconnect", () => {
      const wasInGame = Boolean(socket.matchRoom);
      const disconnectedRoom = socket.matchRoom;
      pendingChallenges.forEach((challenge, challengeId) => {
        if (
          challenge.challengerSocketId !== socket.id &&
          challenge.opponentSocketId !== socket.id
        ) {
          return;
        }

        pendingChallenges.delete(challengeId);
        const otherSocketId =
          challenge.challengerSocketId === socket.id
            ? challenge.opponentSocketId
            : challenge.challengerSocketId;
        const otherSocket = io.sockets.sockets.get(otherSocketId);
        if (otherSocket) {
          otherSocket.emit("challenge:declined", {
            challengeId,
            message: "The player is no longer available.",
          });
        }
      });
      presence.removeSocket(socket);
      broadcastLobbySnapshot();

      console.log(`Player ${socket.id} disconnected.`);

      if (!wasInGame) return;

      matches.delete(disconnectedRoom);
      socket.to(disconnectedRoom).emit("gameStateReset", {
        message: "The game state has been reset due to a player disconnection.",
      });
    });
  });
}

module.exports = registerGameSocket;
