// IQ Arena - Main Controller

import { GameType, PlayerProgress, GameDifficulty, GameCategory } from './types';
import { 
  loadProgress, 
  getLevelInfo, 
  getProgressToNextLevel,
  getWinsNeededForNextLevel,
  getWinRate,
  formatTimePlayed
} from './level-system';
import { 
  getRandomGame, 
  GAME_CONFIGS,
  isGameUnlocked,
  getDifficultyParams,
  createGameSession,
  formatTime,
  GameSession,
  DifficultyParams
} from './game-controller';
import { soundManager } from './sound-manager';
import { 
  getRandomJokeOrQuote, 
  getEncouragementMessage 
} from './data/jokes';
import { 
  getAllAchievements, 
  getAchievementProgress 
} from './data/achievements';

// Backend API URL
const BACKEND_URL = 'http://localhost:8000';

// Current state
let currentProgress: PlayerProgress;
let currentSession: GameSession | null = null;
let timerInterval: number | null = null;

// Game mode state
type GameMode = 'career' | 'freeplay';
let currentMode: GameMode = 'career';
let freePlayDifficulty: GameDifficulty = 'medium';
let freePlayGameSettings: Record<string, any> = {};
let selectedFreePlayGame: GameType | null = null;
let selectedCategory: GameCategory = 'all';

// DOM Elements
const elements = {
  // Screens
  homeScreen: document.getElementById('homeScreen')!,
  gameScreen: document.getElementById('gameScreen')!,
  resultScreen: document.getElementById('resultScreen')!,
  
  // Mode Selector
  careerModeBtn: document.getElementById('careerModeBtn')!,
  freePlayModeBtn: document.getElementById('freePlayModeBtn')!,
  careerModeContent: document.getElementById('careerModeContent')!,
  freePlayModeContent: document.getElementById('freePlayModeContent')!,
  
  // Level Card
  levelIcon: document.getElementById('levelIcon')!,
  levelNumber: document.getElementById('levelNumber')!,
  levelName: document.getElementById('levelName')!,
  streakCount: document.getElementById('streakCount')!,
  progressFill: document.getElementById('progressFill')!,
  progressText: document.getElementById('progressText')!,
  totalWins: document.getElementById('totalWins')!,
  winRate: document.getElementById('winRate')!,
  totalGames: document.getElementById('totalGames')!,
  
  // Buttons
  playRandomBtn: document.getElementById('playRandomBtn')!,
  backToHome: document.getElementById('backToHome')!,
  soundToggle: document.getElementById('soundToggle')!,
  statsBtn: document.getElementById('statsBtn')!,
  achievementsBtn: document.getElementById('achievementsBtn')!,
  
  // Game grids
  careerGamesGrid: document.getElementById('careerGamesGrid')!,
  freePlayGamesGrid: document.getElementById('freePlayGamesGrid')!,
  difficultySelector: document.getElementById('difficultySelector')!,
  
  // Game Settings Modal
  gameSettingsModal: document.getElementById('gameSettingsModal')!,
  closeGameSettings: document.getElementById('closeGameSettings')!,
  settingsGameIcon: document.getElementById('settingsGameIcon')!,
  settingsGameName: document.getElementById('settingsGameName')!,
  gameSettingsBody: document.getElementById('gameSettingsBody')!,
  startGameWithSettings: document.getElementById('startGameWithSettings')!,
  
  // Game Screen
  currentGameIcon: document.getElementById('currentGameIcon')!,
  currentGameName: document.getElementById('currentGameName')!,
  gameModeLabel: document.getElementById('gameModeLabel')!,
  gameTimer: document.getElementById('gameTimer')!,
  gameContainer: document.getElementById('gameContainer')!,
  
  // Result Screen
  resultModeBadge: document.getElementById('resultModeBadge')!,
  resultIcon: document.getElementById('resultIcon')!,
  resultTitle: document.getElementById('resultTitle')!,
  resultMessage: document.getElementById('resultMessage')!,
  resultTime: document.getElementById('resultTime')!,
  resultScore: document.getElementById('resultScore')!,
  levelUpBanner: document.getElementById('levelUpBanner')!,
  newLevelName: document.getElementById('newLevelName')!,
  newAchievements: document.getElementById('newAchievements')!,
  achievementsList: document.getElementById('achievementsList')!,
  quoteText: document.getElementById('quoteText')!,
  quoteAuthor: document.getElementById('quoteAuthor')!,
  playAgainBtn: document.getElementById('playAgainBtn')!,
  homeBtn: document.getElementById('homeBtn')!,
  
  // Modals
  statsModal: document.getElementById('statsModal')!,
  achievementsModal: document.getElementById('achievementsModal')!,
  closeStats: document.getElementById('closeStats')!,
  closeAchievements: document.getElementById('closeAchievements')!,
  statsGrid: document.getElementById('statsGrid')!,
  gameStatsList: document.getElementById('gameStatsList')!,
  achievementsProgress: document.getElementById('achievementsProgress')!,
  allAchievements: document.getElementById('allAchievements')!,
};

// Initialize
async function init() {
  currentProgress = await loadProgress();
  updateUI();
  renderCareerGamesGrid();
  renderFreePlayGamesGrid();
  setupEventListeners();
  updateSoundButton();
}

// Update UI with current progress
function updateUI() {
  const levelInfo = getLevelInfo(currentProgress.level);
  const progress = getProgressToNextLevel(currentProgress);
  const winsNeeded = getWinsNeededForNextLevel(currentProgress);
  
  elements.levelIcon.textContent = levelInfo.icon;
  elements.levelNumber.textContent = String(currentProgress.level);
  elements.levelName.textContent = levelInfo.name;
  elements.streakCount.textContent = String(currentProgress.currentStreak);
  
  elements.progressFill.style.width = `${progress}%`;
  
  if (winsNeeded === 0) {
    elements.progressText.textContent = '🎉 Max Level Reached!';
  } else {
    elements.progressText.textContent = `${currentProgress.winsAtCurrentLevel} / ${levelInfo.winsRequired} wins to next level`;
  }
  
  elements.totalWins.textContent = String(currentProgress.totalWins);
  elements.winRate.textContent = `${getWinRate(currentProgress)}%`;
  elements.totalGames.textContent = String(currentProgress.totalGamesPlayed);
}

// Render Career Mode games grid (with locks)
function renderCareerGamesGrid() {
  const allGames = Object.values(GAME_CONFIGS);
  
  elements.careerGamesGrid.innerHTML = allGames.map(game => {
    const unlocked = isGameUnlocked(game.type, currentProgress.level);
    return `
      <div class="game-card ${unlocked ? '' : 'locked'}" data-game="${game.type}">
        ${!unlocked ? '<span class="game-card-lock">🔒</span>' : ''}
        <span class="game-card-icon">${game.icon}</span>
        <span class="game-card-name">${game.name}</span>
        ${!unlocked ? `<span class="game-card-level">Lvl ${game.minLevel}</span>` : ''}
      </div>
    `;
  }).join('');
  
  // Add click handlers for unlocked games
  elements.careerGamesGrid.querySelectorAll('.game-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => {
      const gameType = card.getAttribute('data-game') as GameType;
      startGame(gameType, 'career');
    });
  });
}

// Render Free Play games grid (all unlocked, filtered by category)
function renderFreePlayGamesGrid() {
  const allGames = Object.values(GAME_CONFIGS);
  const filteredGames = selectedCategory === 'all' 
    ? allGames 
    : allGames.filter(g => g.category === selectedCategory);
  
  // Update title and count
  const categoryTitles: Record<GameCategory, string> = {
    'all': 'All Games',
    'memory': 'Memory Games',
    'speed': 'Speed Games',
    'logic': 'Logic Games',
    'words': 'Word Games',
    'ai': 'AI-Powered Games'
  };
  
  const titleEl = document.getElementById('categoryTitle');
  const countEl = document.getElementById('gameCount');
  if (titleEl) titleEl.textContent = categoryTitles[selectedCategory];
  if (countEl) countEl.textContent = `(${filteredGames.length})`;
  
  elements.freePlayGamesGrid.innerHTML = filteredGames.map(game => `
    <div class="game-card" data-game="${game.type}">
      <span class="game-card-icon">${game.icon}</span>
      <span class="game-card-name">${game.name}</span>
      ${game.requiresAI ? '<span class="game-card-ai">AI</span>' : ''}
    </div>
  `).join('');
  
  // Add click handlers to show settings modal
  elements.freePlayGamesGrid.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const gameType = card.getAttribute('data-game') as GameType;
      showGameSettingsModal(gameType);
    });
  });
}

// Show game settings modal for Free Play
function showGameSettingsModal(gameType: GameType) {
  selectedFreePlayGame = gameType;
  const config = GAME_CONFIGS[gameType];
  
  elements.settingsGameIcon.textContent = config.icon;
  elements.settingsGameName.textContent = config.name;
  
  // Build settings based on game type
  let settingsHTML = '';
  
  // Difficulty is already selected in the main Free Play screen
  settingsHTML += `
    <div class="game-setting-group">
      <div class="game-setting-label">Selected Difficulty</div>
      <div class="selected-difficulty" style="font-family: var(--font-display); font-size: 18px; color: var(--primary);">
        ${freePlayDifficulty.toUpperCase()}
      </div>
    </div>
  `;
  
  // Game-specific settings
  switch (gameType) {
    case 'ai-trivia':
      settingsHTML += `
        <div class="game-setting-group">
          <div class="game-setting-label">Category</div>
          <div class="game-setting-options" id="triviaCategory">
            <button class="setting-option-btn active" data-category="random">🎲 Random</button>
            <button class="setting-option-btn" data-category="science">🔬 Science</button>
            <button class="setting-option-btn" data-category="history">📜 History</button>
            <button class="setting-option-btn" data-category="technology">💻 Technology</button>
            <button class="setting-option-btn" data-category="geography">🌍 Geography</button>
            <button class="setting-option-btn" data-category="nature">🌿 Nature</button>
            <button class="setting-option-btn" data-category="space">🚀 Space</button>
          </div>
        </div>
        <div class="game-setting-group">
          <div class="game-setting-label">Number of Questions</div>
          <div class="game-setting-options" id="triviaCount">
            <button class="setting-option-btn" data-count="3">3</button>
            <button class="setting-option-btn active" data-count="5">5</button>
            <button class="setting-option-btn" data-count="7">7</button>
            <button class="setting-option-btn" data-count="10">10</button>
          </div>
        </div>
      `;
      break;
      
    case 'fact-or-fiction':
      settingsHTML += `
        <div class="game-setting-group">
          <div class="game-setting-label">Number of Statements</div>
          <div class="game-setting-options" id="fofCount">
            <button class="setting-option-btn" data-count="3">3</button>
            <button class="setting-option-btn active" data-count="5">5</button>
            <button class="setting-option-btn" data-count="7">7</button>
            <button class="setting-option-btn" data-count="10">10</button>
          </div>
        </div>
      `;
      break;
      
    case 'memory-match':
      settingsHTML += `
        <div class="game-setting-group">
          <div class="game-setting-label">Grid Size</div>
          <div class="game-setting-options" id="memorySize">
            <button class="setting-option-btn" data-size="3x4">3×4 (Easy)</button>
            <button class="setting-option-btn active" data-size="4x4">4×4 (Medium)</button>
            <button class="setting-option-btn" data-size="4x5">4×5 (Hard)</button>
            <button class="setting-option-btn" data-size="5x6">5×6 (Expert)</button>
          </div>
        </div>
      `;
      break;
      
    case 'math-challenge':
      settingsHTML += `
        <div class="game-setting-group">
          <div class="game-setting-label">Operations</div>
          <div class="game-setting-options" id="mathOps">
            <button class="setting-option-btn active" data-ops="+-">+ −</button>
            <button class="setting-option-btn" data-ops="+-*">+ − ×</button>
            <button class="setting-option-btn" data-ops="+-*/">+ − × ÷</button>
          </div>
        </div>
        <div class="game-setting-group">
          <div class="game-setting-label">Number of Questions</div>
          <div class="game-setting-options" id="mathCount">
            <button class="setting-option-btn active" data-count="5">5</button>
            <button class="setting-option-btn" data-count="10">10</button>
            <button class="setting-option-btn" data-count="15">15</button>
          </div>
        </div>
      `;
      break;
      
    case 'minesweeper':
      settingsHTML += `
        <div class="game-setting-group">
          <div class="game-setting-label">Grid Size</div>
          <div class="game-setting-options" id="mineSize">
            <button class="setting-option-btn" data-size="8x8">8×8</button>
            <button class="setting-option-btn active" data-size="9x9">9×9</button>
            <button class="setting-option-btn" data-size="10x10">10×10</button>
            <button class="setting-option-btn" data-size="12x12">12×12</button>
          </div>
        </div>
        <div class="game-setting-group">
          <div class="game-setting-label">Mines</div>
          <div class="game-setting-options" id="mineCount">
            <button class="setting-option-btn" data-mines="10">10</button>
            <button class="setting-option-btn active" data-mines="15">15</button>
            <button class="setting-option-btn" data-mines="20">20</button>
            <button class="setting-option-btn" data-mines="30">30</button>
          </div>
        </div>
      `;
      break;
      
    case 'wordle':
      settingsHTML += `
        <div class="game-setting-group">
          <div class="game-setting-label">Max Attempts</div>
          <div class="game-setting-options" id="wordleAttempts">
            <button class="setting-option-btn" data-attempts="4">4 (Hard)</button>
            <button class="setting-option-btn" data-attempts="5">5 (Medium)</button>
            <button class="setting-option-btn active" data-attempts="6">6 (Easy)</button>
          </div>
        </div>
      `;
      break;
      
    default:
      settingsHTML += `
        <div class="game-setting-group">
          <p style="color: var(--text-muted); text-align: center;">No additional settings for this game.</p>
        </div>
      `;
  }
  
  elements.gameSettingsBody.innerHTML = settingsHTML;
  
  // Add click handlers for setting options
  elements.gameSettingsBody.querySelectorAll('.game-setting-options').forEach(group => {
    group.querySelectorAll('.setting-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.setting-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        soundManager.play('click');
      });
    });
  });
  
  elements.gameSettingsModal.classList.remove('hidden');
  soundManager.play('click');
}

