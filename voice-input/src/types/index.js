"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = exports.DEFAULT_VAD_CONFIG = exports.DEFAULT_SETTINGS = void 0;
exports.DEFAULT_SETTINGS = {
    language: 'zh',
    offlineOnly: false,
    autoPunctuation: true,
    hotwords: [],
    cloudAsrEnabled: false,
    cloudAsrProvider: 'none',
    asrEngine: 'auto',
    theme: 'light',
};
exports.DEFAULT_VAD_CONFIG = {
    mode: 'auto',
    silenceTimeoutMs: 800,
    minSpeechDurationMs: 200,
    threshold: 0.3,
};
// ===== IPC 通道名 =====
exports.IPC_CHANNELS = {
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
};
//# sourceMappingURL=index.js.map