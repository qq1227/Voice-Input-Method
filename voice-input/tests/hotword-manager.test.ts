/**
 * 热词管理系统 - 单元测试
 *
 * 覆盖：增删改查、权重管理、纠错映射、持久化
 * 测试目标：HotwordManager 的核心业务逻辑
 */
import { HotwordManager } from '../electron/services/hotword-manager';
import * as path from 'path';
import * as os from 'os';

// ===== 在每个测试中创建独立实例 =====
function createManager(): HotwordManager {
  const tempDir = path.join(os.tmpdir(), 'voice-input-test-' + Date.now());
  return new HotwordManager(tempDir);
}

// ====================================================
// 1. 正向流程 - 增删改查
// ====================================================
describe('正向流程 - 增删改查', () => {
  let mgr: HotwordManager;

  beforeEach(() => {
    mgr = createManager();
  });

  afterEach(() => {
    mgr.destroy();
  });

  test('添加热词返回带 ID 的对象', () => {
    const hw = mgr.add('语音识别', 8);
    expect(hw.id).toBeTruthy();
    expect(hw.word).toBe('语音识别');
    expect(hw.weight).toBe(8);
    expect(hw.createdAt).toBeGreaterThan(0);
  });

  test('通过 ID 获取热词', () => {
    const added = mgr.add('深度学习', 9);
    const found = mgr.get(added.id);
    expect(found).toBeTruthy();
    expect(found!.word).toBe('深度学习');
  });

  test('通过词汇查找热词', () => {
    mgr.add('机器学习', 7);
    const found = mgr.findByWord('机器学习');
    expect(found).toBeTruthy();
    expect(found!.weight).toBe(7);
  });

  test('删除热词成功返回 true', () => {
    const hw = mgr.add('临时词');
    const result = mgr.remove(hw.id);
    expect(result).toBe(true);
    expect(mgr.get(hw.id)).toBeUndefined();
  });

  test('更新热词权重', () => {
    const hw = mgr.add('重要词汇', 5);
    mgr.update(hw.id, { weight: 10 });
    expect(mgr.get(hw.id)!.weight).toBe(10);
  });

  test('更新热词纠错映射', () => {
    const hw = mgr.add('张小姐', 5);
    mgr.update(hw.id, { correction: '王小姐' });
    expect(mgr.get(hw.id)!.correction).toBe('王小姐');
  });

  test('获取全部热词按权重降序', () => {
    mgr.add('低权重', 1);
    mgr.add('高权重', 10);
    mgr.add('中权重', 5);
    const all = mgr.getAll();
    expect(all[0].weight).toBe(10);
    expect(all[1].weight).toBe(5);
    expect(all[2].weight).toBe(1);
  });
});

// ====================================================
// 2. 正向流程 - 纠错功能
// ====================================================
describe('正向流程 - 纠错应用', () => {
  let mgr: HotwordManager;

  beforeEach(() => {
    mgr = createManager();
  });

  afterEach(() => {
    mgr.destroy();
  });

  test('applyCorrections 替换纠错词汇', () => {
    mgr.add('张小姐', 5, '王小姐');
    const result = mgr.applyCorrections('你好张小姐');
    expect(result).toBe('你好王小姐');
  });

  test('无纠错映射时文本不变', () => {
    mgr.add('普通词', 5);
    const result = mgr.applyCorrections('这是一个普通词');
    expect(result).toBe('这是一个普通词');
  });

  test('多个纠错同时应用', () => {
    mgr.add('A公司', 5, 'B公司');
    mgr.add('旧产品', 3, '新产品');
    const result = mgr.applyCorrections('A公司发布了旧产品');
    expect(result).toBe('B公司发布了新产品');
  });

  test('getWordsForInjection 返回高权重词汇', () => {
    mgr.add('热词A', 8);
    mgr.add('热词B', 3);  // 低权重，应被过滤
    mgr.add('热词C', 5);
    const words = mgr.getWordsForInjection();
    expect(words).toContain('热词A');
    expect(words).not.toContain('热词B'); // 权重3 < 3 的阈值
    expect(words).toContain('热词C');
  });

  test('getCorrectionMap 返回正确映射', () => {
    mgr.add('旧名', 5, '新名');
    mgr.add('无纠错词', 5);
    const map = mgr.getCorrectionMap();
    expect(map.get('旧名')).toBe('新名');
    expect(map.has('无纠错词')).toBe(false);
  });
});

// ====================================================
// 3. 边界 / 异常输入测试
// ====================================================
describe('边界/异常输入', () => {
  let mgr: HotwordManager;

  beforeEach(() => {
    mgr = createManager();
  });

  afterEach(() => {
    mgr.destroy();
  });

  test('删除不存在的 ID 返回 false', () => {
    const result = mgr.remove('non-existent-id');
    expect(result).toBe(false);
  });

  test('获取不存在的 ID 返回 undefined', () => {
    const found = mgr.get('non-existent-id');
    expect(found).toBeUndefined();
  });

  test('空热词列表 getAll 返回空数组', () => {
    expect(mgr.getAll()).toEqual([]);
  });

  test('权重上限钳位到 10', () => {
    const hw = mgr.add('超重词汇', 100);
    expect(hw.weight).toBe(10);
  });

  test('权重下限钳位到 1', () => {
    const hw = mgr.add('轻词汇', -5);
    expect(hw.weight).toBe(1);
  });

  test('添加重复词汇时更新权重而非重复', () => {
    mgr.add('重复词', 3);
    mgr.add('重复词', 8);
    const all = mgr.getAll();
    expect(all.length).toBe(1);
    expect(all[0].weight).toBe(8);
  });

  test('更新不存在的 ID 返回 null', () => {
    const result = mgr.update('non-existent', { weight: 5 });
    expect(result).toBeNull();
  });

  test('清空后列表为空', () => {
    mgr.add('词1', 5);
    mgr.add('词2', 5);
    mgr.clear();
    expect(mgr.getAll()).toEqual([]);
  });

  test('命中计数递增', () => {
    const hw = mgr.add('高频词', 5);
    mgr.incrementHit(hw.id);
    mgr.incrementHit(hw.id);
    expect(mgr.get(hw.id)!.hitCount).toBe(2);
  });

  test('getTopFrequent 按命中排序', () => {
    const a = mgr.add('A', 5);
    const b = mgr.add('B', 5);
    mgr.incrementHit(a.id);
    mgr.incrementHit(a.id);
    mgr.incrementHit(a.id);
    mgr.incrementHit(b.id);
    const top = mgr.getTopFrequent(1);
    expect(top[0].word).toBe('A');
  });
});

// ====================================================
// 4. 持久化测试 (文件读写能力)
// ====================================================
describe('持久化 - 文件读写', () => {
  test('写入热词后重新读取能恢复', () => {
    const dir = path.join(os.tmpdir(), 'voice-input-persist-' + Date.now());
    const mgr1 = new HotwordManager(dir);
    mgr1.add('持久词汇', 9, '纠错后');
    mgr1.destroy();

    // 新实例读取同一目录
    const mgr2 = new HotwordManager(dir);
    const all = mgr2.getAll();
    expect(all.length).toBe(1);
    expect(all[0].word).toBe('持久词汇');
    expect(all[0].correction).toBe('纠错后');
    mgr2.destroy();
  });
});
