// IQ Arena - Main Controller

import { GameType, PlayerProgress, GameDifficulty, GameCategory, IQCategory, IQTestResult, IQTestSession } from './types';
import { 
  generateIQTestQuestions, 
  calculateIQScore, 
  CATEGORY_NAMES, 
  IQ_CLASSIFICATIONS 
} from './data/iq-test-questions';
import { 
  loadProgress, 
  saveProgress,
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
type GameMode = 'career' | 'freeplay' | 'iq-test';
let currentMode: GameMode = 'career';
let freePlayDifficulty: GameDifficulty = 'medium';
let freePlayGameSettings: Record<string, any> = {};
let selectedFreePlayGame: GameType | null = null;
let selectedCategory: GameCategory = 'all';

// IQ Test state
let iqTestSession: IQTestSession | null = null;
let iqTimerInterval: number | null = null;
let iqTestHistory: IQTestResult[] = [];

// Game Tutorials - Rules and how to play for each game
const GAME_TUTORIALS: Record<GameType, { title: string; rules: string[]; tips: string }> = {
  'memory-match': {
    title: '🃏 Memory Match',
    rules: [
      'Flip cards to reveal symbols',
      'Find matching pairs of cards',
      'Remember card positions',
      'Clear all pairs to win'
    ],
    tips: '💡 Start from corners and edges - easier to remember!'
  },
  'math-challenge': {
    title: '🔢 Math Challenge',
    rules: [
      'Solve arithmetic problems quickly',
      'Select the correct answer from options',
      '3 mistakes = game over',
      'Faster answers = higher score'
    ],
    tips: '💡 Practice mental math daily to improve speed!'
  },
  'reaction-time': {
    title: '🎯 Reaction Time',
    rules: [
      'Wait for the box to turn GREEN',
      'Click as fast as possible when green',
      'Don\'t click too early (red = wait)',
      'Average of 5 attempts determines score'
    ],
    tips: '💡 Stay focused but relaxed - tension slows reactions!'
  },
  'simon-says': {
    title: '🎨 Simon Says',
    rules: [
      'Watch the color sequence carefully',
      'Repeat the sequence by clicking colors',
      'Sequence gets longer each round',
      'One mistake = game over'
    ],
    tips: '💡 Say colors aloud in your head to remember!'
  },
  'speed-typing': {
    title: '⌨️ Speed Typing',
    rules: [
      'Type the displayed word exactly',
      'Case doesn\'t matter',
      '3 mistakes = game over',
      'Complete 10 words to win'
    ],
    tips: '💡 Focus on accuracy first, speed comes naturally!'
  },
  'minesweeper': {
    title: '💣 Minesweeper',
    rules: [
      'Click to reveal cells',
      'Numbers show adjacent mines',
      'Right-click to flag suspected mines',
      'Reveal all safe cells to win'
    ],
    tips: '💡 Start with corners - they have fewer neighbors!'
  },
  'sliding-puzzle': {
    title: '🧩 Sliding Puzzle',
    rules: [
      'Click tiles to slide them',
      'Arrange numbers in order (1-8)',
      'Empty space allows movement',
      'Fewer moves = higher score'
    ],
    tips: '💡 Solve top row first, then work down!'
  },
  'wordle': {
    title: '📝 Wordle',
    rules: [
      'Guess the 5-letter word in 6 tries',
      '🟩 Green = correct letter & position',
      '🟨 Yellow = correct letter, wrong position',
      '⬛ Gray = letter not in word'
    ],
    tips: '💡 Start with words that have common vowels like ARISE!'
  },
  'number-sequence': {
    title: '🔮 Number Sequence',
    rules: [
      'Find the pattern in the number series',
      'Select the next number in sequence',
      'Patterns can be +, -, ×, or complex',
      '3 mistakes = game over'
    ],
    tips: '💡 Check differences between consecutive numbers first!'
  },
  'pattern-match': {
    title: '🔷 Pattern Match',
    rules: [
      'Memorize the highlighted pattern',
      'Pattern disappears after a moment',
      'Click cells to recreate the pattern',
      'Accuracy determines your score'
    ],
    tips: '💡 Break complex patterns into smaller chunks!'
  },
  'ai-trivia': {
    title: '🧪 AI Trivia',
    rules: [
      'Answer AI-generated questions',
      'Select from 4 possible answers',
      '3 wrong answers = game over',
      'Questions get harder as you progress'
    ],
    tips: '💡 Read all options before choosing - one is always tricky!'
  },
  'word-association': {
    title: '💭 Word Association',
    rules: [
      'See a word and category (synonym/antonym)',
      'Type a word that matches the category',
      'AI judges if your answer is valid',
      '3 wrong answers = game over'
    ],
    tips: '💡 Think of common, well-known words!'
  },
  'fact-or-fiction': {
    title: '❓ Fact or Fiction',
    rules: [
      'Read each statement carefully',
      'Decide if it\'s TRUE or FALSE',
      'AI generates tricky statements',
      '3 wrong answers = game over'
    ],
    tips: '💡 If it sounds too amazing, it might be fiction!'
  },
  'color-match': {
    title: '🌈 Color Match (Stroop Test)',
    rules: [
      'See a color word (e.g., "RED")',
      'Click the COLOR of the text, not the word',
      'This tests your brain\'s processing',
      '3 mistakes = game over'
    ],
    tips: '💡 Ignore reading the word - focus only on the color!'
  },
  'visual-memory': {
    title: '👁️ Visual Memory',
    rules: [
      'Memorize highlighted cells in the grid',
      'Click the cells that were highlighted',
      'Grid gets larger as you level up',
      '3 wrong clicks = lose a life'
    ],
    tips: '💡 Look for shapes or patterns in the highlighted cells!'
  },
  'anagram': {
    title: '🔤 Anagram',
    rules: [
      'See scrambled letters',
      'Unscramble to form a real word',
      'Type your answer and press Enter',
      '3 wrong answers = game over'
    ],
    tips: '💡 Look for common letter combinations like TH, ING, ED!'
  },
  'emoji-decoder': {
    title: '😀 Emoji Decoder',
    rules: [
      'See emojis representing a word/phrase',
      'Guess what they represent',
      'Type your answer and press Enter',
      '3 wrong answers = game over'
    ],
    tips: '💡 Think of common phrases, movies, or objects!'
  },
  'mental-math': {
    title: '🧮 Mental Math Chain',
    rules: [
      'Solve a chain of calculations',
      'Example: 5 + 3 × 2 - 4 = ?',
      'Calculate left to right',
      'Select the correct answer'
    ],
    tips: '💡 Write intermediate results in your head!'
  },
  'spot-difference': {
    title: '🔍 Spot the Difference',
    rules: [
      'Find the color that\'s slightly different',
      'One square has a different shade',
      'Click the odd one out',
      '3 mistakes = game over'
    ],
    tips: '💡 Relax your eyes and scan the whole grid!'
  },
  'word-search': {
    title: '🔎 Word Search',
    rules: [
      'Find hidden words in the letter grid',
      'Words can be horizontal or vertical',
      'Click letters to select them',
      'Find all words to win'
    ],
    tips: '💡 Scan for the first letter of each word!'
  },
  'ai-riddles': {
    title: '🎭 AI Riddles',
    rules: [
      'Read the AI-generated riddle',
      'Think about what it describes',
      'Type your answer',
      '3 wrong answers = game over'
    ],
    tips: '💡 Riddles often have literal answers hidden in wordplay!'
  },
  'tetris': {
    title: '🧱 Tetris',
    rules: [
      'Falling blocks must be stacked',
      'Complete horizontal lines to clear them',
      'Game ends when blocks reach top',
      'Use arrows to move, up to rotate'
    ],
    tips: '💡 Keep the stack flat - avoid creating holes!'
  },
  'game-2048': {
    title: '🔢 2048',
    rules: [
      'Swipe to move all tiles',
      'Same numbers merge when they touch',
      'Reach 2048 to win',
      'Game ends when no moves left'
    ],
    tips: '💡 Keep your highest tile in a corner!'
  },
  'sudoku': {
    title: '📊 Sudoku',
    rules: [
      'Fill the 9x9 grid with numbers 1-9',
      'Each row must have 1-9 (no repeats)',
      'Each column must have 1-9',
      'Each 3x3 box must have 1-9'
    ],
    tips: '💡 Start with rows/columns that have most numbers!'
  },
  'hangman': {
    title: '🎯 Hangman',
    rules: [
      'Guess the hidden word letter by letter',
      'Correct letters are revealed',
      'Wrong guesses add body parts',
      '6 wrong guesses = game over'
    ],
    tips: '💡 Try common letters first: E, A, R, I, O, T!'
  },
  'connections': {
    title: '🔗 Connections',
    rules: [
      'Group 16 words into 4 categories',
      'Select 4 words that share a theme',
      'Submit to check if correct',
      '4 wrong guesses = game over'
    ],
    tips: '💡 Look for the most obvious group first!'
  },
  'snake': {
    title: '🐍 Snake',
    rules: [
      'Control the snake with arrows',
      'Eat food to grow longer',
      'Don\'t hit walls or yourself',
      'Survive as long as possible'
    ],
    tips: '💡 Plan your path - think 2-3 moves ahead!'
  },
  'match-three': {
    title: '🍬 Match 3',
    rules: [
      'Swap adjacent items to match 3+',
      'Matches clear and score points',
      'Limited moves available',
      'Reach target score to win'
    ],
    tips: '💡 Look for moves that create chain reactions!'
  },
  'google-feud': {
    title: '🔍 Search Feud',
    rules: [
      'Guess popular search autocompletes',
      'Type what people commonly search',
      'Find all answers on the board',
      '5 wrong guesses = game over'
    ],
    tips: '💡 Think about what most people would search!'
  },
  'boggle': {
    title: '🔤 Word Blitz',
    rules: [
      'Find words in the letter grid',
      'Click letters to form words',
      'Words must be 3+ letters',
      '60 seconds to find as many as possible'
    ],
    tips: '💡 Focus on 3-4 letter words - they\'re easier!'
  },
  'aim-trainer': {
    title: '🎯 Aim Trainer',
    rules: [
      'Click targets as they appear',
      'Smaller targets = more points',
      'Miss = target disappears',
      'Hit 20 targets to complete'
    ],
    tips: '💡 Move your cursor to center after each click!'
  },
  'jigsaw': {
    title: '🧩 Jigsaw Puzzle',
    rules: [
      'Click two pieces to swap them',
      'Arrange pieces in correct positions',
      'Numbers help identify order',
      'Fewer moves = higher score'
    ],
    tips: '💡 Work on one row at a time!'
  },
  'n-back': {
    title: '🧠 N-Back Training',
    rules: [
      'Watch positions flash on grid',
      'Remember position from N steps ago',
      'Press YES if position matches N-back',
      'Press NO if different'
    ],
    tips: '💡 Say positions aloud: "top-left, center, bottom"!'
  },
  'crossword': {
    title: '✏️ Mini Crossword',
    rules: [
      'Fill in words based on clues',
      'Across and Down clues provided',
      'Click cell then type letter',
      'Complete all words to win'
    ],
    tips: '💡 Start with the clues you\'re sure about!'
  },
  'solitaire': {
    title: '🃏 Solitaire',
    rules: [
      'Move cards to foundation (A to K)',
      'Build down in alternating colors',
      'Click stock to draw cards',
      'Clear all cards to win'
    ],
    tips: '💡 Reveal face-down cards early!'
  },
  'quick-draw': {
    title: '🎨 Quick Draw',
    rules: [
      'Draw the word shown on screen',
      'You have 20 seconds',
      'AI tries to guess your drawing',
      'Clear, simple drawings work best'
    ],
    tips: '💡 Draw the most recognizable feature first!'
  },
};

// Show tutorial before starting game
function showTutorial(gameType: GameType, onStart: () => void) {
  const tutorial = GAME_TUTORIALS[gameType];
  if (!tutorial) {
    onStart();
    return;
  }
  
  elements.gameContainer.innerHTML = `
    <div class="tutorial-screen">
      <div class="tutorial-header">
        <h2>${tutorial.title}</h2>
        <span class="tutorial-badge">How to Play</span>
      </div>
      <div class="tutorial-rules">
        ${tutorial.rules.map((rule, i) => `
          <div class="tutorial-rule">
            <span class="rule-number">${i + 1}</span>
            <span class="rule-text">${rule}</span>
          </div>
        `).join('')}
      </div>
      <div class="tutorial-tip">${tutorial.tips}</div>
      <button class="tutorial-start-btn" id="startGameBtn">
        <span>Start Game</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
      <label class="tutorial-skip">
        <input type="checkbox" id="skipTutorials"> Don't show tutorials again
      </label>
    </div>
  `;
  
  document.getElementById('startGameBtn')?.addEventListener('click', () => {
    const skipCheckbox = document.getElementById('skipTutorials') as HTMLInputElement;
    if (skipCheckbox?.checked) {
      localStorage.setItem('iq-arena-skip-tutorials', 'true');
    }
    onStart();
  });
}

// Check if tutorials should be skipped
function shouldSkipTutorial(): boolean {
  return localStorage.getItem('iq-arena-skip-tutorials') === 'true';
}

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
  
  // IQ Test Mode
  iqTestModeBtn: document.getElementById('iqTestModeBtn')!,
  iqTestModeContent: document.getElementById('iqTestModeContent')!,
  startIQTest: document.getElementById('startIQTest')!,
  iqHistoryList: document.getElementById('iqHistoryList')!,
  
  // IQ Test Screen
  iqTestScreen: document.getElementById('iqTestScreen')!,
  exitIQTest: document.getElementById('exitIQTest')!,
  iqCurrentQ: document.getElementById('iqCurrentQ')!,
  iqTotalQ: document.getElementById('iqTotalQ')!,
  iqCategoryTag: document.getElementById('iqCategoryTag')!,
  iqTimeRemaining: document.getElementById('iqTimeRemaining')!,
  iqProgressFill: document.getElementById('iqProgressFill')!,
  iqDifficultyIndicator: document.getElementById('iqDifficultyIndicator')!,
  iqQuestionText: document.getElementById('iqQuestionText')!,
  iqOptions: document.getElementById('iqOptions')!,
  iqSkipBtn: document.getElementById('iqSkipBtn')!,
  iqNextBtn: document.getElementById('iqNextBtn')!,
  iqTimer: document.querySelector('.iq-timer') as HTMLElement,
  
  // IQ Results Modal
  iqResultsModal: document.getElementById('iqResultsModal')!,
  iqScoreValue: document.getElementById('iqScoreValue')!,
  iqClassLabel: document.getElementById('iqClassLabel')!,
  iqClassDesc: document.getElementById('iqClassDesc')!,
  iqPercentile: document.getElementById('iqPercentile')!,
  iqCorrectCount: document.getElementById('iqCorrectCount')!,
  iqTotalCount: document.getElementById('iqTotalCount')!,
  iqTimeSpent: document.getElementById('iqTimeSpent')!,
  iqCategoryBars: document.getElementById('iqCategoryBars')!,
  iqStrengths: document.getElementById('iqStrengths')!,
  iqImprovements: document.getElementById('iqImprovements')!,
  retakeIQTest: document.getElementById('retakeIQTest')!,
  closeIQResults: document.getElementById('closeIQResults')!,
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
    'math': 'Math Games',
    'logic': 'Puzzle Games',
    'words': 'Word Games',
    'visual': 'Visual Games',
    'trivia': 'Trivia Games',
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
function showScreen(screenId: 'home' | 'game' | 'result' | 'iqTest') {
  elements.homeScreen.classList.remove('active');
  elements.gameScreen.classList.remove('active');
  elements.resultScreen.classList.remove('active');
  elements.iqTestScreen.classList.remove('active');
  
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
    case 'iqTest':
      elements.iqTestScreen.classList.add('active');
      break;
  }
}

