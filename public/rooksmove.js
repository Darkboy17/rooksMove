import socket from "./socketManager";

class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: "StartScene" });
    this.isConnected = false; // Flag to track connection status
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.startLogo;
    this.message;
    this.socket = socket;
  }

  // load the game assets for the starting scene
  preload() {
    this.load.image("start", "assets/start.png");
  }

  create() {
    // display the "Start" logo
    this.showStartLogo();

    // for displaying an error to the opposite client of a disconnection made by client one

    const errorMessage = this.registry.get("displayErrorMessage");
    if (errorMessage) this.displayInfoMessagesfromServer(errorMessage.message);

    // add a click event listener to the logo
    this.startLogo.on("pointerdown", () => {
      //console.log("Start button clicked");

      // for displaying a connection initiation message
      if (!this.isConnected) {
        const message = "Connecting and finding players...";
        this.showConnectionMessage(message, true);
      }
      // Connect to the server
      this.connectToServer();
      socket.emit("gameStarted");
    });
  }

  // for loading start logo
  showStartLogo() {
    this.startLogo = this.add.image(this.width / 2, this.height / 2, "start");
    this.startLogo.setInteractive(); // Make the logo interactive
  }

  // for connecting to the server
  connectToServer() {
    if (!this.isConnected) {
      this.isConnected = true;

      // Emit the 'startGame' event to the server immediately after clicking the start button
      socket.emit("startGame");

      // Listen for the 'startMyGame' event from the server

      socket.on("startMyGame", (data) => {
        //console.log("Starting MyGame scene...");
        this.isConnected = false; // Reset the flag
        // Start the MyGame scene
        //this.scene.stop("StartScene");
        this.scene.stop("StartScene");
        this.scene.start("MyGame");
      });
    }
  }

  // for displaying informative messages to the clients based on what the other client is doing
  displayInfoMessagesfromServer(message) {
    // Create a text object for the error message
    const errorText = this.add.text(
      this.width / 6,
      this.height / 2 + 70,
      message,
      {
        fontSize: "20px",
        fill: "#ff0000",
        wordWrap: { width: 300 },
      }
    );

    errorText.setOrigin(0.5);
    errorText.x = this.cameras.main.centerX;
    // Add a bouncy effect using a tween
    this.tweens.add({
      targets: errorText,
      y: "+=3", // Move the text object 3 pixels up
      duration: 100, // Duration of the movement in milliseconds
      ease: "Bounce", // Use the 'Bounce' easing function for a bouncy effect
      yoyo: true, // Repeat the tween in reverse, making the text bounce back down
      repeat: 5, // Number of times to repeat the bounce
      onComplete: () => {
        // After the bounce effect, wait for 5 seconds and then fade out
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: errorText,
            alpha: { from: 1, to: 0 },
            duration: 2000, // Duration of the fade-out effect in milliseconds
            ease: "Power2", // Easing function for the animation
            onComplete: () => {
              errorText.destroy(); // Destroy the text object after fade-out
            },
          });
        });
      },
    });
  }

  // for displaying a message to the user while connection is being established
  showConnectionMessage(message, enabled) {
    // Create the popup message
    this.connectionMessage = this.add.text(
      this.width / 2,
      this.height / 2 + 50,
      message,
      { fill: "#fff" }
    );
    this.connectionMessage.setOrigin(0.5);
    this.connectionMessage.setVisible(false);

    // Function to handle the fade-in and fade-out animations
    const fadeInOut = (target, duration, ease, delay) => {
      // Fade-in animation
      this.tweens.add({
        targets: target,
        alpha: { from: 0, to: 1 }, // Change alpha from 0 to 1
        duration: duration, // Duration of the animation in milliseconds
        ease: ease, // Easing function for smooth animation
        onComplete: () => {
          // Fade-out animation
          this.tweens.add({
            targets: target,
            alpha: { from: 1, to: 0 }, // Change alpha from 1 to 0
            duration: duration, // Duration of the animation in milliseconds
            ease: ease, // Easing function for smooth animation
            onComplete: () => {
              // Recursively call the function to start the next cycle of fade-in and fade-out
              setTimeout(() => fadeInOut(target, duration, ease, delay), delay);
            },
          });
        },
      });
    };

    // Check if it's the first click
    if (enabled) {
      this.connectionMessage.setVisible(true); // Make the message visible immediately
      fadeInOut(this.connectionMessage, 1500, "Cubic", 100); // Start the fade-in and fade-out cycle
    }
  }
}

