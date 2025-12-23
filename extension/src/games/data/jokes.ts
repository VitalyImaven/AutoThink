// IQ Arena - Smart Jokes & Quotes Collection

import { JokeOrQuote } from '../types';

export const smartJokes: JokeOrQuote[] = [
  // Programming Jokes
  { text: "Why do programmers prefer dark mode? Because light attracts bugs! 🪲", type: 'joke' },
  { text: "There are only 10 types of people: those who understand binary and those who don't.", type: 'joke' },
  { text: "A SQL query walks into a bar, approaches two tables and asks... 'Can I join you?'", type: 'joke' },
  { text: "Why do Java developers wear glasses? Because they can't C#!", type: 'joke' },
  { text: "How many programmers does it take to change a light bulb? None, that's a hardware problem.", type: 'joke' },
  { text: "A programmer's wife tells him: 'Go to the store and buy a loaf of bread. If they have eggs, buy a dozen.' He returns with 12 loaves of bread.", type: 'joke' },
  { text: "Why did the developer go broke? Because he used up all his cache! 💰", type: 'joke' },
  { text: "I would tell you a UDP joke, but you might not get it.", type: 'joke' },
  { text: "A TCP packet walks into a bar and says, 'I'd like a beer.' The bartender replies, 'You want a beer?' 'Yes, a beer.'", type: 'joke' },
  { text: "99 little bugs in the code, 99 bugs in the code. Take one down, patch it around... 127 little bugs in the code.", type: 'joke' },
  
  // Math Jokes
  { text: "Why was the equal sign so humble? Because it knew it wasn't greater than or less than anyone else.", type: 'joke' },
  { text: "Parallel lines have so much in common. It's a shame they'll never meet.", type: 'joke' },
  { text: "Why did the statistician drown crossing the river? It was 3 feet deep on average.", type: 'joke' },
  { text: "There's a fine line between a numerator and a denominator. Only a fraction of people will get this.", type: 'joke' },
  { text: "Why was 6 afraid of 7? Because 7, 8, 9. But why did 7 eat 9? To get 3 squared meals a day!", type: 'joke' },
  { text: "What's a mathematician's favorite season? Sum-mer! ☀️", type: 'joke' },
  { text: "I'll do algebra, I'll do trig, I'll even do statistics. But graphing is where I draw the line!", type: 'joke' },
  
  // Science Jokes
  { text: "A neutron walks into a bar and asks how much for a drink. The bartender replies, 'For you, no charge!'", type: 'joke' },
  { text: "Schrödinger's cat walks into a bar. And doesn't.", type: 'joke' },
  { text: "Heisenberg gets pulled over. Cop: 'Do you know how fast you were going?' Heisenberg: 'No, but I know exactly where I am.'", type: 'joke' },
  { text: "Two atoms bump into each other. One says 'I think I lost an electron!' The other asks 'Are you sure?' 'Yes, I'm positive!'", type: 'joke' },
  { text: "Why can't you trust atoms? They make up everything!", type: 'joke' },
  { text: "A photon checks into a hotel. The bellhop asks, 'Can I help you with your luggage?' The photon replies, 'No thanks, I'm traveling light.'", type: 'joke' },
  
  // Logic Jokes
  { text: "The barber shaves all those who do not shave themselves. Who shaves the barber? 🤔", type: 'joke' },
  { text: "This statement is false. Think about it... 🧠", type: 'joke' },
  { text: "An optimist sees the glass half full. A pessimist sees it half empty. An engineer sees it as twice as big as it needs to be.", type: 'joke' },
  
  // AI Jokes
  { text: "Why did the neural network go to therapy? It had too many deep issues.", type: 'joke' },
  { text: "Machine learning is like teenage sex: everyone talks about it, nobody really knows how to do it, everyone thinks everyone else is doing it.", type: 'joke' },
  { text: "An AI walks into a bar. The bartender says, 'What'll you have?' The AI responds, 'What's everyone else having?'", type: 'joke' },
];