// Collect settings from modal and start game
function collectSettingsAndStart() {
  if (!selectedFreePlayGame) return;
  
  freePlayGameSettings = {};
  
  // Collect game-specific settings
  switch (selectedFreePlayGame) {
    case 'ai-trivia':
      const categoryBtn = elements.gameSettingsBody.querySelector('#triviaCategory .setting-option-btn.active');
      const countBtn = elements.gameSettingsBody.querySelector('#triviaCount .setting-option-btn.active');
      freePlayGameSettings.category = categoryBtn?.getAttribute('data-category') || 'random';
      freePlayGameSettings.count = parseInt(countBtn?.getAttribute('data-count') || '5');
      break;
      
    case 'fact-or-fiction':
      const fofCountBtn = elements.gameSettingsBody.querySelector('#fofCount .setting-option-btn.active');
      freePlayGameSettings.count = parseInt(fofCountBtn?.getAttribute('data-count') || '5');
      break;
      
    case 'memory-match':
      const memorySizeBtn = elements.gameSettingsBody.querySelector('#memorySize .setting-option-btn.active');
      freePlayGameSettings.gridSize = memorySizeBtn?.getAttribute('data-size') || '4x4';
      break;
      
    case 'math-challenge':
      const mathOpsBtn = elements.gameSettingsBody.querySelector('#mathOps .setting-option-btn.active');
      const mathCountBtn = elements.gameSettingsBody.querySelector('#mathCount .setting-option-btn.active');
      freePlayGameSettings.operations = mathOpsBtn?.getAttribute('data-ops') || '+-';
      freePlayGameSettings.count = parseInt(mathCountBtn?.getAttribute('data-count') || '5');
      break;
      
    case 'minesweeper':
      const mineSizeBtn = elements.gameSettingsBody.querySelector('#mineSize .setting-option-btn.active');
      const mineCountBtn = elements.gameSettingsBody.querySelector('#mineCount .setting-option-btn.active');
      freePlayGameSettings.gridSize = mineSizeBtn?.getAttribute('data-size') || '9x9';
      freePlayGameSettings.mines = parseInt(mineCountBtn?.getAttribute('data-mines') || '15');
      break;
      
    case 'wordle':
      const wordleAttemptsBtn = elements.gameSettingsBody.querySelector('#wordleAttempts .setting-option-btn.active');
      freePlayGameSettings.maxAttempts = parseInt(wordleAttemptsBtn?.getAttribute('data-attempts') || '6');
      break;
  }
  
  elements.gameSettingsModal.classList.add('hidden');
  startGame(selectedFreePlayGame, 'freeplay');
}

// Switch screens
function showScreen(screenId: 'home' | 'game' | 'result') {
  elements.homeScreen.classList.remove('active');
  elements.gameScreen.classList.remove('active');
  elements.resultScreen.classList.remove('active');
  
  switch (screenId) {
    case 'home':
      elements.homeScreen.classList.add('active');
      break;
    case 'game':
      elements.gameScreen.classList.add('active');
      break;
    case 'result':
      elements.resultScreen.classList.add('active');
      break;
  }
}

// Switch mode
function switchMode(mode: GameMode) {
  currentMode = mode;
  
  elements.careerModeBtn.classList.toggle('active', mode === 'career');
  elements.freePlayModeBtn.classList.toggle('active', mode === 'freeplay');
  elements.careerModeContent.classList.toggle('active', mode === 'career');
  elements.freePlayModeContent.classList.toggle('active', mode === 'freeplay');
  
  soundManager.play('click');
}

// Get difficulty params for Free Play (based on selected difficulty or custom settings)
function getFreePlayDifficultyParams(): DifficultyParams {
  const baseParams = getDifficultyParams(
    freePlayDifficulty === 'easy' ? 1 :
    freePlayDifficulty === 'medium' ? 4 :
    freePlayDifficulty === 'hard' ? 6 :
    freePlayDifficulty === 'expert' ? 8 : 10
  );
  
  // Apply custom settings
  if (freePlayGameSettings.gridSize && selectedFreePlayGame === 'memory-match') {
    const [rows, cols] = freePlayGameSettings.gridSize.split('x').map(Number);
    baseParams.memoryGridSize = { rows, cols };
  }
  
  if (freePlayGameSettings.gridSize && selectedFreePlayGame === 'minesweeper') {
    const [rows, cols] = freePlayGameSettings.gridSize.split('x').map(Number);
    baseParams.minesweeperSize = { rows, cols };
  }
  
  if (freePlayGameSettings.mines) {
    baseParams.minesweeperMines = freePlayGameSettings.mines;
  }
  
  if (freePlayGameSettings.operations) {
    baseParams.mathOperations = freePlayGameSettings.operations.split('').filter((c: string) => ['+', '-', '*', '/'].includes(c)) as ('+' | '-' | '*' | '/')[];
  }
  
  if (freePlayGameSettings.count && selectedFreePlayGame === 'math-challenge') {
    baseParams.mathQuestionCount = freePlayGameSettings.count;
  }
  
  if (freePlayGameSettings.maxAttempts) {
    baseParams.wordleMaxAttempts = freePlayGameSettings.maxAttempts;
  }
  
  return baseParams;
}

// Start a game
async function startGame(gameType: GameType, mode: GameMode) {
  currentMode = mode;
  soundManager.play('click');
  
  const config = GAME_CONFIGS[gameType];
  elements.currentGameIcon.textContent = config.icon;
  elements.currentGameName.textContent = config.name;
  
  // Update mode badge
  elements.gameModeLabel.textContent = mode === 'career' ? 'Career' : 'Free Play';
  elements.gameModeLabel.classList.toggle('freeplay', mode === 'freeplay');
  
  // Create session
  currentSession = await createGameSession(gameType);
  
  // Clear and prepare game container
  elements.gameContainer.innerHTML = '<div class="loading">Loading game...</div>';
  
  showScreen('game');
  
  // Start timer
  currentSession.start();
  startTimer();
  
  // Load game module dynamically
  loadGame(gameType, mode);
}

