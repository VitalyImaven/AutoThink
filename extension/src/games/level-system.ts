// IQ Arena - Level System

import { 
  PlayerProgress, 
  LevelInfo, 
  GameType, 
  GameResult, 
  GameDifficulty 
} from './types';
import { checkNewAchievements, Achievement } from './data/achievements';

// All available games
const ALL_GAMES: GameType[] = [
  'memory-match', 'math-challenge', 'reaction-time', 'simon-says', 'speed-typing', 
  'emoji-decoder', 'spot-difference', 'minesweeper', 'color-match', 'anagram', 
  'visual-memory', 'word-search', 'sliding-puzzle', 'pattern-match', 'wordle', 
  'number-sequence', 'mental-math', 'ai-trivia', 'word-association', 'fact-or-fiction', 
  'ai-riddles'
];

// Milestone names every 10 levels
const MILESTONE_NAMES: { [key: number]: { name: string; icon: string } } = {
  10: { name: 'Quick Thinker', icon: '💭' },
  20: { name: 'Logic Apprentice', icon: '🔮' },
  30: { name: 'Mind Athlete', icon: '🏃' },
  40: { name: 'Puzzle Master', icon: '🧩' },
  50: { name: 'Brain Surgeon', icon: '🔬' },
  60: { name: 'Neural Champion', icon: '⚡' },
  70: { name: 'Cognitive Elite', icon: '👑' },
  80: { name: 'Genius', icon: '💎' },
  90: { name: 'Mastermind', icon: '🧠' },
  100: { name: 'Einstein Mode', icon: '🌟' },
};

// Generate level info dynamically for 100 levels
function generateLevelInfo(level: number): LevelInfo {
  // Determine difficulty based on level
  let difficulty: GameDifficulty;
  if (level <= 20) difficulty = 'easy';
  else if (level <= 40) difficulty = 'medium';
  else if (level <= 60) difficulty = 'hard';
  else if (level <= 80) difficulty = 'expert';
  else difficulty = 'legendary';
  
  // Wins required increases gradually (3-12 wins per level)
  const baseWins = 3;
  const winsRequired = level === 100 ? Infinity : baseWins + Math.floor(level / 10);
  
  // Unlock games progressively across 100 levels (36 total games)
  const gameUnlockSchedule: { [key: number]: GameType[] } = {
    1: ['memory-match', 'math-challenge', 'reaction-time', 'snake'],
    5: ['simon-says', 'speed-typing', 'hangman', 'tetris'],
    10: ['spot-difference', 'emoji-decoder', 'aim-trainer', 'game-2048'],
    15: ['color-match', 'anagram', 'match-three', 'jigsaw'],
    20: ['visual-memory', 'word-search', 'boggle', 'solitaire'],
    25: ['sudoku', 'crossword'],
    30: ['minesweeper', 'sliding-puzzle', 'n-back'],
    35: ['connections'],
    40: ['pattern-match', 'wordle'],
    45: ['google-feud'],
    50: ['number-sequence', 'mental-math'],
    55: ['quick-draw'],
    60: ['ai-trivia'],
    70: ['word-association'],
    80: ['fact-or-fiction'],
    90: ['ai-riddles'],
  };
  
  // Collect all unlocked games up to this level
  const unlockedGames: GameType[] = [];
  for (const [unlockLevel, games] of Object.entries(gameUnlockSchedule)) {
    if (level >= parseInt(unlockLevel)) {
      unlockedGames.push(...games);
    }
  }
  
  // Get name and icon - use milestone names or generate
  let name: string;
  let icon: string;
  
  if (MILESTONE_NAMES[level]) {
    name = MILESTONE_NAMES[level].name;
    icon = MILESTONE_NAMES[level].icon;
  } else {
    // Generate name based on level range
    const tier = Math.floor((level - 1) / 10);
    const tierNames = [
      'Beginner', 'Thinker', 'Apprentice', 'Athlete', 'Master',
      'Surgeon', 'Champion', 'Elite', 'Genius', 'Einstein'
    ];
    const tierIcons = ['🧒', '💭', '🔮', '🏃', '🧩', '🔬', '⚡', '👑', '💎', '🌟'];
    name = `${tierNames[Math.min(tier, 9)]} Lv.${level}`;
    icon = tierIcons[Math.min(tier, 9)];
  }
  
  return {
    level,
    name,
    icon,
    winsRequired,
    difficulty,
    unlockedGames,
  };
}

// Generate all 100 levels dynamically
export const LEVELS: LevelInfo[] = Array.from({ length: 100 }, (_, i) => generateLevelInfo(i + 1));

// Export ALL_GAMES for use elsewhere
export { ALL_GAMES };

const STORAGE_KEY = 'iq-arena-progress';
const BACKUP_STORAGE_KEY = 'iq-arena-progress-backup';
const SYNC_STORAGE_KEY = 'iq-arena-progress-sync'; // For cloud sync

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
    // Try Chrome local storage first
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
    
    // Try Chrome sync storage (cloud backup - survives reinstall if signed in)
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      try {
        const syncResult = await chrome.storage.sync.get([SYNC_STORAGE_KEY]);
        if (syncResult[SYNC_STORAGE_KEY]) {
          console.log('✅ Restored progress from cloud backup!');
          // Also save to local storage for faster access
          const progress = syncResult[SYNC_STORAGE_KEY];
          await chrome.storage.local.set({ [STORAGE_KEY]: progress });
          return progress;
        }
      } catch (syncErr) {
        console.log('Sync storage not available:', syncErr);
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
    
    // Save to Chrome local storage
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ 
        [STORAGE_KEY]: progress,
        [BACKUP_STORAGE_KEY]: progress 
      });
    }
    
    // Save to Chrome sync storage (cloud backup - survives reinstall if signed in)
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      try {
        // Sync storage has 100KB limit, so only save essential data
        const syncData = {
          level: progress.level,
          winsAtCurrentLevel: progress.winsAtCurrentLevel,
          totalGamesPlayed: progress.totalGamesPlayed,
          totalWins: progress.totalWins,
          totalLosses: progress.totalLosses,
          currentStreak: progress.currentStreak,
          bestStreak: progress.bestStreak,
          totalTimePlayedSeconds: progress.totalTimePlayedSeconds,
          achievements: progress.achievements,
          lastPlayedDate: progress.lastPlayedDate,
          createdAt: progress.createdAt,
          gamesStats: progress.gamesStats,
        };
        await chrome.storage.sync.set({ [SYNC_STORAGE_KEY]: syncData });
      } catch (syncErr) {
        // Sync storage might fail if quota exceeded
        console.log('Could not save to sync storage:', syncErr);
      }
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