// Switch mode
function switchMode(mode: GameMode) {
  currentMode = mode;
  
  elements.careerModeBtn.classList.toggle('active', mode === 'career');
  elements.freePlayModeBtn.classList.toggle('active', mode === 'freeplay');
  elements.iqTestModeBtn.classList.toggle('active', mode === 'iq-test');
  elements.careerModeContent.classList.toggle('active', mode === 'career');
  elements.freePlayModeContent.classList.toggle('active', mode === 'freeplay');
  elements.iqTestModeContent.classList.toggle('active', mode === 'iq-test');
  
  // Load IQ test history when switching to IQ Test mode
  if (mode === 'iq-test') {
    loadIQTestHistory();
  }
  
  soundManager.play('click');
}

// ========================================
// IQ TEST FUNCTIONS
// ========================================

// Load IQ Test history from storage
async function loadIQTestHistory() {
  try {
    const stored = localStorage.getItem('iq_test_history');
    if (stored) {
      iqTestHistory = JSON.parse(stored);
    }
    renderIQTestHistory();
  } catch {
    iqTestHistory = [];
  }
}

// Save IQ Test result
function saveIQTestResult(result: IQTestResult) {
  iqTestHistory.unshift(result);
  // Keep only last 10 results
  if (iqTestHistory.length > 10) {
    iqTestHistory = iqTestHistory.slice(0, 10);
  }
  localStorage.setItem('iq_test_history', JSON.stringify(iqTestHistory));
}

