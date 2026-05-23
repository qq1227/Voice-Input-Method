// ===== 识别结果 =====
export interface TextSegment {
  text: string;
  startTime: number;
  endTime: number;
  isPunctuated: boolean;
}

export interface RecognitionResult {
  id: string;
  text: string;
  segments: TextSegment[];
  isFinal: boolean;
  source: 'local' | 'cloud';
  latencyMs: number;
  timestamp: number;
}

// ===== VAD 状态 =====
export type VadState = 'idle' | 'speaking' | 'pending_finalize';

export interface VadConfig {
  mode: 'auto' | 'manual';
  silenceTimeoutMs: number;
  minSpeechDurationMs: number;
  threshold: number;
}

// ===== 热词 =====
export interface Hotword {
  id: string;
  word: string;
  weight: number;
  correction?: string;
  createdAt: number;
  hitCount: number;
}

// ===== 设置 =====
export type AsrEngineType = 'auto' | 'vosk' | 'webspeech';

export interface AppSettings {
  language: 'zh' | 'en' | 'yue' | 'mixed';
  offlineOnly: boolean;
  autoPunctuation: boolean;
  hotwords: Hotword[];
  cloudAsrEnabled: boolean;
  cloudAsrProvider: 'baidu' | 'aliyun' | 'none';
  asrEngine: AsrEngineType;
  theme: 'light' | 'dark';
  longTextMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh',
  offlineOnly: false,
  autoPunctuation: true,
  hotwords: [],
  cloudAsrEnabled: false,
  cloudAsrProvider: 'none',
  asrEngine: 'auto',
  theme: 'light',
  longTextMode: false,
};

export const DEFAULT_VAD_CONFIG: VadConfig = {
  mode: 'auto',
  silenceTimeoutMs: 800,
  minSpeechDurationMs: 200,
  threshold: 0.3,
};

// ===== IPC 通道名 =====
export const IPC_CHANNELS = {
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  PAUSE_RECORDING: 'pause-recording',
  RESUME_RECORDING: 'resume-recording',
  AUDIO_CHUNK: 'audio-chunk',
  RECOGNITION_RESULT: 'recognition-result',
  PARTIAL_RESULT: 'partial-result',
  VAD_STATE: 'vad-state',
  AUDIO_LEVEL: 'audio-level',
  ERROR: 'asr-error',
  ASR_ENGINE_STATUS: 'asr-engine-status',
  ADD_HOTWORD: 'add-hotword',
  REMOVE_HOTWORD: 'remove-hotword',
  GET_HOTWORDS: 'get-hotwords',
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  GET_ENGINE_INFO: 'get-engine-info',
  COPY_TEXT: 'copy-text',
  CLEAR_TEXT: 'clear-text',
  GET_HISTORY: 'get-history',
  CLEAR_HISTORY: 'clear-history',
  EXPORT_TEXT: 'export-text',
} as const;

// ===== Electron API 暴露给渲染进程 =====
export interface VoiceInputAPI {
  startRecording(config?: { vad?: Partial<VadConfig> }): Promise<void>;
  stopRecording(): Promise<RecognitionResult | null>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  addHotword(word: string, weight?: number): Promise<void>;
  removeHotword(id: string): Promise<void>;
  getHotwords(): Promise<Hotword[]>;
  getSettings(): Promise<AppSettings>;
  updateSettings(partial: Partial<AppSettings>): Promise<void>;
  getEngineInfo(): Promise<{ type: string; available: boolean; modelLoaded: boolean }>;
  copyText(text: string): Promise<void>;
  clearText(): Promise<void>;
  getHistory(): Promise<RecognitionResult[]>;
  clearHistory(): Promise<void>;
  exportText(text: string): Promise<{ success: boolean; path?: string }>;
  sendAudioChunk(buffer: ArrayBuffer): void;

  onResult(callback: (result: RecognitionResult) => void): () => void;
  onPartialResult(callback: (text: string) => void): () => void;
  onVadState(callback: (state: VadState) => void): () => void;
  onAudioLevel(callback: (level: number) => void): () => void;
  onError(callback: (error: string) => void): () => void;
  onEngineStatus(callback: (status: { type: string; available: boolean }) => void): () => void;
}
