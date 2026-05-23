/**
 * 完整识别流程 - 集成测试
 *
 * 测试标点 + 热词 + VAD 的协作流程
 * 注意：不涉及真正的 ASR 识别，只测试各模块的集成
 */
import { PunctuationService } from '../electron/services/punctuation';
import { HotwordManager } from '../electron/services/hotword-manager';
import { VadService } from '../electron/services/vad-service';
import * as path from 'path';
import * as os from 'os';

// ====================================================
// 1. 标点 + 热词协同测试
// ====================================================
describe('标点 + 热词协同', () => {
  const punct = new PunctuationService();

  test('热词纠错在标点处理后保留标点', () => {
    const mgr = new HotwordManager(path.join(os.tmpdir(), 'voice-input-int-' + Date.now()));
    mgr.add('旧版', 5, '新版');

    const text = '我们发布了旧版';
    const punctuated = punct.process(text);       // → "我们发布了旧版。"
    const corrected = mgr.applyCorrections(punctuated); // → "我们发布了新版。"

    expect(corrected).toBe('我们发布了新版。');
    mgr.destroy();
  });

  test('空数据流经过全部处理不崩溃', () => {
    const mgr = new HotwordManager(path.join(os.tmpdir(), 'voice-input-int2-' + Date.now()));
    const empty = '';
    const step1 = punct.process(empty);
    const step2 = mgr.applyCorrections(step1);
    expect(step2).toBe('');
    mgr.destroy();
  });
});

// ====================================================
// 2. VAD + 标点时序测试
// ====================================================
describe('VAD + 标点时序模拟', () => {
  let vad: VadService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000000);
    vad = new VadService({ silenceTimeoutMs: 500, minSpeechDurationMs: 0 });
    vad.start();
  });

  afterEach(() => {
    vad.destroy();
    jest.useRealTimers();
  });

  test('模拟一段完整对话: 开始 → 说话 → 停止 → 加标点', () => {
    const punct = new PunctuationService();
    const segments: string[] = [];

    // 模拟用户说话
    for (let i = 0; i < 10; i++) {
      const voiceFrame = new Float32Array(512);
      for (let j = 0; j < 512; j++) {
        voiceFrame[j] = Math.sin(2 * Math.PI * 200 * j / 16000) * 0.5;
      }
      vad.processAudio(voiceFrame);
    }

    // VAD 应该在说话状态
    expect(vad.getState()).toBe('speaking');

    // 模拟静音
    for (let i = 0; i < 5; i++) {
      const silent = new Float32Array(512);
      vad.processAudio(silent);
    }

    // 推进时间到超时
    jest.advanceTimersByTime(600);
    const finalState = vad.processAudio(new Float32Array(512));
    expect(finalState).toBe('pending_finalize');

    // 对识别文本加标点
    const recognizedText = '今天天气真好啊';
    const finalText = punct.process(recognizedText);
    expect(finalText).toMatch(/[。！？]$/);
  });
});