// Render IQ Test history
function renderIQTestHistory() {
  if (iqTestHistory.length === 0) {
    elements.iqHistoryList.innerHTML = '<p class="no-results">No previous tests taken</p>';
    return;
  }
  
  elements.iqHistoryList.innerHTML = iqTestHistory.slice(0, 5).map(result => `
    <div class="iq-history-item">
      <div class="iq-history-score">${result.iqScore}</div>
      <div class="iq-history-details">
        <span class="iq-history-class">${result.classification}</span>
        <span class="iq-history-date">${new Date(result.completedAt).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
}

// Start IQ Test
function startIQTest() {
  const questions = generateIQTestQuestions();
  
  iqTestSession = {
    questions,
    currentIndex: 0,
    answers: [],
    startTime: Date.now(),
    timeLimit: 30 * 60, // 30 minutes
    isComplete: false
  };
  
  // Show IQ test screen
  showScreen('iqTest');
  
  // Start timer
  startIQTimer();
  
  // Render first question
  renderIQQuestion();
  
  soundManager.play('click');
}

// Start IQ Test timer
function startIQTimer() {
  if (iqTimerInterval) clearInterval(iqTimerInterval);
  
  iqTimerInterval = window.setInterval(() => {
    if (!iqTestSession) return;
    
    const elapsed = Math.floor((Date.now() - iqTestSession.startTime) / 1000);
    const remaining = Math.max(0, iqTestSession.timeLimit - elapsed);
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    elements.iqTimeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Warning when under 5 minutes
    if (remaining < 300) {
      elements.iqTimer.classList.add('warning');
    }
    
    // Time's up
    if (remaining === 0) {
      finishIQTest();
    }
  }, 1000);
}

// Render current IQ question
function renderIQQuestion() {
  if (!iqTestSession) return;
  
  const question = iqTestSession.questions[iqTestSession.currentIndex];
  const totalQ = iqTestSession.questions.length;
  const currentQ = iqTestSession.currentIndex + 1;
  
  // Update progress
  elements.iqCurrentQ.textContent = String(currentQ);
  elements.iqTotalQ.textContent = String(totalQ);
  elements.iqProgressFill.style.width = `${(currentQ / totalQ) * 100}%`;
  
  // Update category tag
  elements.iqCategoryTag.textContent = CATEGORY_NAMES[question.category];
  
  // Update difficulty indicator
  const dots = elements.iqDifficultyIndicator.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < question.difficulty);
  });
  
  // Render question
  elements.iqQuestionText.textContent = question.question;
  
  // Render options
  elements.iqOptions.innerHTML = question.options.map((opt, i) => `
    <div class="iq-option" data-index="${i}">${opt}</div>
  `).join('');
  
  // Add click handlers
  elements.iqOptions.querySelectorAll('.iq-option').forEach(opt => {
    opt.addEventListener('click', () => {
      elements.iqOptions.querySelectorAll('.iq-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      (elements.iqNextBtn as HTMLButtonElement).disabled = false;
      soundManager.play('click');
    });
  });
  
  // Check if we already answered this question
  const existingAnswer = iqTestSession.answers.find(a => a.questionId === question.id);
  if (existingAnswer) {
    const selectedOpt = elements.iqOptions.querySelector(`[data-index="${existingAnswer.selectedIndex}"]`);
    if (selectedOpt) {
      selectedOpt.classList.add('selected');
      (elements.iqNextBtn as HTMLButtonElement).disabled = false;
    }
  } else {
    (elements.iqNextBtn as HTMLButtonElement).disabled = true;
  }
  
  // Update button text
  if (currentQ === totalQ) {
    elements.iqNextBtn.textContent = 'Finish Test';
  } else {
    elements.iqNextBtn.textContent = 'Next →';
  }
}

// Handle IQ Next button
function handleIQNext() {
  if (!iqTestSession) return;
  
  const selectedOpt = elements.iqOptions.querySelector('.iq-option.selected');
  if (!selectedOpt) return;
  
  const selectedIndex = parseInt(selectedOpt.getAttribute('data-index')!);
  const question = iqTestSession.questions[iqTestSession.currentIndex];
  const questionStartTime = Date.now() - 5000; // Approximate
  
  // Save answer
  const existingIdx = iqTestSession.answers.findIndex(a => a.questionId === question.id);
  if (existingIdx >= 0) {
    iqTestSession.answers[existingIdx].selectedIndex = selectedIndex;
  } else {
    iqTestSession.answers.push({
      questionId: question.id,
      selectedIndex,
      timeSpent: Math.floor((Date.now() - questionStartTime) / 1000)
    });
  }
  
  soundManager.play('click');
  
  // Check if last question
  if (iqTestSession.currentIndex >= iqTestSession.questions.length - 1) {
    finishIQTest();
  } else {
    iqTestSession.currentIndex++;
    renderIQQuestion();
  }
}

// Handle IQ Skip button
function handleIQSkip() {
  if (!iqTestSession) return;
  
  soundManager.play('click');
  
  if (iqTestSession.currentIndex >= iqTestSession.questions.length - 1) {
    finishIQTest();
  } else {
    iqTestSession.currentIndex++;
    renderIQQuestion();
  }
}

// Finish IQ Test and calculate results
function finishIQTest() {
  if (!iqTestSession) return;
  
  // Stop timer
  if (iqTimerInterval) {
    clearInterval(iqTimerInterval);
    iqTimerInterval = null;
  }
  
  // Calculate results
  const totalQuestions = iqTestSession.questions.length;
  let correctAnswers = 0;
  const categoryScores: { [key in IQCategory]?: { correct: number; total: number } } = {};
  
  // Initialize category scores
  iqTestSession.questions.forEach(q => {
    if (!categoryScores[q.category]) {
      categoryScores[q.category] = { correct: 0, total: 0 };
    }
    categoryScores[q.category]!.total++;
  });
  
  // Calculate correct answers
  iqTestSession.answers.forEach(answer => {
    const question = iqTestSession!.questions.find(q => q.id === answer.questionId);
    if (question && answer.selectedIndex === question.correctIndex) {
      correctAnswers++;
      categoryScores[question.category]!.correct++;
    }
  });
  
  const timeSpent = Math.floor((Date.now() - iqTestSession.startTime) / 1000);
  const avgTimePerQuestion = timeSpent / totalQuestions;
  
  // Calculate IQ score
  const { iqScore, percentile, classification } = calculateIQScore(
    correctAnswers, 
    totalQuestions, 
    avgTimePerQuestion
  );
  
  // Find strengths and weaknesses
  const categoryPercentages = Object.entries(categoryScores).map(([cat, score]) => ({
    category: cat as IQCategory,
    percentage: score!.total > 0 ? score!.correct / score!.total : 0
  })).sort((a, b) => b.percentage - a.percentage);
  
  const strengths = categoryPercentages.slice(0, 2).map(c => c.category);
  const improvements = categoryPercentages.slice(-2).map(c => c.category);
  
  // Create result object
  const result: IQTestResult = {
    totalQuestions,
    correctAnswers,
    categoryScores: categoryScores as IQTestResult['categoryScores'],
    rawScore: correctAnswers,
    iqScore,
    percentile,
    classification,
    timeSpent,
    completedAt: new Date().toISOString(),
    detailedAnalysis: {
      strengths,
      areasForImprovement: improvements
    }
  };
  
  // Save result
  saveIQTestResult(result);
  
  // Show results
  showIQResults(result);
  
  soundManager.play(iqScore >= 100 ? 'win' : 'achievement');
}

// Show IQ Results modal
function showIQResults(result: IQTestResult) {
  // Update score
  elements.iqScoreValue.textContent = String(result.iqScore);
  
  // Update classification
  const classInfo = IQ_CLASSIFICATIONS.find(c => result.iqScore >= c.min);
  elements.iqClassLabel.textContent = classInfo?.label || 'Unknown';
  elements.iqClassDesc.textContent = classInfo?.description || '';
  
  // Update percentile
  elements.iqPercentile.textContent = `${result.percentile}%`;
  
  // Update stats
  elements.iqCorrectCount.textContent = String(result.correctAnswers);
  elements.iqTotalCount.textContent = String(result.totalQuestions);
  
  const minutes = Math.floor(result.timeSpent / 60);
  const seconds = result.timeSpent % 60;
  elements.iqTimeSpent.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Render category bars
  elements.iqCategoryBars.innerHTML = Object.entries(result.categoryScores)
    .map(([cat, score]) => {
      const percentage = score!.total > 0 ? Math.round((score!.correct / score!.total) * 100) : 0;
      const catName = CATEGORY_NAMES[cat as IQCategory] || cat;
      const shortName = catName.split('(')[0].trim();
      return `
        <div class="iq-cat-bar">
          <span class="iq-cat-name">${shortName}</span>
          <div class="iq-cat-track">
            <div class="iq-cat-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="iq-cat-score">${percentage}%</span>
        </div>
      `;
    }).join('');
  
  // Render strengths
  elements.iqStrengths.innerHTML = result.detailedAnalysis.strengths
    .map(cat => {
      const name = CATEGORY_NAMES[cat]?.split('(')[0].trim() || cat;
      return `<li>${name}</li>`;
    }).join('');
  
  // Render improvements
  elements.iqImprovements.innerHTML = result.detailedAnalysis.areasForImprovement
    .map(cat => {
      const name = CATEGORY_NAMES[cat]?.split('(')[0].trim() || cat;
      return `<li>${name}</li>`;
    }).join('');
  
  // Show modal
  elements.iqResultsModal.classList.remove('hidden');
}

// Exit IQ Test
function exitIQTest() {
  if (iqTimerInterval) {
    clearInterval(iqTimerInterval);
    iqTimerInterval = null;
  }
  
  const confirmExit = confirm('Are you sure you want to exit? Your progress will be lost.');
  if (confirmExit) {
    iqTestSession = null;
    showScreen('home');
  }
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

// Actually load the game after tutorial
function actuallyLoadGame(gameType: GameType, params: ReturnType<typeof getDifficultyParams>) {
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
    // New classic games
    case 'tetris':
      loadTetris();
      break;
    case 'game-2048':
      load2048();
      break;
    case 'sudoku':
      loadSudoku();
      break;
    case 'hangman':
      loadHangman();
      break;
    case 'connections':
      loadConnections();
      break;
    case 'snake':
      loadSnake();
      break;
    case 'match-three':
      loadMatchThree();
      break;
    case 'google-feud':
      loadGoogleFeud();
      break;
    case 'boggle':
      loadBoggle();
      break;
    case 'aim-trainer':
      loadAimTrainer();
      break;
    // Additional popular games
    case 'jigsaw':
      loadJigsaw();
      break;
    case 'n-back':
      loadNBack();
      break;
    case 'crossword':
      loadCrossword();
      break;
    case 'solitaire':
      loadSolitaire();
      break;
    case 'quick-draw':
      loadQuickDraw();
      break;
  }
}

// Load game - shows tutorial first unless skipped
async function loadGame(gameType: GameType, mode: GameMode) {
  const params = mode === 'career' 
    ? getDifficultyParams(currentProgress.level)
    : getFreePlayDifficultyParams();
  
  if (shouldSkipTutorial()) {
    actuallyLoadGame(gameType, params);
  } else {
    showTutorial(gameType, () => actuallyLoadGame(gameType, params));
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

// Spot the Difference Game - Color Edition
function loadSpotDifference(_params: ReturnType<typeof getDifficultyParams>) {
  // Base colors with their HSL values for easy manipulation
  const baseColors = [
    { name: 'red', h: 0, s: 70, l: 50 },
    { name: 'blue', h: 210, s: 70, l: 50 },
    { name: 'green', h: 120, s: 60, l: 45 },
    { name: 'purple', h: 270, s: 60, l: 55 },
    { name: 'orange', h: 30, s: 80, l: 50 },
    { name: 'cyan', h: 180, s: 70, l: 45 },
    { name: 'pink', h: 330, s: 70, l: 60 },
    { name: 'teal', h: 160, s: 50, l: 45 },
  ];
  
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  let round = 0;
  const MAX_ROUNDS = 15;
  let gridSize = 9; // 3x3
  
  function generateRound() {
    // Increase difficulty over time
    if (round >= 5) gridSize = 16; // 4x4
    if (round >= 10) gridSize = 25; // 5x5
    
    const cols = Math.sqrt(gridSize);
    
    // Pick a random base color
    const baseColor = baseColors[Math.floor(Math.random() * baseColors.length)];
    
    // Calculate difference based on round (harder = smaller difference)
    const difficultyMultiplier = Math.max(5, 20 - round); // Starts at 20, goes down to 5
    const hueDiff = difficultyMultiplier;
    const satDiff = difficultyMultiplier * 0.8;
    const lightDiff = difficultyMultiplier * 0.6;
    
    // Randomly choose which property to change
    const changeType = Math.floor(Math.random() * 3);
    let differentH = baseColor.h;
    let differentS = baseColor.s;
    let differentL = baseColor.l;
    
    switch (changeType) {
      case 0: differentH = baseColor.h + hueDiff; break;
      case 1: differentS = Math.min(100, baseColor.s + satDiff); break;
      case 2: differentL = Math.min(80, baseColor.l + lightDiff); break;
    }
    
    const baseHSL = `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
    const differentHSL = `hsl(${differentH}, ${differentS}%, ${differentL}%)`;
    
    // Pick random position for different color
    const differentIndex = Math.floor(Math.random() * gridSize);
    
    return { baseHSL, differentHSL, differentIndex, cols };
  }
  
  function showRound() {
    if (mistakes >= MAX_MISTAKES) {
      endGame(score > 0, score * 10);
      return;
    }
    
    if (round >= MAX_ROUNDS) {
      endGame(true, score * 10 + 50); // Bonus for completing all rounds
      return;
    }
    
    const { baseHSL, differentHSL, differentIndex, cols } = generateRound();
    
    elements.gameContainer.innerHTML = `
      <div class="spot-game">
        <div class="spot-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <div class="spot-score">Score: ${score}</div>
          <div class="spot-round">Round ${round + 1}/${MAX_ROUNDS}</div>
        </div>
        <div class="spot-instruction">Find the slightly different color!</div>
        <div class="spot-color-grid" style="grid-template-columns: repeat(${cols}, 1fr)">
          ${Array(cols * cols).fill(0).map((_, i) => `
            <button class="spot-color-cell" data-index="${i}" 
                    style="background-color: ${i === differentIndex ? differentHSL : baseHSL}">
            </button>
          `).join('')}
        </div>
        <div class="spot-difficulty">Difficulty: ${round < 5 ? 'Easy' : round < 10 ? 'Medium' : 'Hard'}</div>
      </div>
    `;
    
    elements.gameContainer.querySelectorAll('.spot-color-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index')!);
        
        if (index === differentIndex) {
          score++;
          round++;
          soundManager.play('correct');
          btn.classList.add('correct');
          setTimeout(showRound, 600);
        } else {
          mistakes++;
          soundManager.play('wrong');
          btn.classList.add('wrong');
          // Highlight the correct one
          elements.gameContainer.querySelector(`[data-index="${differentIndex}"]`)?.classList.add('correct');
          setTimeout(showRound, 1200);
        }
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

// ==================== CLASSIC POPULAR GAMES ====================

// Game 1: TETRIS
function loadTetris() {
  const COLS = 10;
  const ROWS = 16;
  const BLOCK_SIZE = 24;
  
  const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,0,0],[1,1,1]], // L
    [[0,0,1],[1,1,1]], // J
    [[0,1,1],[1,1,0]], // S
    [[1,1,0],[0,1,1]], // Z
  ];
  
  const COLORS = ['#00F5FF', '#FFE500', '#FF00E5', '#FF6B00', '#0066FF', '#00FF88', '#FF3366'];
  
  let board: number[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  let currentPiece: { shape: number[][], x: number, y: number, color: number } | null = null;
  let nextPieceIdx: number = Math.floor(Math.random() * SHAPES.length);
  let score = 0;
  let gameOver = false;
  let gameInterval: number | null = null;
  
  function newPiece() {
    const shapeIdx = nextPieceIdx;
    nextPieceIdx = Math.floor(Math.random() * SHAPES.length);
    currentPiece = {
      shape: SHAPES[shapeIdx].map(row => [...row]),
      x: Math.floor(COLS / 2) - 1,
      y: 0,
      color: shapeIdx + 1
    };
    if (collision()) {
      gameOver = true;
      if (gameInterval) clearInterval(gameInterval);
      endGame(score > 50, score);
    }
    renderNextPiece();
  }
  
  function renderNextPiece() {
    const nextCanvas = document.getElementById('tetrisNextCanvas') as HTMLCanvasElement;
    if (!nextCanvas) return;
    const ctx = nextCanvas.getContext('2d')!;
    const size = 16;
    
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    const shape = SHAPES[nextPieceIdx];
    const offsetX = (nextCanvas.width - shape[0].length * size) / 2;
    const offsetY = (nextCanvas.height - shape.length * size) / 2;
    
    ctx.fillStyle = COLORS[nextPieceIdx];
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          ctx.fillRect(offsetX + x * size, offsetY + y * size, size - 1, size - 1);
        }
      }
    }
  }
  
  function collision(offsetX = 0, offsetY = 0, shape = currentPiece?.shape) {
    if (!currentPiece || !shape) return false;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = currentPiece.x + x + offsetX;
          const newY = currentPiece.y + y + offsetY;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && board[newY][newX]) return true;
        }
      }
    }
    return false;
  }
  
  function merge() {
    if (!currentPiece) return;
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const boardY = currentPiece.y + y;
          if (boardY >= 0) board[boardY][currentPiece.x + x] = currentPiece.color;
        }
      }
    }
  }
  
  function clearLines() {
    let lines = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(cell => cell !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        lines++;
        y++;
      }
    }
    if (lines > 0) {
      score += lines * 10 * lines;
      soundManager.play('correct');
    }
  }
  
  function rotate() {
    if (!currentPiece) return;
    const rotated = currentPiece.shape[0].map((_, i) => 
      currentPiece!.shape.map(row => row[i]).reverse()
    );
    if (!collision(0, 0, rotated)) {
      currentPiece.shape = rotated;
    }
  }
  
  function drop() {
    if (gameOver || !currentPiece) return;
    if (!collision(0, 1)) {
      currentPiece.y++;
    } else {
      merge();
      clearLines();
      newPiece();
    }
    render();
  }
  
  function render() {
    const canvas = document.getElementById('tetrisCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw board
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) {
          ctx.fillStyle = COLORS[board[y][x] - 1];
          ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      }
    }
    
    // Draw current piece
    if (currentPiece) {
      ctx.fillStyle = COLORS[currentPiece.color - 1];
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            ctx.fillRect(
              (currentPiece.x + x) * BLOCK_SIZE,
              (currentPiece.y + y) * BLOCK_SIZE,
              BLOCK_SIZE - 1, BLOCK_SIZE - 1
            );
          }
        }
      }
    }
    
    // Update score display
    const scoreEl = document.getElementById('tetrisScore');
    if (scoreEl) scoreEl.textContent = String(score);
  }
  
  elements.gameContainer.innerHTML = `
    <div class="tetris-game">
      <div class="tetris-main">
        <canvas id="tetrisCanvas" width="${COLS * BLOCK_SIZE}" height="${ROWS * BLOCK_SIZE}"></canvas>
        <div class="tetris-sidebar">
          <div class="tetris-next">
            <div class="tetris-next-label">NEXT</div>
            <canvas id="tetrisNextCanvas" width="80" height="80"></canvas>
          </div>
          <div class="tetris-score-box">
            <div class="tetris-score-label">SCORE</div>
            <div class="tetris-score-value" id="tetrisScore">0</div>
          </div>
        </div>
      </div>
      <div class="tetris-controls">
        <button class="tetris-btn" id="tetrisLeft">←</button>
        <button class="tetris-btn" id="tetrisRotate">↻</button>
        <button class="tetris-btn" id="tetrisRight">→</button>
        <button class="tetris-btn" id="tetrisDown">↓</button>
      </div>
      <div class="tetris-hint">Use arrow keys or buttons</div>
    </div>
  `;
  
  // Controls
  document.getElementById('tetrisLeft')?.addEventListener('click', () => {
    if (!collision(-1, 0)) { currentPiece!.x--; render(); }
  });
  document.getElementById('tetrisRight')?.addEventListener('click', () => {
    if (!collision(1, 0)) { currentPiece!.x++; render(); }
  });
  document.getElementById('tetrisRotate')?.addEventListener('click', () => { rotate(); render(); });
  document.getElementById('tetrisDown')?.addEventListener('click', drop);
  
  document.addEventListener('keydown', (e) => {
    if (gameOver) return;
    if (e.key === 'ArrowLeft' && !collision(-1, 0)) { currentPiece!.x--; render(); }
    if (e.key === 'ArrowRight' && !collision(1, 0)) { currentPiece!.x++; render(); }
    if (e.key === 'ArrowUp') { rotate(); render(); }
    if (e.key === 'ArrowDown') drop();
  });
  
  newPiece();
  render();
  gameInterval = window.setInterval(drop, 500);
}

