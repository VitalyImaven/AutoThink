// IQ Arena - Game Controller

import { 
  GameType, 
  GameConfig, 
  GameDifficulty, 
  GameResult
} from './types';
import { 
  loadProgress, 
  getLevelInfo, 
  getDifficultyForLevel,
  processGameResult,
  GameResultUpdate
} from './level-system';
import { soundManager } from './sound-manager';

// Game category labels
export const CATEGORY_LABELS: Record<string, { icon: string; name: string }> = {
  'all': { icon: '🎮', name: 'All Games' },
  'memory': { icon: '🧠', name: 'Memory' },
  'speed': { icon: '⚡', name: 'Speed' },
  'logic': { icon: '🧩', name: 'Puzzles' },
  'words': { icon: '📝', name: 'Words' },
  'math': { icon: '🔢', name: 'Math' },
  'trivia': { icon: '❓', name: 'Trivia' },
  'visual': { icon: '👁️', name: 'Visual' },
  'ai': { icon: '🤖', name: 'AI-Powered' },
};

// Game configurations with detailed categories
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  // Memory Games
  'memory-match': {
    type: 'memory-match',
    name: 'Memory Match',
    icon: '🃏',
    description: 'Flip cards to find matching pairs',
    requiresAI: false,
    minLevel: 1,
    category: 'memory',
  },
  'simon-says': {
    type: 'simon-says',
    name: 'Simon Says',
    icon: '🎨',
    description: 'Repeat the color sequence',
    requiresAI: false,
    minLevel: 5,
    category: 'memory',
  },
  'pattern-match': {
    type: 'pattern-match',
    name: 'Pattern Match',
    icon: '🔷',
    description: 'Memorize the visual pattern',
    requiresAI: false,
    minLevel: 40,
    category: 'memory',
  },
  'visual-memory': {
    type: 'visual-memory',
    name: 'Visual Memory',
    icon: '👁️',
    description: 'Remember and recreate the grid',
    requiresAI: false,
    minLevel: 20,
    category: 'visual',
  },
  
  // Speed Games
  'reaction-time': {
    type: 'reaction-time',
    name: 'Reaction Time',
    icon: '🎯',
    description: 'Test your reflexes',
    requiresAI: false,
    minLevel: 1,
    category: 'speed',
  },
  'speed-typing': {
    type: 'speed-typing',
    name: 'Speed Typing',
    icon: '⌨️',
    description: 'Type as fast as you can',
    requiresAI: false,
    minLevel: 5,
    category: 'speed',
  },
  'color-match': {
    type: 'color-match',
    name: 'Color Match',
    icon: '🌈',
    description: 'Stroop test - match colors quickly',
    requiresAI: false,
    minLevel: 15,
    category: 'speed',
  },

  // Math Games
  'math-challenge': {
    type: 'math-challenge',
    name: 'Math Challenge',
    icon: '🔢',
    description: 'Solve quick arithmetic problems',
    requiresAI: false,
    minLevel: 1,
    category: 'math',
  },
  'mental-math': {
    type: 'mental-math',
    name: 'Mental Math',
    icon: '🧮',
    description: 'Chain calculations in your head',
    requiresAI: false,
    minLevel: 50,
    category: 'math',
  },
  'number-sequence': {
    type: 'number-sequence',
    name: 'Number Sequence',
    icon: '🔮',
    description: 'Find the pattern in numbers',
    requiresAI: false,
    minLevel: 50,
    category: 'math',
  },

  // Logic/Puzzle Games
  'minesweeper': {
    type: 'minesweeper',
    name: 'Minesweeper',
    icon: '💣',
    description: 'Clear the minefield using logic',
    requiresAI: false,
    minLevel: 30,
    category: 'logic',
  },
  'sliding-puzzle': {
    type: 'sliding-puzzle',
    name: 'Sliding Puzzle',
    icon: '🧩',
    description: 'Arrange tiles in correct order',
    requiresAI: false,
    minLevel: 30,
    category: 'logic',
  },
  'spot-difference': {
    type: 'spot-difference',
    name: 'Spot Difference',
    icon: '🔍',
    description: 'Find the odd one out',
    requiresAI: false,
    minLevel: 10,
    category: 'visual',
  },

  // Word Games
  'wordle': {
    type: 'wordle',
    name: 'Wordle',
    icon: '📝',
    description: 'Guess the 5-letter word',
    requiresAI: false,
    minLevel: 40,
    category: 'words',
  },
  'anagram': {
    type: 'anagram',
    name: 'Anagram',
    icon: '🔤',
    description: 'Unscramble the letters',
    requiresAI: false,
    minLevel: 15,
    category: 'words',
  },
  'emoji-decoder': {
    type: 'emoji-decoder',
    name: 'Emoji Decoder',
    icon: '😀',
    description: 'Guess the phrase from emojis',
    requiresAI: false,
    minLevel: 10,
    category: 'words',
  },
  'word-search': {
    type: 'word-search',
    name: 'Word Search',
    icon: '🔎',
    description: 'Find hidden words in the grid',
    requiresAI: false,
    minLevel: 20,
    category: 'words',
  },

  // Trivia & AI-Powered Games
  'ai-trivia': {
    type: 'ai-trivia',
    name: 'AI Trivia',
    icon: '🧪',
    description: 'Answer AI-generated questions',
    requiresAI: true,
    minLevel: 60,
    category: 'trivia',
  },
  'word-association': {
    type: 'word-association',
    name: 'Word Association',
    icon: '💭',
    description: 'Connect related words with AI',
    requiresAI: true,
    minLevel: 70,
    category: 'ai',
  },
  'fact-or-fiction': {
    type: 'fact-or-fiction',
    name: 'Fact or Fiction',
    icon: '❓',
    description: 'Identify true statements',
    requiresAI: true,
    minLevel: 80,
    category: 'trivia',
  },
  'ai-riddles': {
    type: 'ai-riddles',
    name: 'AI Riddles',
    icon: '🎭',
    description: 'Solve AI-generated riddles',
    requiresAI: true,
    minLevel: 90,
    category: 'ai',
  },

  // ============ NEW CLASSIC POPULAR GAMES ============
  
  'tetris': {
    type: 'tetris',
    name: 'Tetris',
    icon: '🧱',
    description: 'Stack falling blocks to clear lines',
    requiresAI: false,
    minLevel: 5,
    category: 'logic',
  },
  'game-2048': {
    type: 'game-2048',
    name: '2048',
    icon: '🔢',
    description: 'Merge tiles to reach 2048',
    requiresAI: false,
    minLevel: 10,
    category: 'logic',
  },
  'sudoku': {
    type: 'sudoku',
    name: 'Sudoku',
    icon: '📊',
    description: 'Fill the 9x9 grid with numbers',
    requiresAI: false,
    minLevel: 25,
    category: 'logic',
  },
  'hangman': {
    type: 'hangman',
    name: 'Hangman',
    icon: '🎯',
    description: 'Guess the word letter by letter',
    requiresAI: false,
    minLevel: 5,
    category: 'words',
  },
  'connections': {
    type: 'connections',
    name: 'Connections',
    icon: '🔗',
    description: 'Group words into 4 categories',
    requiresAI: false,
    minLevel: 35,
    category: 'words',
  },
  'snake': {
    type: 'snake',
    name: 'Snake',
    icon: '🐍',
    description: 'Eat food and grow longer',
    requiresAI: false,
    minLevel: 1,
    category: 'speed',
  },
  'match-three': {
    type: 'match-three',
    name: 'Match 3',
    icon: '🍬',
    description: 'Match 3 or more items in a row',
    requiresAI: false,
    minLevel: 15,
    category: 'logic',
  },
  'google-feud': {
    type: 'google-feud',
    name: 'Search Feud',
    icon: '🔍',
    description: 'Guess the autocomplete suggestions',
    requiresAI: true,
    minLevel: 45,
    category: 'trivia',
  },
  'boggle': {
    type: 'boggle',
    name: 'Word Blitz',
    icon: '🔤',
    description: 'Find words in the letter grid',
    requiresAI: false,
    minLevel: 20,
    category: 'words',
  },
  'aim-trainer': {
    type: 'aim-trainer',
    name: 'Aim Trainer',
    icon: '🎯',
    description: 'Click targets as fast as possible',
    requiresAI: false,
    minLevel: 10,
    category: 'speed',
  },

  // ============ ADDITIONAL POPULAR GAMES ============
  
  'jigsaw': {
    type: 'jigsaw',
    name: 'Jigsaw Puzzle',
    icon: '🧩',
    description: 'Arrange pieces to complete the image',
    requiresAI: false,
    minLevel: 15,
    category: 'logic',
  },
  'n-back': {
    type: 'n-back',
    name: 'N-Back',
    icon: '🧠',
    description: 'Scientific memory training exercise',
    requiresAI: false,
    minLevel: 30,
    category: 'memory',
  },
  'crossword': {
    type: 'crossword',
    name: 'Mini Crossword',
    icon: '✏️',
    description: 'Fill in the crossword puzzle',
    requiresAI: false,
    minLevel: 25,
    category: 'words',
  },
  'solitaire': {
    type: 'solitaire',
    name: 'Solitaire',
    icon: '🃏',
    description: 'Classic card game',
    requiresAI: false,
    minLevel: 20,
    category: 'logic',
  },
  'quick-draw': {
    type: 'quick-draw',
    name: 'Quick Draw',
    icon: '🎨',
    description: 'Draw and let AI guess',
    requiresAI: true,
    minLevel: 55,
    category: 'ai',
  },
  'grid-commander': {
    type: 'grid-commander',
    name: 'Grid Commander',
    icon: '🎮',
    description: 'Strategic grid-based action game - outsmart enemies and collect objectives',
    requiresAI: false,
    minLevel: 1,
    category: 'logic',
  },
};