class MyGame extends Phaser.Scene {
  constructor() {
    super({ key: "MyGame" });
    this.socket = socket;

    // Define class properties
    this.width = 1334;
    this.height = 750;
    this.victoryMessage;
    this.gameOverMessage;
    this.currentPlayer; // Player 1 starts the game
    this.highlighters = []; // Array to store all highlighters
    this.pointerXLabel;
    this.pointerYLabel;
    this.timerDuration = 30; // Timer duration in seconds
    this.countdownValue = this.timerDuration; // Initial countdown value
    this.timer; // Variable to store the timer interval
    this.timerLabel; // Variable to store the timer label text object
    // Define the win position as the bottom-left corner of the board
    this.winPositionX = 1;
    this.winPositionY = 8;
    // Position based on game rule
    this.rookPositionX = 8;
    this.rookPositionY = 1;
    this.chessboard;
    this.gridSize;
    this.topRightX;
    this.topRightY;
    this.rook = null;
    this.currentPlayerSocketId;
    this.isCurrentPlayersTurn = true; // Flag to indicate if it's the current player's turn
    this.messageShownForPlayer = false;
    this.playerSocketIds;
    this.gameStateWon = false;
    this.gameStateOver = false;
    this.count = 0;
  }

  initDefault() {
    this.highlighters = [];
    this.timerDuration = 30;
    this.countdownValue = this.timerDuration;
    this.timerLabel = null;
    this.winPositionX = 1;
    this.winPositionY = 8;
    this.rookPositionX = 8;
    this.rookPositionY = 1;
    this.chessboard;
    this.gridSize = null;
    this.topRightX = null;
    this.topRightY = null;
    this.rook = null;
    this.currentPlayerSocketId = null;
    this.isCurrentPlayersTurn = true;
    this.playerSocketIds = null;
    this.gameStateWon = false;
    this.gameStateOver = false;
    this.messageShownForPlayer = false;
  }

  preload() {
    // Load assets
    this.load.image("chessboard", "assets/chessboard.png");
    this.load.image("grid", "assets/grid.png");
    this.load.image("rook", "assets/rook.png");
    this.load.image("player1avatar", "assets/player_1_avatar.png");
    this.load.image("player2avatar", "assets/player_2_avatar.png");
  }

  create() {
    // for debugging purpose
    // this.createRealtimePointer();

    // load the chessboard
    this.createChessboard();

    // load the listening sockets to communicate with the server
    this.listeniningServerSockets();

    // load the countdown timer
    this.createTimerLabel();

    // load the player avatar for visual represntation
    this.createPlayerAvatars();

    // load the rook
    this.createRook();

    // load the highlighters
    this.createHighlightEffect(
      this,
      this.chessboard,
      this.gridSize,
      7,
      this.rookPositionX,
      this.rookPositionY,
      true
    );

    // load the listeners for listenining on the client-side
    this.chessboard.on("pointerdown", () => {
      if (this.currentPlayerSocketId !== this.socket.id)
        this.displayMessage(this, "It's not your turn Yet!", 500, 2000);
    });
  }

  createPlayerAvatars() {
    const player1 = this.add.image(
      this.width / 6,
      this.height - 150,
      "player1avatar"
    );
    const player2 = this.add.image(
      this.width / 6,
      this.height / 6,
      "player2avatar"
    );
  }

  createRealtimePointer() {
    // Call createPointerLabels function to create labels in the scene
    this.createPointerLabels(this);

    // Add pointermove event listener to update labels when pointer moves
    this.input.on("pointermove", (pointer) => {
      this.updatePointerLabels(pointer);
    });
  }

