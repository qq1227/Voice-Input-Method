import { create } from 'zustand';
import { RecognitionResult, VadState } from '../types';

interface RecognitionState {
  // 状态
  isRecording: boolean;
  isPaused: boolean;
  vadState: VadState;
  audioLevel: number;
  partialText: string;
  currentText: string;
  finalResults: RecognitionResult[];
  history: RecognitionResult[];
  latencyMs: number;

  // 引擎
  engineType: string;
  engineAvailable: boolean;
  error: string | null;

  // 操作
  setIsRecording: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setVadState: (s: VadState) => void;
  setAudioLevel: (l: number) => void;
  setPartialText: (t: string) => void;
  appendPartialText: (t: string) => void;
  addFinalResult: (r: RecognitionResult) => void;
  setCurrentText: (t: string) => void;
  appendCurrentText: (t: string) => void;
  setHistory: (h: RecognitionResult[]) => void;
  setLatencyMs: (l: number) => void;
  setEngineStatus: (type: string, available: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
  clearCurrentText: () => void;
  clearAll: () => void;
}

export const useRecognitionStore = create<RecognitionState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  vadState: 'idle',
  audioLevel: 0,
  partialText: '',
  currentText: '',
  finalResults: [],
  history: [],
  latencyMs: 0,
  engineType: 'checking...',
  engineAvailable: false,
  error: null,

  setIsRecording: (v) => set({ isRecording: v }),
  setIsPaused: (v) => set({ isPaused: v }),
  setVadState: (s) => set({ vadState: s }),
  setAudioLevel: (l) => set({ audioLevel: l }),
  setPartialText: (t) => set({ partialText: t }),
  appendPartialText: (t) => {
    const current = get().partialText;
    set({ partialText: current + t });
  },
  addFinalResult: (r) => {
    const results = [...get().finalResults, r];
    const text = results.map((x) => x.text).join('');
    set({
      finalResults: results,
      currentText: text,
      partialText: '',
    });
  },
  setCurrentText: (t) => set({ currentText: t }),
  appendCurrentText: (t) => {
    set({ currentText: get().currentText + t });
  },
  setHistory: (h) => set({ history: h }),
  setLatencyMs: (l) => set({ latencyMs: l }),
  setEngineStatus: (type, available) =>
    set({ engineType: type, engineAvailable: available }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      isRecording: false,
      isPaused: false,
      vadState: 'idle',
      audioLevel: 0,
      partialText: '',
      finalResults: [],
      error: null,
    }),
  clearCurrentText: () =>
    set({
      currentText: '',
      partialText: '',
      finalResults: [],
    }),
  clearAll: () =>
    set({
      isRecording: false,
      isPaused: false,
      vadState: 'idle',
      audioLevel: 0,
      partialText: '',
      currentText: '',
      finalResults: [],
      history: [],
      latencyMs: 0,
      error: null,
    }),
}));
