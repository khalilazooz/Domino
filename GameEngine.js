class DominoGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error("Canvas element not found");
        }
        this.ctx = this.canvas.getContext("2d");
        
        // Initialize game board
        this.createGameBoard();
        this.initGame();
        
        // Bind event handlers
        this.canvas.addEventListener('click', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMotion.bind(this));
        
        // Start game loop
        this.gameLoopInterval = null;
    }

    // ------------------------------
    // Initialization / setup
    // ------------------------------
    initGame() {
        this.gameType = "Local";
        this.turn = 0;
        this.gamePlayersCount = 0;
        this.botsCount = 0;
        this.outCount = 0;
        this.playersCount = [0, 0, 0];
        this.landCards = [];
        this.outCards = [];
        this.pendingMove = false;
        this.pendingCard = null;
        this.lock = false;
        this.noPlayCount = 0;
        
        // Derived attributes
        this.gameCards = [];
        this.myDeck = [];
        this.listOfBotsDecks = [];
        this.lastPlayedPosition = null;
        this.textMessage = null;
        this.textStartTime = null;
        this.hoveredCard = null;
    }

    createGameBoard() {
        this.boardWidth = domino.DOMINOWIDTH * 16;
        this.boardHeight = domino.DOMINOWIDTH * 8;
        this.boardColor = "#006400"; // Dark green
        
        this.canvas.width = this.boardWidth;
        this.canvas.height = this.boardHeight;
        this.canvas.style.backgroundColor = this.boardColor;
    }

    // ------------------------------
    // Player / deck helpers
    // ------------------------------
    setGamePlayerCount(count) {
        if (count <= 1 || count > 4) {
            throw new Error("Invalid Players Number");
        }

        // Remove double-0 card if 3-player game
        if (count === 3 && this.gameCards.length > 0) {
            this.gameCards = this.gameCards.filter(card => 
                !(card.value[0] === 0 && card.value[1] === 0)
            );
        }

        this.gamePlayersCount = count;

        // Set players_count for first (count-1) positions
        const initial = this.getInitialDeckCount();
        for (let i = 0; i < count - 1; i++) {
            this.playersCount[i] = initial;
        }

        if (count === 2) {
            this.outCount = 14;
        }

        return this;
    }

    prepareCardDeck() {
        this.gameCards = [];
        for (let left = 0; left < 7; left++) {
            for (let right = left; right < 7; right++) {
                this.gameCards.push(new domino(left, right, this.canvas));
            }
        }
        // Shuffle
        for (let i = this.gameCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.gameCards[i], this.gameCards[j]] = [this.gameCards[j], this.gameCards[i]];
        }
        return this;
    }

    prepareDeck() {
        if (this.gameCards.length === 0) {
            throw new Error("Should Prepare Card Deck First");
        }
        if (this.gamePlayersCount === 0) {
            throw new Error("Should Set Game Players Count First");
        }

        const n = this.getInitialDeckCount();
        const deck = this.gameCards.slice(0, n);
        this.gameCards = this.gameCards.slice(n);
        return deck;
    }

    getMyDeck(deckList) {
        this.myDeck = [];
        let bufCount = 0;
        
        if (deckList === null) {
            this.myDeck = this.prepareDeck();
            bufCount = this.myDeck.filter(card => card.isBuf).length;
        } else {
            for (const value of deckList) {
                const card = new domino(value[0], value[1], this.canvas);
                this.myDeck.push(card);
                bufCount += card.isBuf ? 1 : 0;
            }
        }
        return bufCount;
    }

    setGameTurn(turn) {
        this.turn = turn;
        return this;
    }

    getInitialDeckCount() {
        if (this.gamePlayersCount === 0) {
            throw new Error("Should Set Game Players Count First");
        }
        if (this.gamePlayersCount === 2) return 7;
        if (this.gamePlayersCount === 3) return 9;
        if (this.gamePlayersCount === 4) return 7;
    }

    prepareOutDeck() {
        if (this.gamePlayersCount !== 2) {
            throw new Error("Should Set Game Players Count First And Should Be 2");
        }
        this.outCards = this.gameCards.slice(0, 14);
        this.gameCards = this.gameCards.slice(14);
        return this;
    }

    prepareToPlayLocal() {
        if (this.gamePlayersCount === 0) {
            throw new Error("Should Set Game Players Count First");
        }

        let maxBufCount = 0;
        this.setGameTurn(0);
        this.botsCount = this.gamePlayersCount - 1;
        this.listOfBotsDecks = [];

        for (let i = 0; i < this.botsCount; i++) {
            const deck = this.prepareDeck();
            this.listOfBotsDecks.push(deck);
            const bufCount = deck.filter(card => card.isBuf).length;
            if (bufCount > maxBufCount) {
                maxBufCount = bufCount;
            }
        }

        return maxBufCount;
    }

    // ------------------------------
    // Board update / rendering
    // ------------------------------
    updateLand(showCards = false) {
        if (!this.canvas) {
            throw new Error("Should Create Board Game First");
        }
        if (this.gamePlayersCount === 0) {
            throw new Error("Should Set Game Players Count First");
        }
        if (this.gameCards.length > 0) {
            throw new Error("Should Distribute Game Cards first");
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.boardWidth, this.boardHeight);

        // Draw player's hand centered at bottom
        const myDeckLen = this.myDeck.length;
        const startX = (this.boardWidth / 2) - ((myDeckLen / 2) * domino.DOMINOHIGHT);
        
        for (let i = 0; i < myDeckLen; i++) {
            const card = this.myDeck[i];
            const x = startX + i * (domino.DOMINOHIGHT + 2);
            const y = this.boardHeight - domino.DOMINOWIDTH - 15;
            card.setCoordinates(x, y).setVirtical().build();
            
            // Highlight hovered card
            if (this.hoveredCard === card) {
                this.ctx.strokeStyle = "blue";
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, y, domino.DOMINOHIGHT, domino.DOMINOWIDTH);
            }
        }

        // Helper to draw placeholders
        const drawPlaceholders = (count, xFunc, yFunc, vertical = true, deck = null) => {
            for (let i = 0; i < count; i++) {
                let valA = null, valB = null;
                if (deck !== null) {
                    valA = deck[i].value[0];
                    valB = deck[i].value[1];
                }
                const x = xFunc(i);
                const y = yFunc(i);
                const c = new domino(valA, valB, this.canvas);
                if (vertical) {
                    c.setCoordinates(x, y).setVirtical().build();
                } else {
                    c.setCoordinates(x, y).setHorizontal().build();
                }
            }
        };

        // Place opponents / out list depending on number of players
        if (this.gamePlayersCount === 2) {
            const topCount = this.playersCount[0];
            const xTop = i => (this.boardWidth / 2) - ((topCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            const yTop = i => 15;
            
            if (!showCards) {
                drawPlaceholders(topCount, xTop, yTop, true);
            } else {
                drawPlaceholders(topCount, xTop, yTop, true, this.listOfBotsDecks[0]);
            }

            // Out list on left column
            const outX = i => 15;
            const outY = i => (this.boardHeight / 2) - ((this.outCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            for (let i = 0; i < this.outCount; i++) {
                new domino(null, null, this.canvas).setCoordinates(outX(i), outY(i)).setHorizontal().build();
            }
        } else if (this.gamePlayersCount === 3) {
            const leftCount = this.playersCount[0];
            const rightCount = this.playersCount[1];
            
            const leftX = i => 15;
            const leftY = i => (this.boardHeight / 2) - ((leftCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            const rightX = i => (this.boardWidth - domino.DOMINOWIDTH - 15);
            const rightY = i => (this.boardHeight / 2) - ((rightCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            
            if (!showCards) {
                drawPlaceholders(leftCount, leftX, leftY, false);
                drawPlaceholders(rightCount, rightX, rightY, false);
            } else {
                drawPlaceholders(leftCount, leftX, leftY, false, this.listOfBotsDecks[0]);
                drawPlaceholders(rightCount, rightX, rightY, false, this.listOfBotsDecks[1]);
            }
        } else if (this.gamePlayersCount === 4) {
            const topCount = this.playersCount[0];
            const leftCount = this.playersCount[1];
            const rightCount = this.playersCount[2];
            
            const xTop = i => (this.boardWidth / 2) - ((topCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            const yTop = i => 15;
            const leftX = i => 15;
            const leftY = i => (this.boardHeight / 2) - ((leftCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            const rightX = i => (this.boardWidth - domino.DOMINOWIDTH - 15);
            const rightY = i => (this.boardHeight / 2) - ((rightCount / 2) * domino.DOMINOHIGHT) + i * (domino.DOMINOHIGHT + 2);
            
            if (!showCards) {
                drawPlaceholders(topCount, xTop, yTop, true);
                drawPlaceholders(leftCount, leftX, leftY, false);
                drawPlaceholders(rightCount, rightX, rightY, false);
            } else {
                drawPlaceholders(topCount, xTop, yTop, true, this.listOfBotsDecks[0]);
                drawPlaceholders(leftCount, leftX, leftY, false, this.listOfBotsDecks[1]);
                drawPlaceholders(rightCount, rightX, rightY, false, this.listOfBotsDecks[2]);
            }
        }

        // Layout land cards (middle)
        const maxWidth = this.landCards.length;
        let alignX = ((this.boardWidth / 2) - (Math.min(maxWidth, 10) * domino.DOMINOWIDTH) / 2);
        let alignY = (this.boardHeight / 5);

        for (let i = 0; i < this.landCards.length; i++) {
            const card = this.landCards[i];
            
            // Mark last played flags
            if ((i === (maxWidth - 1) && this.lastPlayedPosition === -1) || 
                (i === 0 && this.lastPlayedPosition === 0)) {
                card.isLastPlayed = true;
            } else {
                card.isLastPlayed = false;
            }

            // Positions and orientation
            if (i < 11) {
                card.setCoordinates(alignX, alignY).resetPosition().build();
                alignX += card.isBuf ? domino.DOMINOHIGHT + 2 : domino.DOMINOWIDTH + 2;
            } else if (i >= 11 && i < 15) {
                if (!card.isBuf) {
                    card.setCoordinates(alignX, alignY).resetPosition().setVirtical().build();
                    alignY += domino.DOMINOWIDTH + 2;
                } else {
                    card.setCoordinates(alignX, alignY).resetPosition().setHorizontal().build();
                    alignY += domino.DOMINOHIGHT + 2;
                }
            } else if (i >= 15 && i < 25) {
                if (i === 15) {
                    alignX += domino.DOMINOHIGHT + 2;
                }
                if (!card.isBuf) {
                    alignX -= domino.DOMINOWIDTH + 2;
                } else {
                    alignX -= domino.DOMINOHIGHT + 2;
                }
                card.setCoordinates(alignX, alignY).resetPosition().flip().build();
                card.flip();
            } else { // i >= 25
                if (!card.isBuf) {
                    alignY -= domino.DOMINOWIDTH + 2;
                    card.setCoordinates(alignX, alignY).resetPosition().setVirtical().flip().build();
                } else {
                    alignY -= domino.DOMINOHIGHT + 2;
                    card.setCoordinates(alignX, alignY).resetPosition().setHorizontal().flip().build();
                }
                card.flip();
            }
        }

        // Draw text message if exists
        if (this.textMessage && this.textStartTime) {
            const elapsed = Date.now() - this.textStartTime;
            const fadeDuration = 3000; // 2 seconds
            
            if (elapsed < fadeDuration) {
                const alpha = 1 - (elapsed / fadeDuration);
                const greenValue = Math.floor(255 * alpha);
                this.ctx.fillStyle = `rgb(0, ${greenValue}, 0)`;
                this.ctx.font = "bold 40px Arial";
                this.ctx.textAlign = "center";
                this.ctx.fillText(this.textMessage, domino.DOMINOWIDTH * 10, domino.DOMINOWIDTH * 4);
            } else {
                this.textMessage = null;
                this.textStartTime = null;
            }
        }

        return this;
    }

    updatePlayersCount(playerIndex, count) {
        this.playersCount[playerIndex] = count;
        return this;
    }

    // ------------------------------
    // Selection / moves logic
    // ------------------------------
    getSelectedCard(deck, x, y) {
        for (const element of deck) {
            if (!element.isVertical) {
                if (element.x <= x && x <= (element.x + domino.DOMINOWIDTH) && 
                    element.y <= y && y <= (element.y + domino.DOMINOHIGHT)) {
                    return element;
                }
            } else {
                if (element.x <= x && x <= (element.x + domino.DOMINOHIGHT) && 
                    element.y <= y && y <= (element.y + domino.DOMINOWIDTH)) {
                    return element;
                }
            }
        }
        return null;
    }

    getLegalMoves(card) {
        if (!card) return 0;
        if (this.landCards.length === 0) return 1;
        
        let moves = 0;
        const leftValue = this.landCards[0].value[0];
        const rightValue = this.landCards[this.landCards.length - 1].value[1];
        
        if (card.value.includes(leftValue)) moves++;
        if (card.value.includes(rightValue)) moves++;
        
        return moves;
    }

    correctCardPosition(card, position) {
        let pos = 0;
        if (this.landCards.length === 0) {
            return [pos, card];
        }

        // Placing on right side (insert at 0)
        if (position === "right" || position === null) {
            if (this.landCards[0].value[0] === card.value[0]) {
                [card.value[0], card.value[1]] = [card.value[1], card.value[0]];
                pos = 0;
            } else if (this.landCards[0].value[0] === card.value[1]) {
                pos = 0;
            }
        }

        // Placing on left side (append)
        if (position === "left" || position === null) {
            if (this.landCards[this.landCards.length - 1].value[1] === card.value[1]) {
                [card.value[0], card.value[1]] = [card.value[1], card.value[0]];
                pos = -1;
            } else if (this.landCards[this.landCards.length - 1].value[1] === card.value[0]) {
                pos = -1;
            }
        }

        return [pos, card];
    }

    addCardToLand(card, position) {
        const [pos, correctedCard] = this.correctCardPosition(card, position);
        if (pos === 0) {
            this.lastPlayedPosition = 0;
            this.landCards.unshift(correctedCard);
        } else {
            this.lastPlayedPosition = -1;
            this.landCards.push(correctedCard);
        }
    }

    playMyMove(card, position) {
        this.noPlayCount = 0;
        this.addCardToLand(card, position);
        this.myDeck = this.myDeck.filter(c => c !== card);
        this.updateLand();
    }

    isOutListClicked(x, y) {
        const outListYStart = (this.boardHeight / 2) - ((this.outCount / 2) * domino.DOMINOHIGHT);
        const outListYEnd = outListYStart + this.outCards.length * (domino.DOMINOHIGHT + 2);
        const outListXStart = 15;
        const outListXEnd = 15 + domino.DOMINOWIDTH;
        
        return (outListXStart < x && x < outListXEnd) && (outListYStart < y && y < outListYEnd);
    }

    isThereAnyLegalMove(deckList) {
        return deckList.some(element => this.getLegalMoves(element) > 0);
    }

    getClickedCardPosition(x, y) {
        const card = this.getSelectedCard(this.landCards, x, y);
        if (!card) return null;
        
        if (card === this.landCards[0]) return "right";
        if (card === this.landCards[this.landCards.length - 1]) return "left";
        
        console.log(card.value);
        return null;
    }

    // ------------------------------
    // Event handlers
    // ------------------------------
    onMouseDown(event) {
        if (this.turn !== 0 || this.getGameEnded() !== null) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const card = this.getSelectedCard(this.myDeck, x, y);
        let moves = this.getLegalMoves(card);

        if (this.pendingMove) {
            this.pendingMove = false;
            moves = 0;
            const position = this.getClickedCardPosition(x, y);
            if (position) {
                this.landCards[0].isDoublePlay=false;
                this.landCards[(this.landCards.length -1)].isDoublePlay=false;
                this.playMyMove(this.pendingCard, position);
                this.turn = (this.turn + 1) % this.gamePlayersCount;
            }
            this.updateLand();
        }

        if (moves > 0) {
            if (moves === 1) {
                this.playMyMove(card, null);
                this.turn = (this.turn + 1) % this.gamePlayersCount;
            } else { // moves === 2
                this.pendingMove = true;
                this.pendingCard = card;
                // Visual feedback - highlight ends
                this.landCards[0].isDoublePlay=true;
                this.landCards[(this.landCards.length -1)].isDoublePlay=true;
                this.updateLand();
            }
        } else if (this.isOutListClicked(x, y) && this.outCards.length > 0) {
            if (!this.isThereAnyLegalMove(this.myDeck)) {
                this.myDeck.push(this.outCards.shift());
                this.outCount--;
                this.updateLand();
            }
        }
    }

    onMotion(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const card = this.getSelectedCard(this.myDeck, x, y);
        
        if (card !== this.hoveredCard) {
            this.hoveredCard = card;
            this.updateLand();
        }

        if (card) {
            this.canvas.style.cursor = "pointer";
        } else {
            this.canvas.style.cursor = "default";
        }
    }

    // ------------------------------
    // Computer player logic
    // ------------------------------
    pcPlay(turn) {
        let played = false;
        const botIndex = turn - 1;

        while (!played) {
            // Try to play any legal card
            for (const element of [...this.listOfBotsDecks[botIndex]]) {
                if (this.getLegalMoves(element) > 0) {
                    this.addCardToLand(element, null);
                    this.listOfBotsDecks[botIndex] = this.listOfBotsDecks[botIndex].filter(c => c !== element);
                    this.updatePlayersCount(botIndex, this.listOfBotsDecks[botIndex].length);
                    played = true;
                    this.noPlayCount = 0;
                    break;
                }
            }

            // If out cards exhausted, stop trying draws
            if (this.outCards.length === 0) {
                if (!played) {
                    this.noPlayCount++;
                }
                break;
            }

            // If not played, draw one from out list
            if (!played) {
                this.listOfBotsDecks[botIndex].push(this.outCards.shift());
                this.outCount--;
            }
        }

        this.turn = (this.turn + 1) % this.gamePlayersCount;
        return played;
    }

    // ------------------------------
    // Scoring, end conditions
    // ------------------------------
    getCount(deck) {
        return deck.reduce((sum, card) => sum + card.value[0] + card.value[1], 0);
    }

    showCards() {
        this.updateLand(true);
    }

    async waitForMyTurn() {
        if (this.lock) return;

        const gameEnd = this.getGameEnded();
        
        if (gameEnd === "won") {
            this.lock = true;
            let winValue = 0;
            if (this.gameType === "Local") {
                winValue = this.listOfBotsDecks.reduce((sum, deck) => sum + this.getCount(deck), 0);
            }
            this.showCards();
            await this.delay(500);
            alert(`Game End - You Won (${winValue})`);
            const count = this.gamePlayersCount;
            this.initGame();
            this.startLocalGame(count);
            return;
        }

        if (gameEnd === "lost") {
            this.lock = true;
            this.showCards();
            await this.delay(500);
            alert("Game End - You Lost");
            const count = this.gamePlayersCount;
            this.initGame();
            this.startLocalGame(count);
            return;
        }

        if (this.noPlayCount >= this.gamePlayersCount) {
            this.lock = true;
            const myCount = this.getCount(this.myDeck);
            let othersMin = myCount + 1;
            let winValue = 0;
            
            if (this.gameType === "Local") {
                winValue = this.listOfBotsDecks.reduce((sum, deck) => sum + this.getCount(deck), 0);
                const otherCounts = this.listOfBotsDecks.map(deck => this.getCount(deck));
                othersMin = Math.min(othersMin, ...otherCounts);
            }
            
            this.showCards();
            await this.delay(500);
            
            if (myCount < othersMin) {
                alert(`Game End - You Won (${winValue})`);
            } else if (myCount === othersMin) {
                alert("Game End - Draw");
            } else {
                alert("Game End - You Lost");
            }
            
            const count = this.gamePlayersCount;
            this.initGame();
            this.startLocalGame(count);
            return;
        }

        // If it's not player's turn, let bots play
        if (this.turn !== 0 && this.getGameEnded() === null) {
            if (this.gameType === "Local") {
                while (this.turn !== 0 && this.getGameEnded() === null) {
                    const turn = this.turn;
                    const played = this.pcPlay(turn);
                    
                    if (played) {
                        this.updateLand();
                    } else {
                        this.textMessage = `PLAYER ${turn + 1}: PASS`;
                        this.textStartTime = Date.now();
                        
                        // Start animation loop for smooth fade
                        const animateText = () => {
                            if (this.textMessage) {
                                this.updateLand();
                                requestAnimationFrame(animateText);
                            }
                        };
                        requestAnimationFrame(animateText);
                    }
                    await this.delay(1500);
                }
            }
            return;
        }

        // Player's turn - check if player has any legal move
        const exist = this.myDeck.some(card => this.getLegalMoves(card) > 0);
        if (!exist && this.outCards.length === 0) {
            this.noPlayCount++;
            this.turn = (this.turn + 1) % this.gamePlayersCount;
        }
    }

    getGameEnded() {
        // If any bot has 0 cards => player lost
        if (this.playersCount.slice(0, this.botsCount).some(p => p === 0)) {
            return "lost";
        }
        if (this.myDeck.length === 0) {
            return "won";
        }
        return null;
    }

    // ------------------------------
    // Start / UI helpers
    // ------------------------------
    async startLocalGame(playerCount) {
        while (true) {
            this.prepareCardDeck();
            this.setGamePlayerCount(playerCount);
            
            if (playerCount === 2) {
                this.prepareOutDeck();
            }
            
            const bufCount = this.getMyDeck(null);
            if (bufCount >= 5) {
                console.log("Have 5 or more Buffs");
                continue;
            }
            
            const botBufCount = this.prepareToPlayLocal();
            if (botBufCount >= 5) {
                console.log("Have 5 or more Buffs");
                continue;
            }
            break;
        }

        this.updateLand();
        
        // Start game loop
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
        }
        this.gameLoopInterval = setInterval(() => this.waitForMyTurn(), 2000);
    }

    async getPlayersCount() {
        let playersCount = 0;
        while (true) {
            const input = prompt("Enter Players Count (2-4):");
            try {
                playersCount = parseInt(input);
            } catch (e) {
                // Invalid input
            }

            if (playersCount >= 2 && playersCount <= 4) {
                break;
            } else {
                alert("Invalid Players Number");
            }
        }
        return playersCount;
    }

    // Utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cleanup
    destroy() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
        }
    }
}

// Auto-start when loaded
window.addEventListener('load', async () => {
    const game = new DominoGame('gameCanvas');
    const playersCount = await game.getPlayersCount();
    game.startLocalGame(playersCount);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        game.destroy();
    });
});