  // for the workings of the countdown timer
  startTimer() {
    // Stop the current timer if it exists
    if (this.timer) {
      clearInterval(this.timer); // Clear the existing timer
    }

    // Start the timer
    let timerValue = this.timerDuration;

    // Ensure the timerLabel is initialized and the scene is active
    if (this.timerLabel && this.scene.isActive()) {
      // Reset the timer label
      this.timerLabel.setText(timerValue); // Assuming a 30-second timer
      this.timerLabel.setVisible(true); // Make the timer label visible

      // Use setInterval to decrement the timer value every second
      this.timer = setInterval(() => {
        timerValue--;

        // Ensure the timerLabel is still initialized and the scene is active
        if (this.timerLabel && this.scene.isActive()) {
          this.timerLabel.setText(timerValue.toString());

          // Check if the timer has reached 0
          if (timerValue <= 0) {
            // Emit a 'gameOver' event to the server, including the message
            socket.emit("gameOver", { message: "Time's up! Game over." });

            // Handle the end of the timer
            //console.log("Time's up! Game over.");

            // Handle the game over logic here
            this.stopAndResetTimer();
            timerValue = this.timerDuration;
          }
        }
      }, 1000); // 1000 milliseconds = 1 second
    }
  }

  // for stopping and resetting the countdown timer
  stopAndResetTimer() {
    // Stop the current timer if it exists
    if (this.timer) {
      clearInterval(this.timer); // Clear the existing timer
      this.timer = null; // Reset the timer variable
    }

    // Reset the timer label
    if (this.timerLabel) {
      this.timerLabel.setText("0"); // Reset the timer label text
      this.timerLabel.setVisible(false);
    }
  }

  // for displaying the countdown
  createTimerLabel() {
    // Initialize timerLabel
    this.timerLabel = this.add.text(
      this.width / 6, // X position (centered horizontally)
      this.height - 100, // Y position (centered vertically)
      "", // Initial text (empty string)
      {
        fontFamily: "Arial",
        fontSize: 24,
        color: "#ffffff",
        fontWeight: "bold",
      } // Text style
    );
    this.timerLabel.setOrigin(0.5); // Set origin to center
  }

  // for displaying the chessboard
  createChessboard() {
    // Create chessboard background
    this.chessboard = this.add.image(
      this.width / 6,
      this.height / 2,
      "chessboard"
    );

    this.chessboard.setInteractive();

    this.chessboard.on("pointerdown", () => {
      //console.log("CLient's ID from client:", this.socket.id);
    });
  }

  // for listenining to all necessary events emitted from the server
  listeniningServerSockets() {
    // for welcome message purposes
    let messageShownForPlayer = false;

    // Listen for the 'opponentRookMoved' event from the server
    socket.on("opponentRookMoved", (newPosition) => {
      if (!newPosition) {
        console.log("newPosition is : ", newPosition);
        return;
      }

      //console.log("Opponent moved rook to:", newPosition);

      this.moveRookToGrid(
        this,
        this.rook,
        newPosition.x,
        newPosition.y,
        this.chessboard,
        this.gridSize,
        this.rookPositionX,
        this.rookPositionY,
        this.socket,
        true // Indicate this is a server-initiated move
      );
    });

    // Listen for the 'gameStateReset' event from the server
    socket.on("gameStateReset", (message) => {
      //console.log(message);

      // Emit a custom event with the message to be passed to the Scene Class.
      this.registry.set("displayErrorMessage", message);
      this.resetGame();
    });

    socket.on("gameStateRestart", (message) => {
      this.scene.stop("MyGame");
      this.scene.start("StartScene");
      console.log("Game Restart Data:", message);
      this.registry.set("displayGameRestartMessage", message);
      // Emit a custom event with the message to be passed to the Scene Class.
      // this.registry.set("displayErrorMessage", message);
    });

    // for checking whose turn it is
    socket.on("updateTurnIndicator", (data) => {
      this.currentPlayerSocketId = data.currentPlayerSocketId;

      if (this.currentPlayerSocketId === this.socket.id && !this.gameStateWon)
        this.startTimer();
      else {
        this.stopAndResetTimer();
      }

      if (
        this.currentPlayerSocketId === this.socket.id &&
        !messageShownForPlayer
      ) {
        this.displayWelcomeMessage(this, "Please start first!", 500, 2000);
        this.count++;
      }
      messageShownForPlayer = true;

      //console.log(data.currentPlayerSocketId === this.socket.id);

      if (data.currentPlayerSocketId !== this.socket.id) {
        //console.log("It's not your turn yet!");

        // Hide and delete all existing highlighters
        this.highlighters.forEach((highlighter) => {
          highlighter.setVisible(false);
        });
        return;
      } else {
        // console.log("It's your turn!");

        this.handleHighlighterClick(
          this,
          this.rook,
          this.chessboard,
          this.gridSize,
          this.highlighters,
          this.currentPlayerSocketId
        );
      }
    });

    // for showing whose turn it is
    socket.on("showTurnMessage", (data) => {
      //console.log("Turn Message: ", data);

      if (this.gameStateWon) return;

      if (data.currentPlayerSocketId === this.socket.id && this.count === 0)
        this.displayMessage(this, data.message, 500, 2000);
      else this.count = 0;
    });

    // for getting the players from the server
    socket.on("playersUpdated", (players) => {
      // Update the playerSocketIds object with the received players object
      this.playerSocketIds = players;

      // Log the updated playerSocketIds object to verify
      //console.log("Updated playerSocketIds:", this.playerSocketIds);
    });

    // for displaying a game over message
    socket.on("displayGameOverMessage", (data) => {
      this.gameOver();
    });
  }

