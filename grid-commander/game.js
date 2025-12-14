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
        this.baseEnemySpeed = 600; // ms between enemy moves
        
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
                gridSize: Math.min(8 + Math.floor((i - 1) / 3), 14),
                enemies: Math.min(1 + Math.floor((i - 1) / 2), 8),
                objectives: Math.min(3 + Math.floor((i - 1) / 2), 10),
                obstacles: Math.min(Math.floor((i - 1) / 2) * 3, 25),
                enemySpeed: Math.max(this.baseEnemySpeed - (i - 1) * 20, 200),
                hasPowerups: i >= 3,
                powerupCount: i >= 3 ? Math.min(1 + Math.floor((i - 3) / 3), 3) : 0
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
        this.currentLevel = 1;
        this.score = 0;
        this.lives = 3;
        this.showScreen('game');
        this.initLevel();
    }
    
    initLevel() {
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
        if (objectivesPlaced === 0) {
            // Force place an objective far from player
            const farX = this.gridSize - 1;
            const farY = 0;
            if (this.grid[farY][farX] === 'empty') {
                this.grid[farY][farX] = 'objective';
                this.objectives.push({ x: farX, y: farY });
            }
        }
        
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
        
        // Start enemy movement after a small delay to prevent immediate collisions
        setTimeout(() => {
            if (this.isPlaying) {
                this.startEnemyMovement(config.enemySpeed);
            }
        }, 500);
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
            
            if (this.grid[y][x] === 'empty' && distFromPlayer > 2) {
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
        this.elements.grid.innerHTML = '';
        this.elements.grid.style.gridTemplateColumns = `repeat(${this.gridSize}, var(--cell-size))`;
        
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
        if (this.enemyMoveInterval) {
            clearInterval(this.enemyMoveInterval);
        }
        
        this.enemyMoveInterval = setInterval(() => {
            if (!this.isPaused && this.isPlaying) {
                this.moveEnemies();
            }
        }, speed);
    }
    
    moveEnemies() {
        if (this.enemiesFrozen) return;
        
        this.enemies.forEach(enemy => {
            if (enemy.frozen) return;
            
            // Clear current position
            this.grid[enemy.y][enemy.x] = 'empty';
            
            // Calculate direction toward player
            let dx = 0, dy = 0;
            
            // Smart pathfinding with some randomness
            const shouldChase = Math.random() < 0.7 + (this.currentLevel * 0.02); // Gets smarter with levels
            
            if (shouldChase) {
                if (this.player.x > enemy.x) dx = 1;
                else if (this.player.x < enemy.x) dx = -1;
                
                if (this.player.y > enemy.y) dy = 1;
                else if (this.player.y < enemy.y) dy = -1;
                
                // Choose x or y movement (prefer closing larger gap)
                if (Math.abs(this.player.x - enemy.x) > Math.abs(this.player.y - enemy.y)) {
                    dy = 0;
                } else if (Math.abs(this.player.y - enemy.y) > Math.abs(this.player.x - enemy.x)) {
                    dx = 0;
                } else {
                    // Equal distance, random choice
                    if (Math.random() < 0.5) dx = 0;
                    else dy = 0;
                }
            } else {
                // Random movement
                const directions = [
                    { dx: 0, dy: -1 },
                    { dx: 0, dy: 1 },
                    { dx: -1, dy: 0 },
                    { dx: 1, dy: 0 }
                ];
                const dir = directions[Math.floor(Math.random() * directions.length)];
                dx = dir.dx;
                dy = dir.dy;
            }
            
            const newX = enemy.x + dx;
            const newY = enemy.y + dy;
            
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
                }
            } else {
                // Can't move, stay in place
                this.grid[enemy.y][enemy.x] = 'enemy';
            }
        });
        
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
        this.updateUI();
        
        // Screen shake
        this.elements.grid.classList.add('shake');
        setTimeout(() => this.elements.grid.classList.remove('shake'), 300);
        
        if (this.lives <= 0) {
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
        if (this.objectives.length === 0) {
            this.levelComplete();
        }
    }
    
    levelComplete() {
        this.isPlaying = false;
        clearInterval(this.enemyMoveInterval);
        if (this.powerupTimer) clearTimeout(this.powerupTimer);
        
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
        this.isPlaying = false;
        clearInterval(this.enemyMoveInterval);
        if (this.powerupTimer) clearTimeout(this.powerupTimer);
        
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
        this.isPlaying = false;
        this.isPaused = false;
        clearInterval(this.enemyMoveInterval);
        if (this.powerupTimer) clearTimeout(this.powerupTimer);
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

