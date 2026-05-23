/**
 * 标点恢复引擎
 *
 * 为裸文本添加中文标点符号。
 * 使用规则引擎 + 简单统计方法，无需额外模型。
 * 支持：
 * - 自动句末标点（。！？）
 * - 语音命令（"逗号""句号"等）
 * - 数字/货币格式化
 * - 问句检测
 */
export class PunctuationService {
  // 疑问语气词（句尾）
  private questionParticles = ['吗', '呢', '吧', '啊', '呀', '嘛', '么', '怎', '何', '谁', '哪', '啥', '为什么', '怎么'];

  // 停顿词（后面加逗号）
  private pauseWords = [
    '但是', '可是', '然而', '不过', '而且', '并且', '或者', '还是',
    '因为', '所以', '虽然', '尽管', '如果', '即使', '无论', '不仅',
    '既然', '于是', '然后', '接着', '此外', '另外', '总之', '例如',
    '比如', '比方说', '首先', '其次', '最后', '一方面', '另一方面',
    '那么', '也就是说', '换句话说', '众所周知', '毫无疑问',
  ];

  // 句首词（前面加句号）
  private sentenceStartWords = [
    '但是', '可是', '然而', '不过', '而且', '并且', '虽然', '尽管',
    '如果', '因为', '所以', '于是', '然后', '此外', '另外', '总之',
    '首先', '其次', '最后', '那么', '当然', '其实', '确实', '的确',
    '毕竟', '终究', '原来', '本来', '按理说', '总的来说',
  ];

  // 连接词（前后都可能有停顿）
  private conjunctionWords = [
    '和', '与', '跟', '同', '及', '以及', '或', '或者', '还是',
    '并', '并且', '而且', '不仅', '不但', '既', '又', '一边',
  ];

  /**
   * 给文本加标点
   */
  punctuate(text: string): string {
    if (!text || !text.trim()) return text;

    let result = text.trim();

    // 处理语音命令式标点
    result = this.handleVoiceCommands(result);

    // 处理句末标点
    result = this.addEndingPunctuation(result);

    return result;
  }

  /**
   * 处理语音命令：说"逗号"变成","，"句号"变成"。"等
   */
  private handleVoiceCommands(text: string): string {
    const replacements: [RegExp, string][] = [
      /逗号/g, '，',
      /句号/g, '。',
      /问号/g, '？',
      /感叹号/g, '！',
      /冒号/g, '：',
      /分号/g, '；',
      /顿号/g, '、',
      /引号/g, '"',
      /左引号/g, '"',
      /右引号/g, '"',
      /破折号/g, '——',
      /省略号/g, '……',
      /书名号/g, '《》',
      /间隔号/g, '·',
      /at符号/g, '@',
      /井号/g, '#',
      /美元符号/g, '$',
      /百分号/g, '%',
      /and符号/g, '&',
      /星号/g, '*',
      /波浪号/g, '~',
      /下划线/g, '_',
      /斜杠/g, '/',
      /反斜杠/g, '\\',
      /竖线/g, '|',
    ];

    for (const [pattern, replacement] of replacements) {
      text = text.replace(pattern, replacement);
    }

    return text;
  }

  /**
   * 添加句末标点
   */
  private addEndingPunctuation(text: string): string {
    // 如果已以标点结尾，不做处理
    if (/[。！？\.,!?;；:：……]\s*$/.test(text)) {
      return text;
    }

    // 检查是否有问句特征
    const isQuestion = this.questionParticles.some((p) => text.endsWith(p)) ||
      /^(怎么|为什么|如何|是否|能不能|要不要|有没有|会不会|是不是|能否|何).*$/.test(text) ||
      /吗$/.test(text) ||
      /[？?]$/.test(text);

    // 检查是否有感叹特征
    const isExclamation = /^(太|真|好|非常|特别|多么|居然|竟然|果然).*$/.test(text) ||
      /![!]*$/.test(text);

    if (isQuestion) {
      return text + '？';
    } else if (isExclamation) {
      return text + '！';
    } else {
      return text + '。';
    }
  }

  /**
   * 对完整段落应用标点恢复
   * 此方法处理整段文本，而不仅仅是单句
   */
  punctuateParagraph(text: string): string {
    if (!text || !text.trim()) return text;

    let result = text;

    // 处理语音命令
    result = this.handleVoiceCommands(result);

    // 按换行或明显的句边界分割
    const sentences = this.splitIntoSentences(result);
    const punctuated = sentences.map((s) => this.punctuate(s));
    result = punctuated.join('');

    // 基本清理
    result = result.replace(/，([。！？])/g, '$1');
    result = result.replace(/，$/g, '。');
    result = result.replace(/。，/g, '。');
    result = result.replace(/[。！？]{2,}/g, (m) => m[0]);

    return result;
  }

  /**
   * 将文本分割为句子片段
   */
  private splitIntoSentences(text: string): string[] {
    // 在可能的句子边界处分割
    const parts: string[] = [];
    let current = '';
    let i = 0;

    while (i < text.length) {
      current += text[i];

      // 检查当前累积的文本是否以句子起始词结束
      const matchStart = this.sentenceStartWords.find((w) => current.endsWith(w));
      if (matchStart && current.length > matchStart.length + 2) {
        // 去掉起始词加到前一句
        const sentence = current.slice(0, -matchStart.length);
        parts.push(sentence);
        current = matchStart;
      }

      i++;
    }

    if (current) {
      parts.push(current);
    }

    return parts.length > 0 ? parts : [text];
  }

  /**
   * 格式化数字
   * 如 "一百二十三块五" → "123.5元"
   */
  formatNumbers(text: string): string {
    let result = text;

    // 简单数字转换：在音频中已经由ASR处理，
    // 这里做一些后处理格式化
    // 金额："X块Y" → "X元Y"
    result = result.replace(/(\d+)块(\d+)/g, '$1元$2');
    result = result.replace(/(\d+)块/g, '$1元');

    // 温度
    result = result.replace(/(\d+)度/g, '$1°C');

    return result;
  }

  /**
   * 对话后处理全流程
   */
  process(text: string): string {
    if (!text) return '';
    let result = text;
    result = this.handleVoiceCommands(result);
    result = this.formatNumbers(result);
    result = this.addEndingPunctuation(result);
    return result;
  }
}

// 单例导出
export const punctuationService = new PunctuationService();
