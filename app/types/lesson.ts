export interface ConversationLine {
  speaker: string;
  danish: string;
  english: string;
  persian: string;
}

export interface KeySentence {
  danish: string;
  english: string;
  persian: string;
}

export interface GrammarPoint {
  title: string;
  explanationPersian: string;
  pattern: string;
  examples: string[];
  commonMistake: string;
}

export interface VocabularyItem {
  danish: string;
  english: string;
  persian: string;
  example: string;
}

export interface ReadingQuestion {
  question: string;
  type: string;
  answer: string;
}

export interface Reading {
  title: string;
  text: string;
  questions: ReadingQuestion[];
}

export interface Flashcard {
  front: string;
  back: string;
  type: string;
}

export interface SavedFlashcard {
  id: string;
  front: string;
  back: string;
  status: "new" | "hard" | "good";
  sourceLessonDay: number | null;
  createdAt: string;
  reviewCount?: number;
  correctCount?: number;
  wrongCount?: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

export interface WritingCorrection {
  correctedVersion: string;
  naturalVersion: string;
  explanationPersian: string;
  suggestedFlashcards: Flashcard[];
}

export interface Lesson {
  day: number;
  title: string;
  level: string;
  topic: string;
  conversation: ConversationLine[];
  keySentences: KeySentence[];
  grammarPoints: GrammarPoint[];
  vocabulary: VocabularyItem[];
  reading: Reading;
  writingTask: string;
  suggestedFlashcards: Flashcard[];
}
