// Comprehensive IQ Test Questions
// Based on CHC (Cattell-Horn-Carroll) Theory
// 50 questions across 7 cognitive domains

import { IQQuestion, IQCategory } from '../types';

// Helper to create questions
function q(
  id: number,
  category: IQCategory,
  difficulty: 1 | 2 | 3 | 4 | 5,
  question: string,
  options: string[],
  correctIndex: number,
  questionType: 'text' | 'visual' | 'grid' | 'sequence' = 'text'
): IQQuestion {
  return { id, category, difficulty, question, options, correctIndex, questionType, timeWeight: difficulty };
}

// ========== PATTERN RECOGNITION (10 questions) ==========
// Raven's Progressive Matrices style - fluid intelligence

const patternRecognitionQuestions: IQQuestion[] = [
  q(1, 'pattern-recognition', 1,
    'Which shape completes the sequence? ○ □ △ ○ □ ?',
    ['○', '□', '△', '◇'],
    2
  ),
  q(2, 'pattern-recognition', 1,
    'Find the pattern: 🔴🔵🔴🔵🔴?',
    ['🔴', '🔵', '🟢', '🟡'],
    1
  ),
  q(3, 'pattern-recognition', 2,
    'Complete: ◐ ◑ ◐ ◑ ● ?',
    ['◐', '◑', '○', '●'],
    0
  ),
  q(4, 'pattern-recognition', 2,
    'If A→B, B→C, C→D, then D→?',
    ['A', 'E', 'B', 'D'],
    1
  ),
  q(5, 'pattern-recognition', 3,
    'Pattern: 1A, 2B, 3C, 4D, ?',
    ['5E', '5D', '4E', '6F'],
    0
  ),
  q(6, 'pattern-recognition', 3,
    'Grid pattern: Row 1: ■□■, Row 2: □■□, Row 3: ?',
    ['■□■', '□■□', '■■■', '□□□'],
    0
  ),
  q(7, 'pattern-recognition', 4,
    'Sequence: ↑→↓←↑→↓?',
    ['↑', '←', '→', '↓'],
    1
  ),
  q(8, 'pattern-recognition', 4,
    'Matrix: [1,2][3,4] transforms to [2,4][6,8]. What does [2,3][4,5] become?',
    ['[4,6][8,10]', '[3,4][5,6]', '[4,5][6,7]', '[2,4][6,8]'],
    0
  ),
  q(9, 'pattern-recognition', 5,
    'Complete the pattern: AZ, BY, CX, DW, ?',
    ['EV', 'EU', 'FV', 'EW'],
    0
  ),
  q(10, 'pattern-recognition', 5,
    'Logical grid: If ★ = 3, ◆ = 5, then ★★◆ = 11. What is ◆◆★?',
    ['13', '11', '15', '16'],
    0
  ),
];

// ========== VERBAL REASONING (8 questions) ==========
// Analogies and word relationships

const verbalReasoningQuestions: IQQuestion[] = [
  q(11, 'verbal-reasoning', 1,
    'BIRD is to SKY as FISH is to ?',
    ['Water', 'Land', 'Air', 'Tree'],
    0
  ),
  q(12, 'verbal-reasoning', 2,
    'HOT is to COLD as LIGHT is to ?',
    ['Heavy', 'Dark', 'Bright', 'Warm'],
    1
  ),
  q(13, 'verbal-reasoning', 2,
    'DOCTOR is to PATIENT as TEACHER is to ?',
    ['School', 'Student', 'Book', 'Classroom'],
    1
  ),
  q(14, 'verbal-reasoning', 3,
    'PAINT is to BRUSH as WRITE is to ?',
    ['Paper', 'Pen', 'Book', 'Word'],
    1
  ),
  q(15, 'verbal-reasoning', 3,
    'MORNING is to BREAKFAST as EVENING is to ?',
    ['Lunch', 'Dinner', 'Sleep', 'Night'],
    1
  ),
  q(16, 'verbal-reasoning', 4,
    'AMPLIFY is to SOUND as MAGNIFY is to ?',
    ['Glass', 'Size', 'Lens', 'Vision'],
    1
  ),
  q(17, 'verbal-reasoning', 4,
    'ORCHESTRA is to CONDUCTOR as TEAM is to ?',
    ['Player', 'Captain', 'Game', 'Sport'],
    1
  ),
  q(18, 'verbal-reasoning', 5,
    'ETYMOLOGY is to WORDS as ENTOMOLOGY is to ?',
    ['Insects', 'Plants', 'Rocks', 'Stars'],
    0
  ),
];

