const config = {
  type: Phaser.AUTO,
  width: 1334,
  height: 750,
  scene: {
    preload: preload,
    create: create,
  },
};

const game = new Phaser.Game(config);

let width = 1334;
let height = 750;

let victoryMessage;

let gameOverMessage;

let currentPlayer = 1; // Player 1 starts the game

// Create an array to store all highlighters
let highlighters = [];

// Define variables to store pointer coordinates
let pointerXLabel, pointerYLabel;

let timerDuration = 30; // Timer duration in seconds
let countdownValue = timerDuration; // Initial countdown value
let timer; // Variable to store the timer interval
let timerLabel; // Variable to store the timer label text object

let previousRookPositionX = null;
let previousRookPositionY = null;

// Define the win position as the bottom-left corner of the board
const winPositionX = 1;
const winPositionY = 8;

let winner = null; // Variable to store the winning player's ID

function switchPlayer() {
  currentPlayer = currentPlayer === 1 ? 2 : 1; // Switch to the other player
}

// Function to check for win condition
function checkWinCondition(rookPositionX, rookPositionY) {
  return rookPositionX === winPositionX && rookPositionY === winPositionY;
}

// Function to start the timer
function startTimer() {
  timer = setInterval(updateTimer, 1000); // Update timer every second
}

// Function to stop the timer
function stopTimer() {
  clearInterval(timer); // Clear the timer interval
}

// Function to update the timer label text
function updateTimerLabel() {
  // Update the text of the timer label with the countdown value
  timerLabel.setText(countdownValue);
}

// Function to update the timer countdown
function updateTimer() {
  // Decrement the countdown value
  countdownValue--;

  // Update UI to display the countdownValue
  updateTimerLabel();

  // Check if the countdown has reached zero
  if (countdownValue === 0) {
    console.log("Time's up! Game over.");
    stopTimer(); // Stop the timer
    gameOverMessage.setVisible(true);
  }
}

// Function to create and initialize the timer label
function createTimerLabel(scene, chessboard) {
  // Create the timer label text object
  timerLabel = scene.add.text(
    game.config.width / 2, // X position (centered horizontally)
    chessboard.height - 80, // Y position (below the chessboard)
    "Time : 30", // Initial text (empty string)
    { fontFamily: "Arial", fontSize: 24, color: "#ffffff", fontWeight: "bold" } // Text style
  );
  timerLabel.setOrigin(0.5); // Set origin to center
}

// Create labels to display pointer coordinates
function createPointerLabels(scene) {
  // Add text labels for pointer coordinates
  pointerXLabel = scene.add.text(10, 10, "Pointer X: 0", { fill: "#ffffff" });
  pointerYLabel = scene.add.text(10, 30, "Pointer Y: 0", { fill: "#ffffff" });
}

// Update pointer labels with current coordinates
function updatePointerLabels(pointer) {
  pointerXLabel.setText("Pointer X: " + pointer.x);
  pointerYLabel.setText("Pointer Y: " + pointer.y);
}

function moveRookToGrid(scene, rook, gridX, gridY, chessboard, gridSize) {
  // Calculate the actual position of the grid based on its coordinates
  const targetX = gridX;
  const targetY = gridY;

  // Calculate the new position of the rook based on the grid size

  rookPositionX =
    Math.round((gridX - chessboard.x + gridSize / 2) / gridSize) + 4;
  rookPositionY =
    Math.round((gridY - chessboard.y + gridSize / 2) / gridSize) + 4;
  console.log("Rook Index Position: ", rookPositionX, rookPositionY);

  // Hide and delete all existing highlighters
  highlighters.forEach((highlighter) => {
    highlighter.setVisible(false); // Hide the highlighter
    highlighter.graphics.destroy(); // Destroy the graphics object of the highlighter
  });

  // Animate the rook's movement to the target position
  scene.tweens.add({
    targets: rook,
    x: targetX,
    y: targetY,
    duration: 1000, // Animation duration in milliseconds
    ease: "Linear", // Easing function for smooth movement (optional)
    onComplete: function () {
      // Callback function to execute after the animation completes (optional)
      console.log("Rook moved to grid (" + gridX + ", " + gridY + ")");
      // Add any additional logic here
      // Recreate new highlighters based on the rook's updated position
      createHighlightEffect(
        scene,
        chessboard,
        gridSize,
        7,
        rookPositionX,
        rookPositionY,
        true
      );

      // Switch to the other player after the rook's move

      if (checkWinCondition(rookPositionX, rookPositionY)) {
        // Display victory message
        console.log("Player wins! Victory!");
        // You can also display the victory message in the game UI
        stopTimer();
        // Hide the time label
        timerLabel.setVisible(false);
        victoryMessage.setVisible(true);
      } else {
        // Reset the timer
        stopTimer();
        countdownValue = timerDuration + 1;
        startTimer(); // Call the function to start/reset the timer
        switchPlayer();
      }
    },
  });
}

function getClickedHighlighter(scene, highlighters, gridSize, callback) {
  // Add a pointerdown event listener to the scene
  scene.input.on("pointerdown", function (pointer) {
    // Get the x and y coordinates of the pointer when clicked
    const clickX = pointer.x;
    const clickY = pointer.y;
    console.log("highlighters:", highlighters);
    console.log("clickX, clickY:", clickX, clickY);

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
        console.log("Clicked highlighter:", highlighter);
        // Highlighter clicked, call the callback function with its coordinates
        callback({
          x: highlighterX,
          y: highlighterY,
        });
        return; // Exit the loop since we found the clicked highlighter
      }
    }

    // No highlighter clicked
    console.log("No highlighter clicked");
    return null;
  });
}

