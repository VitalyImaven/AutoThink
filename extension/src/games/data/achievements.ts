// IQ Arena - Achievements System

import { Achievement, PlayerProgress } from '../types';

// Re-export Achievement type for convenience
export type { Achievement };

export const achievements: Achievement[] = [
  // Getting Started
  {
    id: 'first-win',
    name: 'First Victory',
    description: 'Win your first game',
    icon: '🎉',
    condition: (p) => p.totalWins >= 1,
  },
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Play 10 games',
    icon: '👶',
    condition: (p) => p.totalGamesPlayed >= 10,
  },
  
  // Win Streaks
  {
    id: 'hot-streak',
    name: 'Hot Streak',
    description: 'Win 3 games in a row',
    icon: '🔥',
    condition: (p) => p.bestStreak >= 3,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Win 5 games in a row',
    icon: '⚡',
    condition: (p) => p.bestStreak >= 5,
  },
  {
    id: 'legendary-streak',
    name: 'Legendary Streak',
    description: 'Win 10 games in a row',
    icon: '👑',
    condition: (p) => p.bestStreak >= 10,
  },
  
  // Total Wins
  {
    id: 'winner-10',
    name: 'Rising Star',
    description: 'Win 10 games',
    icon: '⭐',
    condition: (p) => p.totalWins >= 10,
  },
  {
    id: 'winner-50',
    name: 'Brain Champion',
    description: 'Win 50 games',
    icon: '🏆',
    condition: (p) => p.totalWins >= 50,
  },
  {
    id: 'winner-100',
    name: 'Centurion',
    description: 'Win 100 games',
    icon: '💯',
    condition: (p) => p.totalWins >= 100,
  },
  {
    id: 'winner-500',
    name: 'Grandmaster',
    description: 'Win 500 games',
    icon: '🎖️',
    condition: (p) => p.totalWins >= 500,
  },
  
  // Level Achievements
  {
    id: 'level-5',
    name: 'Mind Athlete',
    description: 'Reach Level 5',
    icon: '🏃',
    condition: (p) => p.level >= 5,
  },
  {
    id: 'level-10',
    name: 'Einstein Mode',
    description: 'Reach Level 10',
    icon: '🧠',
    condition: (p) => p.level >= 10,
  },
  {
    id: 'level-15',
    name: 'Transcendent',
    description: 'Reach Level 15',
    icon: '🌌',
    condition: (p) => p.level >= 15,
  },
  
  // Time Played
  {
    id: 'dedicated-1h',
    name: 'Dedicated Thinker',
    description: 'Play for 1 hour total',
    icon: '⏰',
    condition: (p) => p.totalTimePlayedSeconds >= 3600,
  },
  {
    id: 'dedicated-5h',
    name: 'Brain Trainer',
    description: 'Play for 5 hours total',
    icon: '🎓',
    condition: (p) => p.totalTimePlayedSeconds >= 18000,
  },
  {
    id: 'dedicated-24h',
    name: 'Mental Marathon',
    description: 'Play for 24 hours total',
    icon: '🏅',
    condition: (p) => p.totalTimePlayedSeconds >= 86400,
  },
  
  // Game-Specific
  {
    id: 'memory-master',
    name: 'Memory Master',
    description: 'Win 20 Memory Match games',
    icon: '🃏',
    condition: (p) => (p.gamesStats['memory-match']?.won || 0) >= 20,
  },
  {
    id: 'math-wizard',
    name: 'Math Wizard',
    description: 'Win 20 Math Challenge games',
    icon: '🔢',
    condition: (p) => (p.gamesStats['math-challenge']?.won || 0) >= 20,
  },
  {
    id: 'mine-expert',
    name: 'Mine Expert',
    description: 'Win 20 Minesweeper games',
    icon: '💣',
    condition: (p) => (p.gamesStats['minesweeper']?.won || 0) >= 20,
  },
  {
    id: 'word-smith',
    name: 'Word Smith',
    description: 'Win 20 Wordle games',
    icon: '📝',
    condition: (p) => (p.gamesStats['wordle']?.won || 0) >= 20,
  },
  {
    id: 'simon-master',
    name: 'Simon Master',
    description: 'Win 20 Simon Says games',
    icon: '🎨',
    condition: (p) => (p.gamesStats['simon-says']?.won || 0) >= 20,
  },
  {
    id: 'trivia-king',
    name: 'Trivia King',
    description: 'Win 20 AI Trivia games',
    icon: '🧪',
    condition: (p) => (p.gamesStats['ai-trivia']?.won || 0) >= 20,
  },
  
  // Win Rate
  {
    id: 'accuracy-70',
    name: 'Sharp Mind',
    description: 'Maintain 70% win rate (min 20 games)',
    icon: '🎯',
    condition: (p) => p.totalGamesPlayed >= 20 && (p.totalWins / p.totalGamesPlayed) >= 0.7,
  },
  {
    id: 'accuracy-85',
    name: 'Precision Thinker',
    description: 'Maintain 85% win rate (min 50 games)',
    icon: '💎',
    condition: (p) => p.totalGamesPlayed >= 50 && (p.totalWins / p.totalGamesPlayed) >= 0.85,
  },
  
  // Variety
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Play at least 5 different game types',
    icon: '🗺️',
    condition: (p) => Object.keys(p.gamesStats).length >= 5,
  },
  {
    id: 'jack-of-all',
    name: 'Jack of All Trades',
    description: 'Win at least one game of each type',
    icon: '🎪',
    condition: (p) => {
      const gameTypes = ['memory-match', 'math-challenge', 'minesweeper', 'simon-says', 'wordle'];
      return gameTypes.every(type => (p.gamesStats[type as keyof typeof p.gamesStats]?.won || 0) >= 1);
    },
  },
  
  // Special
  {
    id: 'comeback-kid',
    name: 'Comeback Kid',
    description: 'Win after 3 consecutive losses',
    icon: '💪',
    condition: () => false, // Special tracking needed
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Win a game in under 30 seconds',
    icon: '⚡',
    condition: () => false, // Special tracking needed
  },
];

export function getUnlockedAchievements(progress: PlayerProgress): Achievement[] {
  return achievements.filter(a => 
    a.condition(progress) && !progress.achievements.includes(a.id)
  );
}

export function checkNewAchievements(progress: PlayerProgress): Achievement[] {
  return getUnlockedAchievements(progress);
}

export function getAchievementById(id: string): Achievement | undefined {
  return achievements.find(a => a.id === id);
}

export function getAllAchievements(): Achievement[] {
  return achievements;
}

export function getAchievementProgress(progress: PlayerProgress): { unlocked: number; total: number } {
  const unlocked = achievements.filter(a => 
    progress.achievements.includes(a.id) || a.condition(progress)
  ).length;
  return { unlocked, total: achievements.length };
}

