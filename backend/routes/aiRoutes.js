const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { getAiMove } = require("../services/aiService");

const router = express.Router();

router.post("/move", requireAuth, async (req, res) => {
  try {
    const aiMove = await getAiMove(req.body.position);
    res.json(aiMove);
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message });
  }
});

module.exports = router;
