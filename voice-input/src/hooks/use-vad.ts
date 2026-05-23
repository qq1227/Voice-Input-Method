import { useEffect, useRef } from 'react';
import { useRecognitionStore } from '../stores/recognition-store';
import { VadState } from '../types';

/**
 * useVad - VAD 状态 Hook
 *
 * 提供 VAD 状态的便捷访问和音频可视化数据。
 */
export function useVad() {
  const vadState = useRecognitionStore((s) => s.vadState);
  const audioLevel = useRecognitionStore((s) => s.audioLevel);
  const isRecording = useRecognitionStore((s) => s.isRecording);

  const getStateLabel = (state: VadState): string => {
    switch (state) {
      case 'idle':
        return '等待输入';
      case 'speaking':
        return '语音输入中...';
      case 'pending_finalize':
        return '静音中...';
      default:
        return '';
    }
  };

  const getStateColor = (state: VadState): string => {
    switch (state) {
      case 'idle':
        return '#888';
      case 'speaking':
        return '#22c55e';
      case 'pending_finalize':
        return '#f59e0b';
      default:
        return '#888';
    }
  };

  return {
    vadState,
    audioLevel,
    isRecording,
    stateLabel: getStateLabel(vadState),
    stateColor: getStateColor(vadState),
  };
}