export const smartQuotes: JokeOrQuote[] = [
  // Einstein
  { text: "The measure of intelligence is the ability to change.", author: "Albert Einstein", type: 'quote' },
  { text: "Logic will get you from A to B. Imagination will take you everywhere.", author: "Albert Einstein", type: 'quote' },
  { text: "Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.", author: "Albert Einstein", type: 'quote' },
  { text: "The important thing is not to stop questioning. Curiosity has its own reason for existence.", author: "Albert Einstein", type: 'quote' },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein", type: 'quote' },
  
  // Philosophy
  { text: "The only true wisdom is knowing you know nothing.", author: "Socrates", type: 'quote' },
  { text: "I think, therefore I am.", author: "René Descartes", type: 'quote' },
  { text: "The unexamined life is not worth living.", author: "Socrates", type: 'quote' },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", type: 'quote' },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche", type: 'quote' },
  
  // Science & Math
  { text: "Mathematics is the language with which God has written the universe.", author: "Galileo Galilei", type: 'quote' },
  { text: "If I have seen further, it is by standing on the shoulders of giants.", author: "Isaac Newton", type: 'quote' },
  { text: "The good thing about science is that it's true whether or not you believe in it.", author: "Neil deGrasse Tyson", type: 'quote' },
  { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan", type: 'quote' },
  
  // Computing & Logic
  { text: "The question of whether a computer can think is no more interesting than the question of whether a submarine can swim.", author: "Edsger W. Dijkstra", type: 'quote' },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson", type: 'quote' },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci", type: 'quote' },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson", type: 'quote' },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay", type: 'quote' },
  
  // Wisdom
  { text: "It is not that I'm so smart. But I stay with the questions much longer.", author: "Albert Einstein", type: 'quote' },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch", type: 'quote' },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats", type: 'quote' },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs", type: 'quote' },
  { text: "Intelligence is the ability to adapt to change.", author: "Stephen Hawking", type: 'quote' },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison", type: 'quote' },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela", type: 'quote' },
];

export const levelUpMessages: string[] = [
  "🎉 Level Up! Your neurons are firing on all cylinders!",
  "🚀 Ascending! You're leaving average minds in the dust!",
  "⚡ Power surge! Your IQ just got a buff!",
  "🧠 Brain expansion detected! You're evolving!",
  "🌟 Brilliant! You've unlocked new neural pathways!",
  "🏆 Champion level reached! The elite awaits!",
  "💎 Diamond mind! You're sharper than ever!",
  "🔥 On fire! Your synapses are blazing!",
  "🎯 Precision thinking! You're in the zone!",
  "⭐ Stellar performance! You're reaching for the stars!",
];

export const encouragementMessages: string[] = [
  "Every expert was once a beginner. Keep going! 💪",
  "Mistakes are proof you're trying. Let's go again! 🔄",
  "Your brain is like a muscle - this is just training! 🏋️",
  "Einstein failed his first physics class. You've got this! 🌟",
  "The comeback is always stronger than the setback! 💥",
  "Don't watch the clock; do what it does - keep going! ⏰",
  "Failure is simply the opportunity to begin again more intelligently. 🧠",
  "You're one puzzle away from a breakthrough! 🧩",
];

export function getRandomJoke(): JokeOrQuote {
  return smartJokes[Math.floor(Math.random() * smartJokes.length)];
}

export function getRandomQuote(): JokeOrQuote {
  return smartQuotes[Math.floor(Math.random() * smartQuotes.length)];
}

export function getRandomJokeOrQuote(): JokeOrQuote {
  const all = [...smartJokes, ...smartQuotes];
  return all[Math.floor(Math.random() * all.length)];
}

export function getLevelUpMessage(): string {
  return levelUpMessages[Math.floor(Math.random() * levelUpMessages.length)];
}

export function getEncouragementMessage(): string {
  return encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
}