// ========== NUMERICAL REASONING (8 questions) ==========
// Number sequences and mathematical logic

const numericalReasoningQuestions: IQQuestion[] = [
  q(19, 'numerical-reasoning', 1,
    'What comes next? 2, 4, 6, 8, ?',
    ['9', '10', '11', '12'],
    1
  ),
  q(20, 'numerical-reasoning', 2,
    'Complete the sequence: 1, 4, 9, 16, ?',
    ['20', '24', '25', '32'],
    2
  ),
  q(21, 'numerical-reasoning', 2,
    'What is the missing number? 3, 6, 12, 24, ?',
    ['36', '48', '30', '42'],
    1
  ),
  q(22, 'numerical-reasoning', 3,
    'Find the pattern: 1, 1, 2, 3, 5, 8, ?',
    ['11', '12', '13', '10'],
    2
  ),
  q(23, 'numerical-reasoning', 3,
    'Complete: 2, 6, 12, 20, 30, ?',
    ['40', '42', '44', '36'],
    1
  ),
  q(24, 'numerical-reasoning', 4,
    'Sequence: 1, 3, 6, 10, 15, 21, ?',
    ['25', '27', '28', '30'],
    2
  ),
  q(25, 'numerical-reasoning', 4,
    'If 2★3=8, 4★5=40, then 3★4=?',
    ['24', '20', '18', '12'],
    0
  ),
  q(26, 'numerical-reasoning', 5,
    'Pattern: 1, 4, 27, 256, ?',
    ['625', '1024', '3125', '2048'],
    2
  ),
];

// ========== SPATIAL REASONING (8 questions) ==========
// 3D rotation, shape manipulation

const spatialReasoningQuestions: IQQuestion[] = [
  q(27, 'spatial-reasoning', 1,
    'How many sides does a hexagon have?',
    ['5', '6', '7', '8'],
    1
  ),
  q(28, 'spatial-reasoning', 2,
    'If you fold a square paper in half twice, how many rectangles do you get when unfolded?',
    ['2', '3', '4', '6'],
    2
  ),
  q(29, 'spatial-reasoning', 2,
    'A cube has how many edges?',
    ['6', '8', '10', '12'],
    3
  ),
  q(30, 'spatial-reasoning', 3,
    'If you rotate the letter "N" 180°, what do you get?',
    ['N', 'Z', 'И', 'M'],
    0
  ),
  q(31, 'spatial-reasoning', 3,
    'Which shape cannot be drawn without lifting your pen and without retracing?',
    ['Triangle', 'Square', 'Pentagon (regular)', 'Circle'],
    2
  ),
  q(32, 'spatial-reasoning', 4,
    'A cube is painted red on all sides and cut into 27 equal smaller cubes. How many small cubes have exactly 2 red faces?',
    ['6', '8', '12', '10'],
    2
  ),
  q(33, 'spatial-reasoning', 4,
    'Mirror image: If AMBULANCE appears as ECNALUBMA in a mirror, what appears as DOOG?',
    ['GOOD', 'DOOG', 'GOOⱭ', 'ⱭOOG'],
    0
  ),
  q(34, 'spatial-reasoning', 5,
    'A 3D shape has 5 faces, 8 edges. How many vertices does it have?',
    ['4', '5', '6', '7'],
    1
  ),
];

// ========== LOGICAL DEDUCTION (8 questions) ==========
// Syllogisms, if-then reasoning