// Game 2: 2048
function load2048() {
  const SIZE = 4;
  let grid: number[][] = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
  let score = 0;
  
  function addRandomTile() {
    const empty: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length > 0) {
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  }
  
  function slide(row: number[]): { newRow: number[], scored: number } {
    let arr = row.filter(x => x !== 0);
    let scored = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        scored += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < SIZE) arr.push(0);
    return { newRow: arr, scored };
  }
  
  function move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    let moved = false;
    const oldGrid = grid.map(r => [...r]);
    
    if (direction === 'left') {
      for (let r = 0; r < SIZE; r++) {
        const { newRow, scored } = slide(grid[r]);
        grid[r] = newRow;
        score += scored;
      }
    } else if (direction === 'right') {
      for (let r = 0; r < SIZE; r++) {
        const { newRow, scored } = slide([...grid[r]].reverse());
        grid[r] = newRow.reverse();
        score += scored;
      }
    } else if (direction === 'up') {
      for (let c = 0; c < SIZE; c++) {
        const col = grid.map(r => r[c]);
        const { newRow, scored } = slide(col);
        for (let r = 0; r < SIZE; r++) grid[r][c] = newRow[r];
        score += scored;
      }
    } else if (direction === 'down') {
      for (let c = 0; c < SIZE; c++) {
        const col = grid.map(r => r[c]).reverse();
        const { newRow, scored } = slide(col);
        const reversed = newRow.reverse();
        for (let r = 0; r < SIZE; r++) grid[r][c] = reversed[r];
        score += scored;
      }
    }
    
    moved = JSON.stringify(oldGrid) !== JSON.stringify(grid);
    return moved;
  }
  
  function checkWin(): boolean {
    return grid.some(r => r.some(c => c >= 2048));
  }
  
  function checkLose(): boolean {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
      }
    }
    return true;
  }
  
  function getTileColor(val: number): string {
    const colors: Record<number, string> = {
      2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563',
      32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61',
      512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
    };
    return colors[val] || '#3c3a32';
  }
  
  function render() {
    const container = document.getElementById('grid2048');
    if (!container) return;
    
    container.innerHTML = grid.map(row => 
      row.map(val => `
        <div class="tile-2048" style="background: ${val ? getTileColor(val) : 'rgba(255,255,255,0.1)'}; color: ${val > 4 ? '#fff' : '#776e65'}">
          ${val || ''}
        </div>
      `).join('')
    ).join('');
    
    const scoreEl = document.getElementById('score2048');
    if (scoreEl) scoreEl.textContent = String(score);
  }
  
  function handleMove(dir: 'up' | 'down' | 'left' | 'right') {
    if (move(dir)) {
      addRandomTile();
      render();
      
      if (checkWin()) {
        soundManager.play('win');
        setTimeout(() => endGame(true, score), 500);
      } else if (checkLose()) {
        soundManager.play('lose');
        setTimeout(() => endGame(false, score), 500);
      }
    }
  }
  
  elements.gameContainer.innerHTML = `
    <div class="game-2048">
      <div class="header-2048">
        <div class="score-2048">Score: <span id="score2048">0</span></div>
      </div>
      <div class="grid-2048" id="grid2048"></div>
      <div class="controls-2048">
        <button class="btn-2048" data-dir="up">↑</button>
        <div class="controls-row">
          <button class="btn-2048" data-dir="left">←</button>
          <button class="btn-2048" data-dir="down">↓</button>
          <button class="btn-2048" data-dir="right">→</button>
        </div>
      </div>
      <div class="hint-2048">Swipe or use arrow keys</div>
    </div>
  `;
  
  // Add tiles
  addRandomTile();
  addRandomTile();
  render();
  
  // Controls
  document.querySelectorAll('.btn-2048').forEach(btn => {
    btn.addEventListener('click', () => {
      handleMove(btn.getAttribute('data-dir') as 'up' | 'down' | 'left' | 'right');
    });
  });
  
  document.addEventListener('keydown', (e) => {
    const keyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right'
    };
    if (keyMap[e.key]) handleMove(keyMap[e.key]);
  });
}