// Get available games for current level
export function getAvailableGames(level: number): GameConfig[] {
  const levelInfo = getLevelInfo(level);
  return levelInfo.unlockedGames.map(type => GAME_CONFIGS[type]);
}

// Get a random available game
export function getRandomGame(level: number, excludeAI: boolean = false): GameConfig {
  let availableGames = getAvailableGames(level);
  
  if (excludeAI) {
    availableGames = availableGames.filter(g => !g.requiresAI);
  }
  
  if (availableGames.length === 0) {
    // Fallback to first game
    return GAME_CONFIGS['memory-match'];
  }
  
  return availableGames[Math.floor(Math.random() * availableGames.length)];
}

// Get game config by type
export function getGameConfig(type: GameType): GameConfig {
  return GAME_CONFIGS[type];
}

// Get all game configs
export function getAllGameConfigs(): GameConfig[] {
  return Object.values(GAME_CONFIGS);
}

// Check if game is unlocked
export function isGameUnlocked(type: GameType, level: number): boolean {
  const levelInfo = getLevelInfo(level);
  return levelInfo.unlockedGames.includes(type);
}

// Get difficulty parameters based on level
export interface DifficultyParams {
  // Memory Match
  memoryGridSize: { rows: number; cols: number };
  
  // Math Challenge
  mathMaxNumber: number;
  mathOperations: ('+' | '-' | '*' | '/')[];
  mathTimePerQuestion: number;
  mathQuestionCount: number;
  
