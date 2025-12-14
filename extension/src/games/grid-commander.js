// ============================================
// GRID COMMANDER - Main Game Logic
// ============================================

class GridCommander {
    constructor() {
        // Game State
        this.currentLevel = 1;
        this.score = 0;
        this.lives = 3;
        this.highScore = parseInt(localStorage.getItem('gridCommanderHighScore')) || 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.gameLoop = null;
        this.enemyMoveInterval = null;
        
        // Grid State
        this.gridSize = 8;
        this.grid = [];
        this.player = { x: 0, y: 0 };
        this.enemies = [];
        this.objectives = [];
        this.obstacles = [];
        this.powerups = [];
        this.collectedObjectives = 0;
        
        // CRITICAL: Lock to prevent crazy movement
        this.lastEnemyMoveTime = 0;
        this.isMovingEnemies = false;
        
        // Power-up State
        this.activePowerup = null;
        this.powerupTimer = null;
        this.playerSpeed = 1;
        this.hasShield = false;
        this.enemiesFrozen = false;
        
        // Level Configuration
        this.levelConfig = this.generateLevelConfigs();
        
        // Timing
        this.levelStartTime = 0;
        this.baseEnemySpeed = 3000; // ms between enemy moves (3 seconds - better balance)
        
        // DOM Elements
        this.screens = {
            start: document.getElementById('start-screen'),
            howToPlay: document.getElementById('how-to-play-screen'),
            game: document.getElementById('game-screen'),
            pause: document.getElementById('pause-screen'),
            levelComplete: document.getElementById('level-complete-screen'),
            gameOver: document.getElementById('game-over-screen')
        };
        
        this.elements = {
            grid: document.getElementById('game-grid'),
            level: document.getElementById('level'),
            score: document.getElementById('score'),
            objectives: document.getElementById('objectives'),
            lives: document.getElementById('lives'),
            highScore: document.getElementById('high-score'),
            powerupStatus: document.getElementById('powerup-status'),
            timeBonus: document.getElementById('time-bonus'),
            objBonus: document.getElementById('obj-bonus'),
            levelScore: document.getElementById('level-score'),
            finalScore: document.getElementById('final-score'),
            levelsCleared: document.getElementById('levels-cleared'),
            newHighScore: document.getElementById('new-high-score')
        };
        
        this.init();
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    init() {
        this.bindEvents();
        this.updateHighScoreDisplay();
    }
    
    bindEvents() {
        // Menu buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('how-to-play-btn').addEventListener('click', () => this.showScreen('howToPlay'));
        document.getElementById('back-btn').addEventListener('click', () => this.showScreen('start'));
        
        // Game controls
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartLevel());
        document.getElementById('quit-btn').addEventListener('click', () => this.quitToMenu());
        
        // Level complete / Game over
        document.getElementById('next-level-btn').addEventListener('click', () => this.nextLevel());
        document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.showScreen('start'));
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    generateLevelConfigs() {
        const configs = [];
        for (let i = 1; i <= 50; i++) {
            configs.push({
                gridSize: Math.min(12 + Math.floor((i - 1) / 8), 16), // Starts at 12x12, grows to 16x16
                enemies: i === 1 ? 1 : Math.min(Math.floor((i - 1) / 4) + 1, 4), // Max 4 enemies, grows slowly
                objectives: i === 1 ? 3 : Math.min(3 + Math.floor((i - 1) / 4), 8), // More objectives on bigger grid
                obstacles: Math.floor(i * 1.5), // Strategic obstacles from level 1! Use them to hide!
                enemySpeed: Math.max(this.baseEnemySpeed - (i - 1) * 100, 1500), // Gets faster with levels, minimum 1.5 seconds
                hasPowerups: i >= 2,
                powerupCount: i >= 2 ? Math.min(1 + Math.floor((i - 2) / 3), 2) : 0
            });
        }
        return configs;
    }
    
