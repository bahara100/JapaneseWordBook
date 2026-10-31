/** Content and record contracts. Started from design/content-model.ts; this file is now the source of truth. */
export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const LEVEL_IDS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const SCHEMA_VERSION = 1;
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
  /** The picture for the question side. Without one, the card shows the written word (or, for a
   *  word written only in kana, its Korean meaning) and asks for the reading. */
  imageAssetId?: string;
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
/** One level's word file: content/<level>/words.json. Media lists the assets its prompts use. */
export interface LevelWords { level: Level; words: Word[]; prompts: CardPrompt[]; media: MediaAsset[] }
/** One level's grammar file: content/<level>/grammar.json. */
export interface LevelGrammar { level: Level; grammar: Grammar[] }
export interface LevelSummary {
  wordsPath: string;
  grammarPath: string;
  wordCount: number;
  grammarCount: number;
  promptCount: number;
  reviewedPromptCount: number;
}
/** Built by tools/build-content.ts into public/content/manifest.json. */
export interface ContentManifest {
  schemaVersion: number;
  contentVersion: string;
  levels: Record<Level, LevelSummary>;
}
export type DailyTarget = 10 | 15 | 20;
export type SpeechRate = 0.7 | 0.85 | 1;
export interface Settings {
  level: Level;
  dailyTarget: DailyTarget;
  /** IANA name, or 'auto' to follow the device (falls back to Asia/Seoul). */
  timeZone: string;
  showRomaji: boolean;
  speechRate: SpeechRate;
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
  /** The listening hint was played before the first answer. */
  hintUsed?: boolean;
  /** Spoken answers heard as some other word before the first evaluation. */
  speechMismatches?: number;
  /** Listening mode: the Korean meanings offered, fixed when the round starts. */
  choices?: { wordId: string; label: string }[];
  firstEvaluation?: {
    outcome: Exclude<Outcome, 'unrecognized'>;
    hintUsed: boolean;
    /** How it was answered, and what was typed or heard, to show on the answer side. */
    method?: AnswerAttempt['method'];
    inputText?: string;
  };
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
  /** Always 'haru-japanese-backup', so other JSON files are recognised as not ours. */
  format: 'haru-japanese-backup';
  schemaVersion: number;
  exportedAt: ISODateTime;
  settings: Settings;
  favorites: Favorite[];
  progress: WordProgress[];
  sessions: StudySession[];
  attempts: AnswerAttempt[];
}
