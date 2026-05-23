import * as fs from 'fs';
import * as path from 'path';
import { Hotword } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 热词管理系统
 *
 * 管理用户自定义热词，支持：
 * - 热词的增删改查
 * - 权重管理 (1-10)
 * - 纠错映射（语音修改）
 * - 持久化存储到本地文件
 * - 注入到 Vosk 识别器
 */
export class HotwordManager {
  private hotwords: Map<string, Hotword> = new Map();
  private storagePath: string;
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  constructor(storageDir?: string) {
    const dir = storageDir || path.join(this.getAppDataPath(), 'hotwords');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.storagePath = path.join(dir, 'hotwords.json');
    this.load();
    this.startAutoPersist();
  }

  private getAppDataPath(): string {
    const appData = process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(require('os').homedir(), 'Library', 'Application Support')
        : path.join(require('os').homedir(), '.local', 'share'));
    return path.join(appData, 'voice-input');
  }

  // ===== 增删改查 =====

  add(word: string, weight: number = 5, correction?: string): Hotword {
    // 去重：如果已存在相同词汇，更新权重
    const existing = this.findByWord(word);
    if (existing) {
      existing.weight = Math.max(1, Math.min(10, weight));
      if (correction) existing.correction = correction;
      existing.hitCount = 0;
      this.save();
      return existing;
    }

    const hotword: Hotword = {
      id: uuidv4(),
      word,
      weight: Math.max(1, Math.min(10, weight)),
      correction,
      createdAt: Date.now(),
      hitCount: 0,
    };

    this.hotwords.set(hotword.id, hotword);
    this.save();
    return hotword;
  }

  remove(id: string): boolean {
    const deleted = this.hotwords.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  update(id: string, updates: Partial<Pick<Hotword, 'word' | 'weight' | 'correction'>>): Hotword | null {
    const hotword = this.hotwords.get(id);
    if (!hotword) return null;

    if (updates.word !== undefined) hotword.word = updates.word;
    if (updates.weight !== undefined) hotword.weight = Math.max(1, Math.min(10, updates.weight));
    if (updates.correction !== undefined) hotword.correction = updates.correction;

    this.save();
    return hotword;
  }

  getAll(): Hotword[] {
    return Array.from(this.hotwords.values())
      .sort((a, b) => b.weight - a.weight);
  }

  get(id: string): Hotword | undefined {
    return this.hotwords.get(id);
  }

  findByWord(word: string): Hotword | undefined {
    return Array.from(this.hotwords.values()).find(
      (h) => h.word === word
    );
  }

  // ===== 统计 =====

  incrementHit(id: string): void {
    const hotword = this.hotwords.get(id);
    if (hotword) {
      hotword.hitCount++;
      this.save();
    }
  }

  getTopFrequent(limit: number = 20): Hotword[] {
    return this.getAll()
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }

  // ===== 导出到 Vosk 格式 =====

  /**
   * 获取热词列表（词汇列表，用于注入Vosk语法）
   */
  getWordsForInjection(): string[] {
    return Array.from(this.hotwords.values())
      .filter((h) => h.weight > 3)
      .map((h) => h.word);
  }

  /**
   * 获取纠错映射表
   */
  getCorrectionMap(): Map<string, string> {
    const map = new Map<string, string>();
    this.hotwords.forEach((h) => {
      if (h.correction) {
        map.set(h.word, h.correction);
      }
    });
    return map;
  }

  /**
   * 对识别结果应用纠错
   */
  applyCorrections(text: string): string {
    let result = text;
    this.hotwords.forEach((h) => {
      if (h.correction && result.includes(h.word)) {
        result = result.replace(new RegExp(h.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), h.correction);
      }
    });
    return result;
  }

  // ===== 持久化 =====

  private load(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const items: Hotword[] = JSON.parse(data);
        this.hotwords.clear();
        items.forEach((item) => {
          if (item.id && item.word) {
            this.hotwords.set(item.id, item);
          }
        });
        console.log(`[HotwordManager] 已加载 ${this.hotwords.size} 个热词`);
      }
    } catch (err) {
      console.warn('[HotwordManager] 加载热词失败:', (err as Error).message);
    }
  }

  private save(): void {
    try {
      const data = JSON.stringify(this.getAll(), null, 2);
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, data, 'utf-8');
    } catch (err) {
      console.error('[HotwordManager] 保存热词失败:', (err as Error).message);
    }
  }

  private startAutoPersist(): void {
    this.persistTimer = setInterval(() => {
      // 每5分钟自动保存一次（save()已经实时保存，此为备份）
    }, 300000);
  }

  clear(): void {
    this.hotwords.clear();
    this.save();
  }

  destroy(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    this.save();
  }
}