  // for creating the rook
  createRook() {
    // Calculate the size of the grid square (assuming an 8x8 grid)
    this.gridSize = Math.min(this.chessboard.width, this.chessboard.height) / 8;

    //console.log("Grid size: ", this.gridSize);

    // Calculate the position of the top-right grid square
    this.topRightX =
      this.chessboard.x +
      this.rookPositionX * (this.gridSize - 5) -
      this.chessboard.width / 2;

    this.topRightY =
      this.chessboard.y +
      (this.rookPositionY + 3) * (this.gridSize - 5.5) -
      this.chessboard.height / 2 +
      this.gridSize / 2;

    // Adjust the position to center the rook on the grid square
    this.rook = this.add.image(
      this.topRightX, // Adjusted X position to center the rook
      this.topRightY, // Adjusted Y position to center the rook
      "rook"
    );

    // Set the origin to the center of the image if needed
    this.rook.setOrigin(0.5, 0.5);

    // Calculate the scale factor to fit the rook inside the grid
    const scaleFactor =
      (this.gridSize - 15) / Math.max(this.rook.width, this.rook.height);

    // Apply the scale factor to the rook
    this.rook.setScale(scaleFactor);
  }

  // for displaying important messages
  displayMessage(
    scene,
    message,
    inRate,
    outRate,
    size = 24,
    stayDuration = 500
  ) {
    // Create the text object
    const turnMessage = scene.add.text(
      this.width / 6, // X position (center of the screen)
      this.height, // Y position (bottom of the screen)
      message, // Message text
      { fontFamily: "Arial", fontSize: size, color: "#ffffff" } // Text style
    );

    // Set the origin to the center of the text for proper positioning
    turnMessage.setOrigin(0.5);

    // Initially set the text to be invisible
    turnMessage.setAlpha(0);

    // Add a tween to fade in the text from the bottom
    scene.tweens.add({
      targets: turnMessage,
      y: scene.cameras.main.centerY, // Move the text to the center of the screen
      alpha: 1, // Fade in the text
      duration: inRate, // Duration of the fade-in animation in milliseconds
      ease: "Power2", // Easing function for smooth animation
      onComplete: () => {
        // After the fade-in, wait for the specified stay duration before starting the fade-out
        scene.time.delayedCall(stayDuration, () => {
          // Add a tween to fade out the text to the top
          scene.tweens.add({
            targets: turnMessage,
            y: 0, // Move the text to the top of the screen
            alpha: 0, // Fade out the text
            duration: outRate, // Duration of the fade-out animation in milliseconds
            ease: "Power2", // Easing function for smooth animation
            onComplete: () => {
              // After the fade-out, destroy the text object
              turnMessage.destroy();
            },
          });
        });
      },
    });
  }