// Game 3: SUDOKU
function loadSudoku() {
  // Multiple Sudoku puzzles for variety (0 = empty)
  const puzzleData = [
    {
      puzzle: [
        [5,3,0,0,7,0,0,0,0],
        [6,0,0,1,9,5,0,0,0],
        [0,9,8,0,0,0,0,6,0],
        [8,0,0,0,6,0,0,0,3],
        [4,0,0,8,0,3,0,0,1],
        [7,0,0,0,2,0,0,0,6],
        [0,6,0,0,0,0,2,8,0],
        [0,0,0,4,1,9,0,0,5],
        [0,0,0,0,8,0,0,7,9]
      ],
      solution: [
        [5,3,4,6,7,8,9,1,2],
        [6,7,2,1,9,5,3,4,8],
        [1,9,8,3,4,2,5,6,7],
        [8,5,9,7,6,1,4,2,3],
        [4,2,6,8,5,3,7,9,1],
        [7,1,3,9,2,4,8,5,6],
        [9,6,1,5,3,7,2,8,4],
        [2,8,7,4,1,9,6,3,5],
        [3,4,5,2,8,6,1,7,9]
      ]
    },
    {
      puzzle: [
        [0,0,0,2,6,0,7,0,1],
        [6,8,0,0,7,0,0,9,0],
        [1,9,0,0,0,4,5,0,0],
        [8,2,0,1,0,0,0,4,0],
        [0,0,4,6,0,2,9,0,0],
        [0,5,0,0,0,3,0,2,8],
        [0,0,9,3,0,0,0,7,4],
        [0,4,0,0,5,0,0,3,6],
        [7,0,3,0,1,8,0,0,0]
      ],
      solution: [
        [4,3,5,2,6,9,7,8,1],
        [6,8,2,5,7,1,4,9,3],
        [1,9,7,8,3,4,5,6,2],
        [8,2,6,1,9,5,3,4,7],
        [3,7,4,6,8,2,9,1,5],
        [9,5,1,7,4,3,6,2,8],
        [5,1,9,3,2,6,8,7,4],
        [2,4,8,9,5,7,1,3,6],
        [7,6,3,4,1,8,2,5,9]
      ]
    }
  ];
  
  // Pick random puzzle
  const puzzleIdx = Math.floor(Math.random() * puzzleData.length);
  const { puzzle: initialPuzzle, solution } = puzzleData[puzzleIdx];
  const puzzle = initialPuzzle.map(r => [...r]);
  const original = initialPuzzle.map(r => [...r]);
  let selectedCell: [number, number] | null = null;
  let mistakes = 0;
  
  // Find all conflicts in current grid
  function findConflicts(): Set<string> {
    const conflicts = new Set<string>();
    
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = puzzle[r][c];
        if (val === 0) continue;
        
        // Check row
        for (let i = 0; i < 9; i++) {
          if (i !== c && puzzle[r][i] === val) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${r},${i}`);
          }
        }
        
        // Check column
        for (let i = 0; i < 9; i++) {
          if (i !== r && puzzle[i][c] === val) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${i},${c}`);
          }
        }
        
        // Check 3x3 box
        const boxR = Math.floor(r / 3) * 3;
        const boxC = Math.floor(c / 3) * 3;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const nr = boxR + i, nc = boxC + j;
            if ((nr !== r || nc !== c) && puzzle[nr][nc] === val) {
              conflicts.add(`${r},${c}`);
              conflicts.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
    
    return conflicts;
  }
  
  function render() {
    const grid = document.getElementById('sudokuGrid');
    if (!grid) return;
    
    const conflicts = findConflicts();
    
    grid.innerHTML = puzzle.map((row, r) => 
      row.map((val, c) => {
        const isOriginal = original[r][c] !== 0;
        const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c;
        const hasConflict = conflicts.has(`${r},${c}`) && !isOriginal;
        return `
          <div class="sudoku-cell ${isOriginal ? 'original' : ''} ${isSelected ? 'selected' : ''} ${hasConflict ? 'conflict' : ''}" 
               data-row="${r}" data-col="${c}">
            ${val || ''}
          </div>
        `;
      }).join('')
    ).join('');
    
    // Update mistakes display
    const mistakesEl = document.getElementById('sudokuMistakes');
    if (mistakesEl) mistakesEl.textContent = String(mistakes);
    
    // Add click handlers
    grid.querySelectorAll('.sudoku-cell:not(.original)').forEach(cell => {
      cell.addEventListener('click', () => {
        const r = parseInt(cell.getAttribute('data-row')!);
        const c = parseInt(cell.getAttribute('data-col')!);
        selectedCell = [r, c];
        render();
      });
    });
  }
  
  function checkWin(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== solution[r][c]) return false;
      }
    }
    return true;
  }
  
  function isFilled(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] === 0) return false;
      }
    }
    return true;
  }
  
  elements.gameContainer.innerHTML = `
    <div class="sudoku-game">
      <div class="sudoku-header">
        <span>Sudoku</span>
        <span class="sudoku-info">Fill all cells correctly</span>
      </div>
      <div class="sudoku-grid" id="sudokuGrid"></div>
      <div class="sudoku-numbers">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="sudoku-num" data-num="${n}">${n}</button>`).join('')}
        <button class="sudoku-num sudoku-clear" data-num="0">✕</button>
      </div>
      <button class="sudoku-check" id="sudokuCheck">Check Solution</button>
    </div>
  `;
  
  render();
  
  // Number input
  document.querySelectorAll('.sudoku-num').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selectedCell) return;
      const [r, c] = selectedCell;
      if (original[r][c] !== 0) return;
      
      const num = parseInt(btn.getAttribute('data-num')!);
      puzzle[r][c] = num;
      soundManager.play('click');
      render();
    });
  });
  
  // Check solution button
  document.getElementById('sudokuCheck')?.addEventListener('click', () => {
    if (!isFilled()) {
      // Show message that puzzle is not complete
      const info = document.querySelector('.sudoku-info');
      if (info) {
        info.textContent = 'Fill all cells first!';
        info.classList.add('warning');
        setTimeout(() => {
          info.textContent = 'Fill all cells correctly';
          info.classList.remove('warning');
        }, 2000);
      }
      return;
    }
    
    if (checkWin()) {
      soundManager.play('win');
      setTimeout(() => endGame(true, 100), 500);
    } else {
      soundManager.play('wrong');
      mistakes++;
      const info = document.querySelector('.sudoku-info');
      if (info) {
        info.textContent = 'Not correct! Check conflicts.';
        info.classList.add('error');
        setTimeout(() => {
          info.textContent = 'Fill all cells correctly';
          info.classList.remove('error');
        }, 2000);
      }
      render();
      
      if (mistakes >= 3) {
        setTimeout(() => endGame(false, 0), 1500);
      }
    }
  });
}

// Game 4: HANGMAN
function loadHangman() {
  const words = [
    'JAVASCRIPT', 'PYTHON', 'ALGORITHM', 'DATABASE', 'FUNCTION',
    'VARIABLE', 'COMPUTER', 'KEYBOARD', 'INTERNET', 'SOFTWARE',
    'BROWSER', 'NETWORK', 'MEMORY', 'PROCESSOR', 'ENCRYPTION'
  ];
  
  const word = words[Math.floor(Math.random() * words.length)];
  let guessed: string[] = [];
  let mistakes = 0;
  const maxMistakes = 6;
  
  function render() {
    const display = word.split('').map(l => guessed.includes(l) ? l : '_').join(' ');
    const won = !display.includes('_');
    const lost = mistakes >= maxMistakes;
    
    elements.gameContainer.innerHTML = `
      <div class="hangman-game">
        <div class="hangman-figure">
          <svg viewBox="0 0 200 200" width="150" height="150">
            <line x1="20" y1="180" x2="100" y2="180" stroke="#00F5FF" stroke-width="3"/>
            <line x1="60" y1="180" x2="60" y2="20" stroke="#00F5FF" stroke-width="3"/>
            <line x1="60" y1="20" x2="140" y2="20" stroke="#00F5FF" stroke-width="3"/>
            <line x1="140" y1="20" x2="140" y2="40" stroke="#00F5FF" stroke-width="3"/>
            ${mistakes > 0 ? '<circle cx="140" cy="55" r="15" stroke="#FF3366" fill="none" stroke-width="3"/>' : ''}
            ${mistakes > 1 ? '<line x1="140" y1="70" x2="140" y2="110" stroke="#FF3366" stroke-width="3"/>' : ''}
            ${mistakes > 2 ? '<line x1="140" y1="80" x2="120" y2="100" stroke="#FF3366" stroke-width="3"/>' : ''}
            ${mistakes > 3 ? '<line x1="140" y1="80" x2="160" y2="100" stroke="#FF3366" stroke-width="3"/>' : ''}
            ${mistakes > 4 ? '<line x1="140" y1="110" x2="120" y2="140" stroke="#FF3366" stroke-width="3"/>' : ''}
            ${mistakes > 5 ? '<line x1="140" y1="110" x2="160" y2="140" stroke="#FF3366" stroke-width="3"/>' : ''}
          </svg>
        </div>
        <div class="hangman-word">${display}</div>
        <div class="hangman-status">Mistakes: ${mistakes}/${maxMistakes}</div>
        ${won || lost ? `
          <div class="hangman-result ${won ? 'won' : 'lost'}">
            ${won ? '🎉 You Won!' : `💀 Game Over! Word: ${word}`}
          </div>
        ` : `
          <div class="hangman-keyboard">
            ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `
              <button class="hangman-key ${guessed.includes(l) ? (word.includes(l) ? 'correct' : 'wrong') : ''}" 
                      data-letter="${l}" ${guessed.includes(l) ? 'disabled' : ''}>
                ${l}
              </button>
            `).join('')}
          </div>
        `}
      </div>
    `;
    
    if (won) {
      soundManager.play('win');
      setTimeout(() => endGame(true, (maxMistakes - mistakes) * 15), 1000);
    } else if (lost) {
      soundManager.play('lose');
      setTimeout(() => endGame(false, 0), 1000);
    } else {
      // Add click handlers
      document.querySelectorAll('.hangman-key:not([disabled])').forEach(key => {
        key.addEventListener('click', () => {
          const letter = key.getAttribute('data-letter')!;
          guessed.push(letter);
          if (!word.includes(letter)) {
            mistakes++;
            soundManager.play('wrong');
          } else {
            soundManager.play('correct');
          }
          render();
        });
      });
    }
  }
  
  render();
}

// Game 5: CONNECTIONS (NYT style)
function loadConnections() {
  const puzzles = [
    {
      groups: [
        { category: '🟨 Fruits', words: ['APPLE', 'BANANA', 'ORANGE', 'GRAPE'] },
        { category: '🟩 Countries', words: ['FRANCE', 'JAPAN', 'BRAZIL', 'EGYPT'] },
        { category: '🟦 Colors', words: ['RED', 'BLUE', 'GREEN', 'YELLOW'] },
        { category: '🟪 Planets', words: ['MARS', 'VENUS', 'JUPITER', 'SATURN'] }
      ]
    },
    {
      groups: [
        { category: '🟨 Animals', words: ['DOG', 'CAT', 'BIRD', 'FISH'] },
        { category: '🟩 Sports', words: ['SOCCER', 'TENNIS', 'GOLF', 'HOCKEY'] },
        { category: '🟦 Music', words: ['PIANO', 'GUITAR', 'DRUMS', 'VIOLIN'] },
        { category: '🟪 Food', words: ['PIZZA', 'BURGER', 'PASTA', 'SALAD'] }
      ]
    }
  ];
  
  const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  const allWords = puzzle.groups.flatMap(g => g.words).sort(() => Math.random() - 0.5);
  let selected: string[] = [];
  let found: string[][] = [];
  let mistakes = 0;
  const maxMistakes = 4;
  
  function render() {
    const remaining = allWords.filter(w => !found.flat().includes(w));
    
    elements.gameContainer.innerHTML = `
      <div class="connections-game">
        <div class="connections-header">
          <span>Group 16 words into 4 categories</span>
          <span class="connections-mistakes">Mistakes: ${mistakes}/${maxMistakes}</span>
        </div>
        <div class="connections-found">
          ${found.map((group, i) => {
            const groupData = puzzle.groups.find(g => g.words.every(w => group.includes(w)));
            return `<div class="connections-group found-${i}">${groupData?.category}</div>`;
          }).join('')}
        </div>
        <div class="connections-grid">
          ${remaining.map(word => `
            <button class="connections-word ${selected.includes(word) ? 'selected' : ''}" data-word="${word}">
              ${word}
            </button>
          `).join('')}
        </div>
        <div class="connections-actions">
          <button class="connections-btn" id="connectionsClear">Clear</button>
          <button class="connections-btn primary" id="connectionsSubmit" ${selected.length !== 4 ? 'disabled' : ''}>
            Submit (${selected.length}/4)
          </button>
        </div>
      </div>
    `;
    
    // Word selection
    document.querySelectorAll('.connections-word').forEach(btn => {
      btn.addEventListener('click', () => {
        const word = btn.getAttribute('data-word')!;
        if (selected.includes(word)) {
          selected = selected.filter(w => w !== word);
        } else if (selected.length < 4) {
          selected.push(word);
        }
        render();
      });
    });
    
    document.getElementById('connectionsClear')?.addEventListener('click', () => {
      selected = [];
      render();
    });
    
    document.getElementById('connectionsSubmit')?.addEventListener('click', () => {
      const isCorrect = puzzle.groups.some(g => 
        g.words.every(w => selected.includes(w)) && selected.every(w => g.words.includes(w))
      );
      
      if (isCorrect) {
        found.push([...selected]);
        selected = [];
        soundManager.play('correct');
        
        if (found.length === 4) {
          setTimeout(() => endGame(true, (maxMistakes - mistakes) * 25), 500);
        } else {
          render();
        }
      } else {
        mistakes++;
        soundManager.play('wrong');
        if (mistakes >= maxMistakes) {
          setTimeout(() => endGame(false, found.length * 20), 500);
        } else {
          render();
        }
      }
    });
  }
  
  render();
}

// Game 6: SNAKE
function loadSnake() {
  const GRID_SIZE = 15;
  const CELL_SIZE = 20;
  
  let snake = [{ x: 7, y: 7 }];
  let direction = { x: 1, y: 0 };
  let food = { x: 10, y: 7 };
  let score = 0;
  let gameOver = false;
  let gameInterval: number | null = null;
  
  function placeFood() {
    do {
      food = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }
  
  function update() {
    if (gameOver) return;
    
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    
    // Check collision with walls
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      gameOver = true;
      if (gameInterval) clearInterval(gameInterval);
      endGame(score > 20, score);
      return;
    }
    
    // Check collision with self
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      gameOver = true;
      if (gameInterval) clearInterval(gameInterval);
      endGame(score > 20, score);
      return;
    }
    
    snake.unshift(head);
    
    // Check food
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      soundManager.play('correct');
      placeFood();
    } else {
      snake.pop();
    }
    
    render();
  }
  
  function render() {
    const canvas = document.getElementById('snakeCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }
    
    // Draw snake
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#00FF88' : '#00D4FF';
      ctx.fillRect(s.x * CELL_SIZE + 1, s.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
    
    // Draw food
    ctx.fillStyle = '#FF3366';
    ctx.beginPath();
    ctx.arc(food.x * CELL_SIZE + CELL_SIZE/2, food.y * CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    
    const scoreEl = document.getElementById('snakeScore');
    if (scoreEl) scoreEl.textContent = String(score);
  }
  
  elements.gameContainer.innerHTML = `
    <div class="snake-game">
      <div class="snake-header">Score: <span id="snakeScore">0</span></div>
      <canvas id="snakeCanvas" width="${GRID_SIZE * CELL_SIZE}" height="${GRID_SIZE * CELL_SIZE}"></canvas>
      <div class="snake-controls">
        <button class="snake-btn" data-dir="up">↑</button>
        <div class="snake-row">
          <button class="snake-btn" data-dir="left">←</button>
          <button class="snake-btn" data-dir="down">↓</button>
          <button class="snake-btn" data-dir="right">→</button>
        </div>
      </div>
    </div>
  `;
  
  render();
  
  const setDirection = (dir: string) => {
    const dirs: Record<string, {x: number, y: number}> = {
      'up': {x: 0, y: -1}, 'down': {x: 0, y: 1},
      'left': {x: -1, y: 0}, 'right': {x: 1, y: 0}
    };
    const newDir = dirs[dir];
    if (newDir && !(direction.x === -newDir.x && direction.y === -newDir.y)) {
      direction = newDir;
    }
  };
  
  document.querySelectorAll('.snake-btn').forEach(btn => {
    btn.addEventListener('click', () => setDirection(btn.getAttribute('data-dir')!));
  });
  
  document.addEventListener('keydown', (e) => {
    const keyMap: Record<string, string> = {
      'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right'
    };
    if (keyMap[e.key]) setDirection(keyMap[e.key]);
  });
  
  gameInterval = window.setInterval(update, 150);
}

// Game 7: MATCH-3
function loadMatchThree() {
  const GRID = 6;
  const TYPES = ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐'];
  
  let grid: string[][] = [];
  let selected: [number, number] | null = null;
  let score = 0;
  let moves = 20;
  
  function init() {
    grid = Array(GRID).fill(null).map(() => 
      Array(GRID).fill(null).map(() => TYPES[Math.floor(Math.random() * TYPES.length)])
    );
    // Remove initial matches
    while (findMatches().length > 0) {
      clearMatches();
      fillGrid();
    }
  }
  
  function findMatches(): [number, number][] {
    const matches: Set<string> = new Set();
    
    // Horizontal
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID - 2; c++) {
        if (grid[r][c] && grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) {
          matches.add(`${r},${c}`);
          matches.add(`${r},${c+1}`);
          matches.add(`${r},${c+2}`);
        }
      }
    }
    
    // Vertical
    for (let c = 0; c < GRID; c++) {
      for (let r = 0; r < GRID - 2; r++) {
        if (grid[r][c] && grid[r][c] === grid[r+1][c] && grid[r][c] === grid[r+2][c]) {
          matches.add(`${r},${c}`);
          matches.add(`${r+1},${c}`);
          matches.add(`${r+2},${c}`);
        }
      }
    }
    
    return Array.from(matches).map(s => s.split(',').map(Number) as [number, number]);
  }
  
  function clearMatches() {
    const matches = findMatches();
    matches.forEach(([r, c]) => { grid[r][c] = ''; });
    score += matches.length * 10;
    return matches.length > 0;
  }
  
  function fillGrid() {
    for (let c = 0; c < GRID; c++) {
      for (let r = GRID - 1; r >= 0; r--) {
        if (!grid[r][c]) {
          // Drop from above
          for (let above = r - 1; above >= 0; above--) {
            if (grid[above][c]) {
              grid[r][c] = grid[above][c];
              grid[above][c] = '';
              break;
            }
          }
          // If still empty, add new
          if (!grid[r][c]) {
            grid[r][c] = TYPES[Math.floor(Math.random() * TYPES.length)];
          }
        }
      }
    }
  }
  
  function swap(r1: number, c1: number, r2: number, c2: number) {
    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
  }
  
  function render() {
    elements.gameContainer.innerHTML = `
      <div class="match3-game">
        <div class="match3-header">
          <span>Score: ${score}</span>
          <span>Moves: ${moves}</span>
        </div>
        <div class="match3-grid">
          ${grid.map((row, r) => row.map((cell, c) => `
            <button class="match3-cell ${selected && selected[0] === r && selected[1] === c ? 'selected' : ''}" 
                    data-row="${r}" data-col="${c}">
              ${cell}
            </button>
          `).join('')).join('')}
        </div>
      </div>
    `;
    
    document.querySelectorAll('.match3-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const r = parseInt(cell.getAttribute('data-row')!);
        const c = parseInt(cell.getAttribute('data-col')!);
        
        if (!selected) {
          selected = [r, c];
          render();
        } else {
          const [sr, sc] = selected;
          const isAdjacent = (Math.abs(r - sr) === 1 && c === sc) || (Math.abs(c - sc) === 1 && r === sr);
          
          if (isAdjacent) {
            swap(sr, sc, r, c);
            
            if (findMatches().length > 0) {
              moves--;
              while (clearMatches()) {
                fillGrid();
              }
              soundManager.play('correct');
            } else {
              swap(sr, sc, r, c); // Swap back
              soundManager.play('wrong');
            }
          }
          
          selected = null;
          
          if (moves <= 0) {
            setTimeout(() => endGame(score >= 100, score), 500);
          } else {
            render();
          }
        }
      });
    });
  }
  
  init();
  render();
}

// Game 8: GOOGLE FEUD (Search Feud)
async function loadGoogleFeud() {
  // Pre-made queries with common completions
  const queries = [
    { start: 'Why do cats', answers: ['purr', 'knead', 'meow', 'sleep so much', 'like boxes'] },
    { start: 'How to make', answers: ['money', 'friends', 'pancakes', 'slime', 'coffee'] },
    { start: 'Is it bad to', answers: ['sleep too much', 'eat late', 'crack knuckles', 'skip breakfast'] },
    { start: 'Why is the sky', answers: ['blue', 'red at sunset', 'orange', 'gray'] },
    { start: 'Can dogs eat', answers: ['bananas', 'chocolate', 'grapes', 'cheese', 'apples'] },
    { start: 'What happens if', answers: ['you swallow gum', 'you eat too much', 'the sun explodes'] },
  ];
  
  let currentQuery = queries[Math.floor(Math.random() * queries.length)];
  let found: string[] = [];
  let guesses = 0;
  const maxGuesses = 5;
  let score = 0;
  
  function render() {
    elements.gameContainer.innerHTML = `
      <div class="feud-game">
        <div class="feud-header">
          <span>Guesses: ${guesses}/${maxGuesses}</span>
          <span>Score: ${score}</span>
        </div>
        <div class="feud-query">
          <span class="feud-google">G</span><span class="feud-google o1">o</span><span class="feud-google o2">o</span><span class="feud-google g">g</span><span class="feud-google l">l</span><span class="feud-google e">e</span>
          <div class="feud-search">${currentQuery.start}...</div>
        </div>
        <div class="feud-answers">
          ${currentQuery.answers.map((a, i) => `
            <div class="feud-answer ${found.includes(a) ? 'found' : ''}">
              ${found.includes(a) ? a : `#${i + 1}`}
            </div>
          `).join('')}
        </div>
        <div class="feud-input-wrap">
          <input type="text" id="feudInput" class="feud-input" placeholder="Type your guess..." autocomplete="off">
          <button class="feud-submit" id="feudSubmit">Guess</button>
        </div>
      </div>
    `;
    
    const input = document.getElementById('feudInput') as HTMLInputElement;
    const submit = document.getElementById('feudSubmit')!;
    input.focus();
    
    const checkGuess = () => {
      const guess = input.value.toLowerCase().trim();
      if (!guess) return;
      
      const match = currentQuery.answers.find(a => 
        a.toLowerCase().includes(guess) || guess.includes(a.toLowerCase())
      );
      
      if (match && !found.includes(match)) {
        found.push(match);
        score += 20;
        soundManager.play('correct');
      } else {
        guesses++;
        soundManager.play('wrong');
      }
      
      input.value = '';
      
      if (found.length === currentQuery.answers.length) {
        setTimeout(() => endGame(true, score), 500);
      } else if (guesses >= maxGuesses) {
        setTimeout(() => endGame(score > 0, score), 500);
      } else {
        render();
      }
    };
    
    submit.addEventListener('click', checkGuess);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkGuess(); });
  }
  
  render();
}

