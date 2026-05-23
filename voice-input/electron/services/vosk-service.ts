import * as path from 'path';
import * as fs from 'fs';

export type VoskEngineEvent = 'partial' | 'final' | 'error' | 'ready';

export interface VoskEngineOptions {
  modelPath?: string;
  sampleRate?: number;
  grammar?: string[];
}

/**
 * Vosk ASR 引擎封装
 *
 * 负责加载 Vosk 模型、流式语音识别、
 * 热词注入、以及生命周期管理。
 * 当 vosk 原生模块不可用时自动降级。
 */
export class VoskService {
  private model: any = null;
  private recognizer: any = null;
  private vosk: any = null;
  private isLoaded = false;
  private isRecognizing = false;
  private available = false;
  private modelPath: string;
  private sampleRate: number;
  private listeners: Map<VoskEngineEvent, Set<(...args: any[]) => void>> = new Map();
  private partialBuffer = '';
  private hotwordWords: string[] = [];

  constructor(options: VoskEngineOptions = {}) {
    const basePath = path.join(__dirname, '..', '..', '..', 'models');
    this.modelPath = options.modelPath || process.env.VOSK_MODEL_PATH || basePath;
    this.sampleRate = options.sampleRate || 16000;
  }

  async init(): Promise<boolean> {
    try {
      this.vosk = require('vosk');
      this.available = true;
      await this.loadModel();
      return true;
    } catch (err) {
      console.warn('[Vosk] 原生模块不可用，降级到 Web Speech API 模式:', (err as Error).message);
      this.available = false;
      this.emit('ready', { available: false, engine: 'webspeech' });
      return false;
    }
  }

  private async loadModel(): Promise<void> {
    if (!this.vosk) return;

    let modelPath = this.resolveModelPath();
    if (!modelPath) {
      console.warn('[Vosk] 未找到模型文件，尝试默认路径');
      modelPath = this.modelPath;
    }

    try {
      this.model = new this.vosk.Model(modelPath);
      this.isLoaded = true;
      console.log('[Vosk] 模型加载成功:', modelPath);
      this.initRecognizer();
      this.emit('ready', { available: true, engine: 'vosk' });
    } catch (err) {
      console.error('[Vosk] 模型加载失败:', (err as Error).message);
      this.isLoaded = false;
      this.available = false;
      this.emit('error', '模型加载失败: ' + (err as Error).message);
    }
  }

  private resolveModelPath(): string | null {
    const searchPaths = [
      this.modelPath,
      path.join(__dirname, '..', '..', '..', 'models', 'vosk-model-small-cn-0.22'),
      path.join(__dirname, '..', '..', '..', 'models', 'vosk-model-cn-0.22'),
      path.join(process.resourcesPath || '', 'models', 'vosk-model-small-cn-0.22'),
    ];

    for (const p of searchPaths) {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const amFile = path.join(p, 'am');
        if (fs.existsSync(amFile) || fs.existsSync(path.join(p, 'conf', 'model.conf'))) {
          return p;
        }
      }
    }
    return null;
  }

  private initRecognizer(): void {
    if (!this.model || !this.vosk) return;

    try {
      const config: any = {
        model: this.model,
        sampleRate: this.sampleRate,
      };

      if (this.hotwordWords.length > 0) {
        config.grammar = this.hotwordWords;
      }

      this.recognizer = new this.vosk.Recognizer(config);
      this.recognizer.SetWords(true);
    } catch (err) {
      console.error('[Vosk] 识别器初始化失败:', (err as Error).message);
    }
  }

  start(): void {
    if (!this.recognizer || !this.isLoaded) {
      this.emit('error', '引擎未就绪');
      return;
    }
    this.isRecognizing = true;
    this.partialBuffer = '';
  }

  stop(): string {
    this.isRecognizing = false;
    if (!this.recognizer) return this.partialBuffer;

    try {
      const result = this.recognizer.FinalResult();
      const text = this.parseResult(result);
      // 重置识别器以准备下一次
      this.recognizer.Reset();
      this.partialBuffer = '';
      return text || this.partialBuffer;
    } catch (err) {
      console.error('[Vosk] 停止识别出错:', err);
      return this.partialBuffer;
    }
  }

  feedAudio(data: Float32Array): void {
    if (!this.isRecognizing || !this.recognizer) return;

    try {
      const accept = this.recognizer.AcceptWaveform(data);
      if (accept) {
        const result = this.recognizer.Result();
        const text = this.parseResult(result);
        if (text) {
          this.emit('final', text);
          this.partialBuffer = '';
        }
      } else {
        const partial = this.recognizer.PartialResult();
        const text = this.parsePartial(partial);
        if (text && text !== this.partialBuffer) {
          this.partialBuffer = text;
          this.emit('partial', text);
        }
      }
    } catch (err) {
      // 持续识别中偶尔的错误不中断流程
    }
  }

  private parseResult(result: any): string {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed.text || '';
    } catch {
      return String(result || '');
    }
  }

  private parsePartial(partial: any): string {
    try {
      const parsed = typeof partial === 'string' ? JSON.parse(partial) : partial;
      return parsed.partial || '';
    } catch {
      return String(partial || '');
    }
  }

  setHotwords(words: string[]): void {
    this.hotwordWords = words;
    if (this.recognizer) {
      this.recognizer.Reset();
      this.initRecognizer();
    }
  }

  isAvailable(): boolean {
    return this.available && this.isLoaded;
  }

  getStatus(): { type: string; available: boolean; modelLoaded: boolean } {
    return {
      type: 'vosk',
      available: this.available,
      modelLoaded: this.isLoaded,
    };
  }

  on(event: VoskEngineEvent, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: VoskEngineEvent, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: VoskEngineEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[Vosk] 事件处理错误 (${event}):`, err);
      }
    });
  }

  destroy(): void {
    this.isRecognizing = false;
    if (this.recognizer) {
      try {
        this.recognizer.Free();
      } catch (_) {}
      this.recognizer = null;
    }
    if (this.model) {
      try {
        this.model.Free();
      } catch (_) {}
      this.model = null;
    }
    this.listeners.clear();
    this.isLoaded = false;
  }
}