  // just for a welcome message
  displayWelcomeMessage(scene, message, inRate, outRate, stayDuration = 500) {
    // Create the text object
    if (this.messageShownForPlayer) return;
    const turnMessage = scene.add.text(
      this.width / 6,
      scene.height,
      message, // Message text
      { fontFamily: "Arial", fontSize: 24, color: "#ffffff" }
    );

    // Set the origin to the center of the text for proper positioning
    turnMessage.setOrigin(0.5);

    // Initially set the text to be invisible
    turnMessage.setAlpha(0);

    // Add a tween to fade in the text from the bottom
    scene.tweens.add({
      targets: turnMessage,
      y: scene.cameras.main.centerY, // Move the text to the center of the screen
      alpha: 1, // Fade in the text
      duration: inRate, // Duration of the fade-in animation in milliseconds
      ease: "Power2", // Easing function for smooth animation
      onComplete: () => {
        // After the fade-in, wait for the specified stay duration before starting the fade-out
        scene.time.delayedCall(stayDuration, () => {
          // Add a tween to fade out the text to the top
          scene.tweens.add({
            targets: turnMessage,
            y: 0, // Move the text to the top of the screen
            alpha: 0, // Fade out the text
            duration: outRate, // Duration of the fade-out animation in milliseconds
            ease: "Power2", // Easing function for smooth animation
            onComplete: () => {
              // After the fade-out, destroy the text object
              turnMessage.destroy();
            },
          });
        });
      },
    });
    this.messageShownForPlayer = true;
  }

  // for using during a game over state
  gameOver(message = "Time's up! Game over.") {
    this.gameOverMessage = this.add.text(
      this.width / 6, // X position (center of the screen)
      this.height / 2, // Y position (center of the screen)
      message, // Message text
      { fontFamily: "Arial", fontSize: 24, color: "#ffffff" } // Text style
    );

    if (this.gameOverMessage) {
      this.gameOverMessage.setOrigin(0.5); // Set origin to center align
      this.gameOverMessage.setVisible(true); // Initially hide the victory message
      this.disableGameElements();
    }
    this.scene.pause("MyGame");
  }

