import { useRecognitionStore } from '../stores/recognition-store';
import { useVad } from '../hooks/use-vad';

/**
 * StatusBar - 底部状态栏
 *
 * 显示音频电平、引擎状态、VAD 状态等实时信息。
 */
export default function StatusBar() {
  const { audioLevel, stateLabel, stateColor } = useVad();
  const { isRecording, engineType, engineAvailable, error } = useRecognitionStore();

  // 音频电平百分比
  const levelPercent = Math.min(Math.round(audioLevel * 100), 100);

  // 电平条颜色
  const getLevelColor = () => {
    if (levelPercent < 30) return '#22c55e';
    if (levelPercent < 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <footer className="status-bar">
      <div className="status-left">
        {/* 音频电平 */}
        <div className="level-meter">
          <div className="level-bar-bg">
            <div
              className="level-bar-fill"
              style={{
                width: `${levelPercent}%`,
                backgroundColor: getLevelColor(),
                transition: 'width 0.1s ease',
              }}
            />
          </div>
        </div>

        {/* VAD 状态 */}
        {isRecording && (
          <span className="status-text" style={{ color: stateColor }}>
            {stateLabel}
          </span>
        )}
      </div>

      <div className="status-right">
        {/* 引擎信息 */}
        <span className="engine-badge" title={engineType === 'vosk' ? 'Vosk 离线引擎' : engineType === 'webspeech' ? '浏览器语音识别' : '不可用'}>
          <span className={`engine-dot ${engineType === 'vosk' ? 'online' : 'offline'}`} />
          {engineType === 'vosk' ? 'Vosk' : engineType === 'webspeech' ? 'Web Speech' : engineType === 'unavailable' ? '不可用' : engineType}
        </span>

        {/* 错误提示 */}
        {error && (
          <span className="error-badge" title={error}>
            ⚠️
          </span>
        )}
      </div>
    </footer>
  );
}
