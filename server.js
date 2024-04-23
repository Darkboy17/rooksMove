const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Apply CORS middleware
app.use(cors());

const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static("public")); 

// Serve static files from the 'public' directory
app.use("/assets", express.static("assets"));

// Serve your main HTML file
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html"); 
});

let playerCount = 0; // Initialize player count
let players = {};
let currentPlayerTurn; // Add this line after the playerCount declaration

let startCount = 0; // Keeps track of how many players have clicked "Start"

// sockets for listening and emitting to the client
io.on("connection", function (socket) {
  // for server-related logs
  console.log(
    "A player has connected. Waiting for the player to start the game... "
  );

  // A socket to broadast moving of rook to both clients
  socket.on("rookMoved", (position) => {
    // Check if it's the current player's turn
    console.log("rookMOved event entered!!!");

    socket.broadcast.emit("opponentRookMoved", position);
    // Broadcast the rook's new position to the other player and also turn change
    console.log("Rook moved to:", position);
  });

  // Listen for the 'startGame' event
  socket.on("startGame", () => {
    // Assign a player identifier when a player connects
    let playerId = Object.keys(players).length === 0 ? "Player1" : "Player2";

    players[socket.id] = playerId;

    currentPlayerTurn = "Player1";

    console.log(`${playerId} connected. Socket ID: ${socket.id}`);

    startCount++;

    // Check if two players are ready to start
    if (startCount >= 2) {
      // Emit an event to all clients to start the game
      io.emit("startMyGame");

      // Reset the start count for the next game
      startCount = 0;
      console.log(`Game has started!!!`);

      setTimeout(() => {
        broadcastCurrentTurn();
      }, 1000); // Adjust delay as needed

      // Emit the players object to all connected clients
      setTimeout(() => {
        io.emit("playersUpdated", players);
      }, 1000);
    }
  });

  // listen for complete player move
  socket.on("playerMoveCompleted", (data) => {
    /* for debugging purpose 
    console.log("Before switching turns on the server :", currentPlayerTurn);
    console.log(
      "checking socket id in server: ",
      data.playerSocketId === getCurrentPlayerSocketId(currentPlayerTurn)
    );*/

    if (data.playerSocketId === getCurrentPlayerSocketId(currentPlayerTurn)) {
      switchTurn();

      /* for debugging purpose
      // console.log("After switching turns on the server :", currentPlayerTurn);*/

      // Broadcast the updated turn information to all clients
      setTimeout(() => {
        broadcastCurrentTurn();
      }, 1000); // Adjust delay as needed

      // for debugging purpose
      /*console.log(
        "Current Player socket ID: ",
        Object.keys(players).find((key) => players[key] === currentPlayerTurn)
      );*/
    }
  });

  socket.on("gameOver", (data) => {
    /* for debugging purpose
    //console.log(data.message);*/

    // Broadcast the game over message to all clients
    io.emit("displayGameOverMessage", {
      message: "Game Over, Move not completed on time.",
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // for server-related logs
    console.log(`Player ${socket.id} disconnected.`);

    // Reset all relevant data structures and states
    players = {}; // Reset the players object
    playerCount = 0; // Reset the player count
    startCount = 0; // Reset the start count
    gameState = {}; // Reset the game state

    // for server-related logs
    console.log(`Player count after disconnection: ${playerCount}`);

    // Emit an event to all remaining clients to inform them of the reset
    socket.broadcast.emit("gameStateReset", {
      message: "The game state has been reset due to a player disconnection.",
    });

    console.log("All data on the server has been reset.");
  });
});

// function to switch player turns
function switchTurn() {
  currentPlayerTurn = currentPlayerTurn === "Player1" ? "Player2" : "Player1";
}

// Function to get the current player's socket ID
function getCurrentPlayerSocketId(currentPlayerTurn) {
  return Object.keys(players).find((key) => players[key] === currentPlayerTurn);
}

// function to broadcast current turn to the client
function broadcastCurrentTurn() {
  let currentSocketID = Object.keys(players).find(
    (key) => players[key] === currentPlayerTurn
  );
  io.emit("updateTurnIndicator", {
    currentPlayerTurn,
    currentPlayerSocketId: Object.keys(players).find(
      (key) => players[key] === currentPlayerTurn
    ),
  });
  // Emit an event to all clients to show the message
  io.emit("showTurnMessage", {
    message: "Your Turn",
    currentPlayerSocketId: Object.keys(players).find(
      (key) => players[key] === currentPlayerTurn
    ),
  });
  console.log("currentSocketID", currentSocketID);
}

var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log("listening on *: " + port);
});