  // Function to reverse the key-value pairs
  reverseObject(obj) {
    const reversedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        reversedObj[obj[key]] = key;
      }
    }
    return reversedObj;
  }
  // for disabling game objects
  disableGameElements() {
    // Disable interaction for the chessboard
    if (this.chessboard && this.chessboard.disableInteractive) {
      this.chessboard.disableInteractive();
    }

    // Clear all existing highlighters
    this.highlighters.forEach((highlighter) => {
      //highlighter.setVisible(false); // Hide the highlighter
      highlighter.graphics.destroy(); // Destroy the graphics object of the highlighter
    });
    this.highlighters = []; // Reset the highlighters array

    // Hide or disable the rook
    if (this.rook) {
      // If the rook is interactive, disable its interaction
      if (this.rook.disableInteractive) {
        this.rook.disableInteractive();
      }
      // Hide the rook
      this.rook.setVisible(false);
    }
  }

  // for displaying who won and lost
  gameWon(currentPlayerSocketID) {
    const winningPlayerName = this.getPlayerNameBySocketId(
      currentPlayerSocketID
    );

    if (this.currentPlayerSocketId !== this.socket.id) {
      this.victoryMessage = this.add.text(
        this.width / 6, // X position (center of the screen)
        this.height / 2, // Y position (center of the screen)
        winningPlayerName + " wins! You lose!", // Message text
        { fontFamily: "Arial", fontSize: 24, color: "#ffffff" } // Text style
      );
    }
    if (this.currentPlayerSocketId === this.socket.id) {
      this.victoryMessage = this.add.text(
        this.width / 6, // X position (center of the screen)
        this.height / 2, // Y position (center of the screen)
        "You Won!", // Message text
        { fontFamily: "Arial", fontSize: 24, color: "#ffffff" } // Text style
      );
    }

    // Check if this.victoryMessage is defined before setting its visibility
    if (this.victoryMessage) {
      this.victoryMessage.setVisible(true);
      this.victoryMessage.setOrigin(0.5); // Set origin to center align
    }
    this.displayRefreshMessage("Refresh the page to replay the game.");
  }

  displayRefreshMessage(message) {
    // Create a text object for the error message
    const refreshText = this.add.text(this.width / 6, 70, message, {
      fontSize: "20px",
      fill: "#ffff00",
      wordWrap: { width: 300 },
    });

    refreshText.setOrigin(0.5);
    // Add a bouncy effect using a tween
    this.tweens.add({
      targets: refreshText,
      y: "+=3", // Move the text object 3 pixels up
      duration: 100, // Duration of the movement in milliseconds
      ease: "Bounce", // Use the 'Bounce' easing function for a bouncy effect
      yoyo: true, // Repeat the tween in reverse, making the text bounce back down
      repeat: 5, // Number of times to repeat the bounce
      onComplete: () => {
        // After the bounce effect, wait for 5 seconds and then fade out
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: refreshText,
            alpha: { from: 1, to: 0 },
            duration: 2000, // Duration of the fade-out effect in milliseconds
            ease: "Power2", // Easing function for the animation
            onComplete: () => {
              refreshText.destroy(); // Destroy the text object after fade-out
            },
          });
        });
      },
    });
  }

  // for getting player name based on socket ID
  getPlayerNameBySocketId(socketId) {
    // Reverse the key-value pairs
    const playerOjb = this.reverseObject(this.playerSocketIds);
    // Iterate over the keys (player names) in the playerSocketIds object
    for (const playerName in playerOjb) {
      // Check if the current key's value (socket ID) matches the given socket ID
      if (playerOjb[playerName] === socketId) {
        // If a match is found, return the corresponding player name
        return playerName;
      }
    }
    // If no match is found, return a default value or handle the case as needed
    return "Unknown Player";
  }

  // for resetting the game
  resetGame() {
    // console.log("Game resetted");

    // Reset the timer
    this.countdownValue = this.timerDuration; // Reset the countdown value

    // Hide any visible messages
    if (this.victoryMessage) {
      this.victoryMessage.setVisible(false);
    }
    if (this.gameOverMessage) {
      this.gameOverMessage.setVisible(false);
    }

    // Reset the rook's position
    // Assuming the initial position is at the top-right of the chessboard
    const gridSize =
      Math.min(this.chessboard.width, this.chessboard.height) / 8;
    const topRightX =
      this.chessboard.x +
      this.rookPositionX * (gridSize - 5) -
      this.chessboard.width / 2;
    const topRightY =
      this.chessboard.y +
      (this.rookPositionY + 3) * (gridSize - 5.5) -
      this.chessboard.height / 2 +
      gridSize / 2;
    this.rook.setPosition(topRightX, topRightY);
    this.rookPositionX = 8;
    this.rookPositionY = 1;

    // Clear all existing highlighters
    this.highlighters.forEach((highlighter) => {
      highlighter.setVisible(false);
      highlighter.graphics.destroy();
    });
    this.highlighters = []; // Reset the highlighters array

    // Reset game state
    this.initDefault();
    this.scene.stop("StartScene");
    this.scene.start("StartScene");
  }

  // Function to check for win condition
  checkWinCondition(rookPositionX, rookPositionY) {
    return (
      rookPositionX === this.winPositionX && rookPositionY === this.winPositionY
    );
  }

  // to create labels to display pointer coordinates
  createPointerLabels(scene) {
    // Add text labels for pointer coordinates
    this.pointerXLabel = scene.add.text(10, 10, "Pointer X: 0", {
      fill: "#ffffff",
    });
    this.pointerYLabel = scene.add.text(10, 30, "Pointer Y: 0", {
      fill: "#ffffff",
    });
  }

  // to update pointer labels with current coordinates
  updatePointerLabels(pointer) {
    this.pointerXLabel.setText("Pointer X: " + pointer.x);
    this.pointerYLabel.setText("Pointer Y: " + pointer.y);
  }

  // to get the current clicked highlighter
  getClickedHighlighter(scene, highlighters, gridSize, callback) {
    // Add a pointerdown event listener to the scene
    scene.input.on("pointerdown", function (pointer) {
      // Get the x and y coordinates of the pointer when clicked
      const clickX = pointer.x;
      const clickY = pointer.y;

      //console.log("highlighters:", highlighters);
      //console.log("clickX, clickY:", clickX, clickY);

      // Iterate over each highlighter to check if the click coordinates are within its bounds
      for (let i = 0; i < highlighters.length; i++) {
        const highlighter = highlighters[i];

        // Get the position and dimensions of the highlighter
        const highlighterX = highlighter.centerX;
        const highlighterY = highlighter.centerY;
        const highlighterWidth = highlighter.width;
        const highlighterHeight = highlighter.height;

        // Check if the click coordinates are within the bounds of the highlighter
        if (
          clickX >= highlighterX - gridSize / 2 &&
          clickX <= highlighterX + gridSize / 4 &&
          clickY >= highlighterY - gridSize / 2 &&
          clickY <= highlighterY + gridSize / 4
        ) {
          // Highlighter clicked, return it

          //console.log("Clicked highlighter:", highlighter);

          // Highlighter clicked, call the callback function with its coordinates
          callback({
            x: highlighterX,
            y: highlighterY,
          });
          return; // Exit the loop since we found the clicked highlighter
        }
      }

      // No highlighter clicked
      //console.log("No highlighter clicked");

      return null;
    });
  }

  // what should be done with the clicked highlighter?
  handleHighlighterClick(
    scene,
    rook,
    chessboard,
    gridSize,
    highlighters,
    socket,
    currentPlayerSocketId
  ) {
    // Call getClickedHighlighter with a callback function
    this.getClickedHighlighter(scene, highlighters, gridSize, (coordinates) => {
      // Check if it's the current player's turn and if a move has not been made yet

      if (this.socket.id !== this.currentPlayerSocketId) {
        return; // Do not proceed with the move
      }
      if (
        coordinates.x > rook.x ||
        coordinates.y < rook.y ||
        (coordinates.x > rook.x && coordinates.y < rook.y) ||
        (coordinates.x > rook.x && coordinates.y > rook.y) ||
        (coordinates.x < rook.x && coordinates.y < rook.y) ||
        (coordinates.x > rook.x && coordinates.y > rook.y)
      ) {
        this.displayMessage(
          this,
          "Moving right, up or diagonally denied.",
          500,
          2000,
          20
        );
        return; // Do not proceed with the move
      }

      // Move the rook to the clicked highlighter coordinates
      this.moveRookToGrid(
        scene,
        rook,
        coordinates.x,
        coordinates.y,
        this.chessboard,
        this.gridSize,
        this.rookPositionX,
        this.rookPositionY,
        this.socket
      );
    });
  }

  // for moving the rook to a position clicked on the grid
  moveRookToGrid(
    scene,
    rook,
    gridX,
    gridY,
    chessboard,
    gridSize,
    rookPositionX,
    rookPositionY,
    socket,
    isServerMove = false // flag to indicate server-initiated moves
  ) {
    // Calculate the actual position of the grid based on its coordinates
    const targetX = gridX;
    const targetY = gridY;

    // Calculate the new position of the rook based on the grid size
    rookPositionX =
      Math.round((gridX - chessboard.x + gridSize / 2) / gridSize) + 4;
    rookPositionY =
      Math.round((gridY - chessboard.y + gridSize / 2) / gridSize) + 4;
    //console.log("Rook Index Position: ", rookPositionX, rookPositionY);

    // Hide and delete all existing highlighters
    this.highlighters.forEach((highlighter) => {
      highlighter.setVisible(false); // Hide the highlighter
      highlighter.graphics.destroy(); // Destroy the graphics object of the highlighter
    });

    // Animate the rook's movement to the target position
    scene.tweens.add({
      targets: rook,
      x: targetX,
      y: targetY,
      duration: 500, // Animation duration in milliseconds
      ease: "Power2", // Easing function for smooth movement
      onComplete: () => {
        // Callback function to execute after the animation completes
        //console.log("Rook moved to grid (" + gridX + ", " + gridY + ")");

        // Recreate new highlighters based on the rook's updated position
        this.createHighlightEffect(
          scene,
          chessboard,
          gridSize,
          7,
          rookPositionX,
          rookPositionY,
          true
        );

        // Emit the rook's move to the server
        if (!isServerMove && socket) {
          this.rookPositionX = gridX;
          this.rookPositionY = gridY;
          socket.emit("rookMoved", {
            x: this.rookPositionX,
            y: this.rookPositionY,
          });
          socket.emit("playerMoveCompleted", {
            playerSocketId: this.socket.id,
          });
          //console.log("Emitting rookMoved event");
        }

        if (this.checkWinCondition(rookPositionX, rookPositionY)) {
          //console.log("Player wins! Victory!");
          this.gameStateWon = true;
          // Display the victory message in the game UI
          this.gameWon(this.currentPlayerSocketId);
          this.stopAndResetTimer();
          this.scene.pause("MyGame");
          return;
        }
      },
    });
  }

  // Function to create row highlight effect using Highlighter class
  createHighlightEffect(
    scene,
    chessboard,
    gridSize,
    noOfHighlighters,
    rookPositionX,
    rookPositionY,
    enabled
  ) {
    if (!enabled) return;

    // col-wise highlighters
    // Calculate the center position of the first grid square
    const centerY =
      chessboard.y +
      (rookPositionY + 3) * (gridSize - 5.5) -
      chessboard.height / 2 +
      gridSize / 2;

    for (let i = 0; i <= rookPositionX - 2; i++) {
      // Calculate the X position for each highlight
      const centerX =
        chessboard.x + (i + 1) * (gridSize - 5) - chessboard.width / 2;

      // Create a new instance of Highlighter for each row highlighter
      let colhighlighter = new Highlighter(
        scene,
        chessboard,
        gridSize,
        centerX,
        centerY
      );
      this.highlighters.push(colhighlighter);
    }

    // row-wise highlighters
    const centerX =
      chessboard.x + rookPositionX * (gridSize - 5) - chessboard.width / 2;

    for (let i = 0; i <= noOfHighlighters - rookPositionY; i++) {
      // Calculate the Y position for each highlight
      const centerY =
        chessboard.y +
        (i + rookPositionY + 4) * (gridSize - 5.5) -
        chessboard.height / 2 +
        gridSize / 2;

      // Create a new instance of Highlighter for each row highlighter
      let rowhighlighter = new Highlighter(
        scene,
        chessboard,
        gridSize,
        centerX,
        centerY
      );
      this.highlighters.push(rowhighlighter);
    }
  }
}

