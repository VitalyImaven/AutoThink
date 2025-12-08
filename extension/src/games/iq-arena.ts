// IQ Arena - Main Controller

import { GameType, PlayerProgress, GameDifficulty } from './types';
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

// Render Free Play games grid (all unlocked)
function renderFreePlayGamesGrid() {
  const allGames = Object.values(GAME_CONFIGS);
  
  elements.freePlayGamesGrid.innerHTML = allGames.map(game => `
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

// AI Trivia Game
async function loadAiTrivia(params: ReturnType<typeof getDifficultyParams>) {
  const difficulty = freePlayDifficulty || (params.triviaQuestionCount <= 5 ? 'easy' : params.triviaQuestionCount <= 8 ? 'medium' : 'hard');
  const category = freePlayGameSettings.category !== 'random' ? freePlayGameSettings.category : null;
  const count = freePlayGameSettings.count || 5;
  
  elements.gameContainer.innerHTML = `
    <div class="loading-game">
      <div class="loading-spinner">🧠</div>
      <p>AI is generating trivia questions...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`${BACKEND_URL}/games/trivia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, category, count })
    });
    
    if (!response.ok) throw new Error('Failed to fetch trivia');
    
    const data = await response.json();
    const questions = data.questions;
    
    let currentQuestion = 0;
    let score = 0;
    
    function showQuestion() {
      if (currentQuestion >= questions.length) {
        endGame(score >= questions.length / 2, score * 20);
        return;
      }
      
      const q = questions[currentQuestion];
      
      elements.gameContainer.innerHTML = `
        <div class="trivia-game">
          <div class="trivia-info">
            <span>Question ${currentQuestion + 1}/${questions.length}</span>
            <span class="trivia-category">${q.category}</span>
            <span>Score: ${score}</span>
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
            soundManager.play('wrong');
          }
          
          const explanationEl = document.createElement('div');
          explanationEl.className = 'trivia-explanation';
          explanationEl.innerHTML = `<strong>💡</strong> ${q.explanation}`;
          elements.gameContainer.querySelector('.trivia-game')?.appendChild(explanationEl);
          
          currentQuestion++;
          setTimeout(showQuestion, 2500);
        });
      });
    }
    
    showQuestion();
    
  } catch (error) {
    console.error('AI Trivia error:', error);
    elements.gameContainer.innerHTML = `
      <div class="error-message">
        <p style="font-size: 48px;">⚠️</p>
        <p>Could not connect to AI service</p>
        <p style="font-size: 14px; color: var(--text-muted);">Make sure the backend is running</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
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
      </div>
    `;
    
    currentRound++;
    setTimeout(startRound, 2500);
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

// Fact or Fiction Game
async function loadFactOrFiction(params: ReturnType<typeof getDifficultyParams>) {
  const difficulty = freePlayDifficulty || (params.triviaQuestionCount <= 5 ? 'easy' : 'medium');
  const count = freePlayGameSettings.count || 5;
  
  elements.gameContainer.innerHTML = `
    <div class="loading-game">
      <div class="loading-spinner">🤔</div>
      <p>AI is generating statements...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`${BACKEND_URL}/games/fact-or-fiction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, count })
    });
    
    if (!response.ok) throw new Error('Failed to fetch statements');
    
    const data = await response.json();
    const statements = data.statements;
    
    let currentStatement = 0;
    let score = 0;
    
    function showStatement() {
      if (currentStatement >= statements.length) {
        endGame(score >= statements.length / 2, score * 20);
        return;
      }
      
      const s = statements[currentStatement];
      
      elements.gameContainer.innerHTML = `
        <div class="fof-game">
          <div class="fof-info">
            <span>Statement ${currentStatement + 1}/${statements.length}</span>
            <span class="fof-category">${s.category}</span>
            <span>Score: ${score}</span>
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
            const correctBtn = elements.gameContainer.querySelector(`[data-answer="${s.is_fact}"]`);
            correctBtn?.classList.add('correct');
            soundManager.play('wrong');
          }
          
          const explanationEl = document.createElement('div');
          explanationEl.className = 'fof-explanation';
          explanationEl.innerHTML = `
            <div class="fof-verdict">${s.is_fact ? '✅ This is a FACT!' : '❌ This is FICTION!'}</div>
            <p>${s.explanation}</p>
          `;
          elements.gameContainer.querySelector('.fof-game')?.appendChild(explanationEl);
          
          currentStatement++;
          setTimeout(showStatement, 3000);
        });
      });
    }
    
    showStatement();
    
  } catch (error) {
    console.error('Fact or Fiction error:', error);
    elements.gameContainer.innerHTML = `
      <div class="error-message">
        <p style="font-size: 48px;">⚠️</p>
        <p>Could not connect to AI service</p>
        <p style="font-size: 14px; color: var(--text-muted);">Make sure the backend is running</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// Auto-continue timer
let autoNextTimer: number | null = null;
let autoNextCountdown = 3;

// End game and show results
async function endGame(won: boolean, score: number) {
  stopTimer();
  
  if (!currentSession) return;
  
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
