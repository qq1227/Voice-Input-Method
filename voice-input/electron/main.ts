import { app, BrowserWindow, ipcMain, clipboard, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { VoskService } from './services/vosk-service';
import { VadService } from './services/vad-service';
import { punctuationService } from './services/punctuation';
import { cloudAsrService } from './services/cloud-asr';
import { HotwordManager } from './services/hotword-manager';
import {
  IPC_CHANNELS,
  RecognitionResult,
  VadState,
  Hotword,
  AppSettings,
  DEFAULT_SETTINGS,
} from '../src/types';
import { v4 as uuidv4 } from 'uuid';

// ===== 全局状态 =====
let mainWindow: BrowserWindow | null = null;
const voskService = new VoskService();
const vadService = new VadService();
const hotwordManager = new HotwordManager();
let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
let isRecording = false;
let currentResult: RecognitionResult | null = null;
const history: RecognitionResult[] = [];
const MAX_HISTORY = 100;

// ===== 创建窗口 =====
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 360,
    minHeight: 480,
    title: '语音输入法',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // 启用语音识别相关特性
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== 初始化 ASR 引擎 =====
async function initAsrEngine(): Promise<void> {
  const available = await voskService.init();
  if (available) {
    console.log('[Main] Vosk ASR 引擎就绪');
    sendEngineStatus('vosk', true);
  } else {
    console.log('[Main] Vosk 不可用，使用 Web Speech API 模式');
    sendEngineStatus('webspeech', true);
  }
}

// ===== IPC 通信辅助 =====
function sendToRenderer(channel: string, data: any): void {
  mainWindow?.webContents.send(channel, data);
}

function sendResult(result: RecognitionResult): void {
  sendToRenderer(IPC_CHANNELS.RECOGNITION_RESULT, result);
}

function sendPartial(text: string): void {
  sendToRenderer(IPC_CHANNELS.PARTIAL_RESULT, text);
}

function sendVadState(state: VadState): void {
  sendToRenderer(IPC_CHANNELS.VAD_STATE, state);
}

function sendAudioLevel(level: number): void {
  sendToRenderer(IPC_CHANNELS.AUDIO_LEVEL, level);
}

function sendError(msg: string): void {
  sendToRenderer(IPC_CHANNELS.ERROR, msg);
}

function sendEngineStatus(type: string, available: boolean): void {
  sendToRenderer(IPC_CHANNELS.ASR_ENGINE_STATUS, { type, available });
}

// ===== 注册 IPC 处理器 =====
function registerIpcHandlers(): void {
  // 开始录音
  ipcMain.handle(IPC_CHANNELS.START_RECORDING, async (_event, config?: { vad?: any }) => {
    if (isRecording) return;

    isRecording = true;
    const startTime = Date.now();

    // 配置VAD
    if (config?.vad) {
      vadService.setConfig(config.vad);
    }

    // 注入热词到Vosk
    const hotwordWords = hotwordManager.getWordsForInjection();
    if (hotwordWords.length > 0) {
      voskService.setHotwords(hotwordWords);
    }

    // 启动引擎
    voskService.start();
    vadService.start();

    currentResult = {
      id: uuidv4(),
      text: '',
      segments: [],
      isFinal: false,
      source: 'local',
      latencyMs: 0,
      timestamp: startTime,
    };

    sendVadState('idle');
    console.log('[Main] 开始录音');
  });

  // 停止录音
  ipcMain.handle(IPC_CHANNELS.STOP_RECORDING, async () => {
    if (!isRecording) return null;

    isRecording = false;
    voskService.stop();
    vadService.stop();

    if (currentResult) {
      currentResult.isFinal = true;

      // 应用标点恢复
      if (currentSettings.autoPunctuation) {
        currentResult.text = punctuationService.process(currentResult.text);
      }

      // 应用热词纠错
      currentResult.text = hotwordManager.applyCorrections(currentResult.text);

      currentResult.latencyMs = Date.now() - currentResult.timestamp;

      // 存入历史记录
      if (currentResult.text.trim()) {
        history.unshift({ ...currentResult });
        if (history.length > MAX_HISTORY) {
          history.length = MAX_HISTORY;
        }
      }

      sendResult(currentResult);
      const result = { ...currentResult };
      currentResult = null;
      console.log('[Main] 录音结束');
      return result;
    }
    return null;
  });

  // 暂停/恢复录音
  ipcMain.handle(IPC_CHANNELS.PAUSE_RECORDING, async () => {
    // VAD状态控制
  });

  ipcMain.handle(IPC_CHANNELS.RESUME_RECORDING, async () => {
    // VAD状态控制
  });

  // 音频数据块（来自渲染进程的麦克风PCM）
  ipcMain.on(IPC_CHANNELS.AUDIO_CHUNK, (_event, buffer: ArrayBuffer) => {
    if (!isRecording) return;
    const pcmData = new Float32Array(buffer);

    // VAD处理（自动发送状态和电平事件）
    vadService.processAudio(pcmData);

    // 送入ASR引擎
    voskService.feedAudio(pcmData);
  });

  // 监听Vosk事件
  voskService.on('partial', (text: string) => {
    if (currentResult) {
      // 应用纠错
      const corrected = hotwordManager.applyCorrections(text);
      // 部分结果不上标点（避免用户看到带标点的中间结果闪烁）
      currentResult.text = corrected;
    }
    sendPartial(text);
  });

  voskService.on('final', (text: string) => {
    if (currentResult) {
      let processed = text;
      if (currentSettings.autoPunctuation) {
        processed = punctuationService.process(text);
      }
      processed = hotwordManager.applyCorrections(processed);

      currentResult.text += (currentResult.text ? ' ' : '') + processed;
      currentResult.isFinal = true;
      sendResult({ ...currentResult });
      currentResult.isFinal = false; // 继续累积

      // 尝试云端纠错（不阻塞）
      if (currentSettings.cloudAsrEnabled && currentSettings.cloudAsrProvider !== 'none') {
        cloudAsrService.correct(processed).then((corrected) => {
          if (corrected && corrected !== processed) {
            // 已上屏纠错（仅通知，不修改已上屏内容）
            sendToRenderer('cloud-correction', {
              original: processed,
              corrected,
            });
          }
        });
      }
    }
  });

  voskService.on('error', (msg: string) => {
    sendError(msg);
  });

  // VAD状态变化
  vadService.on('stateChange', (state: VadState) => {
    sendVadState(state);

    // 自动结束时通知渲染进程
    if (state === 'pending_finalize' && currentSettings.offlineOnly) {
      // 静音超时，自动停止
      setTimeout(async () => {
        if (vadService.getState() === 'pending_finalize' && isRecording) {
          // 不自动停止，留给用户或渲染进程决定
        }
      }, 300);
    }
  });

  // 音频电平
  vadService.on('audioLevel', (level: number) => {
    sendAudioLevel(level);
  });

  // ===== 热词管理 =====
  ipcMain.handle(IPC_CHANNELS.ADD_HOTWORD, async (_event, word: string, weight?: number) => {
    const hw = hotwordManager.add(word, weight);
    // 更新Vosk热词
    voskService.setHotwords(hotwordManager.getWordsForInjection());
    return hw;
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_HOTWORD, async (_event, id: string) => {
    const result = hotwordManager.remove(id);
    voskService.setHotwords(hotwordManager.getWordsForInjection());
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.GET_HOTWORDS, async () => {
    return hotwordManager.getAll();
  });

  // ===== 设置管理 =====
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return currentSettings;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, partial: Partial<AppSettings>) => {
    currentSettings = { ...currentSettings, ...partial };
    // 同步到云端ASR配置
    cloudAsrService.setEnabled(currentSettings.cloudAsrEnabled);
    return currentSettings;
  });

  // ===== 引擎信息 =====
  ipcMain.handle(IPC_CHANNELS.GET_ENGINE_INFO, async () => {
    return voskService.getStatus();
  });

  // ===== 文本操作 =====
  ipcMain.handle(IPC_CHANNELS.COPY_TEXT, async (_event, text: string) => {
    if (text) {
      clipboard.writeText(text);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_TEXT, async () => {
    currentResult = null;
  });

  // ===== 历史记录 =====
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
    return history.slice(0, 50);
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, async () => {
    history.length = 0;
  });

  // ===== 导出文本 =====
  ipcMain.handle(IPC_CHANNELS.EXPORT_TEXT, async (_event, text: string) => {
    if (!text) return { success: false };
    try {
      const now = new Date();
      const defaultName = `语音输入_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.txt`;

      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出语音输入文本',
        defaultPath: defaultName,
        filters: [
          { name: '文本文件', extensions: ['txt'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      fs.writeFileSync(result.filePath, text, 'utf-8');
      return { success: true, path: result.filePath };
    } catch (err) {
      console.error('[Main] 导出失败:', err);
      return { success: false };
    }
  });
}

// ===== 应用生命周期 =====
app.whenReady().then(async () => {
  createWindow();
  registerIpcHandlers();
  await initAsrEngine();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  voskService.destroy();
  vadService.destroy();
  hotwordManager.destroy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  voskService.destroy();
  vadService.destroy();
  hotwordManager.destroy();
});
