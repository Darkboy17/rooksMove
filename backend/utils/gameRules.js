/**
 * Converts unknown input into numeric board coordinates.
 */
function toBoardPosition(position) {
  return {
    col: Number(position && position.col),
    row: Number(position && position.row),
  };
}

/**
 * Checks whether a position is inside the 8x8 board.
 */
function isBoardPosition(position) {
  return (
    Number.isInteger(position.col) &&
    Number.isInteger(position.row) &&
    position.col >= 1 &&
    position.col <= 8 &&
    position.row >= 1 &&
    position.row <= 8
  );
}

/**
 * Lists all legal rook moves from the current position.
 */
function getLegalMoves(position) {
  const moves = [];

  for (let col = 1; col < position.col; col++) {
    moves.push({ col, row: position.row });
  }

  for (let row = position.row + 1; row <= 8; row++) {
    moves.push({ col: position.col, row });
  }

  return moves;
}

/**
 * Checks whether a position is the winning square.
 */
function isWinningPosition(position) {
  return position.col === 1 && position.row === 8;
}

/**
 * Checks whether a move follows the left-or-down rule.
 */
function isLegalMove(from, to) {
  if (!isBoardPosition(from) || !isBoardPosition(to)) return false;
  if (isWinningPosition(from)) return false;

  const movedLeft = to.row === from.row && to.col < from.col && to.col >= 1;
  const movedDown = to.col === from.col && to.row > from.row && to.row <= 8;
  return movedLeft || movedDown;
}

/**
 * Picks a winning-strategy move when possible.
 */
function chooseStrategicMove(position) {
  const legalMoves = getLegalMoves(position);
  if (legalMoves.length === 0) return null;

  const leftRemaining = position.col - 1;
  const downRemaining = 8 - position.row;

  if (leftRemaining > downRemaining) {
    return { col: downRemaining + 1, row: position.row };
  }

  if (downRemaining > leftRemaining) {
    return { col: position.col, row: 8 - leftRemaining };
  }

  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}

module.exports = {
  chooseStrategicMove,
  getLegalMoves,
  isBoardPosition,
  isLegalMove,
  isWinningPosition,
  toBoardPosition,
};