// a definition of how highlighters should look and function
class Highlighter {
  constructor(scene, chessboard, gridSize, centerX, centerY) {
    this.scene = scene;
    this.chessboard = chessboard;
    this.gridSize = gridSize;
    this.centerX = centerX;
    this.centerY = centerY;

    // Create a Graphics object to draw the highlighter
    this.graphics = this.scene.add.graphics();

    // Set initial properties for the highlighter
    this.size = this.gridSize - 15;
    this.speed = 0.5;
    this.minSize = this.gridSize - 20;
    this.maxSize = this.size;
    this.cornerRadius = 7;

    // Call the drawBorders method to initially draw the highlighter
    this.drawBorders();

    // Add the update method to the scene's update loop
    this.scene.events.on("update", this.update, this);

    // Add event listener to toggle visibility when chessboard is clicked
    this.chessboard.setInteractive();
    //this.chessboard.on("pointerdown", this.toggleVisibility, this);
  }

  // Method to set visibility of the highlighter
  setVisible(visible) {
    this.graphics.setVisible(visible);
  }

  // Method to draw the borders of the highlighter
  drawBorders() {
    this.graphics.clear(); // Clear previous drawings
    this.graphics.lineStyle(1, 0xd3d3d3, 1); // Set line style
    this.graphics.strokeRoundedRect(
      this.centerX - this.size / 2,
      this.centerY - this.size / 2,
      this.size,
      this.size,
      this.cornerRadius
    ); // Draw the rectangle
  }

  // Method to update the size of the highlighter
  update() {
    if (this.growing) {
      this.size += this.speed;
      if (this.size >= this.maxSize) {
        // If the size exceeds the maximum size
        this.growing = false; // Switch to shrinking
      }
    } else {
      this.size -= this.speed;
      if (this.size <= this.minSize) {
        // If the size falls below the minimum size
        this.size = this.minSize;
        this.growing = true; // Switch to growing
      }
    }

    // Redraw the highlighter with the updated size
    this.drawBorders();
  }
}

// the Game configuration
const config = {
  scale: {
    type: Phaser.AUTO,
    parent: "game-container",
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [StartScene, MyGame],
};

// Create a new Phaser game instance
const game = new Phaser.Game(config);
