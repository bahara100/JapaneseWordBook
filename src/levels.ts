import type { Level } from './content/types';

export const LEVELS: { id: Level; label: string; description: string }[] = [
  { id: 'N5', label: '입문', description: '일상의 첫 단어부터' },
  { id: 'N4', label: '초급', description: '생활 속 표현 넓히기' },
  { id: 'N3', label: '중급', description: '생각을 더 풍부하게' },
  { id: 'N2', label: '중상급', description: '다양한 맥락 이해하기' },
  { id: 'N1', label: '고급', description: '섬세한 의미 알아가기' },
];

/** Product defaults until settings are stored on the device (backlog 2-3). */
export const DEFAULT_SETTINGS = { level: 'N5' as Level, dailyTarget: 15 };
