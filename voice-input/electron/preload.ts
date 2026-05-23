import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, VoiceInputAPI, RecognitionResult, VadState, Hotword, AppSettings } from '../src/types';

/**
 * Preload 脚本
 *
 * 通过 contextBridge 安全地向渲染进程暴露语音输入 API。
 * 所有 IPC 通信都通过明确定义的通道进行。
 */
const api: VoiceInputAPI = {
  // ===== 录音控制 =====
  startRecording: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_RECORDING, config),

  stopRecording: () =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_RECORDING),

  pauseRecording: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PAUSE_RECORDING),

  resumeRecording: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RESUME_RECORDING),

  // ===== 热词管理 =====
  addHotword: (word, weight) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_HOTWORD, word, weight),

  removeHotword: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_HOTWORD, id),

  getHotwords: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HOTWORDS),

  // ===== 设置管理 =====
  getSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  updateSettings: (partial) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, partial),

  // ===== 引擎信息 =====
  getEngineInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ENGINE_INFO),

  // ===== 音频数据 =====
  sendAudioChunk: (buffer) =>
    ipcRenderer.send(IPC_CHANNELS.AUDIO_CHUNK, buffer),

  // ===== 文本操作 =====
  copyText: (text) =>
    ipcRenderer.invoke(IPC_CHANNELS.COPY_TEXT, text),

  clearText: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_TEXT),

  // ===== 历史记录 =====
  getHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),

  clearHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY),

  // ===== 导出 =====
  exportText: (text) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_TEXT, text),

  // ===== 事件监听 =====
  onResult: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: RecognitionResult) => callback(result);
    ipcRenderer.on(IPC_CHANNELS.RECOGNITION_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RECOGNITION_RESULT, handler);
  },

  onPartialResult: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on(IPC_CHANNELS.PARTIAL_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PARTIAL_RESULT, handler);
  },

  onVadState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: VadState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.VAD_STATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.VAD_STATE, handler);
  },

  onAudioLevel: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, level: number) => callback(level);
    ipcRenderer.on(IPC_CHANNELS.AUDIO_LEVEL, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_LEVEL, handler);
  },

  onError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on(IPC_CHANNELS.ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ERROR, handler);
  },

  onEngineStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { type: string; available: boolean }) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.ASR_ENGINE_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ASR_ENGINE_STATUS, handler);
  },
};

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('voiceInput', api);
