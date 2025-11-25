import { SupportedLanguage } from './types';

export const VOICE_OPTIONS = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

// Default mapping for convenience, but user can override
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', voiceName: 'Puck' },
  { code: 'hi', name: 'Hindi', voiceName: 'Kore' },
  { code: 'bn', name: 'Bengali', voiceName: 'Kore' },
  { code: 'gu', name: 'Gujarati', voiceName: 'Kore' },
  { code: 'ta', name: 'Tamil', voiceName: 'Kore' },
  { code: 'te', name: 'Telugu', voiceName: 'Kore' },
  { code: 'mr', name: 'Marathi', voiceName: 'Kore' },
  { code: 'ur', name: 'Urdu', voiceName: 'Kore' },
  { code: 'fr', name: 'French', voiceName: 'Zephyr' },
  { code: 'es', name: 'Spanish', voiceName: 'Fenrir' },
  { code: 'de', name: 'German', voiceName: 'Charon' },
];

export const MAX_PREVIEW_LENGTH = 500;
export const TTS_CHUNK_SIZE = 3000; // Safe character limit for TTS requests