// Game 9: BOGGLE (Word Blitz)
function loadBoggle() {
  const LETTERS = 'AAABCDEEEFGHIIIJKLMNOOOPQRSTUUUVWXYZ';
  const SIZE = 4;
  
  const grid: string[] = Array(SIZE * SIZE).fill('').map(() => 
    LETTERS[Math.floor(Math.random() * LETTERS.length)]
  );
  
  // Simple word list
  const validWords = new Set([
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD',
    'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS',
    'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY',
    'DID', 'OWN', 'SAY', 'SHE', 'TOO', 'USE', 'CAT', 'DOG', 'PIG', 'COW',
    'RUN', 'SUN', 'FUN', 'GUN', 'BUN', 'PEN', 'TEN', 'MEN', 'HEN', 'DEN',
    'BAT', 'HAT', 'RAT', 'SAT', 'MAT', 'PAT', 'FAT', 'EAT', 'BIG', 'DIG',
    'FIG', 'JIG', 'PIG', 'RIG', 'WIG', 'BIT', 'FIT', 'HIT', 'KIT', 'LIT',
    'PIT', 'SIT', 'WIT', 'CUP', 'CUT', 'GUT', 'HUT', 'JUT', 'NUT', 'PUT',
    'RUT', 'TUB', 'BUS', 'GUS', 'PUS', 'AIR', 'ASK', 'ACE', 'ACT', 'ADD'
  ]);
  
  let foundWords: string[] = [];
  let currentWord = '';
  let selectedCells: number[] = [];
  let score = 0;
  let timeLeft = 60;
  let timer: number | null = null;
  
  function render() {
    elements.gameContainer.innerHTML = `
      <div class="boggle-game">
        <div class="boggle-header">
          <span>Score: ${score}</span>
          <span>Time: ${timeLeft}s</span>
        </div>
        <div class="boggle-current">${currentWord || 'Select letters...'}</div>
        <div class="boggle-grid">
          ${grid.map((l, i) => `
            <button class="boggle-cell ${selectedCells.includes(i) ? 'selected' : ''}" data-idx="${i}">
              ${l}
            </button>
          `).join('')}
        </div>
        <div class="boggle-actions">
          <button class="boggle-btn" id="boggleClear">Clear</button>
          <button class="boggle-btn primary" id="boggleSubmit">Submit</button>
        </div>
        <div class="boggle-found">Found: ${foundWords.join(', ') || 'none yet'}</div>
      </div>
    `;
    
    document.querySelectorAll('.boggle-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const idx = parseInt(cell.getAttribute('data-idx')!);
        if (!selectedCells.includes(idx)) {
          selectedCells.push(idx);
          currentWord += grid[idx];
          render();
        }
      });
    });
    
    document.getElementById('boggleClear')?.addEventListener('click', () => {
      currentWord = '';
      selectedCells = [];
      render();
    });
    
    document.getElementById('boggleSubmit')?.addEventListener('click', () => {
      if (currentWord.length >= 3 && validWords.has(currentWord) && !foundWords.includes(currentWord)) {
        foundWords.push(currentWord);
        score += currentWord.length * 10;
        soundManager.play('correct');
      } else {
        soundManager.play('wrong');
      }
      currentWord = '';
      selectedCells = [];
      render();
    });
  }
  
  render();
  
  timer = window.setInterval(() => {
    timeLeft--;
    const timeEl = document.querySelector('.boggle-header span:last-child');
    if (timeEl) timeEl.textContent = `Time: ${timeLeft}s`;
    
    if (timeLeft <= 0) {
      if (timer) clearInterval(timer);
      endGame(score >= 30, score);
    }
  }, 1000);
}

