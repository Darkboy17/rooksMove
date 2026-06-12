import Phaser from "phaser";
import socket from "../network/socketManager";
import { apiFetch } from "../auth/authClient";

let gameOptions = {
  mode: "online",
  user: null,
  match: null,
};

class MyGame extends Phaser.Scene {
  constructor() {
    super({ key: "MyGame" });
    this.socket = socket;

    // Define class properties
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.victoryMessage;
    this.gameOverMessage;
    this.currentPlayer; // Player 1 starts the game
    this.highlighters = []; // Array to store all highlighters
    this.highlighterPointerHandler = null;
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
    this.currentPlayerTurn = "Player1";
    this.gameMode = "online";
    this.currentUser = null;
    this.matchData = null;
    this.humanPlayerId = "human";
    this.aiPlayerId = "ai";
    this.isAiThinking = false;
    this.boardDisplaySize = 0;
    this.hudHeight = 92;
    this.boardPadding = 24;
    this.boardCenterX = 0;
    this.boardCenterY = 0;
    this.boardGraphics = null;
    this.finishWidget = null;
    this.bottomHudHeight = 112;
    this.turnLabel = null;
    this.statusBadge = null;
    this.statusAccent = null;
    this.statusText = null;
    this.statusHideTimer = null;
    this.aiThinkTimer = null;
    this.playerWidgets = {};
    this.activeWidgetTween = null;
    this.activeWidgetKey = null;
    this.aiThinkingBadge = null;
    this.aiThinkingAccent = null;
    this.aiThinkingText = null;
    this.aiThinkingTween = null;
    this.endMessageFrame = null;
    this.endMessageAccent = null;
    this.endActions = null;
    this.gameStatusHandler = null;
  }

  init() {
    this.gameMode = gameOptions.mode || "online";
    this.currentUser = gameOptions.user || null;
    this.matchData = gameOptions.match || null;
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
    this.currentPlayerTurn = "Player1";
    this.currentUser = gameOptions.user || null;
    this.matchData = gameOptions.match || null;
    this.isAiThinking = false;
    if (this.aiThinkTimer) {
      clearTimeout(this.aiThinkTimer);
      this.aiThinkTimer = null;
    }
    this.stopAiThinkingIndicator();
    this.stopWidgetCountdown(true);
  }

  preload() {
    // Load assets
    this.load.image("rook", "assets/rook.png");
  }

