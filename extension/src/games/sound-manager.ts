// IQ Arena - Sound Manager

import { SoundEffect } from './types';

// Sound settings
const SOUND_STORAGE_KEY = 'iq-arena-sound-enabled';

class SoundManager {
  private enabled: boolean = true;
  private audioContext: AudioContext | null = null;
  private initialized: boolean = false;

  constructor() {
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(SOUND_STORAGE_KEY);
        this.enabled = result[SOUND_STORAGE_KEY] !== false;
      } else {
        const stored = localStorage.getItem(SOUND_STORAGE_KEY);
        this.enabled = stored !== 'false';
      }
    } catch {
      this.enabled = true;
    }
  }

  private initAudioContext(): void {
    if (!this.initialized && typeof AudioContext !== 'undefined') {
      this.audioContext = new AudioContext();
      this.initialized = true;
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [SOUND_STORAGE_KEY]: enabled });
      }
      localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
    } catch (error) {
      console.error('Error saving sound settings:', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Play a generated tone sound
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
    if (!this.enabled) return;
    
    this.initAudioContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.error('Error playing tone:', error);
    }
  }

  // Play multiple notes in sequence
  private playMelody(notes: { freq: number; dur: number }[], type: OscillatorType = 'sine'): void {
    if (!this.enabled) return;
    
    this.initAudioContext();
    if (!this.audioContext) return;

    let time = this.audioContext.currentTime;
    notes.forEach(note => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.value = note.freq;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.2, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + note.dur);

      oscillator.start(time);
      oscillator.stop(time + note.dur);

      time += note.dur * 0.8; // Slight overlap
    });
  }

  // Sound effect implementations
  play(effect: SoundEffect): void {
    if (!this.enabled) return;

    switch (effect) {
      case 'click':
        this.playTone(800, 0.05, 'square', 0.1);
        break;

      case 'correct':
        this.playMelody([
          { freq: 523.25, dur: 0.1 }, // C5
          { freq: 659.25, dur: 0.15 }, // E5
        ], 'sine');
        break;

      case 'wrong':
        this.playMelody([
          { freq: 311.13, dur: 0.15 }, // Eb4
          { freq: 261.63, dur: 0.2 }, // C4
        ], 'sawtooth');
        break;

      case 'win':
        this.playMelody([
          { freq: 523.25, dur: 0.12 }, // C5
          { freq: 659.25, dur: 0.12 }, // E5
          { freq: 783.99, dur: 0.12 }, // G5
          { freq: 1046.50, dur: 0.25 }, // C6
        ], 'sine');
        break;

      case 'lose':
        this.playMelody([
          { freq: 392.00, dur: 0.15 }, // G4
          { freq: 349.23, dur: 0.15 }, // F4
          { freq: 329.63, dur: 0.15 }, // E4
          { freq: 261.63, dur: 0.3 }, // C4
        ], 'triangle');
        break;

      case 'levelUp':
        this.playMelody([
          { freq: 523.25, dur: 0.1 }, // C5
          { freq: 587.33, dur: 0.1 }, // D5
          { freq: 659.25, dur: 0.1 }, // E5
          { freq: 698.46, dur: 0.1 }, // F5
          { freq: 783.99, dur: 0.1 }, // G5
          { freq: 880.00, dur: 0.1 }, // A5
          { freq: 987.77, dur: 0.1 }, // B5
          { freq: 1046.50, dur: 0.3 }, // C6
        ], 'sine');
        break;

      case 'achievement':
        this.playMelody([
          { freq: 783.99, dur: 0.1 }, // G5
          { freq: 987.77, dur: 0.1 }, // B5
          { freq: 1174.66, dur: 0.15 }, // D6
          { freq: 1567.98, dur: 0.25 }, // G6
        ], 'sine');
        break;

      case 'tick':
        this.playTone(1000, 0.03, 'square', 0.1);
        break;

      case 'flip':
        this.playTone(600, 0.08, 'sine', 0.15);
        break;

      case 'match':
        this.playMelody([
          { freq: 880, dur: 0.08 }, // A5
          { freq: 1108.73, dur: 0.12 }, // C#6
        ], 'sine');
        break;

      case 'explosion':
        // White noise burst for explosion
        this.initAudioContext();
        if (this.audioContext) {
          const bufferSize = this.audioContext.sampleRate * 0.3;
          const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
          const data = buffer.getChannelData(0);
          
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
          }
          
          const source = this.audioContext.createBufferSource();
          const gainNode = this.audioContext.createGain();
          
          source.buffer = buffer;
          source.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
          
          source.start();
        }
        break;

      default:
        console.warn('Unknown sound effect:', effect);
    }
  }

  // Play Simon Says colors
  playSimonColor(colorIndex: number): void {
    const frequencies = [329.63, 440, 554.37, 659.25]; // E4, A4, C#5, E5
    if (colorIndex >= 0 && colorIndex < frequencies.length) {
      this.playTone(frequencies[colorIndex], 0.3, 'sine', 0.3);
    }
  }

  // Play countdown tick
  playCountdown(number: number): void {
    const freq = number === 0 ? 880 : 440 + (3 - number) * 100;
    this.playTone(freq, number === 0 ? 0.3 : 0.1, 'sine', 0.2);
  }
}

// Export singleton instance
export const soundManager = new SoundManager();