// Game 10: AIM TRAINER
function loadAimTrainer() {
  let score = 0;
  let misses = 0;
  let targetsHit = 0;
  const totalTargets = 20;
  let targetTimeout: number | null = null;
  
  function spawnTarget() {
    if (targetsHit >= totalTargets) {
      const finalScore = Math.max(0, score - misses * 5);
      endGame(finalScore > 100, finalScore);
      return;
    }
    
    const container = document.getElementById('aimContainer');
    if (!container) return;
    
    const size = 30 + Math.random() * 30;
    const maxX = container.clientWidth - size;
    const maxY = container.clientHeight - size;
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    
    container.innerHTML = `
      <div class="aim-target" style="left: ${x}px; top: ${y}px; width: ${size}px; height: ${size}px;">
        🎯
      </div>
    `;
    
    const target = container.querySelector('.aim-target')!;
    target.addEventListener('click', (e) => {
      e.stopPropagation();
      targetsHit++;
      score += Math.round(60 - size + 20);
      soundManager.play('correct');
      if (targetTimeout) clearTimeout(targetTimeout);
      updateUI();
      spawnTarget();
    });
    
    targetTimeout = window.setTimeout(() => {
      misses++;
      soundManager.play('wrong');
      updateUI();
      spawnTarget();
    }, 1500);
  }
  
  function updateUI() {
    const scoreEl = document.getElementById('aimScore');
    const progressEl = document.getElementById('aimProgress');
    if (scoreEl) scoreEl.textContent = String(score);
    if (progressEl) progressEl.textContent = `${targetsHit}/${totalTargets}`;
  }
  
  elements.gameContainer.innerHTML = `
    <div class="aim-game">
      <div class="aim-header">
        <span>Score: <span id="aimScore">0</span></span>
        <span>Targets: <span id="aimProgress">0/${totalTargets}</span></span>
      </div>
      <div class="aim-container" id="aimContainer"></div>
      <div class="aim-hint">Click the targets as fast as you can!</div>
    </div>
  `;
  
  const container = document.getElementById('aimContainer')!;
  container.addEventListener('click', () => {
    misses++;
    updateUI();
  });
  
  spawnTarget();
}

// ==================== ADDITIONAL POPULAR GAMES ====================

// Game 11: JIGSAW PUZZLE
function loadJigsaw() {
  const GRID = 3; // 3x3 = 9 pieces
  const PIECE_SIZE = 80;
  
  // Create pieces with positions
  const pieces: { id: number; currentPos: number; correctPos: number }[] = [];
  for (let i = 0; i < GRID * GRID; i++) {
    pieces.push({ id: i, currentPos: i, correctPos: i });
  }
  
  // Shuffle pieces (but keep one in place for solvability)
  for (let i = pieces.length - 2; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i].currentPos, pieces[j].currentPos] = [pieces[j].currentPos, pieces[i].currentPos];
  }
  
  let selected: number | null = null;
  let moves = 0;
  
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  
  function checkWin(): boolean {
    return pieces.every(p => p.currentPos === p.correctPos);
  }
  
  function render() {
    const sortedByPos = [...pieces].sort((a, b) => a.currentPos - b.currentPos);
    
    elements.gameContainer.innerHTML = `
      <div class="jigsaw-game">
        <div class="jigsaw-header">
          <span>Moves: ${moves}</span>
        </div>
        <div class="jigsaw-grid" style="grid-template-columns: repeat(${GRID}, ${PIECE_SIZE}px)">
          ${sortedByPos.map(piece => `
            <div class="jigsaw-piece ${selected === piece.id ? 'selected' : ''} ${piece.currentPos === piece.correctPos ? 'correct' : ''}" 
                 data-id="${piece.id}"
                 style="background: ${colors[piece.id]}">
              ${piece.id + 1}
            </div>
          `).join('')}
        </div>
        <div class="jigsaw-hint">Click two pieces to swap them</div>
      </div>
    `;
    
    document.querySelectorAll('.jigsaw-piece').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.getAttribute('data-id')!);
        
        if (selected === null) {
          selected = id;
        } else if (selected === id) {
          selected = null;
        } else {
          // Swap pieces
          const piece1 = pieces.find(p => p.id === selected)!;
          const piece2 = pieces.find(p => p.id === id)!;
          [piece1.currentPos, piece2.currentPos] = [piece2.currentPos, piece1.currentPos];
          moves++;
          selected = null;
          soundManager.play('click');
          
          if (checkWin()) {
            soundManager.play('win');
            setTimeout(() => endGame(true, Math.max(10, 100 - moves * 2)), 500);
            return;
          }
        }
        render();
      });
    });
  }
  
  render();
}

// Game 12: N-BACK
function loadNBack() {
  const POSITIONS = 9; // 3x3 grid
  const N = 2; // 2-back
  let sequence: number[] = [];
  let currentIndex = 0;
  let score = 0;
  let mistakes = 0;
  const MAX_MISTAKES = 3;
  const TOTAL_ROUNDS = 20;
  let showingPosition = false;
  
  function generateSequence() {
    sequence = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      // 30% chance to repeat N-back position
      if (i >= N && Math.random() < 0.3) {
        sequence.push(sequence[i - N]);
      } else {
        sequence.push(Math.floor(Math.random() * POSITIONS));
      }
    }
  }
  
  function showPosition() {
    if (currentIndex >= TOTAL_ROUNDS || mistakes >= MAX_MISTAKES) {
      endGame(score >= 10, score * 5);
      return;
    }
    
    showingPosition = true;
    render();
    
    setTimeout(() => {
      showingPosition = false;
      render();
    }, 1000);
  }
  
  function render() {
    const isMatch = currentIndex >= N && sequence[currentIndex] === sequence[currentIndex - N];
    
    elements.gameContainer.innerHTML = `
      <div class="nback-game">
        <div class="nback-header">
          <div class="lives-display">
            ${Array(MAX_MISTAKES).fill(0).map((_, i) => `
              <span class="life-heart ${i < MAX_MISTAKES - mistakes ? 'active' : 'lost'}">❤️</span>
            `).join('')}
          </div>
          <span>Score: ${score}</span>
          <span>Round: ${currentIndex + 1}/${TOTAL_ROUNDS}</span>
        </div>
        <div class="nback-info">${N}-Back: Was this position shown ${N} steps ago?</div>
        <div class="nback-grid">
          ${Array(POSITIONS).fill(0).map((_, i) => `
            <div class="nback-cell ${showingPosition && sequence[currentIndex] === i ? 'active' : ''}"></div>
          `).join('')}
        </div>
        ${!showingPosition ? `
          <div class="nback-buttons">
            <button class="nback-btn no" id="nbackNo">✗ Different</button>
            <button class="nback-btn yes" id="nbackYes">✓ Same</button>
          </div>
        ` : '<div class="nback-waiting">Remember this position...</div>'}
      </div>
    `;
    
    if (!showingPosition) {
      document.getElementById('nbackYes')?.addEventListener('click', () => {
        if (isMatch) {
          score++;
          soundManager.play('correct');
        } else {
          mistakes++;
          soundManager.play('wrong');
        }
        currentIndex++;
        showPosition();
      });
      
      document.getElementById('nbackNo')?.addEventListener('click', () => {
        if (!isMatch) {
          score++;
          soundManager.play('correct');
        } else {
          mistakes++;
          soundManager.play('wrong');
        }
        currentIndex++;
        showPosition();
      });
    }
  }
  
  generateSequence();
  showPosition();
}

// Game 13: MINI CROSSWORD
function loadCrossword() {
  const puzzle = {
    grid: [
      ['C', 'A', 'T', ' ', ' '],
      ['A', ' ', 'O', ' ', ' '],
      ['R', 'U', 'N', ' ', ' '],
      [' ', ' ', ' ', ' ', ' '],
      [' ', ' ', ' ', ' ', ' '],
    ],
    clues: {
      across: [
        { num: 1, row: 0, col: 0, answer: 'CAT', clue: 'Feline pet' },
        { num: 3, row: 2, col: 0, answer: 'RUN', clue: 'Move fast' },
      ],
      down: [
        { num: 1, row: 0, col: 0, answer: 'CAR', clue: 'Vehicle' },
        { num: 2, row: 0, col: 2, answer: 'TON', clue: '2000 pounds' },
      ]
    }
  };
  
  const userGrid: string[][] = puzzle.grid.map(row => row.map(c => c === ' ' ? ' ' : ''));
  let selectedCell: [number, number] | null = null;
  
  function checkWin(): boolean {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (puzzle.grid[r][c] !== ' ' && userGrid[r][c] !== puzzle.grid[r][c]) {
          return false;
        }
      }
    }
    return true;
  }
  
  function render() {
    elements.gameContainer.innerHTML = `
      <div class="crossword-game">
        <div class="crossword-grid">
          ${puzzle.grid.map((row, r) => row.map((cell, c) => {
            if (cell === ' ') {
              return '<div class="crossword-cell blocked"></div>';
            }
            const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c;
            const isCorrect = userGrid[r][c] === puzzle.grid[r][c];
            const clueNum = 
              (r === 0 && c === 0) ? '1' : 
              (r === 0 && c === 2) ? '2' : 
              (r === 2 && c === 0) ? '3' : '';
            return `
              <div class="crossword-cell ${isSelected ? 'selected' : ''} ${isCorrect && userGrid[r][c] ? 'correct' : ''}" 
                   data-row="${r}" data-col="${c}">
                ${clueNum ? `<span class="crossword-num">${clueNum}</span>` : ''}
                ${userGrid[r][c]}
              </div>
            `;
          }).join('')).join('')}
        </div>
        <div class="crossword-clues">
          <div class="clue-section">
            <h4>Across</h4>
            ${puzzle.clues.across.map(c => `<div class="clue">${c.num}. ${c.clue}</div>`).join('')}
          </div>
          <div class="clue-section">
            <h4>Down</h4>
            ${puzzle.clues.down.map(c => `<div class="clue">${c.num}. ${c.clue}</div>`).join('')}
          </div>
        </div>
        <div class="crossword-keyboard">
          ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => 
            `<button class="crossword-key" data-letter="${l}">${l}</button>`
          ).join('')}
        </div>
      </div>
    `;
    
    // Cell selection
    document.querySelectorAll('.crossword-cell:not(.blocked)').forEach(cell => {
      cell.addEventListener('click', () => {
        const r = parseInt(cell.getAttribute('data-row')!);
        const c = parseInt(cell.getAttribute('data-col')!);
        selectedCell = [r, c];
        render();
      });
    });
    
    // Keyboard input
    document.querySelectorAll('.crossword-key').forEach(key => {
      key.addEventListener('click', () => {
        if (!selectedCell) return;
        const [r, c] = selectedCell;
        userGrid[r][c] = key.getAttribute('data-letter')!;
        soundManager.play('click');
        
        if (checkWin()) {
          soundManager.play('win');
          setTimeout(() => endGame(true, 100), 500);
        } else {
          render();
        }
      });
    });
  }
  
  render();
}