const logicalDeductionQuestions: IQQuestion[] = [
  q(35, 'logical-deduction', 1,
    'All cats are animals. Tom is a cat. Therefore:',
    ['Tom is an animal', 'All animals are cats', 'Tom is not a cat', 'Some animals are not cats'],
    0
  ),
  q(36, 'logical-deduction', 2,
    'If it rains, the ground is wet. The ground is wet. What can we conclude?',
    ['It rained', 'It might have rained', 'It did not rain', 'The sun is shining'],
    1
  ),
  q(37, 'logical-deduction', 2,
    'A is taller than B. B is taller than C. Therefore:',
    ['C is tallest', 'A is shortest', 'A is taller than C', 'B is tallest'],
    2
  ),
  q(38, 'logical-deduction', 3,
    'No birds are fish. All sparrows are birds. Therefore:',
    ['All fish are sparrows', 'No sparrows are fish', 'Some fish are birds', 'All sparrows are fish'],
    1
  ),
  q(39, 'logical-deduction', 3,
    'If P then Q. Not Q. Therefore:',
    ['P', 'Not P', 'Q', 'P and Q'],
    1
  ),
  q(40, 'logical-deduction', 4,
    'Some doctors are rich. All rich people pay taxes. Therefore:',
    ['All doctors pay taxes', 'Some doctors pay taxes', 'No doctors pay taxes', 'All rich people are doctors'],
    1
  ),
  q(41, 'logical-deduction', 4,
    '5 people (A,B,C,D,E) are in a race. A finishes before B but after C. D finishes before E but after B. Who finished 3rd?',
    ['A', 'B', 'C', 'D'],
    1
  ),
  q(42, 'logical-deduction', 5,
    'If all Zorbs are Blips, and some Blips are Crots, which MUST be true?',
    ['All Zorbs are Crots', 'Some Zorbs are Crots', 'No Zorbs are Crots', 'None of the above'],
    3
  ),
];

// ========== WORKING MEMORY (4 questions) ==========
// Sequence recall, mental manipulation

const workingMemoryQuestions: IQQuestion[] = [
  q(43, 'working-memory', 2,
    'Remember: 7-3-9-1-5. What is the sum of all these numbers?',
    ['23', '24', '25', '26'],
    2
  ),
  q(44, 'working-memory', 3,
    'Memorize: KQJTA. What is this sequence reversed?',
    ['ATJQK', 'ATKJQ', 'TAJKQ', 'ATJKQ'],
    0
  ),
  q(45, 'working-memory', 4,
    'Calculate mentally: (8 × 7) - (6 × 5) + 12 = ?',
    ['34', '38', '42', '26'],
    1
  ),
  q(46, 'working-memory', 5,
    'Given: A=1, B=2, C=3... What is the sum of letters in "BRAIN"?',
    ['43', '44', '45', '42'],
    0  // B(2)+R(18)+A(1)+I(9)+N(14) = 44... let me recalculate: 2+18+1+9+14 = 44
  ),
];

// Fix question 46
workingMemoryQuestions[3] = q(46, 'working-memory', 5,
  'Given: A=1, B=2, C=3... What is the sum of letters in "BRAIN"?',
  ['43', '44', '45', '42'],
  1  // B(2)+R(18)+A(1)+I(9)+N(14) = 44
);

// ========== VISUAL PROCESSING (4 questions) ==========
// Pattern completion, visual analysis

const visualProcessingQuestions: IQQuestion[] = [
  q(47, 'visual-processing', 2,
    'Count the triangles: △ inside a larger △ with one horizontal line through the middle creates how many triangles total?',
    ['2', '3', '4', '5'],
    2
  ),
  q(48, 'visual-processing', 3,
    'A square contains 4 equal smaller squares. Each small square is divided diagonally. How many triangles in total?',
    ['4', '8', '12', '16'],
    1
  ),
  q(49, 'visual-processing', 4,
    'Odd one out: Circle, Ellipse, Triangle, Oval',
    ['Circle', 'Ellipse', 'Triangle', 'Oval'],
    2
  ),
  q(50, 'visual-processing', 5,
    'A 4×4 grid has alternating black/white squares (like a checkerboard). How many squares are there in total (1×1, 2×2, 3×3, 4×4)?',
    ['16', '20', '30', '36'],
    2  // 16 (1×1) + 9 (2×2) + 4 (3×3) + 1 (4×4) = 30
  ),
];

// ========== COMBINE ALL QUESTIONS ==========
export const IQ_TEST_QUESTIONS: IQQuestion[] = [
  ...patternRecognitionQuestions,
  ...verbalReasoningQuestions,
  ...numericalReasoningQuestions,
  ...spatialReasoningQuestions,
  ...logicalDeductionQuestions,
  ...workingMemoryQuestions,
  ...visualProcessingQuestions,
];

