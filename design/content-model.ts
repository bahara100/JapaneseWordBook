/** Phase 1 contracts. Not yet wired to persistence or a production runtime. */
export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type ReviewStatus = 'draft' | 'reviewed';
export type ISODateTime = string;
export type StudyDate = string; // YYYY-MM-DD in session.timeZone

export interface Provenance {
  author: string;
  sourceUrl?: string;
  usageTerms: string;
  status: ReviewStatus;
  reviewedAt?: ISODateTime;
}
export interface MediaAsset {
  id: string;
  kind: 'image' | 'audio';
  path: string; // repository-relative, resolved through deployment base
  description: string;
  provenance: Provenance;
}
export interface ExampleSentence {
  id: string;
  japanese: string;
  reading: string;
  korean: string;
  audioAssetId?: string;
  provenance: Provenance;
}
export interface WordReading { id: string; kana: string; romaji?: string }
export interface WordSense {
  id: string;
  korean: string[];
  partOfSpeech: string;
  readingIds: string[];
  examples: ExampleSentence[];
}
export interface Word {
  id: string;
  level: Level;
  curriculumOrder: number;
  written: string;
  readings: WordReading[];
  senses: WordSense[];
  provenance: Provenance;
}
export interface CardPrompt {
  id: string;
  wordId: string;
  senseId: string;
  readingId: string;
  imageAssetId: string;
  audioAssetId?: string;
  situationHint?: string;
  acceptedWrittenForms: string[];
  acceptedKanaForms: string[];
  status: ReviewStatus;
}
export interface Grammar {
  id: string;
  level: Level;
  expression: string;
  koreanMeaning: string;
  connection: string;
  explanation: string;
  cautions: string[];
  examples: ExampleSentence[];
  relatedGrammarIds: string[];
  provenance: Provenance;
}
export interface ContentManifest {
  schemaVersion: number;
  contentVersion: string;
  levels: Record<Level, { wordsPath: string; grammarPath: string; wordCount: number; grammarCount: number }>;
}
export interface Settings {
  level: Level;
  dailyTarget: 10 | 15 | 20;
  timeZone: string;
  showRomaji: boolean;
  speechRate: number;
}
export interface Favorite { wordId: string; createdAt: ISODateTime }
export type Outcome = 'correct' | 'incorrect' | 'revealed' | 'unrecognized';
export interface AnswerAttempt {
  id: string;
  sessionId: string;
  cardIndex: number;
  method: 'speech' | 'typing' | 'choice' | 'reveal';
  inputText?: string;
  outcome: Outcome;
  hintUsed: boolean;
  attemptedAt: ISODateTime;
}
export interface WordProgress {
  promptId: string;
  level: Level;
  reviewStep: number;
  dueAt: ISODateTime;
  firstSeenAt: ISODateTime;
  lastReviewedAt: ISODateTime;
  incorrectCount: number;
}
export interface SessionCard {
  promptSnapshot: CardPrompt;
  wordSnapshot: Word; // finish old sessions after content changes
  mediaSnapshots: MediaAsset[];
  kind: 'new' | 'review';
  mode: 'picture' | 'listening' | 'repeat';
  state: 'question' | 'answering' | 'feedback' | 'revealed' | 'complete';
  firstEvaluation?: { outcome: Exclude<Outcome, 'unrecognized'>; hintUsed: boolean };
}
export interface StudySession {
  id: string;
  type: 'daily' | 'favorites' | 'practice';
  studyDate: StudyDate;
  timeZone: string;
  level: Level;
  target: number;
  contentVersion: string;
  cards: SessionCard[];
  currentIndex: number;
  status: 'active' | 'complete';
  revision: number;
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
}
export interface Backup {
  schemaVersion: number;
  exportedAt: ISODateTime;
  settings: Settings;
  favorites: Favorite[];
  progress: WordProgress[];
  sessions: StudySession[];
  attempts: AnswerAttempt[];
}
