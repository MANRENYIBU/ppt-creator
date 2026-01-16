import { create } from 'zustand';
import { GenerationRecord, GenerationProgress, GenerationStage } from '@/types';

const STORAGE_KEY = 'ppt-creator-history';

interface GenerationState {
  // 当前生成状态
  isGenerating: boolean;
  currentProgress: GenerationProgress | null;
  currentRecord: GenerationRecord | null;

  // 历史记录
  history: GenerationRecord[];

  // Actions
  startGeneration: (topic: string, language: 'zh-CN' | 'en-US', duration: number) => void;
  updateProgress: (progress: GenerationProgress) => void;
  completeGeneration: (record: GenerationRecord) => void;
  setError: (message: string) => void;
  reset: () => void;

  // 历史记录操作
  loadHistory: () => void;
  addToHistory: (record: GenerationRecord) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  isGenerating: false,
  currentProgress: null,
  currentRecord: null,
  history: [],

  startGeneration: (topic, language, duration) => {
    set({
      isGenerating: true,
      currentProgress: {
        stage: 'collecting',
        progress: 0,
        message: language === 'zh-CN' ? '正在收集资料...' : 'Collecting resources...',
      },
      currentRecord: null,
    });
  },

  updateProgress: (progress) => {
    set({ currentProgress: progress });
  },

  completeGeneration: (record) => {
    const { addToHistory } = get();
    addToHistory(record);
    set({
      isGenerating: false,
      currentProgress: {
        stage: 'completed',
        progress: 100,
        message: record.language === 'zh-CN' ? '生成完成！' : 'Generation completed!',
      },
      currentRecord: record,
    });
  },

  setError: (message) => {
    set({
      isGenerating: false,
      currentProgress: {
        stage: 'error',
        progress: 0,
        message,
      },
    });
  },

  reset: () => {
    set({
      isGenerating: false,
      currentProgress: null,
      currentRecord: null,
    });
  },

  loadHistory: () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ history: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  },

  addToHistory: (record) => {
    const { history } = get();
    const newHistory = [record, ...history];
    set({ history: newHistory });
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    }
  },

  removeFromHistory: (id) => {
    const { history } = get();
    const newHistory = history.filter((r) => r.id !== id);
    set({ history: newHistory });
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    }
  },

  clearHistory: () => {
    set({ history: [] });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
}));
