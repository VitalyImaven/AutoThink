// IQ Arena - Level System

import { 
  PlayerProgress, 
  LevelInfo, 
  GameType, 
  GameResult, 
  GameDifficulty 
} from './types';
import { checkNewAchievements, Achievement } from './data/achievements';

// Level definitions - now with 21 games total
export const LEVELS: LevelInfo[] = [
  {
    level: 1,
    name: 'Beginner Brain',
    icon: '🧠',
    winsRequired: 5,
    difficulty: 'easy',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time'],
  },
  {
    level: 2,
    name: 'Quick Thinker',
    icon: '💭',
    winsRequired: 7,
    difficulty: 'easy',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference'],
  },
  {
    level: 3,
    name: 'Logic Apprentice',
    icon: '🔮',
    winsRequired: 10,
    difficulty: 'medium',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search'],
  },
  {
    level: 4,
    name: 'Pattern Seeker',
    icon: '🔷',
    winsRequired: 12,
    difficulty: 'medium',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle'],
  },
  {
    level: 5,
    name: 'Mind Athlete',
    icon: '🏃',
    winsRequired: 15,
    difficulty: 'medium',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 'number-sequence', 'mental-math', 'ai-trivia'],
  },
  {
    level: 6,
    name: 'Puzzle Wizard',
    icon: '🧙',
    winsRequired: 18,
    difficulty: 'hard',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 'number-sequence', 'mental-math', 'ai-trivia', 'word-association'],
  },
  {
    level: 7,
    name: 'Neural Champion',
    icon: '⚡',
    winsRequired: 20,
    difficulty: 'hard',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 'number-sequence', 'mental-math', 'ai-trivia', 'word-association', 'fact-or-fiction'],
  },
  {
    level: 8,
    name: 'Brain Surgeon',
    icon: '🔬',
    winsRequired: 25,
    difficulty: 'expert',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 'number-sequence', 'mental-math', 'ai-trivia', 'word-association', 'fact-or-fiction', 'ai-riddles'],
  },
  {
    level: 9,
    name: 'Genius',
    icon: '💎',
    winsRequired: 30,
    difficulty: 'expert',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 'number-sequence', 'mental-math', 'ai-trivia', 'word-association', 'fact-or-fiction', 'ai-riddles'],
  },
  {
    level: 10,
    name: 'Einstein Mode',
    icon: '🌟',
    winsRequired: Infinity, // Max level
    difficulty: 'legendary',
    unlockedGames: ['memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 'number-sequence', 'mental-math', 'ai-trivia', 'word-association', 'fact-or-fiction', 'ai-riddles'],
  },
];

const STORAGE_KEY = 'iq-arena-progress';
const BACKUP_STORAGE_KEY = 'iq-arena-progress-backup';

