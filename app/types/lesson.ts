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
  pdUpgradeExample?: { simple: string; upgraded: string };
  whyBetterForPD3?: string;
  appliedExample?: string;
}

export interface VocabularyItem {
  danish: string;
  english: string;
  persian: string;
  example: string;
  category?: "word" | "phrase" | "collocation" | "connector";
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

export type ExamQuestionType =
  | "short_answer"
  | "multiple_choice"
  | "vocabulary_in_context"
  | "matching"
  | "matching_heading"
  | "matching_person_opinion"
  | "cloze"
  | "gapped_text"
  | "inference"
  | "writer_purpose"
  | "main_argument"
  | "counterargument"
  | "open_analytical_answer";

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface ExamQuestion {
  type: ExamQuestionType;
  instruction: string;
  correctAnswer: string;
  explanationPersian: string;
  question?: string;
  options?: string[];
  items?: MatchingPair[];
  textWithBlanks?: string;
  missingSentenceOptions?: string[];
  gappedParagraph?: string;
}

export interface ReadingExamPractice {
  title: string;
  questions: ExamQuestion[];
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
  examStrategy: string;
  readingExamPractice?: ReadingExamPractice;
}