// Timer functions
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = window.setInterval(() => {
    if (currentSession) {
      elements.gameTimer.textContent = formatTime(currentSession.getElapsedSeconds());
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Load game based on type
async function loadGame(gameType: GameType, mode: GameMode) {
  const params = mode === 'career' 
    ? getDifficultyParams(currentProgress.level)
    : getFreePlayDifficultyParams();
  
  switch (gameType) {
    case 'memory-match':
      loadMemoryMatch(params);
      break;
    case 'math-challenge':
      loadMathChallenge(params);
      break;
    case 'simon-says':
      loadSimonSays(params);
      break;
    case 'minesweeper':
      loadMinesweeper(params);
      break;
    case 'sliding-puzzle':
      loadSlidingPuzzle(params);
      break;
    case 'wordle':
      loadWordle(params);
      break;
    case 'number-sequence':
      loadNumberSequence(params);
      break;
    case 'pattern-match':
      loadPatternMatch(params);
      break;
    case 'ai-trivia':
      loadAiTrivia(params);
      break;
    case 'word-association':
      loadWordAssociation(params);
      break;
    case 'fact-or-fiction':
      loadFactOrFiction(params);
      break;
    // New games
    case 'speed-typing':
      loadSpeedTyping(params);
      break;
    case 'color-match':
      loadColorMatch(params);
      break;
    case 'reaction-time':
      loadReactionTime();
      break;
    case 'visual-memory':
      loadVisualMemory(params);
      break;
    case 'anagram':
      loadAnagram(params);
      break;
    case 'emoji-decoder':
      loadEmojiDecoder(params);
      break;
    case 'ai-riddles':
      loadAiRiddles(params);
      break;
    case 'mental-math':
      loadMentalMath(params);
      break;
    case 'spot-difference':
      loadSpotDifference(params);
      break;
    case 'word-search':
      loadWordSearch(params);
      break;
  }
}

// Memory Match Game
function loadMemoryMatch(params: ReturnType<typeof getDifficultyParams>) {
  const { rows, cols } = params.memoryGridSize;
  const totalCards = rows * cols;
  const pairCount = totalCards / 2;
  
  const emojis = ['🎮', '🎯', '⭐', '🎨', '🔥', '💎', '🎵', '🚀', '⚡', '🌟', '🎪', '🏆', '💡', '🎲', '🌈', '🎭', '🎸', '🎹', '🎺', '🎻'];
  const selectedEmojis = emojis.slice(0, pairCount);
  
  let cards = [...selectedEmojis, ...selectedEmojis]
    .map((emoji, index) => ({ id: index, emoji, isFlipped: false, isMatched: false }))
    .sort(() => Math.random() - 0.5);
  
  let flippedCards: number[] = [];
  let matchedPairs = 0;
  let canFlip = true;
  
  const cardBackIcon = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color: white; opacity: 0.9;">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 16v-4M12 8h.01"></path>
  </svg>`;
  
  elements.gameContainer.innerHTML = `
    <div class="memory-grid" style="grid-template-columns: repeat(${cols}, 1fr); max-width: ${cols * 90}px; gap: 12px;">
      ${cards.map((card, i) => `
        <div class="memory-card" data-index="${i}">
          <div class="memory-card-face memory-card-back">${cardBackIcon}</div>
          <div class="memory-card-face memory-card-front">${card.emoji}</div>
        </div>
      `).join('')}
    </div>
  `;
  
  elements.gameContainer.querySelectorAll('.memory-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => {
      if (!canFlip) return;
      
      const index = parseInt(cardEl.getAttribute('data-index')!);
      const card = cards[index];
      
      if (card.isFlipped || card.isMatched) return;
      
      card.isFlipped = true;
      cardEl.classList.add('flipped');
      flippedCards.push(index);
      soundManager.play('flip');
      
      if (flippedCards.length === 2) {
        canFlip = false;
        const [first, second] = flippedCards;
        
        if (cards[first].emoji === cards[second].emoji) {
          cards[first].isMatched = true;
          cards[second].isMatched = true;
          matchedPairs++;
          
          setTimeout(() => {
            document.querySelector(`[data-index="${first}"]`)?.classList.add('matched');
            document.querySelector(`[data-index="${second}"]`)?.classList.add('matched');
            soundManager.play('match');
          }, 300);
          
          flippedCards = [];
          canFlip = true;
          
          if (matchedPairs === pairCount) {
            endGame(true, matchedPairs * 10);
          }
        } else {
          setTimeout(() => {
            cards[first].isFlipped = false;
            cards[second].isFlipped = false;
            document.querySelector(`[data-index="${first}"]`)?.classList.remove('flipped');
            document.querySelector(`[data-index="${second}"]`)?.classList.remove('flipped');
            soundManager.play('wrong');
            flippedCards = [];
            canFlip = true;
          }, 1000);
        }
      }
    });
  });
}

// Math Challenge Game
function loadMathChallenge(params: ReturnType<typeof getDifficultyParams>) {
  const { mathMaxNumber, mathOperations, mathTimePerQuestion, mathQuestionCount } = params;
  
  let currentQuestion = 0;
  let score = 0;
  let questionTimer: number | null = null;
  let timeLeft = mathTimePerQuestion;
  
  function generateQuestion() {
    const op = mathOperations[Math.floor(Math.random() * mathOperations.length)];
    let a = Math.floor(Math.random() * mathMaxNumber) + 1;
    let b = Math.floor(Math.random() * mathMaxNumber) + 1;
    let answer: number;
    
    switch (op) {
      case '+':
        answer = a + b;
        break;
      case '-':
        if (a < b) [a, b] = [b, a];
        answer = a - b;
        break;
      case '*':
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        answer = a * b;
        break;
      case '/':
        answer = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        a = answer * b;
        break;
      default:
        answer = a + b;
    }
    
    const wrongAnswers = new Set<number>();
    while (wrongAnswers.size < 3) {
      const wrong = answer + (Math.floor(Math.random() * 20) - 10);
      if (wrong !== answer && wrong > 0) {
        wrongAnswers.add(wrong);
      }
    }
    
    const options = [answer, ...Array.from(wrongAnswers)].sort(() => Math.random() - 0.5);
    
    return { question: `${a} ${op} ${b} = ?`, answer, options };
  }
  
  function showQuestion() {
    if (currentQuestion >= mathQuestionCount) {
      const finalScore = Math.round((score / mathQuestionCount) * 100);
      endGame(score >= mathQuestionCount / 2, finalScore);
      return;
    }
    
    const q = generateQuestion();
    timeLeft = mathTimePerQuestion;
    
    elements.gameContainer.innerHTML = `
      <div class="game-score">Question ${currentQuestion + 1}/${mathQuestionCount} | Score: <span>${score}</span></div>
      <div class="math-question">${q.question}</div>
      <div class="math-timer" style="text-align: center; margin-bottom: 20px;">
        <span style="font-family: var(--font-display); font-size: 24px; color: var(--warning);">${timeLeft}s</span>
      </div>
      <div class="math-options">
        ${q.options.map(opt => `
          <button class="math-option" data-value="${opt}">${opt}</button>
        `).join('')}
      </div>
    `;
    
    if (questionTimer) clearInterval(questionTimer);
    questionTimer = window.setInterval(() => {
      timeLeft--;
      const timerEl = elements.gameContainer.querySelector('.math-timer span');
      if (timerEl) timerEl.textContent = `${timeLeft}s`;
      
      if (timeLeft <= 0) {
        clearInterval(questionTimer!);
        soundManager.play('wrong');
        currentQuestion++;
        setTimeout(showQuestion, 500);
      }
    }, 1000);
    
    elements.gameContainer.querySelectorAll('.math-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (questionTimer) clearInterval(questionTimer);
        
        const value = parseInt(btn.getAttribute('data-value')!);
        const isCorrect = value === q.answer;
        
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
        
        if (isCorrect) {
          score++;
          soundManager.play('correct');
        } else {
          soundManager.play('wrong');
          elements.gameContainer.querySelectorAll('.math-option').forEach(b => {
            if (parseInt(b.getAttribute('data-value')!) === q.answer) {
              b.classList.add('correct');
            }
          });
        }
        
        currentQuestion++;
        setTimeout(showQuestion, 800);
      });
    });
  }
  
  showQuestion();
}

// Simon Says Game
function loadSimonSays(params: ReturnType<typeof getDifficultyParams>) {
  const { simonStartLength, simonMaxLength, simonSpeed } = params;
  
  const colors = [
    { name: 'red', bg: '#FF3366', glow: 'rgba(255, 51, 102, 0.6)' },
    { name: 'green', bg: '#00FF88', glow: 'rgba(0, 255, 136, 0.6)' },
    { name: 'blue', bg: '#00D4FF', glow: 'rgba(0, 212, 255, 0.6)' },
    { name: 'yellow', bg: '#FFE500', glow: 'rgba(255, 229, 0, 0.6)' },
  ];
  
  let sequence: number[] = [];
  let playerSequence: number[] = [];
  let isShowingSequence = false;
  let currentRound = 0;
  
  function renderGame() {
    elements.gameContainer.innerHTML = `
      <div class="simon-game">
        <div class="simon-info">
          <span class="simon-round">Round: <strong>${currentRound}</strong></span>
          <span class="simon-status" id="simonStatus">Watch the pattern...</span>
        </div>
        <div class="simon-board">
          ${colors.map((c, i) => `
            <button class="simon-btn" data-index="${i}" style="--btn-color: ${c.bg}; --btn-glow: ${c.glow};" ${isShowingSequence ? 'disabled' : ''}>
              <div class="simon-btn-inner"></div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    if (!isShowingSequence) {
      elements.gameContainer.querySelectorAll('.simon-btn').forEach(btn => {
        btn.addEventListener('click', () => handlePlayerInput(parseInt(btn.getAttribute('data-index')!)));
      });
    }
  }
  
  function flashButton(index: number, duration: number = simonSpeed): Promise<void> {
    return new Promise(resolve => {
      const btn = elements.gameContainer.querySelector(`[data-index="${index}"]`) as HTMLElement;
      if (btn) {
        btn.classList.add('active');
        soundManager.playSimonColor(index);
        
        setTimeout(() => {
          btn.classList.remove('active');
          setTimeout(resolve, duration / 3);
        }, duration * 0.7);
      } else {
        resolve();
      }
    });
  }
  
  async function showSequence() {
    isShowingSequence = true;
    const statusEl = document.getElementById('simonStatus');
    if (statusEl) statusEl.textContent = 'Watch the pattern...';
    
    renderGame();
    await new Promise(r => setTimeout(r, 500));
    
    for (let i = 0; i < sequence.length; i++) {
      await flashButton(sequence[i]);
    }
    
    isShowingSequence = false;
    playerSequence = [];
    if (statusEl) statusEl.textContent = 'Your turn!';
    renderGame();
  }
  
  function handlePlayerInput(index: number) {
    if (isShowingSequence) return;
    
    playerSequence.push(index);
    flashButton(index, 200);
    
    const currentIndex = playerSequence.length - 1;
    if (playerSequence[currentIndex] !== sequence[currentIndex]) {
      soundManager.play('wrong');
      endGame(currentRound > 0, currentRound * 10);
      return;
    }
    
    soundManager.play('correct');
    
    if (playerSequence.length === sequence.length) {
      currentRound++;
      
      if (currentRound >= simonMaxLength) {
        endGame(true, currentRound * 15);
        return;
      }
      
      setTimeout(() => {
        sequence.push(Math.floor(Math.random() * 4));
        showSequence();
      }, 1000);
    }
  }
  
  currentRound = 1;
  sequence = [];
  for (let i = 0; i < simonStartLength; i++) {
    sequence.push(Math.floor(Math.random() * 4));
  }
  
  renderGame();
  setTimeout(showSequence, 1000);
}

// Minesweeper Game
function loadMinesweeper(params: ReturnType<typeof getDifficultyParams>) {
  const { rows, cols } = params.minesweeperSize;
  const mineCount = params.minesweeperMines;
  
  type Cell = {
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines: number;
  };
  
  let grid: Cell[][] = [];
  let gameOver = false;
  let firstClick = true;
  let revealedCount = 0;
  let flagCount = 0;
  const totalSafe = rows * cols - mineCount;
  
  function initGrid(excludeRow: number, excludeCol: number) {
    const positions: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1) continue;
        positions.push([r, c]);
      }
    }
    
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    const minePositions = new Set(positions.slice(0, mineCount).map(([r, c]) => `${r},${c}`));
    
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = {
          isMine: minePositions.has(`${r},${c}`),
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0,
        };
      }
    }
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
              count++;
            }
          }
        }
        grid[r][c].adjacentMines = count;
      }
    }
  }
  
  function reveal(r: number, c: number) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (grid[r][c].isRevealed || grid[r][c].isFlagged) return;
    
    grid[r][c].isRevealed = true;
    revealedCount++;
    
    if (grid[r][c].adjacentMines === 0 && !grid[r][c].isMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          reveal(r + dr, c + dc);
        }
      }
    }
  }
  
  function renderGrid() {
    const numberColors = ['', '#00D4FF', '#00FF88', '#FF3366', '#8B5CF6', '#FFE500', '#00D4FF', '#FFFFFF', '#AAAAAA'];
    
    elements.gameContainer.innerHTML = `
      <div class="mine-info">
        <span>💣 ${mineCount - flagCount}</span>
        <span>🚩 ${flagCount}</span>
      </div>
      <div class="mine-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
        ${grid.map((row, r) => row.map((cell, c) => {
          let content = '';
          let className = 'mine-cell';
          
          if (cell.isRevealed) {
            className += ' revealed';
            if (cell.isMine) {
              content = '💥';
              className += ' mine';
            } else if (cell.adjacentMines > 0) {
              content = `<span style="color: ${numberColors[cell.adjacentMines]}">${cell.adjacentMines}</span>`;
            }
          } else if (cell.isFlagged) {
            content = '🚩';
            className += ' flagged';
          }
          
          return `<div class="${className}" data-r="${r}" data-c="${c}">${content}</div>`;
        }).join('')).join('')}
      </div>
      <div class="mine-hint" style="text-align: center; margin-top: 12px; font-size: 12px; color: var(--text-muted);">
        Click to reveal • Right-click to flag
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.mine-cell:not(.revealed)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        const r = parseInt(cell.getAttribute('data-r')!);
        const c = parseInt(cell.getAttribute('data-c')!);
        handleCellClick(r, c);
      });
      
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const r = parseInt(cell.getAttribute('data-r')!);
        const c = parseInt(cell.getAttribute('data-c')!);
        handleRightClick(r, c);
      });
    });
  }
  
  function handleCellClick(r: number, c: number) {
    if (gameOver || grid[r][c].isFlagged) return;
    
    if (firstClick) {
      firstClick = false;
      initGrid(r, c);
    }
    
    if (grid[r][c].isMine) {
      gameOver = true;
      grid[r][c].isRevealed = true;
      soundManager.play('explosion');
      renderGrid();
      setTimeout(() => endGame(false, revealedCount), 1000);
      return;
    }
    
    reveal(r, c);
    soundManager.play('click');
    renderGrid();
    
    if (revealedCount === totalSafe) {
      gameOver = true;
      soundManager.play('win');
      endGame(true, totalSafe + mineCount * 5);
    }
  }
  
  function handleRightClick(r: number, c: number) {
    if (gameOver || grid[r][c].isRevealed) return;
    
    grid[r][c].isFlagged = !grid[r][c].isFlagged;
    flagCount += grid[r][c].isFlagged ? 1 : -1;
    soundManager.play('click');
    renderGrid();
  }
  
  grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = { isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 };
    }
  }
  
  renderGrid();
}

