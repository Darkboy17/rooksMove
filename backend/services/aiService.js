const env = require("../config/env");
const {
  chooseStrategicMove,
  getLegalMoves,
  isBoardPosition,
  isLegalMove,
  toBoardPosition,
} = require("../utils/gameRules");

/**
 * Extracts a board move from a Groq chat response.
 */
function parseGroqMove(content) {
  const jsonMatch = String(content || "").match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      col: Number(parsed.col),
      row: Number(parsed.row),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Builds the deterministic game prompt sent to Groq.
 */
function buildPrompt(position, legalMoves) {
  return [
    "You are the AI player in a deterministic board game called Rook's Move.",
    "The board is 8x8. Coordinates are col 1-8 left to right and row 1-8 top to bottom.",
    "A single rook starts at col 8 row 1. Players alternate moving the same rook.",
    "A legal move changes exactly one coordinate: move left to a smaller col, or move down to a larger row.",
    "The player who moves the rook to col 1 row 8 wins.",
    "Choose one legal move for the AI from the provided legal moves.",
    "Prefer the winning Nim strategy: make col - 1 equal 8 - row when possible.",
    "Return only compact JSON with numeric col and row. No prose.",
    `Current position: ${JSON.stringify(position)}.`,
    `Legal moves: ${JSON.stringify(legalMoves)}.`,
  ].join("\n");
}

/**
 * Requests a move from Groq when an API key is configured.
 */
async function requestGroqMove(position, legalMoves) {
  if (!env.groqApiKey) return null;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.groqModel,
      messages: [
        {
          role: "system",
          content: "Return only a valid JSON object. Do not include markdown.",
        },
        {
          role: "user",
          content: buildPrompt(position, legalMoves),
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 40,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return parseGroqMove(data.choices && data.choices[0] && data.choices[0].message.content);
}

/**
 * Returns a legal AI move from Groq or the local strategy fallback.
 */
async function getAiMove(rawPosition) {
  const position = toBoardPosition(rawPosition);

  if (!isBoardPosition(position)) {
    const error = new Error("AI move requires a valid board position.");
    error.status = 400;
    throw error;
  }

  const legalMoves = getLegalMoves(position);
  if (legalMoves.length === 0) {
    const error = new Error("No legal AI moves are available.");
    error.status = 400;
    throw error;
  }

  try {
    const groqMove = await requestGroqMove(position, legalMoves);
    if (groqMove && isLegalMove(position, groqMove)) {
      const result = { move: groqMove, source: "groq", model: env.groqModel };
      console.info("[AI] Move source=groq", {
        model: result.model,
        position,
        move: result.move,
      });
      return result;
    }
  } catch (error) {
    console.error("Groq AI move failed:", error.message);
  }

  const result = {
    move: chooseStrategicMove(position),
    source: env.groqApiKey ? "fallback" : "local",
    model: env.groqModel,
  };

  console.info("[AI] Move source=rule-based", {
    reason: env.groqApiKey ? "groq-fallback" : "no-groq-api-key",
    reportedSource: result.source,
    model: result.model,
    position,
    move: result.move,
  });

  return result;
}

module.exports = {
  getAiMove,
};
