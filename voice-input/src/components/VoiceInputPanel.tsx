import { useEffect, useRef } from 'react';
import { useRecognition } from '../hooks/use-recognition';
import { useVad } from '../hooks/use-vad';

/**
 * VoiceInputPanel - 语音输入主面板
 *
 * 包含：
 * - 录音按钮（大圆形，点击切换开始/停止）
 * - 实时文字显示区域（部分结果 + 最终结果）
 * - 音频可视化波形
 * - 操作按钮（复制、清空）
 */
export default function VoiceInputPanel() {
  const {
    isRecording,
    currentText,
    partialText,
    error,
    engineType,
    toggleRecording,
    clearText,
    copyText,
  } = useRecognition();

  const { audioLevel, stateLabel, stateColor } = useVad();
  const textEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveAnimRef = useRef<number>(0);
  const wavePhaseRef = useRef(0);

  // 自动滚动到底部
  useEffect(() => {
    textEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentText, partialText]);

  // 波形动画
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawWave = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (isRecording) {
        wavePhaseRef.current += 0.05;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const t = x / w;
          // 基于音频级别和相位的复合波形
          const base = Math.sin(t * 20 + wavePhaseRef.current) * audioLevel * h * 0.4;
          const harmonic = Math.sin(t * 40 + wavePhaseRef.current * 1.3) * audioLevel * h * 0.2;
          const y = h / 2 + base + harmonic;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // 空闲时画一条平线
        const y = h / 2;
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const animate = () => {
      drawWave();
      waveAnimRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(waveAnimRef.current);
  }, [isRecording, audioLevel]);

  // 录音按钮状态
  const btnState = isRecording ? 'recording' : 'idle';

  return (
    <div className="voice-panel">
      {/* 文字显示区域 */}
      <div className="text-display">
        <div className="text-content">
          {currentText ? (
            <p className="final-text">{currentText}</p>
          ) : (
            <p className="placeholder">点击下方按钮开始语音输入...</p>
          )}
          {partialText && (
            <p className="partial-text">
              {partialText}
              <span className="cursor-blink">|</span>
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
          <div ref={textEndRef} />
        </div>

        {/* 波形 */}
        <canvas
          ref={canvasRef}
          className="wave-canvas"
          width={400}
          height={60}
        />
      </div>

      {/* 录音按钮 */}
      <div className="controls">
        <div className="vad-indicator" style={{ color: stateColor }}>
          {stateLabel}
        </div>

        <button
          className={`record-btn ${btnState}`}
          onClick={toggleRecording}
          title={isRecording ? '停止录音' : '开始录音'}
        >
          <div className="record-btn-inner">
            {isRecording ? (
              <div className="stop-icon">
                <div className="stop-square" />
              </div>
            ) : (
              <div className="mic-icon">🎤</div>
            )}
          </div>
          <div className={`record-ring ${isRecording ? 'pulse' : ''}`} />
        </button>

        {/* 操作按钮 */}
        <div className="action-buttons">
          <button
            className="action-btn"
            onClick={() => copyText()}
            disabled={!currentText}
            title="复制文本"
          >
            📋 复制
          </button>
          <button
            className="action-btn"
            onClick={clearText}
            disabled={!currentText && !partialText}
            title="清空文本"
          >
            🗑️ 清空
          </button>
        </div>
      </div>

      {/* 引擎状态 */}
      <div className="engine-info">
        <span className="engine-label">
          引擎: {engineType}
        </span>
      </div>
    </div>
  );
}