// Sliding Puzzle Game
function loadSlidingPuzzle(params: ReturnType<typeof getDifficultyParams>) {
  const size = params.slidingSize;
  let tiles: number[] = [];
  let emptyIndex: number;
  let moves = 0;
  
  function initPuzzle() {
    tiles = [];
    for (let i = 0; i < size * size - 1; i++) {
      tiles.push(i + 1);
    }
    tiles.push(0);
    emptyIndex = size * size - 1;
    
    const shuffleMoves = size * size * 20;
    for (let i = 0; i < shuffleMoves; i++) {
      const validMoves = getValidMoves();
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      swapTiles(randomMove, emptyIndex);
      emptyIndex = randomMove;
    }
    moves = 0;
  }
  
  function getValidMoves(): number[] {
    const moves: number[] = [];
    const row = Math.floor(emptyIndex / size);
    const col = emptyIndex % size;
    
    if (row > 0) moves.push(emptyIndex - size);
    if (row < size - 1) moves.push(emptyIndex + size);
    if (col > 0) moves.push(emptyIndex - 1);
    if (col < size - 1) moves.push(emptyIndex + 1);
    
    return moves;
  }
  
  function swapTiles(i1: number, i2: number) {
    [tiles[i1], tiles[i2]] = [tiles[i2], tiles[i1]];
  }
  
  function isSolved(): boolean {
    for (let i = 0; i < size * size - 1; i++) {
      if (tiles[i] !== i + 1) return false;
    }
    return tiles[size * size - 1] === 0;
  }
  
  function renderPuzzle() {
    elements.gameContainer.innerHTML = `
      <div class="sliding-info">
        <span>Moves: <strong>${moves}</strong></span>
      </div>
      <div class="sliding-grid" style="grid-template-columns: repeat(${size}, 1fr);">
        ${tiles.map((tile, i) => {
          if (tile === 0) {
            return `<div class="sliding-tile empty" data-index="${i}"></div>`;
          }
          const isAdjacent = getValidMoves().includes(i);
          return `<div class="sliding-tile ${isAdjacent ? 'movable' : ''}" data-index="${i}" data-value="${tile}">${tile}</div>`;
        }).join('')}
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.sliding-tile.movable').forEach(tile => {
      tile.addEventListener('click', () => {
        const index = parseInt(tile.getAttribute('data-index')!);
        handleTileClick(index);
      });
    });
  }
  
  function handleTileClick(index: number) {
    if (!getValidMoves().includes(index)) return;
    
    swapTiles(index, emptyIndex);
    emptyIndex = index;
    moves++;
    soundManager.play('click');
    renderPuzzle();
    
    if (isSolved()) {
      soundManager.play('win');
      const perfectMoves = size * size * 3;
      const score = Math.max(0, 100 - Math.floor((moves - perfectMoves) / 2));
      endGame(true, score);
    }
  }
  
  initPuzzle();
  renderPuzzle();
}

// Wordle Game
function loadWordle(params: ReturnType<typeof getDifficultyParams>) {
  const maxAttempts = params.wordleMaxAttempts;
  
  const words = [
    'BRAIN', 'SMART', 'THINK', 'LOGIC', 'QUICK', 'SOLVE', 'LEARN', 'FOCUS',
    'SHARP', 'SKILL', 'POWER', 'LEVEL', 'SCORE', 'PRIZE', 'LIGHT', 'SPARK',
    'STORM', 'FLASH', 'SWIFT', 'RAPID', 'CLEAR', 'CRISP', 'EXACT', 'PRIME',
    'GREAT', 'SUPER', 'EXTRA', 'TURBO', 'BLAST', 'BOOST', 'CLIMB', 'REACH',
    'WORLD', 'SPACE', 'EARTH', 'OCEAN', 'RIVER', 'MOUNT', 'CLOUD', 'FROST',
    'FLAME', 'BLAZE', 'SHINE', 'GLEAM', 'DREAM', 'QUEST', 'CHASE'
  ];
  
  const targetWord = words[Math.floor(Math.random() * words.length)];
  const guesses: string[] = [];
  let currentGuess = '';
  let gameEnded = false;
  
  function renderGame() {
    const keyboard = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
    const usedLetters: Record<string, 'correct' | 'present' | 'absent'> = {};
    
    guesses.forEach(guess => {
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        if (targetWord[i] === letter) {
          usedLetters[letter] = 'correct';
        } else if (targetWord.includes(letter) && usedLetters[letter] !== 'correct') {
          usedLetters[letter] = 'present';
        } else if (!usedLetters[letter]) {
          usedLetters[letter] = 'absent';
        }
      }
    });
    
    elements.gameContainer.innerHTML = `
      <div class="wordle-game">
        <div class="wordle-grid">
          ${Array(maxAttempts).fill(0).map((_, rowIndex) => {
            const guess = guesses[rowIndex] || (rowIndex === guesses.length ? currentGuess : '');
            const isSubmitted = rowIndex < guesses.length;
            
            return `<div class="wordle-row ${isSubmitted ? 'submitted' : ''}">
              ${Array(5).fill(0).map((_, colIndex) => {
                const letter = guess[colIndex] || '';
                let state = '';
                
                if (isSubmitted && letter) {
                  if (targetWord[colIndex] === letter) {
                    state = 'correct';
                  } else if (targetWord.includes(letter)) {
                    state = 'present';
                  } else {
                    state = 'absent';
                  }
                }
                
                return `<div class="wordle-cell ${state}">${letter}</div>`;
              }).join('')}
            </div>`;
          }).join('')}
        </div>
        
        <div class="wordle-keyboard">
          <div class="keyboard-row">
            ${keyboard.slice(0, 10).map(k => `<button class="key ${usedLetters[k] || ''}" data-key="${k}">${k}</button>`).join('')}
          </div>
          <div class="keyboard-row">
            ${keyboard.slice(10, 19).map(k => `<button class="key ${usedLetters[k] || ''}" data-key="${k}">${k}</button>`).join('')}
          </div>
          <div class="keyboard-row">
            <button class="key wide" data-key="ENTER">ENTER</button>
            ${keyboard.slice(19).map(k => `<button class="key ${usedLetters[k] || ''}" data-key="${k}">${k}</button>`).join('')}
            <button class="key wide" data-key="BACK">⌫</button>
          </div>
        </div>
      </div>
    `;
    
    if (!gameEnded) {
      elements.gameContainer.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', () => {
          const k = key.getAttribute('data-key')!;
          handleKeyPress(k);
        });
      });
    }
  }
  
  function handleKeyPress(key: string) {
    if (gameEnded) return;
    
    if (key === 'ENTER') {
      if (currentGuess.length === 5) {
        submitGuess();
      }
    } else if (key === 'BACK') {
      currentGuess = currentGuess.slice(0, -1);
      renderGame();
    } else if (currentGuess.length < 5) {
      currentGuess += key;
      soundManager.play('click');
      renderGame();
    }
  }
  
  function submitGuess() {
    guesses.push(currentGuess);
    
    if (currentGuess === targetWord) {
      gameEnded = true;
      soundManager.play('win');
      renderGame();
      setTimeout(() => {
        const score = (maxAttempts - guesses.length + 1) * 20;
        endGame(true, score);
      }, 1500);
      return;
    }
    
    if (guesses.length >= maxAttempts) {
      gameEnded = true;
      soundManager.play('lose');
      renderGame();
      setTimeout(() => {
        alert(`The word was: ${targetWord}`);
        endGame(false, guesses.length * 5);
      }, 1000);
      return;
    }
    
    currentGuess = '';
    soundManager.play('correct');
    renderGame();
  }
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (gameEnded) return;
    
    if (e.key === 'Enter') {
      handleKeyPress('ENTER');
    } else if (e.key === 'Backspace') {
      handleKeyPress('BACK');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKeyPress(e.key.toUpperCase());
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  renderGame();
}

// Number Sequence Game
function loadNumberSequence(params: ReturnType<typeof getDifficultyParams>) {
  const complexity = params.sequenceComplexity;
  let currentProblem = 0;
  let score = 0;
  const totalProblems = 5;
  
  type SequencePattern = {
    name: string;
    generate: (start: number, length: number) => number[];
    nextValue: (seq: number[]) => number;
  };
  
  const patterns: SequencePattern[] = [
    {
      name: 'Add constant',
      generate: (start, length) => {
        const diff = Math.floor(Math.random() * 5) + 2;
        return Array.from({ length }, (_, i) => start + i * diff);
      },
      nextValue: (seq) => seq[seq.length - 1] + (seq[1] - seq[0])
    },
    {
      name: 'Multiply by 2',
      generate: (_start, length) => {
        const base = Math.floor(Math.random() * 3) + 2;
        return Array.from({ length }, (_, i) => base * Math.pow(2, i));
      },
      nextValue: (seq) => seq[seq.length - 1] * 2
    },
    {
      name: 'Fibonacci-like',
      generate: (_start, length) => {
        const seq = [1, 1];
        for (let i = 2; i < length; i++) {
          seq.push(seq[i - 1] + seq[i - 2]);
        }
        return seq;
      },
      nextValue: (seq) => seq[seq.length - 1] + seq[seq.length - 2]
    },
    {
      name: 'Squares',
      generate: (_start, length) => Array.from({ length }, (_, i) => (i + 1) * (i + 1)),
      nextValue: (seq) => {
        const n = Math.sqrt(seq[seq.length - 1]) + 1;
        return n * n;
      }
    },
    {
      name: 'Triangular',
      generate: (_start, length) => Array.from({ length }, (_, i) => ((i + 1) * (i + 2)) / 2),
      nextValue: (seq) => {
        const n = seq.length + 1;
        return (n * (n + 1)) / 2;
      }
    },
  ];
  
  function generateProblem() {
    const availablePatterns = patterns.slice(0, Math.min(complexity + 1, patterns.length));
    const pattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
    const start = Math.floor(Math.random() * 5) + 1;
    const sequence = pattern.generate(start, 5);
    const answer = pattern.nextValue(sequence);
    
    const options = [answer];
    while (options.length < 4) {
      const wrong = answer + (Math.floor(Math.random() * 20) - 10);
      if (!options.includes(wrong) && wrong > 0) {
        options.push(wrong);
      }
    }
    options.sort(() => Math.random() - 0.5);
    
    return { sequence, answer, options };
  }
  
  function showProblem() {
    if (currentProblem >= totalProblems) {
      endGame(score >= totalProblems / 2, score * 20);
      return;
    }
    
    const problem = generateProblem();
    
    elements.gameContainer.innerHTML = `
      <div class="sequence-game">
        <div class="sequence-info">Problem ${currentProblem + 1}/${totalProblems} | Score: ${score}</div>
        <div class="sequence-display">
          ${problem.sequence.map(n => `<span class="seq-num">${n}</span>`).join('<span class="seq-arrow">→</span>')}
          <span class="seq-arrow">→</span>
          <span class="seq-num unknown">?</span>
        </div>
        <div class="sequence-options">
          ${problem.options.map(opt => `
            <button class="seq-option" data-value="${opt}">${opt}</button>
          `).join('')}
        </div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.seq-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = parseInt(btn.getAttribute('data-value')!);
        const isCorrect = value === problem.answer;
        
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
        
        if (isCorrect) {
          score++;
          soundManager.play('correct');
        } else {
          soundManager.play('wrong');
          elements.gameContainer.querySelectorAll('.seq-option').forEach(b => {
            if (parseInt(b.getAttribute('data-value')!) === problem.answer) {
              b.classList.add('correct');
            }
          });
        }
        
        currentProblem++;
        setTimeout(showProblem, 1000);
      });
    });
  }
  
  showProblem();
}

// Pattern Match Game (Visual patterns - no AI)
function loadPatternMatch(params: ReturnType<typeof getDifficultyParams>) {
  const gridSize = params.patternGridSize;
  const patternLength = params.patternLength;
  
  let pattern: number[] = [];
  let playerPattern: number[] = [];
  let phase: 'show' | 'input' | 'result' = 'show';
  let currentRound = 1;
  let score = 0;
  const totalRounds = 5;
  
  function generatePattern() {
    pattern = [];
    const totalCells = gridSize * gridSize;
    while (pattern.length < patternLength + currentRound - 1) {
      const cell = Math.floor(Math.random() * totalCells);
      if (!pattern.includes(cell)) {
        pattern.push(cell);
      }
    }
  }
  
  function renderGrid(showPattern: boolean = false, showResults: boolean = false) {
    elements.gameContainer.innerHTML = `
      <div class="pattern-game">
        <div class="pattern-info">
          <span>Round ${currentRound}/${totalRounds}</span>
          <span>Score: ${score}</span>
        </div>
        <div class="pattern-status" id="patternStatus">
          ${phase === 'show' ? '👀 Memorize the pattern!' : '🎯 Tap the highlighted cells!'}
        </div>
        <div class="pattern-grid" style="grid-template-columns: repeat(${gridSize}, 1fr);">
          ${Array(gridSize * gridSize).fill(0).map((_, i) => {
            let className = 'pattern-cell';
            if (showPattern && pattern.includes(i)) {
              className += ' highlighted';
            }
            if (showResults) {
              if (playerPattern.includes(i) && pattern.includes(i)) {
                className += ' correct';
              } else if (playerPattern.includes(i) && !pattern.includes(i)) {
                className += ' wrong';
              } else if (pattern.includes(i)) {
                className += ' missed';
              }
            }
            return `<div class="${className}" data-index="${i}"></div>`;
          }).join('')}
        </div>
      </div>
    `;
    
    if (phase === 'input' && !showResults) {
      elements.gameContainer.querySelectorAll('.pattern-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const index = parseInt(cell.getAttribute('data-index')!);
          handleCellClick(index, cell as HTMLElement);
        });
      });
    }
  }
  
  function handleCellClick(index: number, cell: HTMLElement) {
    if (playerPattern.includes(index)) return;
    
    playerPattern.push(index);
    cell.classList.add('selected');
    soundManager.play('click');
    
    if (playerPattern.length === pattern.length) {
      checkPattern();
    }
  }
  
  function checkPattern() {
    phase = 'result';
    const correct = playerPattern.filter(p => pattern.includes(p)).length;
    const accuracy = correct / pattern.length;
    
    renderGrid(false, true);
    
    if (accuracy >= 0.8) {
      score += Math.floor(accuracy * 20);
      soundManager.play('correct');
    } else {
      soundManager.play('wrong');
    }
    
    setTimeout(() => {
      currentRound++;
      if (currentRound > totalRounds) {
        endGame(score >= totalRounds * 10, score);
      } else {
        startRound();
      }
    }, 1500);
  }
  
  function startRound() {
    playerPattern = [];
    generatePattern();
    phase = 'show';
    renderGrid(true);
    
    setTimeout(() => {
      phase = 'input';
      renderGrid(false);
    }, 1500 + currentRound * 300);
  }
  
  startRound();
}

