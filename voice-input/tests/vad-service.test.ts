/**
 * 语音活动检测 (VAD) 引擎 - 单元测试
 *
 * 覆盖：状态转换、静音检测、自适应阈值、边界条件
 * 测试目标：VadService 的状态机、能量检测、事件通知
 */
import { VadService } from '../electron/services/vad-service';
import { VadState} from '../src/types';

// ===== 辅助函数 =====

/** 生成指定能量级别的音频帧 (Float32Array, 512 samples) */
function createFrame(rms: number, length: number = 512): Float32Array {
  const frame = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // 白噪声 * rms 能量
    frame[i] = (Math.random() - 0.5) * 2 * rms;
  }
  return frame;
}

/** 生成纯静音帧 (全零) */
function silentFrame(length: number = 512): Float32Array {
  return new Float32Array(length);
}

/** 生成正弦波帧 (模拟人声) */
function voiceFrame(freq: number = 200, sampleRate: number = 16000, length: number = 512): Float32Array {
  const frame = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    frame[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.5;
  }
  return frame;
}

// ====================================================
// 1. 正向流程测试
// ====================================================
describe('正向流程 - 状态转换', () => {
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

  test('初始状态为 idle', () => {
    expect(vad.getState()).toBe('idle');
  });

  test('检测到语音 → idle → speaking', () => {
    const frame = voiceFrame(200);
    const state = vad.processAudio(frame);
    expect(state).toBe('speaking');
  });

  test('静音后超时 → speaking → pending_finalize', () => {
    // 先说话
    vad.processAudio(voiceFrame(200));
    expect(vad.getState()).toBe('speaking');

    // 开始静音
    vad.processAudio(silentFrame());
    expect(vad.getState()).toBe('speaking');

    // 时间推进超过静音超时
    jest.advanceTimersByTime(600);

    // 下一个静音帧触发 pending_finalize
    const state = vad.processAudio(silentFrame());
    expect(state).toBe('pending_finalize');
  });

  test('pending_finalize 后检测到语音回到 speaking', () => {
    // 说话 → 静音 → pending_finalize
    vad.processAudio(voiceFrame(200));
    vad.processAudio(silentFrame());
    jest.advanceTimersByTime(600);
    vad.processAudio(silentFrame());
    expect(vad.getState()).toBe('pending_finalize');

    // 再次检测到语音 → 回到 speaking
    const state = vad.processAudio(voiceFrame(200));
    expect(state).toBe('speaking');
  });
});

// ====================================================
// 2. VAD 事件通知测试
// ====================================================
describe('事件通知', () => {
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

  test('stateChange 事件在切换时触发', () => {
    const listener = jest.fn();
    vad.on('stateChange', listener);

    vad.processAudio(voiceFrame(200));
    expect(listener).toHaveBeenCalledWith('speaking');
  });

  test('audioLevel 事件在每帧触发', () => {
    const listener = jest.fn();
    vad.on('audioLevel', listener);

    vad.processAudio(createFrame(0.3));
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0]).toBeGreaterThan(0);
  });

  test('speechStart 事件在检测到语音时触发', () => {
    const listener = jest.fn();
    vad.on('speechStart', listener);

    vad.processAudio(voiceFrame(200));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('speechEnd 事件在静音超时时触发', () => {
    const listener = jest.fn();
    vad.on('speechEnd', listener);

    vad.processAudio(voiceFrame(200));
    vad.processAudio(silentFrame());
    jest.advanceTimersByTime(600);
    vad.processAudio(silentFrame());

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ====================================================
// 3. 异常 / 边界输入测试
// ====================================================
describe('边界/异常输入', () => {
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

  test('空数组不改变状态', () => {
    const empty = new Float32Array(0);
    const state = vad.processAudio(empty);
    expect(state).toBe('idle');
  });

  test('全零帧 (完美静音) 不触发语音', () => {
    for (let i = 0; i < 10; i++) {
      vad.processAudio(silentFrame());
    }
    expect(vad.getState()).toBe('idle');
  });

  test('极低能量帧不触发语音 (阈值过滤)', () => {
    const veryLow = createFrame(0.001);
    for (let i = 0; i < 20; i++) {
      vad.processAudio(veryLow);
    }
    expect(vad.getState()).toBe('idle');
  });

  test('未 start 时不处理', () => {
    const vad2 = new VadService();
    const state = vad2.processAudio(createFrame(0.5));
    expect(state).toBe('idle');
    vad2.destroy();
  });

  test('stop 后不处理音频', () => {
    vad.stop();
    const state = vad.processAudio(createFrame(0.5));
    expect(state).toBe('idle');
  });
});

// ====================================================
// 4. 手动模式测试
// ====================================================
describe('手动模式 (VAD mode=manual)', () => {
  let vad: VadService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000000);
    vad = new VadService({ mode: 'manual', silenceTimeoutMs: 200, minSpeechDurationMs: 0 });
    vad.start();
  });

  afterEach(() => {
    vad.destroy();
    jest.useRealTimers();
  });

  test('手动模式下静音不自动进入 pending_finalize', () => {
    vad.processAudio(voiceFrame(200));
    expect(vad.getState()).toBe('speaking');

    vad.processAudio(silentFrame());
    jest.advanceTimersByTime(1000);
    const state = vad.processAudio(silentFrame());
    // 手动模式不应自动转换到 pending_finalize
    expect(state).toBe('speaking');
  });
});

// ====================================================
// 5. 峰值能量和噪声基底测试
// ====================================================
describe('噪声基底与自适应阈值', () => {
  let vad: VadService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000000);
    vad = new VadService({ silenceTimeoutMs: 500, threshold: 0.3, minSpeechDurationMs: 0 });
    vad.start();
  });

  afterEach(() => {
    vad.destroy();
    jest.useRealTimers();
  });

  test('前200帧建立噪声基底', () => {
    // 持续输入低噪声
    for (let i = 0; i < 250; i++) {
      vad.processAudio(createFrame(0.01));
    }
    // 状态可能在 idle 或 speaking 之间，但不应该崩溃
    expect(vad.getNoiseFloor()).toBeGreaterThan(0);
  });

  test('噪声适应后仍能检测真实语音', () => {
    // 先建立噪声基底
    for (let i = 0; i < 250; i++) {
      vad.processAudio(createFrame(0.02));
    }
    // 确保回到 idle
    vad.processAudio(silentFrame());
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < 10; i++) {
      vad.processAudio(silentFrame());
    }
    // 真正的语音 (正弦波)
    const state = vad.processAudio(voiceFrame(200));
    // 应该能检测到
    expect(state).toBe('speaking');
  });
});

// ====================================================
// 6. 配置动态修改测试
// ====================================================
describe('动态配置修改', () => {
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

  test('setConfig 更新配置', () => {
    vad.setConfig({ silenceTimeoutMs: 2000, threshold: 0.5 });
    const config = vad.getConfig();
    expect(config.silenceTimeoutMs).toBe(2000);
    expect(config.threshold).toBe(0.5);
  });

  test('更新配置后生效', () => {
    vad.setConfig({ threshold: 0.9 }); // 很高阈值

    // 中等强度语音应该无法触发
    const frame = createFrame(0.3);
    for (let i = 0; i < 5; i++) {
      vad.processAudio(frame);
    }
    expect(vad.getState()).toBe('idle');
  });
});
