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

// Game configurations
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  'memory-match': {
    type: 'memory-match',
    name: 'Memory Match',
    icon: '🃏',
    description: 'Flip cards to find matching pairs',
    requiresAI: false,
    minLevel: 1,
  },
  'math-challenge': {
    type: 'math-challenge',
    name: 'Math Challenge',
    icon: '🔢',
    description: 'Solve quick arithmetic problems',
    requiresAI: false,
    minLevel: 1,
  },
  'simon-says': {
    type: 'simon-says',
    name: 'Simon Says',
    icon: '🎨',
    description: 'Repeat the color sequence',
    requiresAI: false,
    minLevel: 2,
  },
  'minesweeper': {
    type: 'minesweeper',
    name: 'Minesweeper',
    icon: '💣',
    description: 'Clear the minefield using logic',
    requiresAI: false,
    minLevel: 3,
  },
  'sliding-puzzle': {
    type: 'sliding-puzzle',
    name: 'Sliding Puzzle',
    icon: '🧩',
    description: 'Arrange tiles in correct order',
    requiresAI: false,
    minLevel: 4,
  },
  'wordle': {
    type: 'wordle',
    name: 'Wordle',
    icon: '📝',
    description: 'Guess the 5-letter word',
    requiresAI: false,
    minLevel: 5,
  },
  'number-sequence': {
    type: 'number-sequence',
    name: 'Number Sequence',
    icon: '🔮',
    description: 'Find the pattern in numbers',
    requiresAI: false,
    minLevel: 6,
  },
  'pattern-match': {
    type: 'pattern-match',
    name: 'Pattern Match',
    icon: '🔷',
    description: 'Complete the visual pattern',
    requiresAI: false,
    minLevel: 7,
  },
  'ai-trivia': {
    type: 'ai-trivia',
    name: 'AI Trivia',
    icon: '🧪',
    description: 'Answer AI-generated questions',
    requiresAI: true,
    minLevel: 8,
  },
  'word-association': {
    type: 'word-association',
    name: 'Word Association',
    icon: '💭',
    description: 'Connect related words with AI',
    requiresAI: true,
    minLevel: 9,
  },
  'fact-or-fiction': {
    type: 'fact-or-fiction',
    name: 'Fact or Fiction',
    icon: '❓',
    description: 'Identify true statements',
    requiresAI: true,
    minLevel: 10,
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
    },
  };
  
  return params[difficulty];
}

// Game session management
export class GameSession {
  private startTime: number = 0;
  private gameType: GameType;
  private difficulty: GameDifficulty;
  private isPaused: boolean = false;
  private pausedTime: number = 0;
  private totalPausedTime: number = 0;

  constructor(gameType: GameType, difficulty: GameDifficulty) {
    this.gameType = gameType;
    this.difficulty = difficulty;
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

