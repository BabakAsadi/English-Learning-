
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Topic = 'Job Interview' | 'Work Daily' | 'Casual';
export type Duration = '1m' | '3m' | '5m';

export interface DialogueTurn {
  speaker: string;
  text: string;
  persianText: string;
  role: 'interviewer' | 'candidate' | 'manager' | 'peer' | 'friend';
}

export interface VocabularyItem {
  word: string;
  partOfSpeech: string;
  englishMeaning: string;
  persianMeaning: string;
  isCustom?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  context: string;
  participants: {
    name: string;
    role: string;
    voice: 'Kore' | 'Puck';
  }[];
  dialogue: DialogueTurn[];
  vocabulary: VocabularyItem[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  SELECTING_LEVEL = 'SELECTING_LEVEL',
  GENERATING_TEXT = 'GENERATING_TEXT',
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  READY = 'READY',
  ERROR = 'ERROR'
}