// ========== IQ SCORING SYSTEM ==========
// Based on standard IQ distribution (mean=100, SD=15)

export const IQ_CLASSIFICATIONS = [
  { min: 145, label: 'Genius', percentile: 99.9, description: 'Exceptionally gifted - top 0.1%' },
  { min: 130, label: 'Very Superior', percentile: 98, description: 'Gifted intelligence - top 2%' },
  { min: 120, label: 'Superior', percentile: 91, description: 'Above average - top 9%' },
  { min: 110, label: 'High Average', percentile: 75, description: 'Above average intelligence' },
  { min: 90, label: 'Average', percentile: 50, description: 'Normal intelligence range' },
  { min: 80, label: 'Low Average', percentile: 25, description: 'Below average range' },
  { min: 70, label: 'Borderline', percentile: 9, description: 'Below normal range' },
  { min: 0, label: 'Extremely Low', percentile: 2, description: 'Significant difficulties' },
];

export const CATEGORY_NAMES: { [key in IQCategory]: string } = {
  'pattern-recognition': 'Pattern Recognition (Fluid Intelligence)',
  'verbal-reasoning': 'Verbal Reasoning',
  'numerical-reasoning': 'Numerical Reasoning',
  'spatial-reasoning': 'Spatial Reasoning',
  'logical-deduction': 'Logical Deduction',
  'working-memory': 'Working Memory',
  'visual-processing': 'Visual Processing',
};

// Calculate IQ score from raw score
export function calculateIQScore(
  correctAnswers: number,
  totalQuestions: number,
  averageTimePerQuestion: number // in seconds
): { iqScore: number; percentile: number; classification: string } {
  // Raw score percentage
  const rawPercentage = correctAnswers / totalQuestions;
  
  // Time bonus/penalty (faster = small bonus, slower = small penalty)
  // Average expected time is 36 seconds per question (30 min / 50 questions)
  const expectedTime = 36;
  const timeFactor = Math.max(0.85, Math.min(1.15, expectedTime / Math.max(averageTimePerQuestion, 10)));
  
  // Adjusted score
  const adjustedScore = rawPercentage * timeFactor;
  
  // Convert to IQ scale (roughly mapping 0-100% to 55-145 IQ range)
  // Using a more realistic distribution:
  // 50% correct ≈ 100 IQ (average)
  // 90% correct ≈ 130 IQ (gifted)
  // 100% correct ≈ 145 IQ (genius)
  // 25% correct ≈ 85 IQ
  
  let iqScore: number;
  if (adjustedScore >= 0.9) {
    // Top tier: 90-100% → 130-145
    iqScore = 130 + ((adjustedScore - 0.9) / 0.1) * 15;
  } else if (adjustedScore >= 0.7) {
    // High: 70-90% → 110-130
    iqScore = 110 + ((adjustedScore - 0.7) / 0.2) * 20;
  } else if (adjustedScore >= 0.5) {
    // Average: 50-70% → 90-110
    iqScore = 90 + ((adjustedScore - 0.5) / 0.2) * 20;
  } else if (adjustedScore >= 0.3) {
    // Below average: 30-50% → 70-90
    iqScore = 70 + ((adjustedScore - 0.3) / 0.2) * 20;
  } else {
    // Low: 0-30% → 55-70
    iqScore = 55 + (adjustedScore / 0.3) * 15;
  }
  
  iqScore = Math.round(Math.max(55, Math.min(155, iqScore)));
  
  // Calculate percentile using normal distribution approximation
  const zScore = (iqScore - 100) / 15;
  const percentile = Math.round(normalCDF(zScore) * 100 * 10) / 10;
  
  // Get classification
  const classification = IQ_CLASSIFICATIONS.find(c => iqScore >= c.min)?.label || 'Unknown';
  
  return { iqScore, percentile, classification };
}

// Normal CDF approximation
function normalCDF(z: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

// Shuffle questions for each test session (maintaining category balance)
export function generateIQTestQuestions(): IQQuestion[] {
  // Shuffle within each category, then interleave for variety
  const shuffled = [...IQ_TEST_QUESTIONS];
  
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Sort by difficulty (easier first, harder later)
  shuffled.sort((a, b) => a.difficulty - b.difficulty);
  
  return shuffled;
}




