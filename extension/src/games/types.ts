// IQ Arena - Type Definitions

export type GameType = 
  | 'memory-match'
  | 'math-challenge'
  | 'minesweeper'
  | 'simon-says'
  | 'sliding-puzzle'
  | 'wordle'
  | 'number-sequence'
  | 'pattern-match'
  | 'ai-trivia'
  | 'word-association'
  | 'fact-or-fiction'
  // New games
  | 'speed-typing'
  | 'color-match'
  | 'reaction-time'
  | 'visual-memory'
  | 'anagram'
  | 'emoji-decoder'
  | 'ai-riddles'
  | 'mental-math'
  | 'spot-difference'
  | 'word-search';

export type GameCategory = 'all' | 'memory' | 'speed' | 'logic' | 'words' | 'ai';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'legendary';

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'paused';

export interface GameConfig {
  type: GameType;
  name: string;
  icon: string;
  description: string;
  requiresAI: boolean;
  minLevel: number;
  category: GameCategory;
}

export interface GameResult {
  gameType: GameType;
  won: boolean;
  score: number;
  timeSpent: number; // in seconds
  difficulty: GameDifficulty;
  timestamp: number;
}

export interface LevelInfo {
  level: number;
  name: string;
  icon: string;
  winsRequired: number;
  difficulty: GameDifficulty;
  unlockedGames: GameType[];
}

export interface PlayerProgress {
  level: number;
  winsAtCurrentLevel: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  bestStreak: number;
  totalTimePlayedSeconds: number;
  gamesStats: {
    [key in GameType]?: {
      played: number;
      won: number;
      bestTime?: number;
      bestScore?: number;
    };
  };
  achievements: string[];
  lastPlayedDate: string;
  createdAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (progress: PlayerProgress) => boolean;
}

export interface JokeOrQuote {
  text: string;
  author?: string;
  type: 'joke' | 'quote';
}

// Game-specific types

export interface MemoryCard {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface MinesweeperCell {
  row: number;
  col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

export interface WordleGuess {
  word: string;
  result: ('correct' | 'present' | 'absent')[];
}

export interface SimonSequence {
  colors: number[];
  playerInput: number[];
}

export interface MathProblem {
  question: string;
  answer: number;
  options: number[];
}

export interface SequenceProblem {
  sequence: number[];
  answer: number;
  options: number[];
  pattern: string;
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: GameDifficulty;
}

// Sound types
export type SoundEffect = 
  | 'click'
  | 'correct'
  | 'wrong'
  | 'win'
  | 'lose'
  | 'levelUp'
  | 'achievement'
  | 'tick'
  | 'flip'
  | 'match'
  | 'explosion';

// Backend API types
export interface GameProgressSyncRequest {
  progress: PlayerProgress;
  userId?: string;
}

export interface GameProgressSyncResponse {
  success: boolean;
  message: string;
  serverProgress?: PlayerProgress;
}

export interface AITriviaRequest {
  difficulty: GameDifficulty;
  category?: string;
  count?: number;
}

export interface AITriviaResponse {
  questions: TriviaQuestion[];
}

