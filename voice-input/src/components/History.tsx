import { useEffect, useState } from 'react';
import { useRecognitionStore } from '../stores/recognition-store';
import { RecognitionResult } from '../types';

/**
 * History - 识别历史记录
 *
 * 显示过去的识别结果，支持复制和清除。
 */
export default function History() {
  const [history, setHistory] = useState<RecognitionResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const h = await window.voiceInput?.getHistory();
      if (h) setHistory(h);
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
    try {
      const result = await window.voiceInput?.exportText(text);
      if (result?.success) {
        setCopiedId('export');
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      // fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      setCopiedId('export');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleClear = async () => {
    try {
      await window.voiceInput?.clearHistory();
    } catch {
      // ignore
    }
    setHistory([]);
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
