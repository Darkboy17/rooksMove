# Rook's Move Game Documentation

This document provides instructions for setting up and running the Rook's Move Game.

## Table of Contents

1.  [Introduction](#introduction)
2.  [Prerequisites](#prerequisites)
3.  [Installation](#installation)
4.  [Running the Game](#running-the-game)
5.  [Game Controls](#game-controls)
6.  [Game Rules](#game-rules)
7.  [Contributing](#contributing)
8.  [License](#license)

## Introduction

The Rook's Move Game is a web-based chess game implemented using HTML, CSS, and JavaScript. It allows two players to play to move the rook on a virtual chessboard based on game rules specified below.

## Prerequisites

Before running the Game, ensure you have the following installed on your system:

-   Web browser (Google Chrome, Mozilla Firefox, etc.)
-   Code editor (Visual Studio Code, Sublime Text, etc.)

## Installation

 1.  Clone the repository to your local machine:

		bash

	    `git clone https://github.com/Darkboy17/rooksMove`
    
 2. Navigate to the project directory:
    
	bash

	`cd rooksMove`

## Running the Game

To run the Rook's Move Game, follow these steps:

1.  Open the project directory in your code editor.
2.  Open the `index.html` file in your web browser or use Live Reload (in vs code).
3.  The Game will be displayed in your web browser.

## Game Controls

-   Use the mouse to interact with the Rook.
-   Click on any one of the cells within the highlighted path to move the Rook to.

## Game Rules

 - The game will be played on an 8x8 chessboard.
 - There will be two players, and they will take turns to move the rook. Rooks starts from the top right square.
 - On each turn, a player can move the rook any number of steps to the left or down, but not up, right or diagonally.
 - The player who reaches the bottom-left corner of the board first wins the game.

## Contributing

Contributions to the Chess Game are welcome! To contribute:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature-branch`).
3.  Make your changes.
4.  Commit your changes (`git commit -am 'Add new feature'`).
5.  Push to the branch (`git push origin feature-branch`).
6.  Create a new Pull Request.

## License

The Chess Game is open-source software licensed under the MIT License.
