import { VadState, VadConfig, DEFAULT_VAD_CONFIG } from '../../src/types';

export type VadEvent = 'stateChange' | 'audioLevel' | 'speechStart' | 'speechEnd';

/**
 * 语音活动检测 (VAD) 引擎
 *
 * 基于能量检测 + 过零率检测的简单 VAD，
 * 用于判断用户是否在说话，以及何时结束。
 * 设计目标：在安静环境下准确率高、响应快。
 */
export class VadService {
  private config: VadConfig;
  private state: VadState = 'idle';
  private speakingSince: number = 0;
  private lastSpeechTime: number = 0;
  private silenceStart: number = 0;
  private isActive = false;
  private listeners: Map<VadEvent, Set<(...args: any[]) => void>> = new Map();

  // 能量历史，用于自适应阈值
  private energyHistory: number[] = [];
  private noiseFloor: number = 0;
  private adaptationFrames: number = 0;

  constructor(config: Partial<VadConfig> = {}) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
  }

  setConfig(config: Partial<VadConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): VadConfig {
    return { ...this.config };
  }

  start(): void {
    this.isActive = true;
    this.state = 'idle';
    this.speakingSince = 0;
    this.lastSpeechTime = 0;
    this.silenceStart = 0;
    this.energyHistory = [];
    this.noiseFloor = 0;
    this.adaptationFrames = 0;
  }

  stop(): void {
    this.isActive = false;
    this.setState('idle');
  }

  /**
   * 处理音频块，返回当前 VAD 状态
   * @param pcmSamples Float32Array PCM 样本 (范围 -1.0 ~ 1.0)
   * @returns 当前 VAD 状态
   */
  processAudio(pcmSamples: Float32Array): VadState {
    if (!this.isActive) return this.state;

    const energy = this.calculateEnergy(pcmSamples);
    const threshold = this.getAdaptiveThreshold();

    // 更新音频电平 (用于UI显示)
    this.emit('audioLevel', Math.min(energy * 5, 1.0));

    // 自适应噪声估计 (前200帧)
    if (this.adaptationFrames < 200) {
      this.energyHistory.push(energy);
      this.adaptationFrames++;
      if (this.adaptationFrames === 200) {
        this.noiseFloor = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        this.energyHistory = [];
      }
    } else {
      // 更新噪声基底（慢速跟踪）
      if (energy < this.noiseFloor * 1.5) {
        this.noiseFloor = this.noiseFloor * 0.95 + energy * 0.05;
      }
    }

    const isSpeech = energy > threshold;

    switch (this.state) {
      case 'idle':
        if (isSpeech) {
          const now = Date.now();
          this.speakingSince = now;
          this.lastSpeechTime = now;
          this.setState('speaking');
          this.emit('speechStart');
        }
        break;

      case 'speaking':
        if (isSpeech) {
          this.lastSpeechTime = Date.now();
          this.silenceStart = 0;
        } else if (this.config.mode === 'auto') {
          if (this.silenceStart === 0) {
            this.silenceStart = Date.now();
          } else if (Date.now() - this.silenceStart > this.config.silenceTimeoutMs) {
            this.setState('pending_finalize');
            this.emit('speechEnd');
          }
        }
        break;

      case 'pending_finalize':
        if (isSpeech) {
          this.lastSpeechTime = Date.now();
          this.silenceStart = 0;
          this.setState('speaking');
          this.emit('speechStart');
        }
        break;
    }

    return this.state;
  }

  private calculateEnergy(samples: Float32Array): number {
    let sumSquares = 0;
    let zeroCrossings = 0;

    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
      if (i > 0 && Math.sign(samples[i]) !== Math.sign(samples[i - 1])) {
        zeroCrossings++;
      }
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    const zcr = zeroCrossings / samples.length;

    // 过零率过高通常是噪声，降低能量值
    const noisePenalty = zcr > 0.3 ? 0.5 : 1.0;

    return rms * noisePenalty;
  }

  private getAdaptiveThreshold(): number {
    const baseThreshold = this.config.threshold;
    const adaptiveFloor = this.noiseFloor * 2.5;
    // 使用噪声基底和配置阈值的最大值
    return Math.max(baseThreshold, adaptiveFloor, 0.02);
  }

  private setState(newState: VadState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('stateChange', newState);
    }
  }

  getState(): VadState {
    return this.state;
  }

  getSpeakingDuration(): number {
    if (this.state === 'idle') return 0;
    return Date.now() - this.speakingSince;
  }

  getNoiseFloor(): number {
    return this.noiseFloor;
  }

  on(event: VadEvent, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: VadEvent, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: VadEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[VAD] 事件处理错误 (${event}):`, err);
      }
    });
  }

  destroy(): void {
    this.isActive = false;
    this.listeners.clear();
  }
}
