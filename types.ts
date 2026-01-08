
export enum GameState {
  START = 'START',
  SELECT_HOST = 'SELECT_HOST',
  PLAYING = 'PLAYING',
  SUMMARY = 'SUMMARY'
}

export interface HostPersonality {
  id: string;
  name: string;
  description: string;
  instruction: string;
  avatar: string;
  accent: string;
}

export interface TriviaQuestion {
  question: string;
  answer: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GameStats {
  score: number;
  questionsAnswered: number;
  startTime: number;
}

export interface FactCheck {
  query: string;
  fact: string;
  sources: Array<{ title: string; uri: string }>;
}