// AI Trivia Game - Unlimited mode with 3 lives
async function loadAiTrivia(params: ReturnType<typeof getDifficultyParams>) {
  const difficulty = freePlayDifficulty || (params.triviaQuestionCount <= 5 ? 'easy' : params.triviaQuestionCount <= 8 ? 'medium' : 'hard');
  const category = freePlayGameSettings.category !== 'random' ? freePlayGameSettings.category : null;
  
  const MAX_LIVES = 3;
  let lives = MAX_LIVES;
  let score = 0;
  let questionNumber = 0;
  let questions: any[] = [];
  let isLoading = false;
  let gameEnded = false;
  
  // Fetch questions from AI
  async function fetchMoreQuestions() {
    if (isLoading) return;
    isLoading = true;
    
    try {
      const response = await fetch(`${BACKEND_URL}/games/trivia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, category, count: 5 })
      });
      
      if (!response.ok) throw new Error('Failed to fetch trivia');
      
      const data = await response.json();
      questions.push(...data.questions);
      console.log(`📚 Loaded ${data.questions.length} more questions. Total: ${questions.length}`);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Render lives display
  function renderLives() {
    return `<div class="lives-display">
      ${Array(MAX_LIVES).fill(0).map((_, i) => `
        <span class="life-heart ${i < lives ? 'active' : 'lost'}">❤️</span>
      `).join('')}
    </div>`;
  }
  
  // Show loading screen
  elements.gameContainer.innerHTML = `
    <div class="loading-game">
      <div class="loading-spinner">🧠</div>
      <p>AI is generating trivia questions...</p>
    </div>
  `;
  
  // Initial fetch
  await fetchMoreQuestions();
  
  if (questions.length === 0) {
    elements.gameContainer.innerHTML = `
      <div class="error-message">
        <p style="font-size: 48px;">⚠️</p>
        <p>Could not connect to AI service</p>
        <p style="font-size: 14px; color: var(--text-muted);">Make sure the backend is running</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
    return;
  }
  
  function showQuestion() {
    if (gameEnded) return;
    
    // Check if game over
    if (lives <= 0) {
      gameEnded = true;
      endGame(score > 0, score);
      return;
    }
    
    // Pre-fetch more questions when running low
    if (questions.length - questionNumber <= 2 && !isLoading) {
      fetchMoreQuestions();
    }
    
    // Wait for questions if we ran out
    if (questionNumber >= questions.length) {
      elements.gameContainer.innerHTML = `
        <div class="loading-game">
          <div class="loading-spinner">🧠</div>
          <p>Loading more questions...</p>
        </div>
      `;
      setTimeout(showQuestion, 500);
      return;
    }
    
    const q = questions[questionNumber];
    
    elements.gameContainer.innerHTML = `
      <div class="trivia-game unlimited">
        <div class="trivia-header">
          ${renderLives()}
          <div class="trivia-score">
            <span class="score-label">Score</span>
            <span class="score-value">${score}</span>
          </div>
        </div>
        <div class="trivia-info">
          <span>Question ${questionNumber + 1}</span>
          <span class="trivia-category">${q.category}</span>
        </div>
        <div class="trivia-question">${q.question}</div>
        <div class="trivia-options">
          ${q.options.map((opt: string, i: number) => `
            <button class="trivia-option" data-value="${opt}">${String.fromCharCode(65 + i)}. ${opt}</button>
          `).join('')}
        </div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.trivia-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (gameEnded) return;
        
        const value = btn.getAttribute('data-value')!;
        const isCorrect = value === q.correct_answer;
        
        elements.gameContainer.querySelectorAll('.trivia-option').forEach(b => {
          (b as HTMLButtonElement).disabled = true;
          if (b.getAttribute('data-value') === q.correct_answer) {
            b.classList.add('correct');
          }
        });
        
        if (isCorrect) {
          btn.classList.add('correct');
          score++;
          soundManager.play('correct');
        } else {
          btn.classList.add('wrong');
          lives--;
          soundManager.play('wrong');
          
          // Update lives display
          const livesDisplay = elements.gameContainer.querySelector('.lives-display');
          if (livesDisplay) {
            livesDisplay.innerHTML = renderLives().replace('<div class="lives-display">', '').replace('</div>', '');
          }
        }
        
        const explanationEl = document.createElement('div');
        explanationEl.className = 'trivia-explanation';
        explanationEl.innerHTML = `<strong>💡</strong> ${q.explanation}`;
        elements.gameContainer.querySelector('.trivia-game')?.appendChild(explanationEl);
        
        questionNumber++;
        setTimeout(showQuestion, 2000);
      });
    });
  }
  
  showQuestion();
}

// Word Association Game
async function loadWordAssociation(params: ReturnType<typeof getDifficultyParams>) {
  const difficulty = freePlayDifficulty || (params.sequenceComplexity <= 2 ? 'easy' : params.sequenceComplexity <= 3 ? 'medium' : 'hard');
  
  let currentRound = 0;
  let score = 0;
  const totalRounds = 5;
  let currentWord = '';
  let currentCategory = '';
  
  async function startRound() {
    if (currentRound >= totalRounds) {
      endGame(score >= totalRounds / 2, score * 20);
      return;
    }
    
    elements.gameContainer.innerHTML = `
      <div class="loading-game">
        <div class="loading-spinner">🔤</div>
        <p>Getting next word...</p>
      </div>
    `;
    
    try {
      const response = await fetch(`${BACKEND_URL}/games/word-association/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty })
      });
      
      if (!response.ok) throw new Error('Failed to start word association');
      
      const data = await response.json();
      currentWord = data.starting_word;
      currentCategory = data.target_category;
      
      renderWordInput(data.hint);
      
    } catch (error) {
      showError();
    }
  }
  
  function renderWordInput(hint: string) {
    const categoryLabels: Record<string, string> = {
      'synonym': '🔄 Synonym',
      'antonym': '↔️ Antonym',
      'related': '🔗 Related'
    };
    
    elements.gameContainer.innerHTML = `
      <div class="word-game">
        <div class="word-info">
          <span>Round ${currentRound + 1}/${totalRounds}</span>
          <span class="word-category">${categoryLabels[currentCategory] || currentCategory}</span>
          <span>Score: ${score}</span>
        </div>
        <div class="word-target">
          <span class="target-label">Find a ${currentCategory} for:</span>
          <span class="target-word">${currentWord.toUpperCase()}</span>
        </div>
        <div class="word-hint">${hint}</div>
        <div class="word-input-area">
          <input type="text" class="word-input" id="wordInput" placeholder="Type your answer..." maxlength="30" autocomplete="off">
          <button class="word-submit" id="wordSubmit">Submit</button>
        </div>
      </div>
    `;
    
    const input = document.getElementById('wordInput') as HTMLInputElement;
    const submitBtn = document.getElementById('wordSubmit')!;
    
    input.focus();
    
    const submitAnswer = async () => {
      const userWord = input.value.trim().toLowerCase();
      if (!userWord) return;
      
      submitBtn.textContent = 'Checking...';
      (submitBtn as HTMLButtonElement).disabled = true;
      input.disabled = true;
      
      try {
        const response = await fetch(`${BACKEND_URL}/games/word-association/judge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_word: currentWord,
            user_word: userWord,
            category: currentCategory
          })
        });
        
        if (!response.ok) throw new Error('Failed to judge');
        
        const result = await response.json();
        showResult(userWord, result);
        
      } catch (error) {
        showError();
      }
    };
    
    submitBtn.addEventListener('click', submitAnswer);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
  
  function showResult(userWord: string, result: { is_valid: boolean; score: number; explanation: string; better_examples: string[] }) {
    const isGood = result.is_valid && result.score >= 50;
    
    if (isGood) {
      score++;
      soundManager.play('correct');
    } else {
      soundManager.play('wrong');
    }
    
    elements.gameContainer.innerHTML = `
      <div class="word-result ${isGood ? 'correct' : 'wrong'}">
        <div class="result-icon">${isGood ? '✅' : '❌'}</div>
        <div class="result-words">
          <span class="original-word">${currentWord}</span>
          <span class="arrow">→</span>
          <span class="user-word">${userWord}</span>
        </div>
        <div class="result-score">Score: ${result.score}/100</div>
        <div class="result-explanation">${result.explanation}</div>
        ${result.better_examples.length > 0 ? `
          <div class="better-examples">
            <strong>Better examples:</strong> ${result.better_examples.join(', ')}
          </div>
        ` : ''}
        <div class="countdown-timer" id="wordCountdown">Next in 7s...</div>
      </div>
    `;
    
    // Countdown timer display
    let countdown = 7;
    const countdownEl = document.getElementById('wordCountdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) countdownEl.textContent = `Next in ${countdown}s...`;
      if (countdown <= 0) clearInterval(countdownInterval);
    }, 1000);
    
    currentRound++;
    setTimeout(startRound, 7000); // Increased from 2500ms to 7000ms
  }
  
  function showError() {
    elements.gameContainer.innerHTML = `
      <div class="error-message">
        <p style="font-size: 48px;">⚠️</p>
        <p>Could not connect to AI service</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
  
  startRound();
}

// Fact or Fiction Game - Unlimited mode with 3 lives
async function loadFactOrFiction(params: ReturnType<typeof getDifficultyParams>) {
  const difficulty = freePlayDifficulty || (params.triviaQuestionCount <= 5 ? 'easy' : 'medium');
  
  const MAX_LIVES = 3;
  let lives = MAX_LIVES;
  let score = 0;
  let statementNumber = 0;
  let statements: any[] = [];
  let isLoading = false;
  let gameEnded = false;
  
  // Fetch statements from AI
  async function fetchMoreStatements() {
    if (isLoading) return;
    isLoading = true;
    
    try {
      const response = await fetch(`${BACKEND_URL}/games/fact-or-fiction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, count: 5 })
      });
      
      if (!response.ok) throw new Error('Failed to fetch statements');
      
      const data = await response.json();
      statements.push(...data.statements);
      console.log(`📚 Loaded ${data.statements.length} more statements. Total: ${statements.length}`);
    } catch (error) {
      console.error('Error fetching statements:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Render lives display
  function renderLives() {
    return `<div class="lives-display">
      ${Array(MAX_LIVES).fill(0).map((_, i) => `
        <span class="life-heart ${i < lives ? 'active' : 'lost'}">❤️</span>
      `).join('')}
    </div>`;
  }
  
  // Show loading screen
  elements.gameContainer.innerHTML = `
    <div class="loading-game">
      <div class="loading-spinner">🤔</div>
      <p>AI is generating statements...</p>
    </div>
  `;
  
  // Initial fetch
  await fetchMoreStatements();
  
  if (statements.length === 0) {
    elements.gameContainer.innerHTML = `
      <div class="error-message">
        <p style="font-size: 48px;">⚠️</p>
        <p>Could not connect to AI service</p>
        <p style="font-size: 14px; color: var(--text-muted);">Make sure the backend is running</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
    return;
  }
  
  function showStatement() {
    if (gameEnded) return;
    
    // Check if game over
    if (lives <= 0) {
      gameEnded = true;
      endGame(score > 0, score);
      return;
    }
    
    // Pre-fetch more statements when running low
    if (statements.length - statementNumber <= 2 && !isLoading) {
      fetchMoreStatements();
    }
    
    // Wait for statements if we ran out
    if (statementNumber >= statements.length) {
      elements.gameContainer.innerHTML = `
        <div class="loading-game">
          <div class="loading-spinner">🤔</div>
          <p>Loading more statements...</p>
        </div>
      `;
      setTimeout(showStatement, 500);
      return;
    }
    
    const s = statements[statementNumber];
    
    elements.gameContainer.innerHTML = `
      <div class="fof-game unlimited">
        <div class="fof-header">
          ${renderLives()}
          <div class="fof-score">
            <span class="score-label">Score</span>
            <span class="score-value">${score}</span>
          </div>
        </div>
        <div class="fof-info">
          <span>Statement ${statementNumber + 1}</span>
          <span class="fof-category">${s.category}</span>
        </div>
        <div class="fof-statement">"${s.statement}"</div>
        <div class="fof-buttons">
          <button class="fof-btn fact" data-answer="true">
            <span class="fof-icon">✅</span>
            <span>FACT</span>
          </button>
          <button class="fof-btn fiction" data-answer="false">
            <span class="fof-icon">❌</span>
            <span>FICTION</span>
          </button>
        </div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.fof-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (gameEnded) return;
        
        const answer = btn.getAttribute('data-answer') === 'true';
        const isCorrect = answer === s.is_fact;
        
        elements.gameContainer.querySelectorAll('.fof-btn').forEach(b => {
          (b as HTMLButtonElement).disabled = true;
        });
        
        if (isCorrect) {
          btn.classList.add('correct');
          score++;
          soundManager.play('correct');
        } else {
          btn.classList.add('wrong');
          lives--;
          const correctBtn = elements.gameContainer.querySelector(`[data-answer="${s.is_fact}"]`);
          correctBtn?.classList.add('correct');
          soundManager.play('wrong');
          
          // Update lives display
          const livesDisplay = elements.gameContainer.querySelector('.lives-display');
          if (livesDisplay) {
            livesDisplay.innerHTML = renderLives().replace('<div class="lives-display">', '').replace('</div>', '');
          }
        }
        
        const explanationEl = document.createElement('div');
        explanationEl.className = 'fof-explanation';
        explanationEl.innerHTML = `
          <div class="fof-verdict">${s.is_fact ? '✅ This is a FACT!' : '❌ This is FICTION!'}</div>
          <p>${s.explanation}</p>
        `;
        elements.gameContainer.querySelector('.fof-game')?.appendChild(explanationEl);
        
        statementNumber++;
        setTimeout(showStatement, 2500);
      });
    });
  }
  
  showStatement();
}

// ==================== NEW GAMES ====================

// Speed Typing Game
function loadSpeedTyping(_params: ReturnType<typeof getDifficultyParams>) {
  const words = [
    'brain', 'think', 'smart', 'quick', 'logic', 'solve', 'learn', 'focus',
    'power', 'skill', 'sharp', 'speed', 'fast', 'type', 'word', 'game',
    'challenge', 'keyboard', 'fingers', 'practice', 'memory', 'reaction',
    'intelligence', 'cognitive', 'mental', 'exercise', 'training', 'brain',
    'puzzle', 'trivia', 'knowledge', 'wisdom', 'genius', 'expert', 'master'
  ];
  
  let currentWordIndex = 0;
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  const totalWords = 10;
  let startTime = 0;
  
  function showWord() {
    if (mistakes >= MAX_MISTAKES) {
      endGame(score > 0, score * 10);
      return;
    }
    
    if (currentWordIndex >= totalWords) {
      const timeBonus = Math.max(0, 100 - Math.floor((Date.now() - startTime) / 1000));
      endGame(true, score * 10 + timeBonus);
      return;
    }
    
    const word = words[Math.floor(Math.random() * words.length)];
    
    elements.gameContainer.innerHTML = `
      <div class="typing-game">
        <div class="typing-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="typing-score">
            <span class="score-label">Score</span>
            <span class="score-value">${score}</span>
          </div>
        </div>
        <div class="typing-word-display">${word.toUpperCase()}</div>
        <input type="text" class="typing-input" id="typingInput" placeholder="Type the word..." autocomplete="off" autocapitalize="off">
        <div class="typing-progress">Word ${currentWordIndex + 1} of ${totalWords}</div>
      </div>
    `;
    
    const input = document.getElementById('typingInput') as HTMLInputElement;
    input.focus();
    
    if (currentWordIndex === 0) startTime = Date.now();
    
    input.addEventListener('input', () => {
      const typed = input.value.toLowerCase();
      if (typed === word) {
        score++;
        soundManager.play('correct');
        currentWordIndex++;
        setTimeout(showWord, 300);
      } else if (typed.length >= word.length) {
        mistakes++;
        soundManager.play('wrong');
        input.value = '';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
        if (mistakes >= MAX_MISTAKES) {
          setTimeout(showWord, 500);
        }
      }
    });
  }
  
  showWord();
}

// Color Match (Stroop Test)
function loadColorMatch(_params: ReturnType<typeof getDifficultyParams>) {
  const colors = [
    { name: 'RED', color: '#FF3366' },
    { name: 'BLUE', color: '#00D4FF' },
    { name: 'GREEN', color: '#00FF88' },
    { name: 'YELLOW', color: '#FFE500' },
    { name: 'PURPLE', color: '#8B5CF6' },
  ];
  
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  let round = 0;
  const totalRounds = 15;
  
  function showRound() {
    if (mistakes >= MAX_MISTAKES || round >= totalRounds) {
      endGame(score > 0, score * 10);
      return;
    }
    
    // Random word and color (often mismatched for Stroop effect)
    const wordColor = colors[Math.floor(Math.random() * colors.length)];
    const textColor = Math.random() > 0.3 
      ? colors[Math.floor(Math.random() * colors.length)]
      : wordColor;
    
    elements.gameContainer.innerHTML = `
      <div class="color-match-game">
        <div class="color-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="color-score">Score: ${score}</div>
        </div>
        <div class="color-instruction">What COLOR is the text?</div>
        <div class="color-word" style="color: ${textColor.color}">${wordColor.name}</div>
        <div class="color-options">
          ${colors.map(c => `
            <button class="color-option" data-color="${c.name}" style="background: ${c.color}"></button>
          `).join('')}
        </div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-color');
        const isCorrect = selected === textColor.name;
        
        if (isCorrect) {
          score++;
          soundManager.play('correct');
        } else {
          mistakes++;
          soundManager.play('wrong');
        }
        
        round++;
        setTimeout(showRound, 300);
      });
    });
  }
  
  showRound();
}

// Reaction Time Game
function loadReactionTime() {
  let attempts = 0;
  let totalTime = 0;
  const maxAttempts = 5;
  let waitTimeout: number | null = null;
  let startTime = 0;
  
  function showWaiting() {
    if (attempts >= maxAttempts) {
      const avgTime = Math.round(totalTime / maxAttempts);
      const score = Math.max(0, 500 - avgTime);
      endGame(avgTime < 400, score);
      return;
    }
    
    elements.gameContainer.innerHTML = `
      <div class="reaction-game waiting">
        <div class="reaction-info">Attempt ${attempts + 1}/${maxAttempts}</div>
        <div class="reaction-box">
          <div class="reaction-text">Wait for GREEN...</div>
        </div>
        <div class="reaction-hint">Click when the box turns green!</div>
      </div>
    `;
    
    const box = elements.gameContainer.querySelector('.reaction-box')!;
    
    // Random delay 1-4 seconds
    const delay = 1000 + Math.random() * 3000;
    
    waitTimeout = window.setTimeout(() => {
      startTime = Date.now();
      box.classList.add('ready');
      (box.querySelector('.reaction-text') as HTMLElement).textContent = 'CLICK NOW!';
      
      box.addEventListener('click', handleClick);
    }, delay);
    
    // Handle early click
    box.addEventListener('click', handleEarlyClick);
  }
  
  function handleEarlyClick() {
    if (startTime === 0) {
      if (waitTimeout) clearTimeout(waitTimeout);
      soundManager.play('wrong');
      
      elements.gameContainer.innerHTML = `
        <div class="reaction-game too-early">
          <div class="reaction-box">
            <div class="reaction-text">Too Early! 😅</div>
          </div>
        </div>
      `;
      
      setTimeout(showWaiting, 1500);
    }
  }
  
  function handleClick() {
    if (startTime > 0) {
      const reactionTime = Date.now() - startTime;
      totalTime += reactionTime;
      attempts++;
      startTime = 0;
      
      soundManager.play('correct');
      
      elements.gameContainer.innerHTML = `
        <div class="reaction-game result">
          <div class="reaction-time">${reactionTime}ms</div>
          <div class="reaction-rating">${reactionTime < 200 ? '🔥 Incredible!' : reactionTime < 300 ? '⚡ Fast!' : reactionTime < 400 ? '👍 Good' : '🐢 Keep trying'}</div>
        </div>
      `;
      
      setTimeout(showWaiting, 1500);
    }
  }
  
  showWaiting();
}

// Visual Memory Game
function loadVisualMemory(_params: ReturnType<typeof getDifficultyParams>) {
  let gridSize = 3;
  let level = 1;
  let lives = 3;
  
  function startLevel() {
    if (lives <= 0) {
      endGame(level > 1, (level - 1) * 20);
      return;
    }
    
    const totalCells = gridSize * gridSize;
    const highlightCount = Math.min(gridSize + level - 1, Math.floor(totalCells * 0.6));
    
    // Generate random highlighted cells
    const highlighted: number[] = [];
    while (highlighted.length < highlightCount) {
      const cell = Math.floor(Math.random() * totalCells);
      if (!highlighted.includes(cell)) highlighted.push(cell);
    }
    
    // Show pattern
    elements.gameContainer.innerHTML = `
      <div class="visual-memory-game">
        <div class="vm-header">
          <div class="lives-display">
            ${Array(3).fill(0).map((_, i) => `
              <span class="life-heart ${i < lives ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="vm-level">Level ${level}</div>
        </div>
        <div class="vm-instruction">Memorize the pattern!</div>
        <div class="vm-grid" style="grid-template-columns: repeat(${gridSize}, 1fr)">
          ${Array(totalCells).fill(0).map((_, i) => `
            <div class="vm-cell ${highlighted.includes(i) ? 'highlighted' : ''}" data-index="${i}"></div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Hide after delay
    setTimeout(() => {
      let playerClicks: number[] = [];
      let wrongClicks = 0;
      
      elements.gameContainer.innerHTML = `
        <div class="visual-memory-game">
          <div class="vm-header">
            <div class="lives-display">
              ${Array(3).fill(0).map((_, i) => `
                <span class="life-heart ${i < lives ? 'active' : 'lost'}">❤️</span>
              `).join('')}
            </div>
            <div class="vm-level">Level ${level}</div>
          </div>
          <div class="vm-instruction">Click the highlighted cells! (${highlightCount - playerClicks.length} left)</div>
          <div class="vm-grid" style="grid-template-columns: repeat(${gridSize}, 1fr)">
            ${Array(totalCells).fill(0).map((_, i) => `
              <div class="vm-cell" data-index="${i}"></div>
            `).join('')}
          </div>
        </div>
      `;
      
      elements.gameContainer.querySelectorAll('.vm-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const index = parseInt(cell.getAttribute('data-index')!);
          if (playerClicks.includes(index)) return;
          
          playerClicks.push(index);
          
          if (highlighted.includes(index)) {
            cell.classList.add('correct');
            soundManager.play('correct');
            
            // Update instruction
            const instruction = elements.gameContainer.querySelector('.vm-instruction');
            if (instruction) {
              instruction.textContent = `Click the highlighted cells! (${highlightCount - playerClicks.filter(c => highlighted.includes(c)).length} left)`;
            }
            
            // Check if all found
            if (playerClicks.filter(c => highlighted.includes(c)).length === highlightCount) {
              level++;
              if (level > 3 && gridSize < 5) gridSize++;
              setTimeout(startLevel, 1000);
            }
          } else {
            cell.classList.add('wrong');
            wrongClicks++;
            soundManager.play('wrong');
            
            if (wrongClicks >= 3) {
              lives--;
              if (lives > 0) {
                setTimeout(startLevel, 1000);
              } else {
                setTimeout(() => endGame(level > 1, (level - 1) * 20), 1000);
              }
            }
          }
        });
      });
    }, 1500 + level * 200);
  }
  
  startLevel();
}

// Anagram Game
function loadAnagram(_params: ReturnType<typeof getDifficultyParams>) {
  const wordList = [
    'BRAIN', 'SMART', 'THINK', 'LOGIC', 'SOLVE', 'LEARN', 'FOCUS', 'POWER',
    'QUICK', 'SHARP', 'PUZZLE', 'TRIVIA', 'WISDOM', 'GENIUS', 'MEMORY',
    'SKILL', 'SPEED', 'MENTAL', 'MASTER'
  ];
  
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  let round = 0;
  
  function scramble(word: string): string {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }
  
  function showRound() {
    if (mistakes >= MAX_MISTAKES) {
      endGame(score > 0, score * 15);
      return;
    }
    
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    let scrambled = scramble(word);
    while (scrambled === word) scrambled = scramble(word);
    
    elements.gameContainer.innerHTML = `
      <div class="anagram-game">
        <div class="anagram-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="anagram-score">Score: ${score}</div>
        </div>
        <div class="anagram-scrambled">${scrambled}</div>
        <input type="text" class="anagram-input" id="anagramInput" placeholder="Unscramble the word..." maxlength="${word.length}" autocomplete="off" autocapitalize="characters">
        <div class="anagram-hint">Hint: ${word.length} letters</div>
      </div>
    `;
    
    const input = document.getElementById('anagramInput') as HTMLInputElement;
    input.focus();
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const answer = input.value.toUpperCase();
        if (answer === word) {
          score++;
          soundManager.play('correct');
          round++;
          setTimeout(showRound, 500);
        } else {
          mistakes++;
          soundManager.play('wrong');
          input.value = '';
          input.placeholder = `It was: ${word}`;
          setTimeout(showRound, 1500);
        }
      }
    });
  }
  
  showRound();
}

// Emoji Decoder Game
function loadEmojiDecoder(_params: ReturnType<typeof getDifficultyParams>) {
  const puzzles = [
    { emojis: '🌙⭐', answer: 'NIGHT SKY', hints: ['Two words', 'Look up'] },
    { emojis: '🔥🥊', answer: 'BOXING', hints: ['Sport', 'Fighting'] },
    { emojis: '🍕🇮🇹', answer: 'ITALY', hints: ['Country', 'Europe'] },
    { emojis: '📖🐛', answer: 'BOOKWORM', hints: ['Reader', 'One word'] },
    { emojis: '🎂🎈', answer: 'BIRTHDAY', hints: ['Celebration', 'Annual'] },
    { emojis: '☀️🌻', answer: 'SUNFLOWER', hints: ['Plant', 'Yellow'] },
    { emojis: '🌊🏄', answer: 'SURFING', hints: ['Sport', 'Beach'] },
    { emojis: '❄️👸', answer: 'FROZEN', hints: ['Movie', 'Disney'] },
    { emojis: '🎭🎪', answer: 'CIRCUS', hints: ['Entertainment', 'Tent'] },
    { emojis: '🌈🦄', answer: 'UNICORN', hints: ['Mythical', 'Horse'] },
    { emojis: '🧠💡', answer: 'IDEA', hints: ['Thought', 'Lightbulb moment'] },
    { emojis: '⏰🐊', answer: 'TICK TOCK', hints: ['Sound', 'Peter Pan'] },
  ];
  
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  let usedPuzzles: number[] = [];
  
  function showPuzzle() {
    if (mistakes >= MAX_MISTAKES || usedPuzzles.length >= puzzles.length) {
      endGame(score > 0, score * 20);
      return;
    }
    
    let puzzleIndex;
    do {
      puzzleIndex = Math.floor(Math.random() * puzzles.length);
    } while (usedPuzzles.includes(puzzleIndex));
    usedPuzzles.push(puzzleIndex);
    
    const puzzle = puzzles[puzzleIndex];
    
    elements.gameContainer.innerHTML = `
      <div class="emoji-game">
        <div class="emoji-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="emoji-score">Score: ${score}</div>
        </div>
        <div class="emoji-display">${puzzle.emojis}</div>
        <div class="emoji-question">What does this represent?</div>
        <input type="text" class="emoji-input" id="emojiInput" placeholder="Type your answer..." autocomplete="off" autocapitalize="characters">
        <div class="emoji-hints">Hints: ${puzzle.hints.join(' • ')}</div>
      </div>
    `;
    
    const input = document.getElementById('emojiInput') as HTMLInputElement;
    input.focus();
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const answer = input.value.toUpperCase().trim();
        if (answer === puzzle.answer || answer === puzzle.answer.replace(' ', '')) {
          score++;
          soundManager.play('correct');
          setTimeout(showPuzzle, 500);
        } else {
          mistakes++;
          soundManager.play('wrong');
          input.value = '';
          input.placeholder = `Answer: ${puzzle.answer}`;
          setTimeout(showPuzzle, 2000);
        }
      }
    });
  }
  
  showPuzzle();
}

// Mental Math Chain Game
function loadMentalMath(_params: ReturnType<typeof getDifficultyParams>) {
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  
  function generateChain(): { expression: string; answer: number } {
    let result = Math.floor(Math.random() * 20) + 5;
    let expression = String(result);
    
    const operations = 3;
    for (let i = 0; i < operations; i++) {
      const op = ['+', '-', '×'][Math.floor(Math.random() * 3)];
      let num: number;
      
      switch (op) {
        case '+':
          num = Math.floor(Math.random() * 20) + 1;
          result += num;
          expression += ` + ${num}`;
          break;
        case '-':
          num = Math.floor(Math.random() * Math.min(result, 15)) + 1;
          result -= num;
          expression += ` - ${num}`;
          break;
        case '×':
          num = Math.floor(Math.random() * 5) + 2;
          result *= num;
          expression += ` × ${num}`;
          break;
      }
    }
    
    return { expression, answer: result };
  }
  
  function showProblem() {
    if (mistakes >= MAX_MISTAKES) {
      endGame(score > 0, score * 15);
      return;
    }
    
    const { expression, answer } = generateChain();
    const options = [answer];
    while (options.length < 4) {
      const wrong = answer + (Math.floor(Math.random() * 40) - 20);
      if (!options.includes(wrong) && wrong > 0) options.push(wrong);
    }
    options.sort(() => Math.random() - 0.5);
    
    elements.gameContainer.innerHTML = `
      <div class="mental-math-game">
        <div class="mm-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="mm-score">Score: ${score}</div>
        </div>
        <div class="mm-expression">${expression} = ?</div>
        <div class="mm-options">
          ${options.map(opt => `
            <button class="mm-option" data-value="${opt}">${opt}</button>
          `).join('')}
        </div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.mm-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = parseInt(btn.getAttribute('data-value')!);
        if (value === answer) {
          score++;
          soundManager.play('correct');
          btn.classList.add('correct');
        } else {
          mistakes++;
          soundManager.play('wrong');
          btn.classList.add('wrong');
          elements.gameContainer.querySelector(`[data-value="${answer}"]`)?.classList.add('correct');
        }
        
        setTimeout(showProblem, 800);
      });
    });
  }
  
  showProblem();
}

