export interface OutlineItem {
  title: string;
  points: string[];
}

export interface GenerationRecord {
  id: string;
  topic: string;
  language: 'zh-CN' | 'en-US';
  duration: number;
  outline: OutlineItem[];
  createdAt: string;
  downloadUrl?: string;
}

export type GenerationStage = 'collecting' | 'outlining' | 'generating' | 'completed' | 'error';

export interface GenerationProgress {
  stage: GenerationStage;
  progress: number;
  message: string;
}

export interface GenerateRequest {
  topic: string;
  language: 'zh-CN' | 'en-US';
  duration: number;
}

export const DURATION_OPTIONS = [5, 10, 15, 20, 30] as const;

export const DURATION_TO_SLIDES: Record<number, { min: number; max: number }> = {
  5: { min: 5, max: 6 },
  10: { min: 8, max: 10 },
  15: { min: 12, max: 15 },
  20: { min: 16, max: 20 },
  30: { min: 24, max: 30 },
};
