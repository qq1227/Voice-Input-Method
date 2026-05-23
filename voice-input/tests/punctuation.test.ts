/**
 * 标点恢复引擎 - 单元测试
 *
 * 覆盖：正向流程、异常输入、边界条件
 * 测试目标：PunctuationService 的标点恢复、语音命令、数字格式化
 */
import { PunctuationService } from '../electron/services/punctuation';

// ===== 创建测试实例 =====
const service = new PunctuationService();

// ===== 辅助函数 =====
function process(text: string): string {
  return service.process(text);
}

function punctuate(text: string): string {
  return service.punctuate(text);
}

// ====================================================
// 1. 正向流程测试 (Positive Flow)
// ====================================================
describe('正向流程 - 标点添加', () => {
  test('普通陈述句添加句号', () => {
    expect(process('今天天气不错')).toBe('今天天气不错。');
  });

  test('疑问句添加问号 (语气词 吗)', () => {
    expect(process('你吃饭了吗')).toBe('你吃饭了吗？');
  });

  test('疑问句添加问号 (疑问词 怎么)', () => {
    expect(process('怎么回事')).toBe('怎么回事？');
  });

  test('疑问句添加问号 (疑问词 为什么)', () => {
    expect(process('为什么天空是蓝色的')).toBe('为什么天空是蓝色的？');
  });

  test('疑问句添加问号 (谁)', () => {
    expect(process('谁在敲门')).toBe('谁在敲门？');
  });

  test('感叹语气添加感叹号 (太)', () => {
    expect(process('太棒了')).toBe('太棒了！');
  });

  test('感叹语气添加感叹号 (真)', () => {
    expect(process('真漂亮')).toBe('真漂亮！');
  });

  test('感叹语气添加感叹号 (居然)', () => {
    expect(process('居然这么简单')).toBe('居然这么简单！');
  });

  test('已以句号结尾时不重复添加', () => {
    expect(process('你好。')).toBe('你好。');
  });

  test('已以问号结尾时不重复添加', () => {
    expect(process('你好吗？')).toBe('你好吗？');
  });

  test('已以感叹号结尾时不重复添加', () => {
    expect(process('太好了！')).toBe('太好了！');
  });

  test('已以省略号结尾时不重复添加', () => {
    expect(process('这个嘛……')).toBe('这个嘛……');
  });
});

// ====================================================
// 2. 语音命令测试 (Voice Commands)
// ====================================================
describe('正向流程 - 语音命令', () => {
  test('"逗号" → ，', () => {
    expect(process('今天逗号明天')).toBe('今天，明天。');
  });

  test('"句号" → 。', () => {
    expect(process('再见句号')).toBe('再见。');
  });

  test('"问号" → ？', () => {
    expect(process('真的吗问号')).toBe('真的吗？');
  });

  test('"感叹号" → ！', () => {
    expect(process('太棒了感叹号')).toBe('太棒了！');
  });

  test('"冒号" → ：', () => {
    expect(process('他说冒号你好')).toBe('他说：你好。');
  });

  test('"at符号" → @', () => {
    expect(process('请联系at符号张三')).toBe('请联系@张三。');
  });

  test('"百分号" → %', () => {
    expect(process('增长了百分号五十')).toBe('增长了%五十。');
  });

  test('多重语音命令组合', () => {
    expect(process('今天逗号明天逗号后天句号')).toBe('今天，明天，后天。');
  });
});

// ====================================================
// 3. 边界 / 异常输入测试 (Edge Cases)
// ====================================================
describe('边界/异常输入', () => {
  test('空字符串返回空', () => {
    expect(process('')).toBe('');
  });

  test('仅空白字符返回空白字符', () => {
    expect(process('   ')).toBe('   。');
  });

  test('纯数字添加句号', () => {
    expect(process('123')).toBe('123。');
  });

  test('仅特殊字符', () => {
    expect(process('@#$%')).toBe('@#$%。');
  });

  test('超长文本不崩溃', () => {
    const long = '你好'.repeat(1000);
    const result = process(long);
    expect(result).toContain('你好');
    expect(result.length).toBeGreaterThan(2000);
  });

  test('null 类似输入不崩溃', () => {
    expect(process('null')).toBe('null。');
  });

  test('undefined 类似输入不崩溃', () => {
    expect(process('undefined')).toBe('undefined。');
  });

  test('Unicode 字符保留', () => {
    const result = process('🌞今天天气不错🌛');
    expect(result).toContain('🌞');
    expect(result).toContain('🌛');
  });
});

// ====================================================
// 4. Punctuate 方法测试 (不带数字格式化的基础标点)
// ====================================================
describe('punctuate 基础方法', () => {
  test('基础句号', () => {
    expect(punctuate('今天天气不错')).toBe('今天天气不错。');
  });

  test('已有点标点不覆盖', () => {
    expect(punctuate('你好。')).toBe('你好。');
  });
});

// ====================================================
// 5. 标点段落方法测试
// ====================================================
describe('punctuateParagraph 段落方法', () => {
  test('段落多句处理', () => {
    const input = '今天天气不错你吃饭了吗太棒了';
    const result = service.punctuateParagraph(input);
    // "太棒了"结尾 → 感叹号
    expect(result).toMatch(/[。！？]$/);
  });

  test('段落以起始词分割', () => {
    const input = '我今天很开心但是明天要上班';
    const result = service.punctuateParagraph(input);
    expect(result).toContain('。');
  });

  test('段落空字符串', () => {
    expect(service.punctuateParagraph('')).toBe('');
  });
});

// ====================================================
// 6. formatNumbers 数字格式化测试
// ====================================================
describe('formatNumbers 数字格式化', () => {
  test('金额格式化 X块Y分', () => {
    expect(service.formatNumbers('一共100块5毛')).toBe('一共100元5毛');
  });

  test('温度格式化 X度', () => {
    expect(service.formatNumbers('今天36度')).toBe('今天36°C');
  });
});

// ====================================================
// 7. 综合流程测试 (Real-world scenarios)
// ====================================================
describe('综合场景测试', () => {
  test('日常对话场景', () => {
    const input = '今天天气真好啊我们去公园散步吧';
    const result = process(input);
    expect(result).toMatch(/[。！？]$/);
    expect(result).toContain('今天天气');
  });

  test('办公场景 - 会议记录', () => {
    const input = '大家好今天我们来讨论一下项目进度首先张三汇报一下开发情况';
    const result = process(input);
    expect(result).toMatch(/[。！？]$/);
    expect(result).toContain('大家好');
  });

  test('带语音命令的混合输入', () => {
    const input = '第一项逗号第二项逗号第三项目号';
    const result = process(input);
    expect(result).toContain('，');
    expect(result).toContain('。');
  });

  test('连续短句', () => {
    const result = process('你好吗我很好谢谢');
    // "我很好谢谢" 以"谢谢"结尾，不是疑问词
    expect(result).toMatch(/[。！？]$/);
  });
});
