// IQ Arena - Main Controller

import { GameType, PlayerProgress } from './types';
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
  GameSession
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

// Current state
let currentProgress: PlayerProgress;
let currentSession: GameSession | null = null;
let timerInterval: number | null = null;

// DOM Elements
const elements = {
  // Screens
  homeScreen: document.getElementById('homeScreen')!,
  gameScreen: document.getElementById('gameScreen')!,
  resultScreen: document.getElementById('resultScreen')!,
  
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
  
  // Game Screen
  gamesGrid: document.getElementById('gamesGrid')!,
  currentGameIcon: document.getElementById('currentGameIcon')!,
  currentGameName: document.getElementById('currentGameName')!,
  gameTimer: document.getElementById('gameTimer')!,
  gameContainer: document.getElementById('gameContainer')!,
  
  // Result Screen
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
  renderGamesGrid();
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

// Render games grid
function renderGamesGrid() {
  const allGames = Object.values(GAME_CONFIGS);
  
  elements.gamesGrid.innerHTML = allGames.map(game => {
    const unlocked = isGameUnlocked(game.type, currentProgress.level);
    return `
      <div class="game-card ${unlocked ? '' : 'locked'}" data-game="${game.type}">
        ${!unlocked ? '<span class="game-card-lock">🔒</span>' : ''}
        <span class="game-card-icon">${game.icon}</span>
        <span class="game-card-name">${game.name}</span>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  elements.gamesGrid.querySelectorAll('.game-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => {
      const gameType = card.getAttribute('data-game') as GameType;
      startGame(gameType);
    });
  });
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

// Start a game
async function startGame(gameType: GameType) {
  soundManager.play('click');
  
  const config = GAME_CONFIGS[gameType];
  elements.currentGameIcon.textContent = config.icon;
  elements.currentGameName.textContent = config.name;
  
  // Create session
  currentSession = await createGameSession(gameType);
  
  // Clear and prepare game container
  elements.gameContainer.innerHTML = '<div class="loading">Loading game...</div>';
  
  showScreen('game');
  
  // Start timer
  currentSession.start();
  startTimer();
  
  // Load game module dynamically
  loadGame(gameType);
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
async function loadGame(gameType: GameType) {
  const params = getDifficultyParams(currentProgress.level);
  
  switch (gameType) {
    case 'memory-match':
      loadMemoryMatch(params);
      break;
    case 'math-challenge':
      loadMathChallenge(params);
      break;
    // Other games will be added in future phases
    default:
      elements.gameContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted);">
          <p style="font-size: 48px; margin-bottom: 20px;">🚧</p>
          <p>Coming Soon!</p>
          <p style="font-size: 14px; margin-top: 10px;">${GAME_CONFIGS[gameType].name} is under development</p>
        </div>
      `;
  }
}

// Memory Match Game
function loadMemoryMatch(params: ReturnType<typeof getDifficultyParams>) {
  const { rows, cols } = params.memoryGridSize;
  const totalCards = rows * cols;
  const pairCount = totalCards / 2;
  
  // Emoji pairs - nice clear icons
  const emojis = ['🎮', '🎯', '⭐', '🎨', '🔥', '💎', '🎵', '🚀', '⚡', '🌟', '🎪', '🏆', '💡', '🎲', '🌈', '🎭', '🎸', '🎹', '🎺', '🎻'];
  const selectedEmojis = emojis.slice(0, pairCount);
  
  // Create pairs and shuffle
  let cards = [...selectedEmojis, ...selectedEmojis]
    .map((emoji, index) => ({ id: index, emoji, isFlipped: false, isMatched: false }))
    .sort(() => Math.random() - 0.5);
  
  let flippedCards: number[] = [];
  let matchedPairs = 0;
  let canFlip = true;
  
  // Card back SVG icon
  const cardBackIcon = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color: white; opacity: 0.9;">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 16v-4M12 8h.01"></path>
  </svg>`;
  
  // Render with proper spacing
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
  
  // Add click handlers
  elements.gameContainer.querySelectorAll('.memory-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => {
      if (!canFlip) return;
      
      const index = parseInt(cardEl.getAttribute('data-index')!);
      const card = cards[index];
      
      if (card.isFlipped || card.isMatched) return;
      
      // Flip card
      card.isFlipped = true;
      cardEl.classList.add('flipped');
      flippedCards.push(index);
      soundManager.play('flip');
      
      // Check for match
      if (flippedCards.length === 2) {
        canFlip = false;
        const [first, second] = flippedCards;
        
        if (cards[first].emoji === cards[second].emoji) {
          // Match!
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
          
          // Check win
          if (matchedPairs === pairCount) {
            endGame(true, matchedPairs * 10);
          }
        } else {
          // No match
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
    
    // Generate wrong answers
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
      // Game complete
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
    
    // Timer
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
    
    // Option clicks
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
          // Show correct answer
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

// Auto-continue timer
let autoNextTimer: number | null = null;
let autoNextCountdown = 3;

// End game and show results
async function endGame(won: boolean, score: number) {
  stopTimer();
  
  if (!currentSession) return;
  
  const result = await currentSession.end(won, score);
  currentProgress = result.progress;
  
  // Update result screen
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
  
  // Quote/Joke
  const quote = getRandomJokeOrQuote();
  elements.quoteText.textContent = quote.type === 'quote' ? `"${quote.text}"` : quote.text;
  elements.quoteAuthor.textContent = quote.author ? `— ${quote.author}` : '';
  elements.quoteAuthor.style.display = quote.author ? 'block' : 'none';
  
  showScreen('result');
  
  // Update home screen data for when we return
  updateUI();
  renderGamesGrid();
  
  // Auto-continue to next game if won
  if (won) {
    startAutoNextCountdown();
  }
}

// Start auto-continue countdown
function startAutoNextCountdown() {
  autoNextCountdown = 4;
  
  // Update button text with countdown
  updateAutoNextButton();
  
  autoNextTimer = window.setInterval(() => {
    autoNextCountdown--;
    updateAutoNextButton();
    
    if (autoNextCountdown <= 0) {
      stopAutoNextCountdown();
      // Start next random game
      const game = getRandomGame(currentProgress.level);
      startGame(game.type);
    }
  }, 1000);
}

// Update the play again button with countdown
function updateAutoNextButton() {
  if (autoNextCountdown > 0) {
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
  
  // Game-specific stats
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
  // Play random game
  elements.playRandomBtn.addEventListener('click', () => {
    const game = getRandomGame(currentProgress.level);
    startGame(game.type);
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
    // Start next random game for variety
    const game = getRandomGame(currentProgress.level);
    startGame(game.type);
  });
  
  elements.homeBtn.addEventListener('click', () => {
    stopAutoNextCountdown();
    soundManager.play('click');
    showScreen('home');
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