  // Minesweeper
  minesweeperSize: { rows: number; cols: number };
  minesweeperMines: number;
  
  // Simon Says
  simonStartLength: number;
  simonMaxLength: number;
  simonSpeed: number;
  
  // Sliding Puzzle
  slidingSize: number;
  
  // Wordle
  wordleMaxAttempts: number;
  
  // Number Sequence
  sequenceComplexity: number;
  
  // AI Trivia
  triviaQuestionCount: number;
  
  // Pattern Match
  patternGridSize: number;
  patternLength: number;
}

export function getDifficultyParams(level: number): DifficultyParams {
  const difficulty = getDifficultyForLevel(level);
  
  const params: Record<GameDifficulty, DifficultyParams> = {
    easy: {
      memoryGridSize: { rows: 3, cols: 4 },
      mathMaxNumber: 20,
      mathOperations: ['+', '-'],
      mathTimePerQuestion: 15,
      mathQuestionCount: 5,
      minesweeperSize: { rows: 8, cols: 8 },
      minesweeperMines: 10,
      simonStartLength: 3,
      simonMaxLength: 8,
      simonSpeed: 800,
      slidingSize: 3,
      wordleMaxAttempts: 6,
      sequenceComplexity: 1,
      triviaQuestionCount: 5,
      patternGridSize: 4,
      patternLength: 4,
    },
    medium: {
      memoryGridSize: { rows: 4, cols: 4 },
      mathMaxNumber: 50,
      mathOperations: ['+', '-', '*'],
      mathTimePerQuestion: 12,
      mathQuestionCount: 7,
      minesweeperSize: { rows: 9, cols: 9 },
      minesweeperMines: 15,
      simonStartLength: 4,
      simonMaxLength: 10,
      simonSpeed: 600,
      slidingSize: 3,
      wordleMaxAttempts: 5,
      sequenceComplexity: 2,
      triviaQuestionCount: 7,
      patternGridSize: 4,
      patternLength: 5,
    },
    hard: {
      memoryGridSize: { rows: 4, cols: 5 },
      mathMaxNumber: 100,
      mathOperations: ['+', '-', '*', '/'],
      mathTimePerQuestion: 10,
      mathQuestionCount: 10,
      minesweeperSize: { rows: 10, cols: 10 },
      minesweeperMines: 20,
      simonStartLength: 5,
      simonMaxLength: 12,
      simonSpeed: 500,
      slidingSize: 4,
      wordleMaxAttempts: 5,
      sequenceComplexity: 3,
      triviaQuestionCount: 10,
      patternGridSize: 5,
      patternLength: 6,
    },
    expert: {
      memoryGridSize: { rows: 5, cols: 4 },
      mathMaxNumber: 200,
      mathOperations: ['+', '-', '*', '/'],
      mathTimePerQuestion: 8,
      mathQuestionCount: 12,
      minesweeperSize: { rows: 12, cols: 12 },
      minesweeperMines: 30,
      simonStartLength: 6,
      simonMaxLength: 15,
      simonSpeed: 400,
      slidingSize: 4,
      wordleMaxAttempts: 4,
      sequenceComplexity: 4,
      triviaQuestionCount: 12,
      patternGridSize: 5,
      patternLength: 7,
    },
    legendary: {
      memoryGridSize: { rows: 5, cols: 6 },
      mathMaxNumber: 500,
      mathOperations: ['+', '-', '*', '/'],
      mathTimePerQuestion: 6,
      mathQuestionCount: 15,
      minesweeperSize: { rows: 16, cols: 16 },
      minesweeperMines: 40,
      simonStartLength: 7,
      simonMaxLength: 20,
      simonSpeed: 300,
      slidingSize: 5,
      wordleMaxAttempts: 4,
      sequenceComplexity: 5,
      triviaQuestionCount: 15,
      patternGridSize: 6,
      patternLength: 8,
    },
  };
  
  return params[difficulty];
}

