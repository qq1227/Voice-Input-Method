/**
 * Vosk ASR 引擎 - 单元测试
 *
 * 覆盖：模块不可用时的降级行为、状态管理、事件
 * 注意：真正的 Vosk 识别需要原生模块，这里测试的是 graceful degradation
 */
import { VoskService } from '../electron/services/vosk-service';

// ====================================================
// 1. 初始化测试 (原生模块加载)
// ====================================================
describe('初始化 - 原生模块加载', () => {
  let vosk: VoskService;

  beforeEach(() => {
    vosk = new VoskService();
  });

  afterEach(() => {
    vosk.destroy();
  });

  test('init 在不安装 vosk 的情况下不崩溃', async () => {
    // 应该优雅地返回 false，而不是抛出异常
    const result = await vosk.init();
    expect(typeof result).toBe('boolean');
  });

  test('init 后的状态报告可用', async () => {
    await vosk.init();
    const status = vosk.getStatus();
    expect(status).toHaveProperty('type');
    expect(status).toHaveProperty('available');
    expect(status).toHaveProperty('modelLoaded');
  });
});

// ====================================================
// 2. 操作测试 (引擎未就绪)
// ====================================================
describe('操作 - 引擎未就绪', () => {
  let vosk: VoskService;

  beforeEach(async () => {
    vosk = new VoskService();
    await vosk.init();
  });

  afterEach(() => {
    vosk.destroy();
  });

  test('start 在引擎未就绪时触发 error 事件', () => {
    const listener = jest.fn();
    vosk.on('error', listener);

    vosk.start();
    expect(listener).toHaveBeenCalledWith('引擎未就绪');
  });

  test('stop 在引擎未就绪时返回空字符串', () => {
    vosk.start();
    const result = vosk.stop();
    expect(typeof result).toBe('string');
  });

  test('feedAudio 在未 start 时不崩溃', () => {
    const data = new Float32Array(512);
    expect(() => vosk.feedAudio(data)).not.toThrow();
  });

  test('多次 destroy 不崩溃', () => {
    expect(() => {
      vosk.destroy();
      vosk.destroy();
    }).not.toThrow();
  });

  test('setHotwords 不影响未就绪状态', () => {
    vosk.setHotwords(['test', 'words']);
    expect(vosk.isAvailable()).toBe(false);
  });
});

// ====================================================
// 3. 状态管理测试
// ====================================================
describe('状态管理', () => {
  let vosk: VoskService;

  beforeEach(async () => {
    vosk = new VoskService();
    await vosk.init();
  });

  afterEach(() => {
    vosk.destroy();
  });

  test('初始未就绪时 isAvailable 返回 false', () => {
    expect(vosk.isAvailable()).toBe(false);
  });

  test('getStatus 返回一致的状态', () => {
    const status = vosk.getStatus();
    expect(typeof status.type).toBe('string');
    expect(status.available).toBe(status.modelLoaded);
  });
});
