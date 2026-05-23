import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { AsrEngineType, Hotword } from '../types';

/**
 * Settings - 设置页面
 *
 * 支持：
 * - 语言选择
 * - 离线模式切换
 * - 自动标点开关
 * - 云端ASR配置
 * - 热词管理（增删改）
 */
export default function Settings() {
  const { settings, updateSettings, addHotword, removeHotword } = useSettingsStore();
  const [newWord, setNewWord] = useState('');
  const [newWeight, setNewWeight] = useState(5);
  const [newCorrection, setNewCorrection] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 自动保存
  const handleChange = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    updateSettings({ [key]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleAddHotword = () => {
    if (!newWord.trim()) return;
    const hw: Hotword = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      word: newWord.trim(),
      weight: newWeight,
      correction: newCorrection.trim() || undefined,
      createdAt: Date.now(),
      hitCount: 0,
    };
    addHotword(hw);
    window.voiceInput?.addHotword(hw.word, hw.weight).catch(console.error);
    setNewWord('');
    setNewCorrection('');
    setNewWeight(5);
  };

  const handleRemoveHotword = (id: string) => {
    removeHotword(id);
    window.voiceInput?.removeHotword(id).catch(console.error);
  };

  return (
    <div className="settings-page">
      <div className="settings-section">
        <h3 className="section-title">识别设置</h3>

        <div className="setting-item">
          <label className="setting-label">识别引擎</label>
          <select
            className="setting-select"
            value={settings.asrEngine}
            onChange={(e) => handleChange('asrEngine', e.target.value as AsrEngineType)}
          >
            <option value="auto">自动选择</option>
            <option value="vosk">Vosk (离线)</option>
            <option value="webspeech">Web Speech (在线)</option>
          </select>
        </div>

        <div className="setting-item">
          <label className="setting-label">语言</label>
          <select
            className="setting-select"
            value={settings.language}
            onChange={(e) => handleChange('language', e.target.value as 'zh' | 'en' | 'yue' | 'mixed')}
          >
            <option value="zh">中文普通话</option>
            <option value="en">English</option>
            <option value="yue">粤语</option>
            <option value="mixed">中英文混合</option>
          </select>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.offlineOnly}
              onChange={(e) => handleChange('offlineOnly', e.target.checked)}
            />
            <span className="checkbox-label">仅使用离线引擎</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.autoPunctuation}
              onChange={(e) => handleChange('autoPunctuation', e.target.checked)}
            />
            <span className="checkbox-label">自动添加标点</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.longTextMode}
              onChange={(e) => handleChange('longTextMode', e.target.checked)}
            />
            <span className="checkbox-label">长文本模式（不自动停止）</span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">外观</h3>

        <div className="setting-item">
          <label className="setting-label">主题</label>
          <select
            className="setting-select"
            value={settings.theme}
            onChange={(e) => handleChange('theme', e.target.value as 'light' | 'dark')}
          >
            <option value="light">☀️ 亮色</option>
            <option value="dark">🌙 深色</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">云端纠错</h3>

        <div className="setting-item">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={settings.cloudAsrEnabled}
              onChange={(e) => handleChange('cloudAsrEnabled', e.target.checked)}
            />
            <span className="checkbox-label">启用云端纠错</span>
          </label>
        </div>

        {settings.cloudAsrEnabled && (
          <div className="setting-item">
            <label className="setting-label">服务提供商</label>
            <select
              className="setting-select"
              value={settings.cloudAsrProvider}
              onChange={(e) => handleChange('cloudAsrProvider', e.target.value as any)}
            >
              <option value="none">未配置</option>
              <option value="baidu">百度语音</option>
              <option value="aliyun">阿里云语音</option>
            </select>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="section-title">热词管理</h3>
        <p className="section-desc">添加常用词汇提升识别准确率</p>

        <div className="hotword-form">
          <input
            className="input"
            type="text"
            placeholder="输入热词..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddHotword()}
          />
          <div className="hotword-form-row">
            <div className="weight-control">
              <label>权重: {newWeight}</label>
              <input
                type="range"
                min={1}
                max={10}
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
              />
            </div>
            <input
              className="input correction-input"
              type="text"
              placeholder="纠错为 (可选)"
              value={newCorrection}
              onChange={(e) => setNewCorrection(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleAddHotword}>
              添加
            </button>
          </div>
        </div>

        <div className="hotword-list">
          {settings.hotwords.length === 0 ? (
            <p className="empty-text">暂无热词</p>
          ) : (
            settings.hotwords.map((hw) => (
              <div key={hw.id} className="hotword-item">
                <div className="hotword-info">
                  <span className="hotword-word">{hw.word}</span>
                  <span className="hotword-weight">权重: {hw.weight}</span>
                  {hw.correction && (
                    <span className="hotword-correction">
                      → {hw.correction}
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-danger-small"
                  onClick={() => handleRemoveHotword(hw.id)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="settings-footer">
        {saved && <span className="saved-hint">✓ 已保存</span>}
        <button className="btn btn-secondary" onClick={handleSave}>
          保存设置
        </button>
      </div>
    </div>
  );
}