// Game 14: SOLITAIRE (Simplified Klondike)
function loadSolitaire() {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  interface Card {
    suit: string;
    value: string;
    faceUp: boolean;
    color: 'red' | 'black';
  }
  
  let deck: Card[] = [];
  let tableau: Card[][] = [[], [], [], [], [], [], []];
  let foundation: Card[][] = [[], [], [], []];
  let waste: Card[] = [];
  let stock: Card[] = [];
  let selectedCard: { pile: string; index: number; cardIndex: number } | null = null;
  let moves = 0;
  
  function createDeck(): Card[] {
    const cards: Card[] = [];
    SUITS.forEach(suit => {
      VALUES.forEach(value => {
        cards.push({
          suit,
          value,
          faceUp: false,
          color: suit === '♥' || suit === '♦' ? 'red' : 'black'
        });
      });
    });
    // Shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  
  function setup() {
    deck = createDeck();
    let cardIndex = 0;
    
    // Deal to tableau
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        tableau[col].push(deck[cardIndex]);
        if (row === col) tableau[col][row].faceUp = true;
        cardIndex++;
      }
    }
    
    // Rest goes to stock
    stock = deck.slice(cardIndex);
  }
  
  function drawFromStock() {
    if (stock.length > 0) {
      const card = stock.pop()!;
      card.faceUp = true;
      waste.push(card);
    } else {
      // Reset stock from waste
      stock = waste.reverse().map(c => ({ ...c, faceUp: false }));
      waste = [];
    }
    moves++;
    render();
  }
  
  function checkWin(): boolean {
    return foundation.every(pile => pile.length === 13);
  }
  
  function render() {
    elements.gameContainer.innerHTML = `
      <div class="solitaire-game">
        <div class="solitaire-header">
          <span>Moves: ${moves}</span>
          <span>Foundation: ${foundation.reduce((a, p) => a + p.length, 0)}/52</span>
        </div>
        <div class="solitaire-top">
          <div class="solitaire-stock" id="stock">
            ${stock.length > 0 ? '🂠' : '⭕'}
          </div>
          <div class="solitaire-waste">
            ${waste.length > 0 ? `
              <div class="solitaire-card ${waste[waste.length-1].color}" data-pile="waste">
                ${waste[waste.length-1].value}${waste[waste.length-1].suit}
              </div>
            ` : ''}
          </div>
          <div class="solitaire-foundations">
            ${foundation.map((pile, i) => `
              <div class="solitaire-foundation" data-foundation="${i}">
                ${pile.length > 0 ? `
                  <div class="solitaire-card ${pile[pile.length-1].color}">
                    ${pile[pile.length-1].value}${pile[pile.length-1].suit}
                  </div>
                ` : SUITS[i]}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="solitaire-tableau">
          ${tableau.map((pile, col) => `
            <div class="solitaire-pile" data-col="${col}">
              ${pile.map((card, idx) => `
                <div class="solitaire-card ${card.faceUp ? card.color : 'face-down'} ${selectedCard?.pile === 'tableau' && selectedCard?.index === col && selectedCard?.cardIndex === idx ? 'selected' : ''}" 
                     style="top: ${idx * 20}px"
                     data-pile="tableau" data-col="${col}" data-idx="${idx}">
                  ${card.faceUp ? `${card.value}${card.suit}` : '🂠'}
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
        <div class="solitaire-hint">Click stock to draw, click cards to move to foundation</div>
      </div>
    `;
    
    // Stock click
    document.getElementById('stock')?.addEventListener('click', drawFromStock);
    
    // Card clicks - simplified: just try to move to foundation
    document.querySelectorAll('.solitaire-card:not(.face-down)').forEach(card => {
      card.addEventListener('click', () => {
        const pile = card.getAttribute('data-pile');
        
        if (pile === 'waste' && waste.length > 0) {
          const topCard = waste[waste.length - 1];
          const foundIdx = foundation.findIndex((f, i) => {
            if (f.length === 0) return topCard.value === 'A' && SUITS[i] === topCard.suit;
            const topF = f[f.length - 1];
            return topF.suit === topCard.suit && VALUES.indexOf(topCard.value) === VALUES.indexOf(topF.value) + 1;
          });
          
          if (foundIdx >= 0) {
            foundation[foundIdx].push(waste.pop()!);
            moves++;
            soundManager.play('correct');
            if (checkWin()) {
              setTimeout(() => endGame(true, Math.max(10, 200 - moves)), 500);
            }
          }
        } else if (pile === 'tableau') {
          const col = parseInt(card.getAttribute('data-col')!);
          const idx = parseInt(card.getAttribute('data-idx')!);
          const tableauCard = tableau[col][idx];
          
          if (idx === tableau[col].length - 1 && tableauCard.faceUp) {
            const foundIdx = foundation.findIndex((f, i) => {
              if (f.length === 0) return tableauCard.value === 'A' && SUITS[i] === tableauCard.suit;
              const topF = f[f.length - 1];
              return topF.suit === tableauCard.suit && VALUES.indexOf(tableauCard.value) === VALUES.indexOf(topF.value) + 1;
            });
            
            if (foundIdx >= 0) {
              foundation[foundIdx].push(tableau[col].pop()!);
              if (tableau[col].length > 0 && !tableau[col][tableau[col].length - 1].faceUp) {
                tableau[col][tableau[col].length - 1].faceUp = true;
              }
              moves++;
              soundManager.play('correct');
              if (checkWin()) {
                setTimeout(() => endGame(true, Math.max(10, 200 - moves)), 500);
              }
            }
          }
        }
        render();
      });
    });
  }
  
  setup();
  render();
}

// Game 15: QUICK DRAW (AI guesses your drawing)
function loadQuickDraw() {
  const WORDS = ['cat', 'dog', 'house', 'tree', 'car', 'sun', 'flower', 'fish', 'bird', 'star'];
  const targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  let isDrawing = false;
  let timeLeft = 20;
  let timer: number | null = null;
  let guessed = false;
  
  elements.gameContainer.innerHTML = `
    <div class="quickdraw-game">
      <div class="quickdraw-header">
        <span>Draw: <strong>${targetWord.toUpperCase()}</strong></span>
        <span>Time: <span id="qdTime">${timeLeft}</span>s</span>
      </div>
      <canvas id="qdCanvas" width="300" height="300"></canvas>
      <div class="quickdraw-controls">
        <button class="quickdraw-btn" id="qdClear">Clear</button>
        <button class="quickdraw-btn primary" id="qdSubmit">Submit Drawing</button>
      </div>
      <div class="quickdraw-hint">Draw the word above! AI will try to guess.</div>
    </div>
  `;
  
  const canvas = document.getElementById('qdCanvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00F5FF';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  let lastX = 0, lastY = 0;
  
  const startDraw = (e: MouseEvent | TouchEvent) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastX = clientX - rect.left;
    lastY = clientY - rect.top;
  };
  
  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastX = x;
    lastY = y;
  };
  
  const stopDraw = () => { isDrawing = false; };
  
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', startDraw);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDraw);
  
  document.getElementById('qdClear')?.addEventListener('click', () => {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });
  
  document.getElementById('qdSubmit')?.addEventListener('click', () => {
    if (guessed) return;
    guessed = true;
    if (timer) clearInterval(timer);
    
    // Simulate AI "guessing" - in real implementation, would use AI
    const guesses = [targetWord, ...WORDS.filter(w => w !== targetWord).slice(0, 2)];
    const aiGuess = guesses[Math.floor(Math.random() * 3)];
    const correct = aiGuess === targetWord;
    
    const container = document.querySelector('.quickdraw-game')!;
    container.innerHTML += `
      <div class="quickdraw-result ${correct ? 'correct' : 'wrong'}">
        AI guessed: "${aiGuess.toUpperCase()}"
        ${correct ? '✅ Correct!' : `❌ Wrong! It was "${targetWord.toUpperCase()}"`}
      </div>
    `;
    
    if (correct) {
      soundManager.play('win');
      setTimeout(() => endGame(true, timeLeft * 5), 1500);
    } else {
      soundManager.play('lose');
      setTimeout(() => endGame(false, 0), 1500);
    }
  });
  
  timer = window.setInterval(() => {
    timeLeft--;
    const timeEl = document.getElementById('qdTime');
    if (timeEl) timeEl.textContent = String(timeLeft);
    
    if (timeLeft <= 0) {
      if (timer) clearInterval(timer);
      document.getElementById('qdSubmit')?.click();
    }
  }, 1000);
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
  
  // Export progress
  document.getElementById('exportProgress')?.addEventListener('click', () => {
    const data = JSON.stringify(currentProgress, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autothink-iq-arena-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const status = document.getElementById('backupStatus');
    if (status) {
      status.textContent = '✅ Backup exported successfully!';
      status.className = 'backup-status show success';
      setTimeout(() => { status.className = 'backup-status'; }, 3000);
    }
  });
  
  // Import progress
  document.getElementById('importProgress')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const status = document.getElementById('backupStatus');
    
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      
      // Validate the imported data has required fields
      if (!imported.level || !imported.totalGamesPlayed === undefined) {
        throw new Error('Invalid backup file');
      }
      
      // Save the imported progress
      await saveProgress(imported);
      currentProgress = imported;
      updateUI();
      
      if (status) {
        status.textContent = '✅ Progress restored successfully! Welcome back!';
        status.className = 'backup-status show success';
      }
      
      soundManager.play('levelUp');
    } catch (err) {
      console.error('Import error:', err);
      if (status) {
        status.textContent = '❌ Failed to import backup. Invalid file format.';
        status.className = 'backup-status show error';
      }
    }
    
    // Reset file input
    (e.target as HTMLInputElement).value = '';
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
  
  // ========================================
  // IQ TEST EVENT LISTENERS
  // ========================================
  
  // IQ Test mode button
  elements.iqTestModeBtn.addEventListener('click', () => switchMode('iq-test'));
  
  // Start IQ Test button
  elements.startIQTest.addEventListener('click', startIQTest);
  
  // Exit IQ Test button
  elements.exitIQTest.addEventListener('click', exitIQTest);
  
  // IQ Next button
  elements.iqNextBtn.addEventListener('click', handleIQNext);
  
  // IQ Skip button
  elements.iqSkipBtn.addEventListener('click', handleIQSkip);
  
  // Retake IQ Test button
  elements.retakeIQTest.addEventListener('click', () => {
    elements.iqResultsModal.classList.add('hidden');
    startIQTest();
  });
  
  // Close IQ Results button
  elements.closeIQResults.addEventListener('click', () => {
    elements.iqResultsModal.classList.add('hidden');
    showScreen('home');
    loadIQTestHistory();
  });
  
  // Close IQ Results modal on overlay click
  elements.iqResultsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
    elements.iqResultsModal.classList.add('hidden');
    showScreen('home');
    loadIQTestHistory();
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
