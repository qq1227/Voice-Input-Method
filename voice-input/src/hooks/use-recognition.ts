import { useEffect, useRef, useCallback } from 'react';
import { useRecognitionStore } from '../stores/recognition-store';
import { useSettingsStore } from '../stores/settings-store';
import { RecognitionResult, VadState } from '../types';

/**
 * useRecognition - 语音识别核心 Hook
 *
 * 封装录音控制、事件监听、音频采集等逻辑。
 * 组件只需调用此 hook 即可获得完整的识别能力。
 */
export function useRecognition() {
  const store = useRecognitionStore();
  const settings = useSettingsStore((s) => s.settings);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  const recordedChunksRef = useRef<Float32Array[]>([]);

  // 清理事件监听
  useEffect(() => {
    return () => {
      cleanupFnsRef.current.forEach((fn) => fn());
      cleanupRefs();
    };
  }, []);

  // 初始化事件监听
  useEffect(() => {
    const api = window.voiceInput;
    if (!api) return;

    const cleanups = [
      api.onResult((result: RecognitionResult) => {
        if (result.isFinal) {
          const partial = useRecognitionStore.getState().partialText;
          useRecognitionStore.getState().addFinalResult(result);
          // 如果当前部分结果比最终结果长，说明部分结果包含更多内容
          if (partial.length > result.text.length) {
            useRecognitionStore.setState({ partialText: '' });
          }
        } else {
          useRecognitionStore.setState({ currentText: result.text, latencyMs: result.latencyMs });
        }
      }),

      api.onPartialResult((text: string) => {
        useRecognitionStore.setState({ partialText: text });
      }),

      api.onVadState((state: VadState) => {
        useRecognitionStore.setState({ vadState: state });
      }),

      api.onAudioLevel((level: number) => {
        useRecognitionStore.setState({ audioLevel: level });
      }),

      api.onError((error: string) => {
        useRecognitionStore.setState({ error });
      }),

      api.onEngineStatus((status) => {
        useRecognitionStore.setState({
          engineType: status.type,
          engineAvailable: status.available,
        });
      }),
    ];

    cleanupFnsRef.current = cleanups;

    // 加载初始状态
    api.getEngineInfo().then((info) => {
      useRecognitionStore.setState({
        engineType: info.type,
        engineAvailable: info.available,
      });
    });

    api.getSettings().then((s) => {
      useSettingsStore.getState().setSettings(s);
    });

    api.getHistory().then((h) => {
      useRecognitionStore.setState({ history: h });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const cleanupRefs = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    const api = window.voiceInput;
    if (!api) return;

    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 创建 AudioContext (16kHz)
      const audioContext = new AudioContext({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      // 创建音频源
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 通知主进程开始录音
      await api.startRecording({
        vad: { mode: settings.offlineOnly ? 'auto' : 'auto' },
      });

      // 使用 ScriptProcessorNode 获取 PCM 数据
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!useRecognitionStore.getState().isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        api.sendAudioChunk(chunk.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      useRecognitionStore.setState({
        isRecording: true,
        error: null,
        partialText: '',
      });

      recordedChunksRef.current = [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : '无法访问麦克风';
      useRecognitionStore.setState({ error: msg });
    }
  }, [settings.offlineOnly]);

  const stopRecording = useCallback(async () => {
    const api = window.voiceInput;
    if (!api) return;

    try {
      const result = await api.stopRecording();
      if (result) {
        useRecognitionStore.getState().addFinalResult(result);
      }
    } catch (err) {
      // ignore
    }

    cleanupRefs();

    useRecognitionStore.setState({
      isRecording: false,
      vadState: 'idle',
      audioLevel: 0,
      partialText: '',
    });

    // 刷新历史
    api.getHistory().then((h) => {
      useRecognitionStore.setState({ history: h });
    });
  }, [cleanupRefs]);

  const toggleRecording = useCallback(async () => {
    if (useRecognitionStore.getState().isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [startRecording, stopRecording]);

  const clearText = useCallback(() => {
    useRecognitionStore.getState().clearCurrentText();
    window.voiceInput?.clearText().catch(() => {});
  }, []);

  const copyText = useCallback(async (text?: string) => {
    const content = text || useRecognitionStore.getState().currentText;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // fallback
      window.voiceInput?.copyText(content).catch(() => {});
    }
  }, []);

  return {
    ...store,
    startRecording,
    stopRecording,
    toggleRecording,
    clearText,
    copyText,
  };
}