// Game session management
export class GameSession {
  private startTime: number = 0;
  private _gameType: GameType;
  private _difficulty: GameDifficulty;
  private isPaused: boolean = false;
  private pausedTime: number = 0;
  private totalPausedTime: number = 0;

  constructor(gameType: GameType, difficulty: GameDifficulty) {
    this._gameType = gameType;
    this._difficulty = difficulty;
  }

  get gameType(): GameType {
    return this._gameType;
  }

  get difficulty(): GameDifficulty {
    return this._difficulty;
  }

  start(): void {
    this.startTime = Date.now();
    this.isPaused = false;
    this.totalPausedTime = 0;
  }

  pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.pausedTime = Date.now();
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.totalPausedTime += Date.now() - this.pausedTime;
      this.isPaused = false;
    }
  }

  getElapsedSeconds(): number {
    if (this.startTime === 0) return 0;
    
    let elapsed = Date.now() - this.startTime - this.totalPausedTime;
    if (this.isPaused) {
      elapsed -= (Date.now() - this.pausedTime);
    }
    return Math.floor(elapsed / 1000);
  }

  async end(won: boolean, score: number = 0): Promise<GameResultUpdate> {
    const timeSpent = this.getElapsedSeconds();
    
    const result: GameResult = {
      gameType: this.gameType,
      won,
      score,
      timeSpent,
      difficulty: this.difficulty,
      timestamp: Date.now(),
    };

    // Play appropriate sound
    soundManager.play(won ? 'win' : 'lose');

    // Process and save result
    const update = await processGameResult(result);

    // Play level up sound if applicable
    if (update.leveledUp) {
      setTimeout(() => soundManager.play('levelUp'), 500);
    }

    // Play achievement sounds
    update.newAchievements.forEach((_, index) => {
      setTimeout(() => soundManager.play('achievement'), 1000 + index * 500);
    });

    return update;
  }
}

// Create a new game session
export async function createGameSession(gameType: GameType): Promise<GameSession> {
  const progress = await loadProgress();
  const difficulty = getDifficultyForLevel(progress.level);
  return new GameSession(gameType, difficulty);
}

// Utility: Format time as MM:SS
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Utility: Shuffle array
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