    // ============================================
    // SCREEN MANAGEMENT
    // ============================================
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }
    
    // ============================================
    // GAME FLOW
    // ============================================
    
    startGame() {
        console.log('Grid Commander: Starting game');
        this.currentLevel = 1;
        this.score = 0;
        this.lives = 3;
        console.log('Grid Commander: Initial lives =', this.lives);
        this.showScreen('game');
        this.initLevel();
    }
    
    initLevel() {
        console.log('Grid Commander: Initializing level', this.currentLevel);
        
        // Clear any existing intervals first
        if (this.enemyMoveInterval) {
            clearInterval(this.enemyMoveInterval);
            this.enemyMoveInterval = null;
        }
        if (this.powerupTimer) {
            clearTimeout(this.powerupTimer);
            this.powerupTimer = null;
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        this.collectedObjectives = 0;
        this.activePowerup = null;
        this.playerSpeed = 1;
        this.hasShield = false;
        this.enemiesFrozen = false;
        
        const config = this.levelConfig[this.currentLevel - 1] || this.levelConfig[this.levelConfig.length - 1];
        this.gridSize = config.gridSize;
        
        console.log('Grid Commander: Level config', config);
        
        // Clear existing grid
        this.grid = [];
        this.enemies = [];
        this.objectives = [];
        this.obstacles = [];
        this.powerups = [];
        
        // Initialize empty grid
        for (let y = 0; y < this.gridSize; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                this.grid[y][x] = 'empty';
            }
        }
        
        // Place player at bottom-left
        this.player = { x: 0, y: this.gridSize - 1 };
        this.grid[this.player.y][this.player.x] = 'player';
        
        // Place obstacles (avoiding player start area)
        for (let i = 0; i < config.obstacles; i++) {
            this.placeRandomEntity('obstacle');
        }
        
        // Place objectives (MUST have at least 1)
        let objectivesPlaced = 0;
        for (let i = 0; i < config.objectives; i++) {
            if (this.placeRandomEntity('objective')) {
                objectivesPlaced++;
            }
        }
        
        // Ensure at least 1 objective exists
        if (objectivesPlaced === 0 || this.objectives.length === 0) {
            console.warn('Grid Commander: No objectives placed, forcing one');
            // Force place an objective far from player
            const farX = this.gridSize - 1;
            const farY = 0;
            if (this.grid[farY][farX] === 'empty') {
                this.grid[farY][farX] = 'objective';
                this.objectives.push({ x: farX, y: farY });
                objectivesPlaced = 1;
            } else {
                // Try alternative positions
                for (let tryY = 0; tryY < this.gridSize; tryY++) {
                    for (let tryX = this.gridSize - 1; tryX >= 0; tryX--) {
                        if (this.grid[tryY][tryX] === 'empty' && 
                            (Math.abs(tryX - this.player.x) + Math.abs(tryY - this.player.y) > 2)) {
                            this.grid[tryY][tryX] = 'objective';
                            this.objectives.push({ x: tryX, y: tryY });
                            objectivesPlaced = 1;
                            break;
                        }
                    }
                    if (objectivesPlaced > 0) break;
                }
            }
        }
        
        console.log('Grid Commander: Objectives placed:', this.objectives.length);
        console.log('Grid Commander: Enemies placed:', this.enemies.length);
        
        // Place enemies (at top portion of grid)
        for (let i = 0; i < config.enemies; i++) {
            this.placeRandomEntity('enemy', true);
        }
        
        // Place powerups
        if (config.hasPowerups) {
            for (let i = 0; i < config.powerupCount; i++) {
                this.placeRandomEntity('powerup');
            }
        }
        
        this.levelStartTime = Date.now();
        this.renderGrid();
        this.updateUI();
        
        console.log('Grid Commander: Level initialized successfully');
        console.log('Grid Commander: Player at', this.player);
        console.log('Grid Commander: Lives =', this.lives);
        
        // Verify no enemies are at player position
        const enemyAtPlayer = this.enemies.find(e => e.x === this.player.x && e.y === this.player.y);
        if (enemyAtPlayer) {
            console.error('Grid Commander: ERROR! Enemy spawned at player position!', enemyAtPlayer);
            // Remove it
            const idx = this.enemies.indexOf(enemyAtPlayer);
            this.enemies.splice(idx, 1);
            this.grid[enemyAtPlayer.y][enemyAtPlayer.x] = 'empty';
            this.grid[this.player.y][this.player.x] = 'player';
        }
        
        // Start enemy movement after a delay to prevent immediate collisions
        // Give player 3 seconds to see the board and start moving
        setTimeout(() => {
            if (this.isPlaying) {
                console.log('Grid Commander: Starting enemy movement with speed:', config.enemySpeed, 'ms');
                console.log('Grid Commander: STRATEGIC MODE - Enemies move predictably!');
                this.startEnemyMovement(config.enemySpeed);
            }
        }, 3000); // 3 seconds - time to start!
    }
    
    placeRandomEntity(type, topHalf = false) {
        let attempts = 0;
        while (attempts < 100) {
            const x = Math.floor(Math.random() * this.gridSize);
            let y;
            
            if (topHalf) {
                y = Math.floor(Math.random() * Math.floor(this.gridSize / 2));
            } else {
                y = Math.floor(Math.random() * this.gridSize);
            }
            
            // Check if position is valid (not near player start for obstacles/enemies)
            const distFromPlayer = Math.abs(x - this.player.x) + Math.abs(y - this.player.y);
            
            // For enemies, require MUCH more distance from player (at least 4 cells)
            const minDist = (type === 'enemy') ? 4 : 2;
            
            if (this.grid[y][x] === 'empty' && distFromPlayer > minDist) {
                this.grid[y][x] = type;
                
                if (type === 'enemy') {
                    this.enemies.push({ x, y, frozen: false });
                } else if (type === 'objective') {
                    this.objectives.push({ x, y });
                } else if (type === 'obstacle') {
                    this.obstacles.push({ x, y });
                } else if (type === 'powerup') {
                    const powerupTypes = ['speed', 'freeze', 'shield'];
                    const powerupType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
                    this.powerups.push({ x, y, type: powerupType });
                    this.grid[y][x] = 'powerup-' + powerupType;
                }
                return true;
            }
            attempts++;
        }
        return false;
    }
    
    // ============================================
    // RENDERING
    // ============================================
    
    renderGrid() {
        console.log('Grid Commander: Rendering grid', this.gridSize, 'x', this.gridSize);
        this.elements.grid.innerHTML = '';
        this.elements.grid.style.gridTemplateColumns = `repeat(${this.gridSize}, var(--cell-size))`;
        this.elements.grid.style.width = 'fit-content';
        this.elements.grid.style.maxWidth = '100%';
        this.elements.grid.style.overflow = 'auto';
        
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                const cellType = this.grid[y][x];
                
                if (cellType === 'player') {
                    cell.classList.add('player');
                    if (this.activePowerup === 'speed') cell.classList.add('speed-boost');
                    if (this.hasShield) cell.classList.add('shielded');
                } else if (cellType === 'enemy') {
                    cell.classList.add('enemy');
                    const enemy = this.enemies.find(e => e.x === x && e.y === y);
                    if (enemy && enemy.frozen) cell.classList.add('frozen');
                } else if (cellType === 'objective') {
                    cell.classList.add('objective');
                } else if (cellType === 'obstacle') {
                    cell.classList.add('obstacle');
                } else if (cellType.startsWith('powerup-')) {
                    const powerupType = cellType.split('-')[1];
                    cell.classList.add('powerup', powerupType);
                }
                
                this.elements.grid.appendChild(cell);
            }
        }
    }
    
    updateUI() {
        this.elements.level.textContent = this.currentLevel;
        this.elements.score.textContent = this.score;
        this.elements.objectives.textContent = `${this.collectedObjectives}/${this.objectives.length + this.collectedObjectives}`;
        this.elements.lives.textContent = '❤️'.repeat(this.lives);
    }
    
    updateHighScoreDisplay() {
        this.elements.highScore.textContent = this.highScore;
    }
    
    // ============================================
    // INPUT HANDLING
    // ============================================
    
    handleKeyPress(e) {
        if (!this.isPlaying) return;
        
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            this.togglePause();
            return;
        }
        
        if (this.isPaused) return;
        
        let dx = 0, dy = 0;
        
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                dy = -1;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                dy = 1;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                dx = -1;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                dx = 1;
                break;
            default:
                return;
        }
        
        e.preventDefault();
        this.movePlayer(dx, dy);
    }
    
    // ============================================
    // PLAYER MOVEMENT
    // ============================================
    
    movePlayer(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        // Check bounds
        if (newX < 0 || newX >= this.gridSize || newY < 0 || newY >= this.gridSize) {
            return;
        }
        
        const targetCell = this.grid[newY][newX];
        
        // Check for obstacle
        if (targetCell === 'obstacle') {
            return;
        }
        
        // Clear current position
        this.grid[this.player.y][this.player.x] = 'empty';
        
        // Handle collisions
        if (targetCell === 'objective') {
            this.collectObjective(newX, newY);
        } else if (targetCell === 'enemy') {
            this.handleEnemyCollision();
            if (!this.isPlaying) return;
        } else if (targetCell.startsWith('powerup-')) {
            const powerupType = targetCell.split('-')[1];
            this.collectPowerup(powerupType, newX, newY);
        }
        
        // Update player position
        this.player.x = newX;
        this.player.y = newY;
        this.grid[newY][newX] = 'player';
        
        // Extra move for speed powerup
        if (this.activePowerup === 'speed' && (dx !== 0 || dy !== 0)) {
            const extraX = this.player.x + dx;
            const extraY = this.player.y + dy;
            
            if (extraX >= 0 && extraX < this.gridSize && 
                extraY >= 0 && extraY < this.gridSize &&
                this.grid[extraY][extraX] !== 'obstacle') {
                
                const extraTarget = this.grid[extraY][extraX];
                this.grid[this.player.y][this.player.x] = 'empty';
                
                if (extraTarget === 'objective') {
                    this.collectObjective(extraX, extraY);
                } else if (extraTarget === 'enemy') {
                    this.handleEnemyCollision();
                    if (!this.isPlaying) return;
                } else if (extraTarget.startsWith('powerup-')) {
                    const powerupType = extraTarget.split('-')[1];
                    this.collectPowerup(powerupType, extraX, extraY);
                }
                
                this.player.x = extraX;
                this.player.y = extraY;
                this.grid[extraY][extraX] = 'player';
            }
        }
        
        this.renderGrid();
        this.checkWinCondition();
    }
    
    // ============================================
    // ENEMY MOVEMENT
    // ============================================
    
    startEnemyMovement(speed) {
        // CRITICAL: Clear any existing intervals FIRST
        if (this.enemyMoveInterval) {
            console.warn('Grid Commander: Clearing existing interval', this.enemyMoveInterval);
            clearInterval(this.enemyMoveInterval);
            this.enemyMoveInterval = null;
        }
        
        // HARD MINIMUM: Never allow faster than 1.5 seconds
        const actualSpeed = Math.max(speed, 1500);
        console.log('Grid Commander: Setting enemy move interval to', actualSpeed, 'milliseconds (requested:', speed, ')');
        
        this.enemyMoveInterval = setInterval(() => {
            console.log('Grid Commander: ⏰ Interval tick at', new Date().toLocaleTimeString());
            if (!this.isPaused && this.isPlaying) {
                this.moveEnemies();
            } else {
                console.log('Grid Commander: Skipping move - paused:', this.isPaused, 'playing:', this.isPlaying);
            }
        }, actualSpeed);
        
        console.log('Grid Commander: Interval ID =', this.enemyMoveInterval, 'Speed:', actualSpeed, 'ms');
    }
    
    moveEnemies() {
        // ABSOLUTE HARD LIMIT: Only allow moves every 1.5+ seconds NO MATTER WHAT
        const now = Date.now();
        const timeSinceLastMove = now - this.lastEnemyMoveTime;
        
        if (timeSinceLastMove < 1500) {
            console.log('Grid Commander: TOO SOON! Only', timeSinceLastMove, 'ms since last move. BLOCKING.');
            return;
        }
        
        if (this.isMovingEnemies) {
            console.log('Grid Commander: Already moving enemies, BLOCKING duplicate call');
            return;
        }
        
        if (this.enemiesFrozen) {
            console.log('Grid Commander: Enemies frozen, skipping move');
            return;
        }
        if (!this.isPlaying) {
            console.log('Grid Commander: Game not playing, skipping move');
            return;
        }
        
        this.isMovingEnemies = true;
        this.lastEnemyMoveTime = now;
        
        console.log('Grid Commander: === MOVING', this.enemies.length, 'ENEMIES ===');
        console.log('Grid Commander: Time since last move:', timeSinceLastMove, 'ms');
        
        this.enemies.forEach((enemy, index) => {
            console.log('Grid Commander: Enemy', index, 'BEFORE move:', enemy.x, enemy.y);
            if (enemy.frozen) return;
            
            // Clear current position
            this.grid[enemy.y][enemy.x] = 'empty';
            
            // Calculate direction toward player
            let dx = 0, dy = 0;
            
            // STRATEGIC MOVEMENT - Enemies move in PREDICTABLE patterns
            // This makes the game strategic - you can PLAN and OUTSMART them!
            
            // 50% of the time: move toward player (predictable)
            // 50% of the time: patrol in straight lines (also predictable)
            
            if (Math.random() < 0.5) {
                // PREDICTABLE CHASE - always moves closer on ONE axis
                // Player can see this coming and plan!
                const distX = Math.abs(this.player.x - enemy.x);
                const distY = Math.abs(this.player.y - enemy.y);
                
                // Move on the axis that's farther away
                if (distX > distY) {
                    if (this.player.x > enemy.x) dx = 1;
                    else if (this.player.x < enemy.x) dx = -1;
                } else {
                    if (this.player.y > enemy.y) dy = 1;
                    else if (this.player.y < enemy.y) dy = -1;
                }
            } else {
                // PATROL MODE - Enemy continues in same direction
                // This creates predictable patterns you can work around!
                if (!enemy.lastDirection) {
                    // Initialize random direction for this enemy
                    const directions = [
                        { dx: 0, dy: -1 },
                        { dx: 0, dy: 1 },
                        { dx: -1, dy: 0 },
                        { dx: 1, dy: 0 }
                    ];
                    enemy.lastDirection = directions[Math.floor(Math.random() * directions.length)];
                }
                
                // Continue in the same direction (predictable patrol)
                dx = enemy.lastDirection.dx;
                dy = enemy.lastDirection.dy;
                
                // If we hit a wall or obstacle, pick a new random direction
                const testX = enemy.x + dx;
                const testY = enemy.y + dy;
                if (testX < 0 || testX >= this.gridSize || 
                    testY < 0 || testY >= this.gridSize ||
                    this.grid[testY][testX] === 'obstacle') {
                    // Change direction
                    const directions = [
                        { dx: 0, dy: -1 },
                        { dx: 0, dy: 1 },
                        { dx: -1, dy: 0 },
                        { dx: 1, dy: 0 }
                    ];
                    enemy.lastDirection = directions[Math.floor(Math.random() * directions.length)];
                    dx = enemy.lastDirection.dx;
                    dy = enemy.lastDirection.dy;
                }
            }
            
            // CRITICAL: Verify dx and dy are ONLY -1, 0, or 1
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                console.error('Grid Commander: BUG! dx or dy > 1:', dx, dy);
                dx = Math.sign(dx);
                dy = Math.sign(dy);
            }
            
            const newX = enemy.x + dx;
            const newY = enemy.y + dy;
            
            console.log('Grid Commander: Enemy', index, 'wants to move by dx:', dx, 'dy:', dy, 'to', newX, newY);
            
            // Check if move is valid
            if (newX >= 0 && newX < this.gridSize &&
                newY >= 0 && newY < this.gridSize &&
                this.grid[newY][newX] !== 'obstacle' &&
                this.grid[newY][newX] !== 'enemy') {
                
                // Check if hitting player
                if (this.grid[newY][newX] === 'player') {
                    this.handleEnemyCollision();
                    if (!this.isPlaying) return;
                    this.grid[enemy.y][enemy.x] = 'enemy';
                } else {
                    enemy.x = newX;
                    enemy.y = newY;
                    this.grid[newY][newX] = 'enemy';
                    console.log('Grid Commander: Enemy', index, 'AFTER move:', enemy.x, enemy.y);
                }
            } else {
                // Can't move, stay in place
                this.grid[enemy.y][enemy.x] = 'enemy';
                console.log('Grid Commander: Enemy', index, 'blocked, stayed at:', enemy.x, enemy.y);
            }
        });
        
        this.isMovingEnemies = false;
        console.log('Grid Commander: === ENEMY MOVE COMPLETE ===');
        this.renderGrid();
    }
    
    // ============================================
    // COLLISIONS & PICKUPS
    // ============================================
    
    collectObjective(x, y) {
        this.collectedObjectives++;
        this.score += 100;
        
        // Remove from objectives array
        const index = this.objectives.findIndex(o => o.x === x && o.y === y);
        if (index > -1) this.objectives.splice(index, 1);
        
        // Animation
        const cell = this.getCellElement(x, y);
        if (cell) cell.classList.add('collected');
        
        this.updateUI();
    }
    
    collectPowerup(type, x, y) {
        // Remove from powerups array
        const index = this.powerups.findIndex(p => p.x === x && p.y === y);
        if (index > -1) this.powerups.splice(index, 1);
        
        // Clear any existing powerup
        if (this.powerupTimer) clearTimeout(this.powerupTimer);
        
        this.activePowerup = type;
        
        switch (type) {
            case 'speed':
                this.elements.powerupStatus.textContent = '⚡ SPEED BOOST - 5s';
                break;
            case 'freeze':
                this.elements.powerupStatus.textContent = '❄️ ENEMIES FROZEN - 4s';
                this.enemiesFrozen = true;
                this.enemies.forEach(e => e.frozen = true);
                break;
            case 'shield':
                this.elements.powerupStatus.textContent = '🛡️ SHIELD ACTIVE - 1 HIT';
                this.hasShield = true;
                break;
        }
        
        this.score += 50;
        
        // Powerup duration
        const duration = type === 'freeze' ? 4000 : type === 'speed' ? 5000 : null;
        
        if (duration) {
            this.powerupTimer = setTimeout(() => {
                this.clearPowerup(type);
            }, duration);
        }
        
        this.updateUI();
    }
    
    clearPowerup(type) {
        if (type === 'freeze') {
            this.enemiesFrozen = false;
            this.enemies.forEach(e => e.frozen = false);
        }
        
        if (this.activePowerup === type) {
            this.activePowerup = null;
            this.elements.powerupStatus.textContent = '';
        }
        
        this.renderGrid();
    }
    
    handleEnemyCollision() {
        console.log('Grid Commander: Enemy collision! Lives before:', this.lives);
        if (!this.isPlaying) return; // Prevent multiple collisions
        
        if (this.hasShield) {
            this.hasShield = false;
            this.elements.powerupStatus.textContent = '';
            this.activePowerup = null;
            
            // Push player back to start
            this.grid[this.player.y][this.player.x] = 'empty';
            
            // Find a safe spawn position
            const safeX = 0;
            const safeY = this.gridSize - 1;
            
            // Remove any enemy at spawn
            const enemyAtSpawn = this.enemies.findIndex(e => e.x === safeX && e.y === safeY);
            if (enemyAtSpawn > -1) {
                this.enemies.splice(enemyAtSpawn, 1);
            }
            
            this.player = { x: safeX, y: safeY };
            this.grid[this.player.y][this.player.x] = 'player';
            
            this.renderGrid();
            return;
        }
        
        this.lives--;
        console.log('Grid Commander: Lives after hit:', this.lives);
        this.updateUI();
        
        // Screen shake
        this.elements.grid.classList.add('shake');
        setTimeout(() => this.elements.grid.classList.remove('shake'), 300);
        
        if (this.lives <= 0) {
            console.log('Grid Commander: GAME OVER triggered');
            this.gameOver();
        } else {
            // Reset player position
            this.grid[this.player.y][this.player.x] = 'empty';
            
            const safeX = 0;
            const safeY = this.gridSize - 1;
            
            // Remove any enemy at spawn position
            const enemyAtSpawn = this.enemies.findIndex(e => e.x === safeX && e.y === safeY);
            if (enemyAtSpawn > -1) {
                this.enemies.splice(enemyAtSpawn, 1);
                this.grid[safeY][safeX] = 'empty';
            }
            
            this.player = { x: safeX, y: safeY };
            this.grid[this.player.y][this.player.x] = 'player';
            this.renderGrid();
        }
    }
    
    getCellElement(x, y) {
        return this.elements.grid.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    }
    
    // ============================================
    // WIN/LOSE CONDITIONS
    // ============================================
    
    checkWinCondition() {
        console.log('Grid Commander: Checking win condition. Objectives remaining:', this.objectives.length);
        // Only check if we've actually collected some objectives
        // Prevent false positive if objectives failed to place
        if (this.objectives.length === 0 && this.collectedObjectives > 0) {
            console.log('Grid Commander: All objectives collected! Level complete!');
            this.levelComplete();
        }
    }
    
    levelComplete() {
        console.log('Grid Commander: LEVEL COMPLETE - clearing intervals');
        this.isPlaying = false;
        
        // CRITICAL: Properly clear interval
        if (this.enemyMoveInterval) {
            clearInterval(this.enemyMoveInterval);
            this.enemyMoveInterval = null;
        }
        
        if (this.powerupTimer) {
            clearTimeout(this.powerupTimer);
            this.powerupTimer = null;
        }
        
        // Calculate bonuses
        const timeSpent = (Date.now() - this.levelStartTime) / 1000;
        const baseTime = 30 + this.currentLevel * 10;
        const timeBonus = Math.max(0, Math.floor((baseTime - timeSpent) * 20));
        const objectiveBonus = this.collectedObjectives * 100;
        const levelBonus = this.currentLevel * 50;
        const totalBonus = timeBonus + objectiveBonus + levelBonus;
        
        this.score += totalBonus;
        
        // Update level complete screen
        this.elements.timeBonus.textContent = `+${timeBonus}`;
        this.elements.objBonus.textContent = `+${objectiveBonus + levelBonus}`;
        this.elements.levelScore.textContent = this.score;
        
        this.showScreen('levelComplete');
    }
    
    nextLevel() {
        this.currentLevel++;
        this.showScreen('game');
        this.initLevel();
    }
    
    gameOver() {
        console.log('Grid Commander: GAME OVER - clearing intervals');
        this.isPlaying = false;
        
        // CRITICAL: Properly clear interval
        if (this.enemyMoveInterval) {
            clearInterval(this.enemyMoveInterval);
            this.enemyMoveInterval = null;
        }
        
        if (this.powerupTimer) {
            clearTimeout(this.powerupTimer);
            this.powerupTimer = null;
        }
        
        // Check for high score
        const isNewHighScore = this.score > this.highScore;
        if (isNewHighScore) {
            this.highScore = this.score;
            localStorage.setItem('gridCommanderHighScore', this.highScore);
            this.updateHighScoreDisplay();
        }
        
        // Update game over screen
        this.elements.finalScore.textContent = this.score;
        this.elements.levelsCleared.textContent = this.currentLevel - 1;
        this.elements.newHighScore.style.display = isNewHighScore ? 'flex' : 'none';
        
        this.showScreen('gameOver');
    }
    
    // ============================================
    // PAUSE/RESUME
    // ============================================
    
    togglePause() {
        if (!this.isPlaying) return;
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.screens.pause.classList.add('active');
        } else {
            this.screens.pause.classList.remove('active');
        }
    }
    
    restartLevel() {
        this.screens.pause.classList.remove('active');
        this.lives = Math.max(this.lives, 1); // At least 1 life for restart
        this.initLevel();
    }
    
    quitToMenu() {
        console.log('Grid Commander: Quitting to menu, clearing interval', this.enemyMoveInterval);
        this.isPlaying = false;
        this.isPaused = false;
        
        // CRITICAL: Clear interval properly
        if (this.enemyMoveInterval) {
            clearInterval(this.enemyMoveInterval);
            this.enemyMoveInterval = null;
        }
        
        if (this.powerupTimer) {
            clearTimeout(this.powerupTimer);
            this.powerupTimer = null;
        }
        
        this.screens.pause.classList.remove('active');
        this.showScreen('start');
    }
}

// ============================================
// INITIALIZE GAME
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    window.game = new GridCommander();
});