  create() {
    this.createChessboard();
    this.createFinishWidget();

    if (!this.isAiGame()) {
      this.listenServerSockets();
    }

    this.createTimerLabel();
    this.createPlayerAvatars();
    this.createRook();

    if (this.isAiGame()) {
      this.setupAiGame();
    } else {
      this.createHighlightEffect(
        this,
        this.chessboard,
        this.gridSize,
        7,
        this.rookPositionX,
        this.rookPositionY,
        true
      );
      this.setupOnlineGame();
    }

    this.chessboard.on("pointerdown", () => {
      if (!this.isHumanTurn())
        this.displayMessage(this, "It's not your turn Yet!", 500, 2000);
    });

    this.scale.on("resize", this.handleResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.handleResize, this);
      if (this.gameStatusHandler) {
        window.removeEventListener("rooks:game-status", this.gameStatusHandler);
        this.gameStatusHandler = null;
      }
      this.removeGameSocketListeners();
      if (this.highlighterPointerHandler) {
        this.input.off("pointerdown", this.highlighterPointerHandler);
        this.highlighterPointerHandler = null;
      }
      if (this.aiThinkTimer) {
        clearTimeout(this.aiThinkTimer);
        this.aiThinkTimer = null;
      }
      this.stopAiThinkingIndicator();
      this.stopAndResetTimer(false);
    });

    this.gameStatusHandler = (event) => {
      const message = event.detail && event.detail.message;
      if (message) this.displayRefreshMessage(message);
    };
    window.addEventListener("rooks:game-status", this.gameStatusHandler);
  }

  removeGameSocketListeners() {
    [
      "opponentRookMoved",
      "gameStateReset",
      "gameStateRestart",
      "updateTurnIndicator",
      "showTurnMessage",
      "playersUpdated",
      "displayGameOverMessage",
      "displayGameWonMessage",
      "match:opponentLeft",
    ].forEach((eventName) => socket.off(eventName));
  }

  refreshLayout(gameSize = null) {
    this.width = gameSize ? gameSize.width : this.scale.width;
    this.height = gameSize ? gameSize.height : this.scale.height;
    this.boardPadding = Math.max(12, Math.min(34, this.width * 0.035));
    this.hudHeight = this.width < 680 ? 68 : 84;
    this.bottomHudHeight = this.width < 680 ? 112 : 132;

    const playAreaTop = this.hudHeight + this.boardPadding;
    const playAreaBottom = this.height - this.bottomHudHeight - this.boardPadding;
    const availableWidth = Math.max(160, this.width - this.boardPadding * 2);
    const availableHeight = Math.max(160, playAreaBottom - playAreaTop);
    const preferredBoardSize = Math.min(availableWidth, availableHeight);
    const minimumBoardSize = Math.min(220, preferredBoardSize);

    this.boardDisplaySize = Math.max(minimumBoardSize, preferredBoardSize);
    this.boardCenterX = this.width / 2;
    this.boardCenterY = playAreaTop + availableHeight / 2;
  }

  handleResize(gameSize) {
    this.refreshLayout(gameSize);

    if (this.chessboard) {
      this.chessboard.setPosition(this.boardCenterX, this.boardCenterY);
      this.chessboard.setSize(this.boardDisplaySize, this.boardDisplaySize);
      this.gridSize = this.getGridSize();
      this.drawBoard();
      this.drawFinishWidget();
    }

    if (this.rook) {
      const rookTarget = this.boardPositionToGrid(this.rookPositionX, this.rookPositionY);
      this.rook.setPosition(rookTarget.x, rookTarget.y);
      this.scaleRookToGrid();
    }

    if (this.turnLabel) {
      this.turnLabel.setPosition(this.boardPadding, 28);
      this.turnLabel.setFontSize(this.width < 420 ? 11 : 13);
    }
    if (this.statusText) {
      this.positionStatusText();
      this.fitTextToWidth(
        this.statusText,
        this.getReadableTextWidth(520) - 58,
        this.width < 420 ? 14 : 16,
        11
      );
      this.drawStatusBadge(this.statusText.alpha);
    }
    this.layoutEndMessage(this.victoryMessage);
    this.layoutEndMessage(this.gameOverMessage);

    this.layoutCountdownWidgets();
    this.positionAiThinkingIndicator();
    if (this.endActions) this.showEndActions();

    this.clearHighlighters();
    if (!this.gameStateWon && !this.gameStateOver && this.chessboard) {
      this.createHighlightEffect(
        this,
        this.chessboard,
        this.gridSize,
        7,
        this.rookPositionX,
        this.rookPositionY,
        true
      );
    }
  }

  isAiGame() {
    return this.gameMode === "ai";
  }

  isHumanTurn() {
    if (this.isAiGame()) {
      return this.currentPlayerSocketId === this.humanPlayerId && !this.isAiThinking;
    }

    return this.currentPlayerSocketId === this.socket.id;
  }

  getLocalDisplayName() {
    const name = this.currentUser && (this.currentUser.name || this.currentUser.email);
    if (!name) return "Player";

    return name.split("@")[0].replace(/\s+/g, " ").trim() || "Player";
  }

  getRoleDisplayName(role) {
    const roleName =
      this.matchData &&
      this.matchData.playerNamesByRole &&
      this.matchData.playerNamesByRole[role];

    if (roleName) return this.compactText(roleName, 18);
    if (this.isAiGame() && role === "Player2") return "AI";
    if (role === "Player1") return this.getLocalDisplayName();

    return "Player 2";
  }

  applyOnlineMatchData(data = null) {
    const match = data || this.matchData;
    if (!match) return;

    this.matchData = match;
    this.playerSocketIds = match.playerNamesBySocketId || this.playerSocketIds;
    this.currentPlayerSocketId =
      match.currentPlayerSocketId || this.currentPlayerSocketId;
    this.currentPlayerTurn = match.currentPlayerTurn || this.currentPlayerTurn;

    if (this.playerWidgets.player1) {
      this.playerWidgets.player1.labelText = this.getRoleDisplayName("Player1");
    }
    if (this.playerWidgets.player2) {
      this.playerWidgets.player2.labelText = this.getRoleDisplayName("Player2");
    }
    this.layoutCountdownWidgets();
  }

  setupOnlineGame() {
    this.applyOnlineMatchData();

    if (!this.currentPlayerSocketId) {
      this.displayMessage(this, "Waiting for match data", 500, 1800);
      return;
    }

    const widgetKey =
      this.currentPlayerTurn === "Player2" ? "player2" : "player1";
    const isLocalTurn = this.currentPlayerSocketId === this.socket.id;

    this.startTimer(widgetKey, isLocalTurn);

    if (!isLocalTurn) {
      this.highlighters.forEach((highlighter) => highlighter.setVisible(false));
      return;
    }

    this.displayMessage(this, "Your Turn", 500, 1600);
    this.handleHighlighterClick(
      this,
      this.rook,
      this.chessboard,
      this.gridSize,
      this.highlighters,
      this.currentPlayerSocketId
    );
  }

  compactText(text, maxLength) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) return normalized;
    if (maxLength <= 4) return normalized.slice(0, maxLength);
    return `${normalized.slice(0, maxLength - 3)}...`;
  }

  getResponsiveFontSize(maxSize, minSize = 16) {
    return Math.max(minSize, Math.min(maxSize, Math.round(this.width * 0.045)));
  }

  getReadableTextWidth(maxWidth = 560) {
    return Math.max(220, Math.min(maxWidth, this.width - this.boardPadding * 2));
  }

  getGridHudPosition() {
    const boardTop = this.boardCenterY - this.boardDisplaySize / 2;
    const y = Math.max(32, boardTop - (this.width < 560 ? 20 : 24));

    return {
      x: this.boardCenterX,
      y,
    };
  }

  getStatusTextPosition() {
    return this.getGridHudPosition();
  }

  positionStatusText() {
    if (!this.statusText) return;
    const position = this.getStatusTextPosition();
    this.statusText.setPosition(position.x, position.y);
  }

  fitTextToWidth(textObject, maxWidth, maxFontSize, minFontSize = 12) {
    if (!textObject) return;

    textObject.setWordWrapWidth(maxWidth);
    textObject.setFontSize(maxFontSize);

    let fontSize = maxFontSize;
    while (textObject.width > maxWidth && fontSize > minFontSize) {
      fontSize -= 1;
      textObject.setFontSize(fontSize);
    }
  }

  setupAiGame() {
    const aiStarts = Phaser.Math.Between(0, 1) === 1;
    this.currentPlayerSocketId = aiStarts ? this.aiPlayerId : this.humanPlayerId;
    this.currentPlayerTurn = aiStarts ? "Player2" : "Player1";
    this.playerSocketIds = {
      [this.humanPlayerId]: this.getLocalDisplayName(),
      [this.aiPlayerId]: "AI",
    };

    if (aiStarts) {
      this.requestAiMove({
        col: this.rookPositionX,
        row: this.rookPositionY,
      });
      return;
    }

    this.createHighlightEffect(
      this,
      this.chessboard,
      this.gridSize,
      7,
      this.rookPositionX,
      this.rookPositionY,
      true
    );
    this.displayWelcomeMessage(this, "Your Turn", 500, 2000);
    this.startTimer("player1", true);
    this.handleHighlighterClick(
      this,
      this.rook,
      this.chessboard,
      this.gridSize,
      this.highlighters,
      null,
      this.currentPlayerSocketId
    );
  }

  createPlayerAvatars() {
    this.playerWidgets.player1 = this.createCountdownWidget(
      "player1",
      this.getRoleDisplayName("Player1")
    );
    this.playerWidgets.player2 = this.createCountdownWidget(
      "player2",
      this.getRoleDisplayName("Player2")
    );
    this.layoutCountdownWidgets();
  }

  createCountdownWidget(kind, labelText) {
    const background = this.add.graphics();
    const avatar = this.add.graphics();
    const frame = this.add.graphics();
    const ring = this.add.graphics();
    const label = this.add.text(0, 0, labelText, {
      fontFamily: "Arial",
      fontSize: 13,
      color: "#dbe7f3",
      fontWeight: "900",
      align: "center",
    });

    label.setOrigin(0.5, 0);

    return {
      avatar,
      background,
      frame,
      ring,
      label,
      labelText: labelText || "Player",
      displayLabel: labelText || "Player",
      kind,
      progress: 1,
      size: 48,
      x: 0,
      y: 0,
    };
  }

  layoutCountdownWidgets() {
    const widgetSize = this.width < 560 ? 48 : 62;
    const gap = Math.max(26, widgetSize * 1.2);
    const y = Math.min(
      this.height - widgetSize / 2 - 28,
      this.boardCenterY + this.boardDisplaySize / 2 + widgetSize / 2 + 18
    );

    this.layoutCountdownWidget(
      this.playerWidgets.player1,
      this.width / 2 - widgetSize / 2 - gap / 2,
      y,
      widgetSize
    );
    this.layoutCountdownWidget(
      this.playerWidgets.player2,
      this.width / 2 + widgetSize / 2 + gap / 2,
      y,
      widgetSize
    );
  }

  layoutCountdownWidget(widget, x, y, size) {
    if (!widget) return;

    widget.x = x;
    widget.y = y;
    widget.size = size;
    widget.displayLabel = this.compactText(widget.labelText, size < 50 ? 9 : 12);
    widget.label.setText(widget.displayLabel);
    widget.label.setPosition(x, y + size / 2 + 5);
    widget.label.setFontSize(size < 50 ? 11 : 13);
    widget.label.setWordWrapWidth(Math.max(76, size * 1.9));
    this.drawCountdownWidget(widget);
  }

  drawCountdownWidget(widget) {
    if (!widget) return;

    const x = widget.x;
    const y = widget.y;
    const size = widget.size;
    const radius = size / 2;
    const progress = Phaser.Math.Clamp(widget.progress, 0, 1);

    widget.background.clear();
    widget.background.fillStyle(0x070a10, 0.94);
    widget.background.fillCircle(x, y, radius + 7);
    widget.background.lineStyle(2, 0x232a35, 1);
    widget.background.strokeCircle(x, y, radius + 7);

    this.drawAvatarIcon(widget);

    widget.frame.clear();
    widget.frame.lineStyle(2, 0x0b1018, 0.72);
    widget.frame.strokeCircle(x, y, radius - 2);

    widget.ring.clear();
    widget.ring.lineStyle(Math.max(4, size * 0.095), 0x15351f, 1);
    widget.ring.strokeCircle(x, y, radius + 2);

    if (progress > 0) {
      widget.ring.lineStyle(Math.max(4, size * 0.095), 0x20df6f, 1);
      widget.ring.beginPath();
      widget.ring.arc(
        x,
        y,
        radius + 2,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + progress * 360),
        false
      );
      widget.ring.strokePath();
    }
  }

  drawAvatarIcon(widget) {
    const g = widget.avatar;
    const x = widget.x;
    const y = widget.y;
    const size = widget.size;
    const r = size * 0.38;

    g.clear();

    if (widget.kind === "player1") {
      g.fillStyle(0xffcf45, 1);
      g.fillCircle(x, y, r);
      g.lineStyle(size * 0.04, 0xfff0a5, 1);
      g.strokeCircle(x, y, r * 0.92);

      g.fillStyle(0x5c3cd6, 1);
      g.fillRoundedRect(x - r * 0.62, y - r * 0.5, r * 1.24, r * 0.98, r * 0.2);
      g.lineStyle(size * 0.035, 0x2b1a82, 1);
      g.strokeRoundedRect(x - r * 0.62, y - r * 0.5, r * 1.24, r * 0.98, r * 0.2);

      g.fillStyle(0x22aee8, 1);
      g.fillRoundedRect(x - r * 0.45, y - r * 0.28, r * 0.9, r * 0.48, r * 0.12);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x - r * 0.24, y - r * 0.04, r * 0.08);
      g.fillCircle(x + r * 0.24, y - r * 0.04, r * 0.08);
      g.lineStyle(size * 0.025, 0xffffff, 1);
      g.lineBetween(x - r * 0.22, y + r * 0.22, x + r * 0.22, y + r * 0.22);
    } else {
      g.fillStyle(0xffca3d, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0xffe087, 1);
      g.fillCircle(x - r * 0.34, y - r * 0.36, r * 0.1);

      g.lineStyle(size * 0.055, 0x087bb7, 1);
      const eyeOffsetX = r * 0.28;
      const eyeY = y - r * 0.08;
      const eyeSize = r * 0.16;
      [x - eyeOffsetX, x + eyeOffsetX].forEach((eyeX) => {
        g.lineBetween(eyeX - eyeSize, eyeY - eyeSize, eyeX + eyeSize, eyeY + eyeSize);
        g.lineBetween(eyeX + eyeSize, eyeY - eyeSize, eyeX - eyeSize, eyeY + eyeSize);
      });

      g.lineStyle(size * 0.045, 0x087bb7, 1);
      g.beginPath();
      g.arc(x, y + r * 0.22, r * 0.24, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165), false);
      g.strokePath();
    }
  }

  showAiThinkingIndicator() {
    if (!this.playerWidgets.player2 || this.gameStateOver || this.gameStateWon) return;

    this.hideStatusNotification();

    if (!this.aiThinkingBadge) {
      this.aiThinkingBadge = this.add.graphics();
      this.aiThinkingBadge.setDepth(10);
    }

    if (!this.aiThinkingAccent) {
      this.aiThinkingAccent = this.add.graphics();
      this.aiThinkingAccent.setDepth(11);
    }

    if (!this.aiThinkingText) {
      this.aiThinkingText = this.add.text(0, 0, "AI THINKING", {
        fontFamily: "Arial",
        fontSize: 12,
        color: "#e8f6ee",
        fontWeight: "900",
      });
      this.aiThinkingText.setDepth(12);
    }

    this.positionAiThinkingIndicator();
    this.aiThinkingBadge.setVisible(true);
    this.aiThinkingAccent.setVisible(true);
    this.aiThinkingText.setVisible(true);
    this.setAiThinkingAlpha(0.34);

    if (this.aiThinkingTween) {
      this.aiThinkingTween.stop();
      this.aiThinkingTween = null;
    }

    this.aiThinkingTween = this.tweens.add({
      targets: [this.aiThinkingText, this.aiThinkingBadge, this.aiThinkingAccent],
      alpha: { from: 0.34, to: 1 },
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  positionAiThinkingIndicator() {
    if (!this.aiThinkingText) return;

    const position = this.getGridHudPosition();
    const badgeWidth = Math.min(
      this.width - this.boardPadding * 2,
      Math.max(128, (this.aiThinkingText.width || 86) + 44)
    );
    const badgeHeight = 34;
    const x = position.x - badgeWidth / 2;

    this.aiThinkingText.setOrigin(0.5, 0.5);
    this.aiThinkingText.setPosition(position.x, position.y);
    this.drawAiThinkingBadge(x, position.y, badgeWidth, badgeHeight);
  }

  drawAiThinkingBadge(x, y, width, height) {
    if (!this.aiThinkingBadge || !this.aiThinkingAccent) return;

    const top = y - height / 2;
    const radius = 8;

    this.aiThinkingBadge.clear();
    this.aiThinkingBadge.fillStyle(0x070a10, 0.94);
    this.aiThinkingBadge.fillRoundedRect(x, top, width, height, radius);
    this.aiThinkingBadge.lineStyle(2, 0x15351f, 1);
    this.aiThinkingBadge.strokeRoundedRect(x, top, width, height, radius);
    this.aiThinkingBadge.lineStyle(1, 0x20df6f, 0.55);
    this.aiThinkingBadge.lineBetween(x + 10, top + 5, x + width - 10, top + 5);

    this.aiThinkingAccent.clear();
    this.aiThinkingAccent.fillStyle(0x20df6f, 1);
    this.aiThinkingAccent.fillCircle(x + 12, y, 4);
    this.aiThinkingAccent.lineStyle(2, 0x20df6f, 0.28);
    this.aiThinkingAccent.strokeCircle(x + 12, y, 8);
    this.aiThinkingAccent.lineStyle(2, 0xf0b35a, 0.82);
    this.aiThinkingAccent.lineBetween(x + width - 13, top + 9, x + width - 7, top + height / 2);
    this.aiThinkingAccent.lineBetween(x + width - 7, top + height / 2, x + width - 13, top + height - 9);
  }

  setAiThinkingAlpha(alpha) {
    if (this.aiThinkingBadge) this.aiThinkingBadge.setAlpha(alpha);
    if (this.aiThinkingAccent) this.aiThinkingAccent.setAlpha(alpha);
    if (this.aiThinkingText) this.aiThinkingText.setAlpha(alpha);
  }

  stopAiThinkingIndicator() {
    if (this.aiThinkingTween) {
      this.aiThinkingTween.stop();
      this.aiThinkingTween = null;
    }

    if (this.aiThinkingBadge) {
      this.aiThinkingBadge.setVisible(false);
      this.aiThinkingBadge.setAlpha(0);
    }
    if (this.aiThinkingAccent) {
      this.aiThinkingAccent.setVisible(false);
      this.aiThinkingAccent.setAlpha(0);
    }
    if (this.aiThinkingText) {
      this.aiThinkingText.setVisible(false);
      this.aiThinkingText.setAlpha(0);
    }
  }

  startWidgetCountdown(widgetKey, durationMs) {
    if (this.gameStateOver || this.gameStateWon) return;

    this.stopWidgetCountdown(false);
    this.activeWidgetKey = widgetKey;

    Object.values(this.playerWidgets || {}).forEach((widget) => {
      widget.progress = 1;
      this.drawCountdownWidget(widget);
    });

    const widget = this.playerWidgets[widgetKey];
    if (!widget) return;

    widget.progress = 1;
    this.drawCountdownWidget(widget);

    this.activeWidgetTween = this.tweens.add({
      targets: widget,
      progress: 0,
      duration: Math.max(1, durationMs),
      ease: "Linear",
      onUpdate: () => this.drawCountdownWidget(widget),
      onComplete: () => {
        this.activeWidgetTween = null;
        this.activeWidgetKey = null;
      },
    });
  }

  completeActiveWidgetCountdown() {
    const widget = this.activeWidgetKey && this.playerWidgets[this.activeWidgetKey];

    if (this.activeWidgetTween) {
      this.activeWidgetTween.stop();
      this.activeWidgetTween = null;
    }

    if (widget) {
      widget.progress = 0;
      this.drawCountdownWidget(widget);
    }

    this.activeWidgetKey = null;
  }

  stopWidgetCountdown(resetAll = true) {
    if (this.activeWidgetTween) {
      this.activeWidgetTween.stop();
      this.activeWidgetTween = null;
    }

    if (!resetAll) return;

    Object.values(this.playerWidgets || {}).forEach((widget) => {
      widget.progress = 1;
      this.drawCountdownWidget(widget);
    });

    this.activeWidgetKey = null;
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
  startTimer(widgetKey = "player1", shouldTimeout = true) {
    if (this.gameStateOver || this.gameStateWon) return;

    // Stop the current timer if it exists
    if (this.timer) {
      clearInterval(this.timer); // Clear the existing timer
    }

    // Start the timer
    let timerValue = this.timerDuration;
    this.startWidgetCountdown(widgetKey, this.timerDuration * 1000);

    this.timer = setInterval(() => {
      timerValue--;

      if (this.gameStateOver || this.gameStateWon || !this.scene.isActive()) {
        clearInterval(this.timer);
        this.timer = null;
        return;
      }

      if (timerValue <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        this.completeActiveWidgetCountdown();

        if (!shouldTimeout) {
          this.stopWidgetCountdown(false);
          return;
        }

        if (this.isAiGame()) {
          this.gameOver("Time's up! AI wins.");
          return;
        }

        // Emit a 'gameOver' event to the server, including the message
        socket.emit("gameOver", { message: "Time's up! Game over." });

        // Handle the game over logic here
        this.stopAndResetTimer(false);
      }
    }, 1000);
  }

  // for stopping and resetting the countdown timer
  stopAndResetTimer(resetWidgets = true) {
    // Stop the current timer if it exists
    if (this.timer) {
      clearInterval(this.timer); // Clear the existing timer
      this.timer = null; // Reset the timer variable
    }

    this.stopWidgetCountdown(resetWidgets);

    if (this.timerLabel) this.timerLabel.setVisible(false);
  }

  // for displaying the countdown
  createTimerLabel() {
    this.timerLabel = null;

    this.turnLabel = this.add.text(this.boardPadding, 28, this.isAiGame() ? "AI DUEL" : "ONLINE DUEL", {
      fontFamily: "Arial",
      fontSize: 13,
      color: "#160f08",
      fontWeight: "900",
      backgroundColor: "#f0b35a",
      padding: { x: 12, y: 6 },
    });
    this.turnLabel.setOrigin(0, 0.5);

    this.statusBadge = this.add.graphics();
    this.statusAccent = this.add.graphics();
    this.statusBadge.setDepth(8);
    this.statusAccent.setDepth(9);

    const statusPosition = this.getStatusTextPosition();
    this.statusText = this.add.text(statusPosition.x, statusPosition.y, "", {
      fontFamily: "Arial",
      fontSize: 16,
      color: "#dbe7f3",
      fontWeight: "bold",
      align: "center",
      wordWrap: { width: Math.min(520, this.width - this.boardPadding * 2) },
    });
    this.statusText.setOrigin(0.5);
    this.statusText.setAlpha(0);
    this.statusText.setDepth(10);
    this.drawStatusBadge(0);
  }

  // for displaying the chessboard
  createChessboard() {
    this.refreshLayout();

    this.boardGraphics = this.add.graphics();
    this.chessboard = this.add.zone(
      this.boardCenterX,
      this.boardCenterY,
      this.boardDisplaySize,
      this.boardDisplaySize
    );
    this.chessboard.setInteractive();
    this.drawBoard();

    this.chessboard.on("pointerdown", () => {
    });
  }

  drawBoard() {
    if (!this.boardGraphics || !this.chessboard) return;

    const size = this.boardDisplaySize;
    const gridSize = this.getGridSize();
    const left = this.chessboard.x - size / 2;
    const top = this.chessboard.y - size / 2;

    this.boardGraphics.clear();
    this.boardGraphics.fillStyle(0x05070b, 1);
    this.boardGraphics.fillRoundedRect(left - 10, top - 10, size + 20, size + 20, 12);
    this.boardGraphics.lineStyle(2, 0x171d26, 1);
    this.boardGraphics.strokeRoundedRect(left - 10, top - 10, size + 20, size + 20, 12);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isDark = (row + col) % 2 === 1;
        this.boardGraphics.fillStyle(isDark ? 0x050608 : 0x262b33, 1);
        this.boardGraphics.fillRect(
          left + col * gridSize,
          top + row * gridSize,
          gridSize,
          gridSize
        );
      }
    }

    this.boardGraphics.lineStyle(Math.max(1, size * 0.003), 0x596170, 0.26);
    for (let i = 0; i <= 8; i++) {
      const offset = i * gridSize;
      this.boardGraphics.lineBetween(left + offset, top, left + offset, top + size);
      this.boardGraphics.lineBetween(left, top + offset, left + size, top + offset);
    }

    this.boardGraphics.lineStyle(Math.max(3, size * 0.008), 0x10151d, 1);
    this.boardGraphics.strokeRect(left, top, size, size);
  }

  createFinishWidget() {
    this.finishWidget = this.add.graphics();
    this.finishWidget.setDepth(1);
    this.drawFinishWidget();
  }

  drawFinishWidget() {
    if (!this.finishWidget || !this.chessboard) return;

    const center = this.boardPositionToGrid(this.winPositionX, this.winPositionY);
    const gridSize = this.getGridSize();
    const radius = gridSize * 0.29;
    const flagWidth = gridSize * 0.22;
    const flagHeight = gridSize * 0.17;
    const poleHeight = gridSize * 0.34;
    const poleX = center.x - gridSize * 0.08;
    const poleTop = center.y - gridSize * 0.22;

    this.finishWidget.clear();

    this.finishWidget.fillStyle(0x020407, 0.42);
    this.finishWidget.fillCircle(center.x + gridSize * 0.04, center.y + gridSize * 0.06, radius * 1.08);

    this.finishWidget.fillStyle(0x0b1018, 0.94);
    this.finishWidget.fillCircle(center.x, center.y, radius);
    this.finishWidget.lineStyle(Math.max(2, gridSize * 0.045), 0x20df6f, 0.9);
    this.finishWidget.strokeCircle(center.x, center.y, radius);
    this.finishWidget.lineStyle(Math.max(1, gridSize * 0.02), 0xf0b35a, 0.9);
    this.finishWidget.strokeCircle(center.x, center.y, radius * 0.72);

    this.finishWidget.lineStyle(Math.max(2, gridSize * 0.035), 0xf0b35a, 1);
    this.finishWidget.lineBetween(poleX, poleTop, poleX, poleTop + poleHeight);

    this.finishWidget.fillStyle(0xf5f7fb, 1);
    this.finishWidget.fillRect(poleX, poleTop, flagWidth, flagHeight);
    this.finishWidget.fillStyle(0x070a10, 1);
    this.finishWidget.fillRect(poleX + flagWidth / 2, poleTop, flagWidth / 2, flagHeight / 2);
    this.finishWidget.fillRect(poleX, poleTop + flagHeight / 2, flagWidth / 2, flagHeight / 2);
    this.finishWidget.lineStyle(Math.max(1, gridSize * 0.014), 0x070a10, 0.85);
    this.finishWidget.strokeRect(poleX, poleTop, flagWidth, flagHeight);

    this.finishWidget.fillStyle(0x20df6f, 1);
    this.finishWidget.fillCircle(center.x + radius * 0.43, center.y + radius * 0.52, Math.max(2, gridSize * 0.035));
  }

  // Handles all realtime game events emitted by the server.
  listenServerSockets() {
    // for welcome message purposes
    let messageShownForPlayer = false;

    // Listen for the 'opponentRookMoved' event from the server
    socket.on("opponentRookMoved", (newPosition) => {
      const target = this.getMoveTargetFromPayload(newPosition);
      if (!target) {
        return;
      }

      this.moveRookToGrid(
        this,
        this.rook,
        target.x,
        target.y,
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

      // Emit a custom event with the message to be passed to the Scene Class.
      this.registry.set("displayErrorMessage", message);
      this.resetGame();
    });

    socket.on("gameStateRestart", (message) => {
      this.scene.restart();
      this.registry.set("displayGameRestartMessage", message);
      // Emit a custom event with the message to be passed to the Scene Class.
      // this.registry.set("displayErrorMessage", message);
    });

    // for checking whose turn it is
    socket.on("updateTurnIndicator", (data) => {
      if (this.gameStateOver || this.gameStateWon) return;

      this.currentPlayerSocketId = data.currentPlayerSocketId;
      this.currentPlayerTurn = data.currentPlayerTurn || this.currentPlayerTurn;
      const timerWidgetKey =
        this.currentPlayerTurn === "Player2" ? "player2" : "player1";
      const isLocalTurn = data.currentPlayerSocketId === this.socket.id;

      this.startTimer(timerWidgetKey, isLocalTurn);

      if (
        this.currentPlayerSocketId === this.socket.id &&
        !messageShownForPlayer
      ) {
        this.displayWelcomeMessage(this, "Please start first!", 500, 2000);
        this.count++;
      }
      messageShownForPlayer = true;


      if (data.currentPlayerSocketId !== this.socket.id) {

        // Hide and delete all existing highlighters
        this.highlighters.forEach((highlighter) => {
          highlighter.setVisible(false);
        });
        return;
      } else {

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

      if (this.gameStateOver || this.gameStateWon) return;

      if (data.currentPlayerSocketId === this.socket.id && this.count === 0)
        this.displayMessage(this, data.message, 500, 2000);
      else this.count = 0;
    });

    // for getting the players from the server
    socket.on("playersUpdated", (players) => {
      if (players && players.playerNamesBySocketId) {
        this.applyOnlineMatchData(players);
        return;
      }

      this.playerSocketIds = players;
    });

    // for displaying a game over message
    socket.on("displayGameOverMessage", (data) => {
      this.gameOver(data && data.message);
    });

    socket.on("displayGameWonMessage", (data) => {
      this.gameWon(data && data.winnerSocketId);
    });

    socket.on("match:opponentLeft", (data) => {
      const message = (data && data.message) || "Opponent left the game.";
      this.gameOver(message);
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("rooks:main-menu", {
            detail: { notifyOpponent: false },
          })
        );
      }, 1800);
    });
  }

  // for creating the rook
  createRook() {
    // Calculate the size of the grid square (assuming an 8x8 grid)
    this.gridSize = this.getGridSize();


    const rookTarget = this.boardPositionToGrid(
      this.rookPositionX,
      this.rookPositionY
    );

    // Adjust the position to center the rook on the grid square
    this.rook = this.add.image(
      rookTarget.x,
      rookTarget.y,
      "rook"
    );

    // Set the origin to the center of the image if needed
    this.rook.setOrigin(0.5, 0.5);
    this.scaleRookToGrid();
  }

  scaleRookToGrid() {
    // Calculate the scale factor to fit the rook inside the grid
    const scaleFactor =
      (this.getGridSize() * 0.68) / Math.max(this.rook.width, this.rook.height);

    // Apply the scale factor to the rook
    this.rook.setScale(scaleFactor);
  }

  getGridSize() {
    return this.chessboard.width / 8;
  }

  getBoardTopLeft() {
    return {
      x: this.chessboard.x - this.chessboard.width / 2,
      y: this.chessboard.y - this.chessboard.height / 2,
    };
  }

  boardPositionToGrid(col, row) {
    const boardTopLeft = this.getBoardTopLeft();
    const gridSize = this.getGridSize();
    return {
      x: boardTopLeft.x + (col - 0.5) * gridSize,
      y: boardTopLeft.y + (row - 0.5) * gridSize,
    };
  }

  /**
   * Converts a realtime move payload into local board pixel coordinates.
   */
  getMoveTargetFromPayload(payload) {
    if (!payload) return null;

    const hasBoardPosition =
      Number.isInteger(payload.col) &&
      Number.isInteger(payload.row) &&
      payload.col >= 1 &&
      payload.col <= 8 &&
      payload.row >= 1 &&
      payload.row <= 8;

    if (hasBoardPosition) {
      return this.boardPositionToGrid(payload.col, payload.row);
    }

    if (Number.isFinite(payload.x) && Number.isFinite(payload.y)) {
      return { x: payload.x, y: payload.y };
    }

    return null;
  }

  /**
   * Builds a resolution-independent realtime move payload.
   */
  createMovePayload(col, row) {
    return { col, row };
  }

  gridToBoardPosition(gridX, gridY) {
    const boardTopLeft = this.getBoardTopLeft();
    const gridSize = this.getGridSize();
    return {
      col: Phaser.Math.Clamp(
        Math.floor((gridX - boardTopLeft.x) / gridSize) + 1,
        1,
        8
      ),
      row: Phaser.Math.Clamp(
        Math.floor((gridY - boardTopLeft.y) / gridSize) + 1,
        1,
        8
      ),
    };
  }

  clearHighlighters() {
    this.highlighters.forEach((highlighter) => {
      highlighter.destroy();
    });
    this.highlighters = [];
    this.highlighterPointerHandler = null;
  }

  formatHudMessage(message) {
    if (!message) return "";
    return message.replace(/\s+/g, " ").trim().toUpperCase();
  }

  drawStatusBadge(alpha = 1) {
    if (!this.statusBadge || !this.statusAccent || !this.statusText) return;

    const textWidth = Math.max(112, this.statusText.width || 0);
    const textHeight = Math.max(22, this.statusText.height || 0);
    const width = Math.min(this.width - this.boardPadding * 2, textWidth + 58);
    const height = textHeight + 22;
    const x = this.statusText.x - width / 2;
    const y = this.statusText.y - height / 2;
    const radius = Math.min(8, height / 2);
    const safeAlpha = Phaser.Math.Clamp(alpha, 0, 1);

    this.statusBadge.clear();
    this.statusBadge.setAlpha(safeAlpha);
    this.statusBadge.fillStyle(0x05070b, 0.78);
    this.statusBadge.fillRoundedRect(x + 4, y + 5, width, height, radius);
    this.statusBadge.fillStyle(0x070a10, 0.94);
    this.statusBadge.fillRoundedRect(x, y, width, height, radius);
    this.statusBadge.lineStyle(2, 0x253142, 1);
    this.statusBadge.strokeRoundedRect(x, y, width, height, radius);
    this.statusBadge.lineStyle(1, 0x20df6f, 0.42);
    this.statusBadge.lineBetween(x + 18, y + 5, x + width - 18, y + 5);
    this.statusBadge.lineStyle(1, 0xf0b35a, 0.38);
    this.statusBadge.lineBetween(x + 18, y + height - 5, x + width - 18, y + height - 5);

    this.statusAccent.clear();
    this.statusAccent.setAlpha(safeAlpha);
    this.statusAccent.fillStyle(0x20df6f, 1);
    this.statusAccent.fillCircle(x + 17, this.statusText.y, 5);
    this.statusAccent.lineStyle(2, 0x20df6f, 0.34);
    this.statusAccent.strokeCircle(x + 17, this.statusText.y, 9);
    this.statusAccent.lineStyle(2, 0xf0b35a, 0.9);
    this.statusAccent.lineBetween(x + width - 18, y + 10, x + width - 10, this.statusText.y);
    this.statusAccent.lineBetween(x + width - 10, this.statusText.y, x + width - 18, y + height - 10);
  }

  setStatusNotificationAlpha(alpha) {
    if (this.statusText) this.statusText.setAlpha(alpha);
    this.drawStatusBadge(alpha);
  }

  hideStatusNotification() {
    if (this.statusHideTimer) {
      this.statusHideTimer.remove(false);
      this.statusHideTimer = null;
    }

    this.tweens.killTweensOf(this.statusText);
    this.setStatusNotificationAlpha(0);
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
    if (!this.statusText) return;

    if (this.statusHideTimer) {
      this.statusHideTimer.remove(false);
      this.statusHideTimer = null;
    }

    this.statusText.setText(this.formatHudMessage(message));
    this.positionStatusText();
    this.fitTextToWidth(
      this.statusText,
      this.getReadableTextWidth(520) - 58,
      Math.max(12, Math.min(size, 17)),
      11
    );
    this.drawStatusBadge(0);
    this.setStatusNotificationAlpha(0);

    scene.tweens.killTweensOf(this.statusText);
    scene.tweens.add({
      targets: this.statusText,
      alpha: 1,
      duration: Math.min(inRate, 250),
      ease: "Power2",
      onUpdate: () => this.drawStatusBadge(this.statusText.alpha),
      onComplete: () => {
        this.drawStatusBadge(1);
        this.statusHideTimer = scene.time.delayedCall(stayDuration + 900, () => {
          scene.tweens.add({
            targets: this.statusText,
            alpha: 0,
            duration: Math.min(outRate, 450),
            ease: "Power2",
            onUpdate: () => this.drawStatusBadge(this.statusText.alpha),
            onComplete: () => this.drawStatusBadge(0),
          });
        });
      },
    });
  }

  // just for a welcome message
  displayWelcomeMessage(scene, message, inRate, outRate, stayDuration = 500) {
    // Create the text object
    if (this.messageShownForPlayer) return;
    this.displayMessage(scene, message, inRate, outRate, 22, stayDuration);
    this.messageShownForPlayer = true;
  }

  createEndMessage(message) {
    if (!this.endMessageFrame) {
      this.endMessageFrame = this.add.graphics();
      this.endMessageFrame.setDepth(17);
    }

    if (!this.endMessageAccent) {
      this.endMessageAccent = this.add.graphics();
      this.endMessageAccent.setDepth(18);
    }

    const text = this.add.text(this.width / 2, this.height / 2, this.formatHudMessage(message), {
      fontFamily: "Arial",
      fontSize: this.getResponsiveFontSize(30, 18),
      color: "#f5f7fb",
      fontWeight: "900",
      align: "center",
      wordWrap: { width: this.getReadableTextWidth(520) },
      lineSpacing: 7,
    });

    text.setOrigin(0.5);
    text.setDepth(19);
    this.layoutEndMessage(text);
    return text;
  }

  layoutEndMessage(text) {
    if (!text) return;

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const maxWidth = this.getReadableTextWidth(500);
    const maxFont = this.getResponsiveFontSize(30, 18);
    const minFont = this.width < 420 ? 15 : 17;

    text.setOrigin(0.5);
    text.setPosition(centerX, centerY);
    this.fitTextToWidth(text, maxWidth, maxFont, minFont);
    text.setPosition(centerX, centerY);
    this.drawEndMessageFrame(text);
  }

  drawEndMessageFrame(text) {
    if (!this.endMessageFrame || !this.endMessageAccent || !text || !text.visible) return;

    const frameWidth = Math.min(
      this.width - this.boardPadding * 2,
      Math.max(240, text.width + 72)
    );
    const frameHeight = Math.max(82, text.height + 48);
    const x = this.width / 2 - frameWidth / 2;
    const y = this.height / 2 - frameHeight / 2;
    const radius = 10;

    this.endMessageFrame.clear();
    this.endMessageFrame.setVisible(true);
    this.endMessageFrame.fillStyle(0x020407, 0.58);
    this.endMessageFrame.fillRoundedRect(x + 8, y + 10, frameWidth, frameHeight, radius);
    this.endMessageFrame.fillStyle(0x070a10, 0.96);
    this.endMessageFrame.fillRoundedRect(x, y, frameWidth, frameHeight, radius);
    this.endMessageFrame.lineStyle(2, 0x253142, 1);
    this.endMessageFrame.strokeRoundedRect(x, y, frameWidth, frameHeight, radius);
    this.endMessageFrame.lineStyle(1, 0x20df6f, 0.48);
    this.endMessageFrame.lineBetween(x + 22, y + 7, x + frameWidth - 22, y + 7);
    this.endMessageFrame.lineStyle(1, 0xf0b35a, 0.46);
    this.endMessageFrame.lineBetween(x + 22, y + frameHeight - 7, x + frameWidth - 22, y + frameHeight - 7);

    this.endMessageAccent.clear();
    this.endMessageAccent.setVisible(true);
    this.endMessageAccent.fillStyle(0x20df6f, 1);
    this.endMessageAccent.fillCircle(x + 22, this.height / 2, 6);
    this.endMessageAccent.lineStyle(2, 0x20df6f, 0.32);
    this.endMessageAccent.strokeCircle(x + 22, this.height / 2, 12);
    this.endMessageAccent.lineStyle(3, 0xf0b35a, 0.9);
    this.endMessageAccent.lineBetween(x + frameWidth - 24, y + 18, x + frameWidth - 12, this.height / 2);
    this.endMessageAccent.lineBetween(x + frameWidth - 12, this.height / 2, x + frameWidth - 24, y + frameHeight - 18);
  }

  // for using during a game over state
  gameOver(message = "Time's up! Game over.") {
    if (this.gameStateOver) return;

    this.gameStateOver = true;
    this.gameStateWon = false;
    this.isAiThinking = false;
    this.completeActiveWidgetCountdown();
    if (this.aiThinkTimer) {
      clearTimeout(this.aiThinkTimer);
      this.aiThinkTimer = null;
    }
    this.stopAndResetTimer(false);
    this.stopAiThinkingIndicator();

    this.gameOverMessage = this.createEndMessage(message);

    if (this.gameOverMessage) {
      this.gameOverMessage.setVisible(true); // Initially hide the victory message
      this.disableGameElements();
      this.showEndActions();
    }
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
    this.stopAndResetTimer(false);
    this.stopAiThinkingIndicator();

    // Disable interaction for the chessboard
    if (this.chessboard && this.chessboard.disableInteractive) {
      this.chessboard.disableInteractive();
    }

    // Clear all existing highlighters
    this.clearHighlighters();

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
    if (this.gameStateOver) return;

    this.gameStateWon = true;
    this.gameStateOver = true;
    this.isAiThinking = false;
    if (this.aiThinkTimer) {
      clearTimeout(this.aiThinkTimer);
      this.aiThinkTimer = null;
    }
    this.stopAndResetTimer(false);
    this.stopAiThinkingIndicator();

    if (this.isAiGame()) {
      const message =
        currentPlayerSocketID === this.humanPlayerId
          ? "You Won!"
          : "AI wins! You lose!";

      this.victoryMessage = this.createEndMessage(message);

      this.victoryMessage.setVisible(true);
      this.displayRefreshMessage("Choose Restart or Main Menu below.");
      this.showEndActions();
      return;
    }

    const winningPlayerName = this.getPlayerNameBySocketId(
      currentPlayerSocketID
    );

    if (this.currentPlayerSocketId !== this.socket.id) {
      this.victoryMessage = this.createEndMessage(`${winningPlayerName} wins! You lose!`);
    }
    if (this.currentPlayerSocketId === this.socket.id) {
      this.victoryMessage = this.createEndMessage("You Won!");
    }

    // Check if this.victoryMessage is defined before setting its visibility
    if (this.victoryMessage) {
      this.victoryMessage.setVisible(true);
    }
    this.displayRefreshMessage("Choose Restart or Main Menu below.");
    this.showEndActions();
  }

  showEndActions() {
    if (this.endActions) this.destroyEndActions();

    const widget = this.playerWidgets.player1;
    const buttonGap = this.width < 420 ? 10 : 14;
    const restartWidth = this.getEndButtonWidth("Restart");
    const menuWidth = this.getEndButtonWidth("Main Menu");
    const totalWidth = restartWidth + menuWidth + buttonGap;
    const preferredY = widget
      ? widget.y + widget.size / 2 + 42
      : this.boardCenterY + this.boardDisplaySize / 2 + 104;
    const y = Math.min(this.height - 28, preferredY);
    const restart = this.createEndButton(this.width / 2 - totalWidth / 2 + restartWidth / 2, y, "Restart", () => {
      window.dispatchEvent(
        new CustomEvent("rooks:restart-game", {
          detail: { mode: this.gameMode },
        })
      );
    });
    const menu = this.createEndButton(this.width / 2 + totalWidth / 2 - menuWidth / 2, y, "Main Menu", () => {
      window.dispatchEvent(new CustomEvent("rooks:main-menu"));
    });

    this.endActions = [...restart, ...menu];
  }

  getEndButtonWidth(text) {
    const base = text === "Main Menu" ? 118 : 104;
    return Math.max(this.width < 420 ? 88 : 100, Math.min(base, this.width * 0.32));
  }

  createEndButton(x, y, text, onClick) {
    const width = this.getEndButtonWidth(text);
    const height = this.width < 420 ? 34 : 38;
    const bg = this.add.graphics();
    bg.fillStyle(0xf0b35a, 1);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    bg.lineStyle(2, 0xffd184, 1);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 8);

    const label = this.add.text(x, y, text, {
      fontFamily: "Arial",
      fontSize: this.width < 420 ? 13 : 15,
      color: "#160f08",
      fontWeight: "900",
    });
    label.setOrigin(0.5);

    const hitArea = this.add.zone(x, y, width, height);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", onClick);

    return [bg, label, hitArea];
  }

  destroyEndActions() {
    if (!this.endActions) return;
    this.endActions.forEach((item) => item.destroy());
    this.endActions = null;
  }

  displayRefreshMessage(message) {
    this.displayMessage(this, message, 250, 600, 18, 5000);
  }

  // for getting player name based on socket ID
  getPlayerNameBySocketId(socketId) {
    // Reverse the key-value pairs
    const playerLookup = this.reverseObject(this.playerSocketIds);
    // Iterate over the keys (player names) in the playerSocketIds object
    for (const playerName in playerLookup) {
      // Check if the current key's value (socket ID) matches the given socket ID
      if (playerLookup[playerName] === socketId) {
        // If a match is found, return the corresponding player name
        return playerName;
      }
    }
    // If no match is found, return a default value or handle the case as needed
    return "Unknown Player";
  }

  // for resetting the game
  resetGame() {
    // Reset the timer
    this.countdownValue = this.timerDuration; // Reset the countdown value

    // Hide any visible messages
    if (this.victoryMessage) {
      this.victoryMessage.setVisible(false);
    }
    if (this.gameOverMessage) {
      this.gameOverMessage.setVisible(false);
    }
    if (this.endMessageFrame) this.endMessageFrame.setVisible(false);
    if (this.endMessageAccent) this.endMessageAccent.setVisible(false);

    // Reset the rook's position
    // Assuming the initial position is at the top-right of the chessboard
    const topRight = this.boardPositionToGrid(this.rookPositionX, this.rookPositionY);
    this.rook.setPosition(topRight.x, topRight.y);
    this.rookPositionX = 8;
    this.rookPositionY = 1;

    // Clear all existing highlighters
    this.clearHighlighters();

    // Reset game state
    this.initDefault();
    this.scene.restart();
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
    if (this.highlighterPointerHandler) {
      scene.input.off("pointerdown", this.highlighterPointerHandler);
    }

    this.highlighterPointerHandler = (pointer) => {
      // Get the x and y coordinates of the pointer when clicked
      const clickX = pointer.x;
      const clickY = pointer.y;


      const activeHighlighters = this.highlighters || highlighters || [];

      // Iterate over each highlighter to check if the click coordinates are within its bounds
      for (let i = 0; i < activeHighlighters.length; i++) {
        const highlighter = activeHighlighters[i];
        if (!highlighter || !highlighter.isVisible) continue;

        // Get the position and dimensions of the highlighter
        const highlighterX = highlighter.centerX;
        const highlighterY = highlighter.centerY;
        const hitGridSize = highlighter.gridSize || gridSize;
        const highlighterWidth = highlighter.width || hitGridSize;
        const highlighterHeight = highlighter.height || hitGridSize;

        // Check if the click coordinates are within the bounds of the highlighter
        if (
          clickX >= highlighterX - hitGridSize / 2 &&
          clickX <= highlighterX + highlighterWidth / 2 &&
          clickY >= highlighterY - hitGridSize / 2 &&
          clickY <= highlighterY + highlighterHeight / 2
        ) {
          // Highlighter clicked, return it


          // Highlighter clicked, call the callback function with its coordinates
          callback({
            x: highlighterX,
            y: highlighterY,
          });
          return; // Exit the loop since we found the clicked highlighter
        }
      }

      // No highlighter clicked

      return null;
    };

    // Add a pointerdown event listener to the scene
    scene.input.on("pointerdown", this.highlighterPointerHandler);
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

      if (!this.isHumanTurn()) {
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
    if (this.gameStateOver || this.gameStateWon) return;

    // Calculate the actual position of the grid based on its coordinates
    const targetX = gridX;
    const targetY = gridY;

    // Calculate the new position of the rook based on the grid size
    const boardPosition = this.gridToBoardPosition(gridX, gridY);
    rookPositionX = boardPosition.col;
    rookPositionY = boardPosition.row;

    // Hide and delete all existing highlighters
    this.clearHighlighters();

    // Animate the rook's movement to the target position
    scene.tweens.add({
      targets: rook,
      x: targetX,
      y: targetY,
      duration: 500, // Animation duration in milliseconds
      ease: "Power2", // Easing function for smooth movement
      onComplete: () => {
        if (this.gameStateOver || this.gameStateWon) return;

        // Callback function to execute after the animation completes

        this.rookPositionX = rookPositionX;
        this.rookPositionY = rookPositionY;

        if (this.checkWinCondition(rookPositionX, rookPositionY)) {
          if (!isServerMove && !this.isAiGame() && socket) {
            socket.emit("rookMoved", this.createMovePayload(rookPositionX, rookPositionY));
            socket.emit("gameWon", {
              winnerSocketId: this.currentPlayerSocketId || this.socket.id,
            });
          }

          this.gameWon(this.currentPlayerSocketId);
          return;
        }

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

        if (!isServerMove && this.isAiGame()) {
          this.requestAiMove({
            col: rookPositionX,
            row: rookPositionY,
          });
          return;
        }

        // Emit the rook's move to the server
        if (!isServerMove && socket) {
          socket.emit("rookMoved", this.createMovePayload(rookPositionX, rookPositionY));
          socket.emit("playerMoveCompleted", {
            playerSocketId: this.socket.id,
          });
        }

        if (this.isAiGame() && isServerMove) {
          this.finishAiMove();
        }
      },
    });
  }

  async requestAiMove(position) {
    if (this.gameStateOver || this.gameStateWon) return;

    this.isAiThinking = true;
    this.currentPlayerSocketId = this.aiPlayerId;
    this.stopAndResetTimer();
    this.highlighters.forEach((highlighter) => highlighter.setVisible(false));
    const thinkDelayMs = Phaser.Math.Between(150, 1000);
    this.showAiThinkingIndicator();
    this.startTimer("player2", false);

    try {
      await new Promise((resolve) => {
        this.aiThinkTimer = setTimeout(resolve, thinkDelayMs);
      });
      this.aiThinkTimer = null;

      if (this.gameStateOver || this.gameStateWon) {
        this.isAiThinking = false;
        this.stopAiThinkingIndicator();
        return;
      }

      const response = await apiFetch("/api/ai/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ position }),
      });

      const data = await response.json().catch(() => ({}));
      if (this.gameStateOver || this.gameStateWon) {
        this.isAiThinking = false;
        this.stopAiThinkingIndicator();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "AI move failed.");
      }

      const target = this.boardPositionToGrid(data.move.col, data.move.row);
      this.moveRookToGrid(
        this,
        this.rook,
        target.x,
        target.y,
        this.chessboard,
        this.gridSize,
        this.rookPositionX,
        this.rookPositionY,
        null,
        true
      );
    } catch (error) {
      if (this.gameStateOver || this.gameStateWon) {
        this.isAiThinking = false;
        this.stopAiThinkingIndicator();
        return;
      }

      this.isAiThinking = false;
      this.stopAiThinkingIndicator();
      this.currentPlayerSocketId = this.humanPlayerId;
      this.startTimer("player1", true);
      this.displayMessage(this, error.message, 500, 2000, 18);
      this.handleHighlighterClick(
        this,
        this.rook,
        this.chessboard,
        this.gridSize,
        this.highlighters,
        null,
        this.currentPlayerSocketId
      );
    }
  }

  finishAiMove() {
    if (this.gameStateOver || this.gameStateWon) {
      this.isAiThinking = false;
      this.stopAiThinkingIndicator();
      return;
    }

    this.isAiThinking = false;
    this.stopAiThinkingIndicator();
    this.currentPlayerSocketId = this.humanPlayerId;
    this.displayMessage(this, "Your Turn", 500, 1300, 22);
    this.startTimer("player1", true);
    this.handleHighlighterClick(
      this,
      this.rook,
      this.chessboard,
      this.gridSize,
      this.highlighters,
      null,
      this.currentPlayerSocketId
    );
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
    gridSize = this.getGridSize();

    // col-wise highlighters
    // Calculate the center position of the first grid square
    const colCenter = this.boardPositionToGrid(rookPositionX, rookPositionY);

    for (let i = 0; i <= rookPositionX - 2; i++) {
      // Calculate the X position for each highlight
      const center = this.boardPositionToGrid(i + 1, rookPositionY);

      // Create a new instance of Highlighter for each row highlighter
      let colhighlighter = new Highlighter(
        scene,
        chessboard,
        gridSize,
        center.x,
        colCenter.y
      );
      this.highlighters.push(colhighlighter);
    }

    // row-wise highlighters
    const rowCenter = this.boardPositionToGrid(rookPositionX, rookPositionY);

    for (let i = 0; i <= noOfHighlighters - rookPositionY; i++) {
      // Calculate the Y position for each highlight
      const center = this.boardPositionToGrid(rookPositionX, i + rookPositionY + 1);

      // Create a new instance of Highlighter for each row highlighter
      let rowhighlighter = new Highlighter(
        scene,
        chessboard,
        gridSize,
        rowCenter.x,
        center.y
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
    this.isVisible = true;
    this.pulseTime = 0;
    this.pulseDuration = 1200;

    // Create a Graphics object to draw the highlighter
    this.graphics = this.scene.add.graphics();

    // Set initial properties for the highlighter
    this.size = this.gridSize * 0.72;
    this.width = this.gridSize;
    this.height = this.gridSize;
    this.minSize = this.gridSize * 0.62;
    this.maxSize = this.size;
    this.cornerRadius = Math.max(5, this.gridSize * 0.08);

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
    this.isVisible = visible;
    if (this.graphics && this.graphics.active) this.graphics.setVisible(visible);
  }

  // Method to draw the borders of the highlighter
  drawBorders() {
    if (!this.graphics || !this.graphics.active) return;
    this.graphics.clear(); // Clear previous drawings
    this.graphics.lineStyle(Math.max(1, this.gridSize * 0.025), 0xd3d3d3, 1); // Set line style
    this.graphics.strokeRoundedRect(
      this.centerX - this.size / 2,
      this.centerY - this.size / 2,
      this.size,
      this.size,
      this.cornerRadius
    ); // Draw the rectangle
  }

  // Method to update the size of the highlighter
  update(time, delta = 16.67) {
    if (!this.graphics || !this.graphics.active) return;
    if (!this.isVisible) return;

    this.pulseTime = (this.pulseTime + delta) % this.pulseDuration;
    const phase = this.pulseTime / this.pulseDuration;
    const eased = 0.5 - Math.cos(phase * Math.PI * 2) / 2;
    this.size = this.minSize + (this.maxSize - this.minSize) * eased;

    // Redraw the highlighter with the updated size
    this.drawBorders();
  }

  destroy() {
    this.scene.events.off("update", this.update, this);
    if (this.graphics) this.graphics.destroy();
  }
}

// the Game configuration
const config = {
  type: Phaser.AUTO,
  scale: {
    parent: "game",
    width: window.innerWidth,
    height: window.innerHeight,
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MyGame],
};

// Create a new Phaser game instance
let game = null;

/**
 * Creates the singleton Phaser game instance for the selected play mode.
 */
export function createGame(options = {}) {
  gameOptions = {
    mode: options.mode || "online",
    user: options.user || null,
    match: options.match || null,
  };

  if (game) return;
  game = new Phaser.Game(config);
}

/**
 * Destroys the active Phaser game and clears its container.
 */
export function destroyGame() {
  if (!game) return;
  game.destroy(true);
  game = null;

  const gameContainer = document.getElementById("game");
  if (gameContainer) gameContainer.innerHTML = "";
}