// Define a function to handle moving the rook to the clicked highlighter
function handleRookMovement(
  scene,
  rook,
  chessboard,
  gridSize,
  highlighters,
  newX,
  newY
) {
  // Callback function to be executed when a highlighter is clicked
  function highlighterClicked(coordinates) {
    console.log("Cooridnates: ", coordinates);
    console.log("Rook x : ", rook.x);
  }

  // Call getClickedHighlighter with the callback function
  getClickedHighlighter(scene, highlighters, gridSize, highlighterClicked);
}

function handleHighlighterClick(
  scene,
  rook,
  chessboard,
  gridSize,
  highlighters
) {
  // Call getClickedHighlighter with a callback function
  getClickedHighlighter(scene, highlighters, gridSize, function (coordinates) {
    console.log("coordinates and rook: ", coordinates.y, rook.y);
    if (coordinates.x > rook.x || coordinates.y < rook.y) {
      console.log("Cannot move rook to the righ or up.");
      return; // Do not proceed with the move
    }

    // Hide all highlighters
    // Move the rook to the clicked highlighter coordinates
    moveRookToGrid(
      scene,
      rook,
      coordinates.x,
      coordinates.y,
      chessboard,
      gridSize
    );
  });
}

function preload() {
  // Load assets
  this.load.image("chessboard", "assets/chessboard.png");
  this.load.image("grid", "assets/grid.png");
  this.load.image("rook", "assets/rook.png");
  this.load.image("player1avatar", "assets/player_1_avatar.png");
  this.load.image("player2avatar", "assets/player_2_avatar.png");
}

function create() {
  // Create chessboard background
  const chessboard = this.add.image(width / 2, height / 2, "chessboard");
  const player1 = this.add.image(width / 2, height - 100, "player1avatar");
  const player2 = this.add.image(width / 2, height / 6, "player2avatar");

  if (currentPlayer === 1) {
    victoryMessage = this.add.text(
      width / 2, // X position (center of the screen)
      height / 2, // Y position (center of the screen)
      "Player 1 wins! Victory!", // Message text
      { fontFamily: "Arial", fontSize: 24, color: "#ffffff" } // Text style
    );
  } else if (currentPlayer === 2) {
    victoryMessage = this.add.text(
      width / 2, // X position (center of the screen)
      height / 2, // Y position (center of the screen)
      "Player 2 wins! Victory!", // Message text
      { fontFamily: "Arial", fontSize: 24, color: "#ffffff" } // Text style
    );
  }

  victoryMessage.setOrigin(0.5); // Set origin to center align
  victoryMessage.setVisible(false); // Initially hide the victory message

  gameOverMessage = this.add.text(
    width / 2, // X position (center of the screen)
    height / 2, // Y position (center of the screen)
    "Time's up! Game over.", // Message text
    { fontFamily: "Arial", fontSize: 24, color: "#ffffff" } // Text style
  );
  gameOverMessage.setOrigin(0.5); // Set origin to center align
  gameOverMessage.setVisible(false); // Initially hide the victory message

  // Calculate the size of the grid square (assuming an 8x8 grid)
  const gridSize = Math.min(chessboard.width, chessboard.height) / 8;
  console.log("Grid size: ", gridSize);

  // Calculate the number of rows and columns in the chessboard
  const numRows = Math.floor(chessboard.height / gridSize);
  const numCols = Math.floor(chessboard.width / gridSize);

  // position based on game rule
  const rookPositionX = 8;
  const rookPositionY = 1;

  // Calculate the position of the top-right grid square
  const topRightX =
    chessboard.x + rookPositionX * (gridSize - 5) - chessboard.width / 2;

  const topRightY =
    chessboard.y +
    (rookPositionY + 3) * (gridSize - 5.5) -
    chessboard.height / 2 +
    gridSize / 2;

  // Add the rook image to the top-right of the chessboard
  // Adjust the position to center the rook on the grid square
  const rook = this.add.image(
    topRightX, // Adjusted X position to center the rook
    topRightY, // Adjusted Y position to center the rook
    "rook"
  );

  // Optionally, set the origin to the center of the image if needed
  rook.setOrigin(0.5, 0.5);

  // Calculate the scale factor to fit the rook inside the grid
  const scaleFactor = (gridSize - 15) / Math.max(rook.width, rook.height);

  // Apply the scale factor to the rook
  rook.setScale(scaleFactor);
  createHighlightEffect(
    this,
    chessboard,
    gridSize,
    7,
    rookPositionX,
    rookPositionY,
    true
  );

  // Call the function to handle rook movement
  handleRookMovement(
    this,
    rook,
    chessboard,
    gridSize,
    highlighters,
    rookPositionX,
    rookPositionY
  );

  console.log("test:", 521.375 + gridSize / 2);

  // Call createPointerLabels function to create labels in the scene
  createPointerLabels(this);

  // Call the createTimerLabel function to create the timer label
  createTimerLabel(this, chessboard);

  // Call the startTimer function to start the timer
  startTimer();
  updateTimerLabel();

  // Add pointermove event listener to update labels when pointer moves
  this.input.on("pointermove", function (pointer) {
    updatePointerLabels(pointer);
  });

  handleHighlighterClick(this, rook, chessboard, gridSize, highlighters);
}

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
    this.speed = 0.125;
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

// Function to create row highlight effect using Highlighter class
function createHighlightEffect(
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
    highlighters.push(colhighlighter);
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
    highlighters.push(rowhighlighter);
  }
}
