export enum AppState {
  IDLE = 'IDLE',
  EXTRACTING = 'EXTRACTING',
  REVIEW = 'REVIEW',
  TRANSLATING = 'TRANSLATING', // Optional step if language differs
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  PLAYBACK = 'PLAYBACK',
  ERROR = 'ERROR'
}

export interface ExtractedDocument {
  text: string;
  detectedLanguage: string;
}

export interface AudioGenerationResult {
  audioBuffer: AudioBuffer | null;
  duration: number;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  voiceName: string; // Mapping to Gemini Voice names
}

export type ProcessingLog = {
  id: string;
  message: string;
  timestamp: number;
};