// Create default progress
export function createDefaultProgress(): PlayerProgress {
  return {
    level: 1,
    winsAtCurrentLevel: 0,
    totalGamesPlayed: 0,
    totalWins: 0,
    totalLosses: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalTimePlayedSeconds: 0,
    gamesStats: {},
    achievements: [],
    lastPlayedDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

// Get current level info
export function getLevelInfo(level: number): LevelInfo {
  const clampedLevel = Math.min(Math.max(level, 1), LEVELS.length);
  return LEVELS[clampedLevel - 1];
}

// Get next level info
export function getNextLevelInfo(level: number): LevelInfo | null {
  if (level >= LEVELS.length) return null;
  return LEVELS[level];
}

// Calculate difficulty for current level
export function getDifficultyForLevel(level: number): GameDifficulty {
  return getLevelInfo(level).difficulty;
}

// Get unlocked games for a level
export function getUnlockedGames(level: number): GameType[] {
  return getLevelInfo(level).unlockedGames;
}

// Load progress from storage
export async function loadProgress(): Promise<PlayerProgress> {
  try {
    // Try Chrome storage first
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get([STORAGE_KEY, BACKUP_STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        return result[STORAGE_KEY];
      }
      // Try backup
      if (result[BACKUP_STORAGE_KEY]) {
        return result[BACKUP_STORAGE_KEY];
      }
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Check backup in localStorage
    const backup = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (backup) {
      return JSON.parse(backup);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  
  return createDefaultProgress();
}

// Save progress to storage
export async function saveProgress(progress: PlayerProgress): Promise<void> {
  try {
    progress.lastPlayedDate = new Date().toISOString();
    
    // Save to Chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ 
        [STORAGE_KEY]: progress,
        [BACKUP_STORAGE_KEY]: progress 
      });
    }
    
    // Also save to localStorage as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

// Process game result and update progress
export interface GameResultUpdate {
  progress: PlayerProgress;
  leveledUp: boolean;
  previousLevel: number;
  newAchievements: Achievement[];
}

export async function processGameResult(
  result: GameResult
): Promise<GameResultUpdate> {
  const progress = await loadProgress();
  const previousLevel = progress.level;
  
  // Update basic stats
  progress.totalGamesPlayed++;
  progress.totalTimePlayedSeconds += result.timeSpent;
  
  // Update game-specific stats
  if (!progress.gamesStats[result.gameType]) {
    progress.gamesStats[result.gameType] = { played: 0, won: 0 };
  }
  progress.gamesStats[result.gameType]!.played++;
  
  if (result.won) {
    progress.totalWins++;
    progress.winsAtCurrentLevel++;
    progress.currentStreak++;
    progress.gamesStats[result.gameType]!.won++;
    
    // Update best streak
    if (progress.currentStreak > progress.bestStreak) {
      progress.bestStreak = progress.currentStreak;
    }
    
    // Update best time
    const gameStats = progress.gamesStats[result.gameType]!;
    if (!gameStats.bestTime || result.timeSpent < gameStats.bestTime) {
      gameStats.bestTime = result.timeSpent;
    }
    
    // Update best score
    if (!gameStats.bestScore || result.score > gameStats.bestScore) {
      gameStats.bestScore = result.score;
    }
    
    // Check for level up
    const currentLevelInfo = getLevelInfo(progress.level);
    if (progress.winsAtCurrentLevel >= currentLevelInfo.winsRequired && progress.level < LEVELS.length) {
      progress.level++;
      progress.winsAtCurrentLevel = 0;
    }
  } else {
    progress.totalLosses++;
    progress.currentStreak = 0;
  }
  
  // Check for new achievements
  const newAchievements = checkNewAchievements(progress);
  newAchievements.forEach(a => {
    if (!progress.achievements.includes(a.id)) {
      progress.achievements.push(a.id);
    }
  });
  
  // Save progress
  await saveProgress(progress);
  
  return {
    progress,
    leveledUp: progress.level > previousLevel,
    previousLevel,
    newAchievements,
  };
}

// Get progress percentage to next level
export function getProgressToNextLevel(progress: PlayerProgress): number {
  const currentLevelInfo = getLevelInfo(progress.level);
  if (currentLevelInfo.winsRequired === Infinity) {
    return 100; // Max level
  }
  return Math.min(100, (progress.winsAtCurrentLevel / currentLevelInfo.winsRequired) * 100);
}

// Get wins needed for next level
export function getWinsNeededForNextLevel(progress: PlayerProgress): number {
  const currentLevelInfo = getLevelInfo(progress.level);
  if (currentLevelInfo.winsRequired === Infinity) {
    return 0;
  }
  return Math.max(0, currentLevelInfo.winsRequired - progress.winsAtCurrentLevel);
}

// Get win rate percentage
export function getWinRate(progress: PlayerProgress): number {
  if (progress.totalGamesPlayed === 0) return 0;
  return Math.round((progress.totalWins / progress.totalGamesPlayed) * 100);
}

// Format time played
export function formatTimePlayed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Reset progress (for testing or user request)
export async function resetProgress(): Promise<PlayerProgress> {
  const newProgress = createDefaultProgress();
  await saveProgress(newProgress);
  return newProgress;
}

// Export progress for backup
export function exportProgress(progress: PlayerProgress): string {
  return JSON.stringify(progress, null, 2);
}

// Import progress from backup
export async function importProgress(jsonString: string): Promise<PlayerProgress> {
  try {
    const progress = JSON.parse(jsonString) as PlayerProgress;
    await saveProgress(progress);
    return progress;
  } catch (error) {
    throw new Error('Invalid progress data');
  }
}