// Spot the Difference Game
function loadSpotDifference(_params: ReturnType<typeof getDifficultyParams>) {
  const patterns = [
    { items: ['🍎', '🍎', '🍎', '🍎', '🍊', '🍎', '🍎', '🍎', '🍎'], different: 4 },
    { items: ['⭐', '⭐', '⭐', '✨', '⭐', '⭐', '⭐', '⭐', '⭐'], different: 3 },
    { items: ['🔵', '🔵', '🔵', '🔵', '🔵', '🔵', '🟣', '🔵', '🔵'], different: 6 },
    { items: ['🐱', '🐱', '🐱', '🐱', '🐱', '😺', '🐱', '🐱', '🐱'], different: 5 },
    { items: ['❤️', '❤️', '💗', '❤️', '❤️', '❤️', '❤️', '❤️', '❤️'], different: 2 },
  ];
  
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  let round = 0;
  
  function showRound() {
    if (mistakes >= MAX_MISTAKES || round >= 10) {
      endGame(score > 0, score * 10);
      return;
    }
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    
    elements.gameContainer.innerHTML = `
      <div class="spot-game">
        <div class="spot-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="spot-score">Score: ${score}</div>
        </div>
        <div class="spot-instruction">Find the different one!</div>
        <div class="spot-grid">
          ${pattern.items.map((item, i) => `
            <button class="spot-item" data-index="${i}">${item}</button>
          `).join('')}
        </div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.spot-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index')!);
        if (index === pattern.different) {
          score++;
          soundManager.play('correct');
          btn.classList.add('correct');
        } else {
          mistakes++;
          soundManager.play('wrong');
          btn.classList.add('wrong');
          elements.gameContainer.querySelector(`[data-index="${pattern.different}"]`)?.classList.add('correct');
        }
        
        round++;
        setTimeout(showRound, 800);
      });
    });
  }
  
  showRound();
}

// Word Search Game
function loadWordSearch(_params: ReturnType<typeof getDifficultyParams>) {
  const words = ['BRAIN', 'THINK', 'SMART', 'LOGIC'];
  const gridSize = 8;
  const grid: string[][] = [];
  
  // Initialize grid with random letters
  for (let r = 0; r < gridSize; r++) {
    grid[r] = [];
    for (let c = 0; c < gridSize; c++) {
      grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
  }
  
  // Place words horizontally
  const placedWords: { word: string; positions: number[] }[] = [];
  words.forEach((word, i) => {
    const row = i * 2;
    const startCol = Math.floor(Math.random() * (gridSize - word.length));
    const positions: number[] = [];
    for (let c = 0; c < word.length; c++) {
      grid[row][startCol + c] = word[c];
      positions.push(row * gridSize + startCol + c);
    }
    placedWords.push({ word, positions });
  });
  
  let foundWords: string[] = [];
  let selectedCells: number[] = [];
  
  function render() {
    elements.gameContainer.innerHTML = `
      <div class="wordsearch-game">
        <div class="ws-header">
          <div class="ws-found">Found: ${foundWords.length}/${words.length}</div>
        </div>
        <div class="ws-words">
          ${words.map(w => `
            <span class="ws-word ${foundWords.includes(w) ? 'found' : ''}">${w}</span>
          `).join('')}
        </div>
        <div class="ws-grid" style="grid-template-columns: repeat(${gridSize}, 1fr)">
          ${grid.flat().map((letter, i) => `
            <button class="ws-cell ${selectedCells.includes(i) ? 'selected' : ''}" data-index="${i}">${letter}</button>
          `).join('')}
        </div>
        <div class="ws-hint">Click cells to select letters</div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.ws-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const index = parseInt(cell.getAttribute('data-index')!);
        
        if (selectedCells.includes(index)) {
          selectedCells = selectedCells.filter(i => i !== index);
        } else {
          selectedCells.push(index);
        }
        
        // Check if selected cells form a word
        const selectedWord = selectedCells.map(i => grid[Math.floor(i / gridSize)][i % gridSize]).join('');
        
        const matchedWord = placedWords.find(pw => 
          pw.word === selectedWord && 
          JSON.stringify(pw.positions.sort()) === JSON.stringify([...selectedCells].sort())
        );
        
        if (matchedWord && !foundWords.includes(matchedWord.word)) {
          foundWords.push(matchedWord.word);
          soundManager.play('correct');
          selectedCells = [];
          
          if (foundWords.length === words.length) {
            setTimeout(() => endGame(true, 100), 500);
            return;
          }
        }
        
        render();
      });
    });
  }
  
  render();
}

