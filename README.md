# Rook's Move Game Documentation

## Overview

Rook's Move is an online multiplayer game where two players compete against each other in a unique chess-inspired challenge. The game is designed to be engaging and strategic, offering players the opportunity to test their skills in a fast-paced environment.

## Gameplay

### Starting the Game

1.  **Connect to the Game**: Upon opening the game, players will see a "Start" button. Clicking this button initiates the connection process to the game server.

2.  **Wait for Opponent**: Once a player has connected, they will wait for an opponent to join the game. The game supports two players at a time.

3.  **Game Start**: When two players are connected, the game will automatically start. Players will be notified, and the countdown timer will begin.

### Moving the Rook

-   **Rules for Movement**: Players can move the rook piece only to the left or down, and they must move it to a new square on the chessboard as guided by highlighters.

-   **Turn-Based Movement**: The game is turn-based. Players take turns moving the rook. The current player's turn is indicated, and players must wait for their turn to move.

-   **Winning the Game**: The first player to move the rook to the bottom-left corner of the chessboard within the stipulated time wins the game.

### Additional Features

-   **Countdown Timer**: Each player has a limited amount of time (30 seconds) to make their move. If a player's time runs out before they can complete their move, the game ends.

-   **Realtime Updates**: The game provides real-time updates to both players, ensuring that each player is aware of the current state of the game at all times.

-   **Game Reset**: In case of any disconnections or errors, the game can be reset, and players can start a new game.

## How to Play as a Normal User

1.  **Access the Game**: Navigate to the game's URL in your web browser.
		http://rooksmove.lu7fuf.com.ar:3000/

3.  **Connect to the Game**: Click the "Start" button to connect to the game server.

4.  **Wait for an Opponent**: The game will search for an opponent. Once found, the game will start automatically.

5.  **Make Your Move**: When it's your turn, click on the highlighted path on the chessboard to move the rook. Remember, you must try to move the rook to the winning position but keeping in mind not to let the opponent get there first.

6.  **Win the Game**: Be the first to move the rook to the bottom-left corner of the chessboard.

## Troubleshooting
-   If you encounter any issues while playing, try refreshing the page or restarting the game.

-   For any technical issues or bugs, please contact the game's support team.


## Setting up the project on your local machine
This document provides instructions for setting up and running the Rook's Move Game on your local machine.

## Table of Contents
 1. [Prerequisites](#prerequisites)
 2. [Installation](#installation)
 3. [Running the Game](#running-the-game)
 4. [Game Controls](#game-controls)
 5.  [Game Rules](#game-rules)
 6. [Contributing](#contributing)
 7.  [License](#license)

## Prerequisites
Before running the Game, ensure you have the following installed on your system:

- Web browser (Google Chrome, Mozilla Firefox, etc.)

- Code editor (Visual Studio Code, Sublime Text, etc.)

## Installation

1. Clone the repository to your local machine:

  

	bash

  

	`git clone https://github.com/Darkboy17/rooksMove`

2. Navigate to the project directory:

	bash

	`cd rooksMove`
  

## Running the Game

To run the Rook's Move Game, follow these steps:
  
 1. Open the project directory in your code editor of choice.

 2. Now run the following:
	`node server.js`

 3. Go to your web browser and type or paste the following:
	`http://localhost:3000`
  

## Game Controls

- Use the mouse to interact with the Rook.

- Click on any one of the cells within the highlighted path to move the Rook.

## Game Rules

- The game will be played on an 8x8 chessboard.

- There will be two players, and they will take turns to move the rook. Rooks starts from the top right square.

- On each turn, a player can move the rook any number of steps to the left or down, but not up, right or diagonally.

- The player who reaches the bottom-left corner of the board first wins the game.

  ## Contributing

Contributions to the Chess Game are welcome! To contribute:

1. Fork the repository.

2. Create a new branch (`git checkout -b feature-branch`).

3. Make your changes.

4. Commit your changes (`git commit -am 'Add new feature'`).

5. Push to the branch (`git push origin feature-branch`).

6. Create a new Pull Request.


## License

This Game has no license for now.
