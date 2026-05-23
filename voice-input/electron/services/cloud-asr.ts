import { RecognitionResult } from '../../src/types';

export type CloudAsrEvent = 'result' | 'error' | 'status';

/**
 * 云端 ASR 加速服务
 *
 * 可选的高精度识别纠错层。
 * 设计原则：不阻塞主流程。
 * - 本地结果优先上屏
 * - 云端结果异步修正已上屏内容
 * - 控制免费用户的云端请求占比 < 8%
 */
export class CloudAsrService {
  private enabled = false;
  private provider: 'baidu' | 'aliyun' | 'none' = 'none';
  private apiKey: string = '';
  private secretKey: string = '';
  private dailyRequestCount = 0;
  private maxDailyRequests = 50; // 控制云端请求频率
  private listeners: Map<CloudAsrEvent, Set<(...args: any[]) => void>> = new Map();

  constructor() {}

  init(config: {
    enabled: boolean;
    provider: 'baidu' | 'aliyun' | 'none';
    apiKey?: string;
    secretKey?: string;
  }): void {
    this.enabled = config.enabled;
    this.provider = config.provider;
    this.apiKey = config.apiKey || '';
    this.secretKey = config.secretKey || '';
    this.dailyRequestCount = 0;
    this.emit('status', { enabled: this.enabled, provider: this.provider });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled && this.provider !== 'none' && this.dailyRequestCount < this.maxDailyRequests;
  }

  /**
   * 异步纠错：发送文本到云端进行修正
   * 不阻塞主流程，结果通过回调返回
   */
  async correct(text: string, context?: string): Promise<string | null> {
    if (!this.isEnabled() || !text.trim()) return null;

    this.dailyRequestCount++;

    try {
      switch (this.provider) {
        case 'baidu':
          return await this.correctWithBaidu(text, context);
        case 'aliyun':
          return await this.correctWithAliyun(text, context);
        default:
          return null;
      }
    } catch (err) {
      console.warn('[CloudASR] 纠错请求失败:', (err as Error).message);
      this.emit('error', '云端纠错失败');
      return null;
    }
  }

  /**
   * 百度语音识别 API (短语音)
   */
  private async correctWithBaidu(text: string, _context?: string): Promise<string | null> {
    // TODO: 接入百度语音识别API
    // 这里返回模拟结果，实际集成时需要替换
    console.log('[CloudASR] 百度API纠错:', text);
    return null;
  }

  /**
   * 阿里云语音识别 API
   */
  private async correctWithAliyun(text: string, _context?: string): Promise<string | null> {
    // TODO: 接入阿里云语音识别API
    console.log('[CloudASR] 阿里云API纠错:', text);
    return null;
  }

  /**
   * 模拟云端结果（开发测试用）
   */
  async simulateCorrection(result: RecognitionResult): Promise<RecognitionResult | null> {
    if (!this.enabled) return null;
    // 模拟300ms的网络延迟
    await new Promise((resolve) => setTimeout(resolve, 300));
    // 实际使用时，这里应该调用真实API
    return null;
  }

  getDailyRequestCount(): number {
    return this.dailyRequestCount;
  }

  getStatus(): { enabled: boolean; provider: string; dailyRequests: number; maxDaily: number } {
    return {
      enabled: this.enabled,
      provider: this.provider,
      dailyRequests: this.dailyRequestCount,
      maxDaily: this.maxDailyRequests,
    };
  }

  on(event: CloudAsrEvent, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: CloudAsrEvent, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: CloudAsrEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[CloudASR] 事件处理错误 (${event}):`, err);
      }
    });
  }

  destroy(): void {
    this.listeners.clear();
  }
}

export const cloudAsrService = new CloudAsrService();