// AI Riddles Game
async function loadAiRiddles(_params: ReturnType<typeof getDifficultyParams>) {
  const difficulty = freePlayDifficulty || 'medium';
  
  elements.gameContainer.innerHTML = `
    <div class="loading-game">
      <div class="loading-spinner">🎭</div>
      <p>AI is creating riddles...</p>
    </div>
  `;
  
  // Fallback riddles if AI fails
  const fallbackRiddles = [
    { riddle: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", answer: "MAP" },
    { riddle: "The more you take, the more you leave behind. What am I?", answer: "FOOTSTEPS" },
    { riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?", answer: "ECHO" },
    { riddle: "What has keys but no locks, space but no room, and you can enter but can't go inside?", answer: "KEYBOARD" },
    { riddle: "I am not alive, but I grow. I don't have lungs, but I need air. What am I?", answer: "FIRE" },
  ];
  
  let riddles = fallbackRiddles;
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  let currentRiddle = 0;
  
  // Try to get AI riddles
  try {
    const response = await fetch(`${BACKEND_URL}/games/riddles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, count: 5 })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.riddles && data.riddles.length > 0) {
        riddles = data.riddles;
      }
    }
  } catch (e) {
    console.log('Using fallback riddles');
  }
  
  function showRiddle() {
    if (mistakes >= MAX_MISTAKES || currentRiddle >= riddles.length) {
      endGame(score > 0, score * 20);
      return;
    }
    
    const riddle = riddles[currentRiddle];
    
    elements.gameContainer.innerHTML = `
      <div class="riddle-game">
        <div class="riddle-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="riddle-score">Score: ${score}</div>
        </div>
        <div class="riddle-text">"${riddle.riddle}"</div>
        <input type="text" class="riddle-input" id="riddleInput" placeholder="Type your answer..." autocomplete="off" autocapitalize="characters">
        <button class="riddle-submit" id="riddleSubmit">Submit Answer</button>
      </div>
    `;
    
    const input = document.getElementById('riddleInput') as HTMLInputElement;
    const submitBtn = document.getElementById('riddleSubmit')!;
    input.focus();
    
    const checkAnswer = () => {
      const answer = input.value.toUpperCase().trim();
      const correct = riddle.answer.toUpperCase();
      
      if (answer === correct || answer.includes(correct) || correct.includes(answer)) {
        score++;
        soundManager.play('correct');
      } else {
        mistakes++;
        soundManager.play('wrong');
        input.value = '';
        input.placeholder = `Answer: ${riddle.answer}`;
      }
      
      currentRiddle++;
      setTimeout(showRiddle, 1500);
    };
    
    submitBtn.addEventListener('click', checkAnswer);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') checkAnswer();
    });
  }
  
  showRiddle();
}

// Auto-continue timer
let autoNextTimer: number | null = null;
let autoNextCountdown = 3;

// Last game info for sharing
let lastGameInfo = {
  gameName: '',
  score: 0,
  gameIcon: ''
};

// Chrome Web Store URL (replace with your actual extension URL when published)
const EXTENSION_URL = 'https://chrome.google.com/webstore/detail/ai-smart-autofill/YOUR_EXTENSION_ID';
const SHARE_HASHTAGS = '#AutoThink #IQArena #BrainGames #AI';

// Generate share text
function generateShareText(): string {
  return `🧠 I scored ${lastGameInfo.score} points in ${lastGameInfo.gameName} on AutoThink IQ Arena!\n\nCan you beat my score? Train your brain with AI-powered games!\n\n🎮 Get AutoThink: ${EXTENSION_URL}\n\n${SHARE_HASHTAGS}`;
}

// Share functions
function shareToTwitter() {
  const text = encodeURIComponent(generateShareText());
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
}

function shareToLinkedIn() {
  const text = encodeURIComponent(`I scored ${lastGameInfo.score} points in ${lastGameInfo.gameName} on IQ Arena! 🧠\n\nTrain your brain with AI-powered games: ${EXTENSION_URL}`);
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(EXTENSION_URL)}&summary=${text}`, '_blank', 'width=550,height=420');
}

function shareToWhatsApp() {
  const text = encodeURIComponent(generateShareText());
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

async function copyToClipboard() {
  const text = generateShareText();
  try {
    await navigator.clipboard.writeText(text);
    const copyBtn = document.getElementById('shareCopy');
    if (copyBtn) {
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
        </svg>`;
      }, 2000);
    }
    soundManager.play('correct');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// End game and show results
async function endGame(won: boolean, score: number) {
  stopTimer();
  
  if (!currentSession) return;
  
  // Save last game info for sharing
  const config = GAME_CONFIGS[currentSession.gameType];
  lastGameInfo = {
    gameName: config?.name || 'IQ Arena',
    score: score,
    gameIcon: config?.icon || '🧠'
  };
  
  // Only process career progress in Career Mode
  if (currentMode === 'career') {
    const result = await currentSession.end(won, score);
    currentProgress = result.progress;
    
    // Level up?
    if (result.leveledUp) {
      elements.levelUpBanner.classList.remove('hidden');
      const newLevelInfo = getLevelInfo(result.progress.level);
      elements.newLevelName.textContent = newLevelInfo.name;
    } else {
      elements.levelUpBanner.classList.add('hidden');
    }
    
    // New achievements?
    if (result.newAchievements.length > 0) {
      elements.newAchievements.classList.remove('hidden');
      elements.achievementsList.innerHTML = result.newAchievements.map(a => `
        <div class="achievement-badge">
          <span class="achievement-badge-icon">${a.icon}</span>
          <span>${a.name}</span>
        </div>
      `).join('');
    } else {
      elements.newAchievements.classList.add('hidden');
    }
    
    // Update home screen data
    updateUI();
    renderCareerGamesGrid();
  } else {
    // Free Play mode - no career progression
    elements.levelUpBanner.classList.add('hidden');
    elements.newAchievements.classList.add('hidden');
  }
  
  // Update result screen
  elements.resultModeBadge.textContent = currentMode === 'career' ? 'Career Mode' : 'Free Play';
  elements.resultModeBadge.classList.toggle('freeplay', currentMode === 'freeplay');
  
  const resultCard = elements.resultScreen.querySelector('.result-card');
  resultCard?.classList.remove('win', 'lose');
  resultCard?.classList.add(won ? 'win' : 'lose');
  
  elements.resultIcon.textContent = won ? '🎉' : '😢';
  elements.resultTitle.textContent = won ? 'Victory!' : 'Try Again';
  elements.resultMessage.textContent = won 
    ? 'Great job! Your brain is getting stronger!'
    : getEncouragementMessage();
  
  elements.resultTime.textContent = formatTime(currentSession.getElapsedSeconds());
  elements.resultScore.textContent = String(score);
  
  // Quote/Joke
  const quote = getRandomJokeOrQuote();
  elements.quoteText.textContent = quote.type === 'quote' ? `"${quote.text}"` : quote.text;
  elements.quoteAuthor.textContent = quote.author ? `— ${quote.author}` : '';
  elements.quoteAuthor.style.display = quote.author ? 'block' : 'none';
  
  showScreen('result');
  
  // Auto-continue to next game if won in Career mode
  if (won && currentMode === 'career') {
    startAutoNextCountdown();
  }
}

// Start auto-continue countdown
function startAutoNextCountdown() {
  autoNextCountdown = 4;
  updateAutoNextButton();
  
  autoNextTimer = window.setInterval(() => {
    autoNextCountdown--;
    updateAutoNextButton();
    
    if (autoNextCountdown <= 0) {
      stopAutoNextCountdown();
      const game = getRandomGame(currentProgress.level);
      startGame(game.type, 'career');
    }
  }, 1000);
}

// Update the play again button with countdown
function updateAutoNextButton() {
  if (autoNextCountdown > 0 && currentMode === 'career') {
    elements.playAgainBtn.innerHTML = `
      <span>Next Game in ${autoNextCountdown}...</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"></path>
      </svg>
    `;
  } else {
    elements.playAgainBtn.innerHTML = `
      <span>Play Again</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"></path>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
      </svg>
    `;
  }
}

// Stop auto-continue countdown
function stopAutoNextCountdown() {
  if (autoNextTimer) {
    clearInterval(autoNextTimer);
    autoNextTimer = null;
  }
  updateAutoNextButton();
}

// Sound toggle
function updateSoundButton() {
  const btn = elements.soundToggle;
  if (soundManager.isEnabled()) {
    btn.classList.remove('muted');
  } else {
    btn.classList.add('muted');
  }
}

// Stats modal
function showStatsModal() {
  const progress = currentProgress;
  
  elements.statsGrid.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${progress.totalGamesPlayed}</span>
      <span class="stat-label">Games Played</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${progress.totalWins}</span>
      <span class="stat-label">Total Wins</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${getWinRate(progress)}%</span>
      <span class="stat-label">Win Rate</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${progress.bestStreak}</span>
      <span class="stat-label">Best Streak</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${formatTimePlayed(progress.totalTimePlayedSeconds)}</span>
      <span class="stat-label">Time Played</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${progress.achievements.length}</span>
      <span class="stat-label">Achievements</span>
    </div>
  `;
  
  const gameStats = Object.entries(progress.gamesStats) as [string, { played: number; won: number; bestTime?: number; bestScore?: number }][];
  if (gameStats.length > 0) {
    elements.gameStatsList.innerHTML = gameStats.map(([type, stats]) => {
      const config = GAME_CONFIGS[type as GameType];
      return `
        <div class="game-stat-item">
          <div class="game-stat-name">
            <span>${config?.icon || '🎮'}</span>
            <span>${config?.name || type}</span>
          </div>
          <span class="game-stat-wins">${stats.won || 0}/${stats.played || 0} wins</span>
        </div>
      `;
    }).join('');
  } else {
    elements.gameStatsList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No games played yet</p>';
  }
  
  elements.statsModal.classList.remove('hidden');
}

// Achievements modal
function showAchievementsModal() {
  const all = getAllAchievements();
  const { unlocked, total } = getAchievementProgress(currentProgress);
  
  elements.achievementsProgress.textContent = `${unlocked} / ${total} Unlocked`;
  
  elements.allAchievements.innerHTML = all.map(a => {
    const isUnlocked = currentProgress.achievements.includes(a.id) || a.condition(currentProgress);
    return `
      <div class="achievement-item ${isUnlocked ? 'unlocked' : 'locked'}">
        <span class="achievement-icon">${a.icon}</span>
        <div class="achievement-info">
          <span class="achievement-name">${a.name}</span>
          <span class="achievement-desc">${a.description}</span>
        </div>
      </div>
    `;
  }).join('');
  
  elements.achievementsModal.classList.remove('hidden');
}

// Event Listeners
function setupEventListeners() {
  // DEV: Unlock all games button
  document.getElementById('unlockAllBtn')?.addEventListener('click', async () => {
    currentProgress.level = 10;
    currentProgress.winsAtCurrentLevel = 0;
    await import('./level-system').then(m => m.saveProgress(currentProgress));
    soundManager.play('levelUp');
    updateUI();
    renderCareerGamesGrid();
    alert('🔓 All games unlocked! Level set to 10 (Einstein Mode)');
  });
  
  // Mode selector
  elements.careerModeBtn.addEventListener('click', () => switchMode('career'));
  elements.freePlayModeBtn.addEventListener('click', () => switchMode('freeplay'));
  
  // Difficulty selector in Free Play
  elements.difficultySelector.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.difficultySelector.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      freePlayDifficulty = btn.getAttribute('data-diff') as GameDifficulty;
      soundManager.play('click');
    });
  });
  
  // Category filter in Free Play
  document.getElementById('categoryFilter')?.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-category') as GameCategory;
      soundManager.play('click');
      renderFreePlayGamesGrid();
    });
  });
  
  // Game settings modal
  elements.closeGameSettings.addEventListener('click', () => {
    elements.gameSettingsModal.classList.add('hidden');
  });
  
  elements.gameSettingsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
    elements.gameSettingsModal.classList.add('hidden');
  });
  
  elements.startGameWithSettings.addEventListener('click', () => {
    collectSettingsAndStart();
  });
  
  // Play random game (Career mode)
  elements.playRandomBtn.addEventListener('click', () => {
    const game = getRandomGame(currentProgress.level);
    startGame(game.type, 'career');
  });
  
  // Back to home
  elements.backToHome.addEventListener('click', () => {
    stopTimer();
    stopAutoNextCountdown();
    showScreen('home');
  });
  
  // Sound toggle
  elements.soundToggle.addEventListener('click', async () => {
    await soundManager.setEnabled(!soundManager.isEnabled());
    updateSoundButton();
    if (soundManager.isEnabled()) {
      soundManager.play('click');
    }
  });
  
  // Stats button
  elements.statsBtn.addEventListener('click', () => {
    soundManager.play('click');
    showStatsModal();
  });
  
  // Achievements button
  elements.achievementsBtn.addEventListener('click', () => {
    soundManager.play('click');
    showAchievementsModal();
  });
  
  // Close modals
  elements.closeStats.addEventListener('click', () => {
    elements.statsModal.classList.add('hidden');
  });
  
  elements.closeAchievements.addEventListener('click', () => {
    elements.achievementsModal.classList.add('hidden');
  });
  
  // Modal overlay click to close
  elements.statsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
    elements.statsModal.classList.add('hidden');
  });
  
  elements.achievementsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
    elements.achievementsModal.classList.add('hidden');
  });
  
  // Result screen buttons
  elements.playAgainBtn.addEventListener('click', () => {
    stopAutoNextCountdown();
    if (currentMode === 'career') {
      const game = getRandomGame(currentProgress.level);
      startGame(game.type, 'career');
    } else {
      // In Free Play, go back to game selection
      showScreen('home');
    }
  });
  
  elements.homeBtn.addEventListener('click', () => {
    stopAutoNextCountdown();
    soundManager.play('click');
    showScreen('home');
  });
  
  // Share buttons
  document.getElementById('shareTwitter')?.addEventListener('click', () => {
    soundManager.play('click');
    shareToTwitter();
  });
  
  document.getElementById('shareLinkedIn')?.addEventListener('click', () => {
    soundManager.play('click');
    shareToLinkedIn();
  });
  
  document.getElementById('shareWhatsApp')?.addEventListener('click', () => {
    soundManager.play('click');
    shareToWhatsApp();
  });
  
  document.getElementById('shareCopy')?.addEventListener('click', () => {
    copyToClipboard();
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
