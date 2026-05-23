import { useEffect, useState } from 'react';
import { useRecognitionStore } from '../stores/recognition-store';
import { RecognitionResult } from '../types';

/**
 * History - 识别历史记录
 *
 * 显示过去的识别结果，支持复制、导出和清除。
 * 数据来源：
 * - Vosk 路径：从主进程 IPC 获取（保存在 main.ts 的 history 数组）
 * - Web Speech 路径：从 Zustand store 的 history 获取（由 stopWebSpeech 写入）
 */
export default function History() {
  const storeHistory = useRecognitionStore((s) => s.history);
  const [history, setHistory] = useState<RecognitionResult[]>(storeHistory);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  // storeHistory 变化时同步（Web Speech 识别的结果由 stopWebSpeech 写入 store）
  useEffect(() => {
    if (storeHistory.length > 0) {
      setHistory(storeHistory);
    }
  }, [storeHistory]);

  const loadHistory = async () => {
    try {
      const h = await window.voiceInput?.getHistory();
      if (h && h.length > 0) setHistory(h);
    } catch {
      // fallback to store
      setHistory(useRecognitionStore.getState().history);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  const handleExport = async () => {
    if (history.length === 0) return;
    const text = history
      .map((item) => `[${formatTime(item.timestamp)}] ${item.text}`)
      .join('\n\n');
    const now = new Date();
    const filename = `语音输入_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.txt`;

    try {
      // Electron 路径：通过 IPC 弹出系统保存对话框
      const result = await window.voiceInput?.exportText(text);
      if (result?.success) {
        setCopiedId('export');
        setTimeout(() => setCopiedId(null), 2000);
        return;
      }
    } catch {
      // 忽略 IPC 错误，走浏览器 fallback
    }

    // 浏览器 fallback：创建 Blob 下载
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedId('export');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = async () => {
    try {
      await window.voiceInput?.clearHistory();
    } catch {
      // ignore
    }
    setHistory([]);
    useRecognitionStore.getState().clearAll();
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="history-page">
      <div className="history-header">
        <h3 className="section-title">历史记录</h3>
        {history.length > 0 && (
          <div className="history-actions-bar">
            <button className="btn btn-small" onClick={handleExport}>
              {copiedId === 'export' ? '✓ 已导出' : '📥 导出'}
            </button>
            <button className="btn btn-danger-small" onClick={handleClear}>
              清空全部
            </button>
          </div>
        )}
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p className="empty-text">暂无历史记录</p>
            <p className="empty-hint">开始语音输入后，结果会显示在这里</p>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="history-item">
              <div className="history-meta">
                <span className="history-time">{formatTime(item.timestamp)}</span>
                <span className="history-source">
                  {item.source === 'local' ? '离线' : '云端'}
                </span>
                {item.latencyMs > 0 && (
                  <span className="history-latency">{item.latencyMs}ms</span>
                )}
              </div>
              <p className="history-text">{item.text}</p>
              <div className="history-actions">
                <button
                  className="btn btn-small"
                  onClick={() => handleCopy(item.text, item.id)}
                >
                  {copiedId === item.id ? '✓ 已复制' : '复制'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
