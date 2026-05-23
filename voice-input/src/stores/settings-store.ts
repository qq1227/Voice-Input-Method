import { create } from 'zustand';
import { AppSettings, Hotword, DEFAULT_SETTINGS } from '../types';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;

  setSettings: (s: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  addHotword: (hw: Hotword) => void;
  removeHotword: (id: string) => void;
  updateHotword: (id: string, updates: Partial<Pick<Hotword, 'word' | 'weight' | 'correction'>>) => void;
  setLoaded: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  setSettings: (s) => set({ settings: s, loaded: true }),

  updateSettings: (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    // 同步到主进程
    window.voiceInput?.updateSettings(partial).catch(console.error);
  },

  addHotword: (hw) => {
    const hotwords = [...get().settings.hotwords, hw];
    set({ settings: { ...get().settings, hotwords } });
  },

  removeHotword: (id) => {
    const hotwords = get().settings.hotwords.filter((h) => h.id !== id);
    set({ settings: { ...get().settings, hotwords } });
  },

  updateHotword: (id, updates) => {
    const hotwords = get().settings.hotwords.map((h) =>
      h.id === id ? { ...h, ...updates } : h
    );
    set({ settings: { ...get().settings, hotwords } });
  },

  setLoaded: (v) => set({ loaded: v }),
}));
