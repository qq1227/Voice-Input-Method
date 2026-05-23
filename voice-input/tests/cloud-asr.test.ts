/**
 * 云端 ASR 服务 - 单元测试
 *
 * 覆盖：启用/禁用、请求计数、配置管理
 * 测试目标：CloudAsrService 的状态和限流逻辑
 */
import { CloudAsrService } from '../electron/services/cloud-asr';

// ====================================================
// 1. 正向流程测试
// ====================================================
describe('正向流程 - 配置管理', () => {
  let service: CloudAsrService;

  beforeEach(() => {
    service = new CloudAsrService();
  });

  afterEach(() => {
    service.destroy();
  });

  test('初始状态为 disabled', () => {
    const status = service.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.provider).toBe('none');
  });

  test('init 后状态正确', () => {
    service.init({ enabled: true, provider: 'baidu', apiKey: 'test-key' });
    const status = service.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.provider).toBe('baidu');
  });

  test('init 禁用状态', () => {
    service.init({ enabled: false, provider: 'aliyun' });
    expect(service.isEnabled()).toBe(false);
  });

  test('setEnabled 动态切换', () => {
    service.init({ enabled: false, provider: 'baidu' });
    expect(service.isEnabled()).toBe(false);

    service.setEnabled(true);
    expect(service.isEnabled()).toBe(true);
  });
});

// ====================================================
// 2. 请求限流测试
// ====================================================
describe('请求限流控制', () => {
  let service: CloudAsrService;

  beforeEach(() => {
    service = new CloudAsrService();
    service.init({ enabled: true, provider: 'baidu' });
  });

  afterEach(() => {
    service.destroy();
  });

  test('每日请求初始为 0', () => {
    expect(service.getDailyRequestCount()).toBe(0);
  });

  test('correct 调用增加计数', async () => {
    await service.correct('测试文本');
    expect(service.getDailyRequestCount()).toBeGreaterThanOrEqual(1);
  });

  test('isEnabled 返回 false 时 correct 返回 null', async () => {
    service.setEnabled(false);
    const result = await service.correct('测试');
    expect(result).toBeNull();
  });
});

// ====================================================
// 3. 边界 / 异常输入测试
// ====================================================
describe('边界/异常输入', () => {
  let service: CloudAsrService;

  beforeEach(() => {
    service = new CloudAsrService();
    service.init({ enabled: true, provider: 'baidu' });
  });

  afterEach(() => {
    service.destroy();
  });

  test('空文本 correct 返回 null', async () => {
    const result = await service.correct('');
    expect(result).toBeNull();
  });

  test('仅空白 correct 返回 null', async () => {
    const result = await service.correct('   ');
    expect(result).toBeNull();
  });

  test('状态报告包含正确字段', () => {
    const status = service.getStatus();
    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('provider');
    expect(status).toHaveProperty('dailyRequests');
    expect(status).toHaveProperty('maxDaily');
  });
});

// ====================================================
// 4. 事件通知测试
// ====================================================
describe('事件通知', () => {
  let service: CloudAsrService;

  beforeEach(() => {
    service = new CloudAsrService();
  });

  afterEach(() => {
    service.destroy();
  });

  test('init 触发 status 事件', () => {
    const listener = jest.fn();
    service.on('status', listener);

    service.init({ enabled: true, provider: 'aliyun' });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, provider: 'aliyun' })
    );
  });
});
