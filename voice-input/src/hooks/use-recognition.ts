import { useEffect, useRef, useCallback } from 'react';
import { useRecognitionStore } from '../stores/recognition-store';
import { useSettingsStore } from '../stores/settings-store';
import { RecognitionResult, VadState } from '../types';

// ===== Web Speech API 类型声明（浏览器兼容） =====
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/**
 * useRecognition - 语音识别核心 Hook
 *
 * 封装录音控制、事件监听、音频采集等逻辑。
 * - Vosk 可用时：通过 IPC 发送音频到主进程
 * - Vosk 不可用时：检测 Web Speech API 是否可用，否则提示用 Chrome 浏览器
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
      // Vosk 不可用时，检测 Web Speech API 是否真实可用
      let engineType = info.type;
      if (engineType !== 'vosk') {
        const ws = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!ws) {
          engineType = 'unavailable';
          useRecognitionStore.setState({
            error: 'Web Speech API 不可用，请用 Chrome 浏览器访问 http://localhost:5173，或安装 Vosk 离线引擎',
          });
        }
      }
      useRecognitionStore.setState({
        engineType,
        engineAvailable: engineType === 'vosk',
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

  /**
   * 使用 Web Speech API 开始识别（浏览器/Electron 渲染进程均可）
   */
  const startWebSpeech = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      useRecognitionStore.setState({
        engineType: 'unavailable',
        error: 'Web Speech API 不可用。\n请用 Chrome 浏览器访问 http://localhost:5173',
      });
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.language === 'en' ? 'en-US' : 'zh-CN';

    // 中间结果
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const result: RecognitionResult = {
          id,
          text: final,
          segments: [{ text: final, startTime: Date.now(), endTime: Date.now(), isPunctuated: false }],
          isFinal: true,
          source: 'cloud',
          latencyMs: 0,
          timestamp: Date.now(),
        };
        useRecognitionStore.getState().addFinalResult(result);
      }

      if (interim) {
        useRecognitionStore.setState({ partialText: interim });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // 正常静音，不报错
      useRecognitionStore.setState({ error: '语音识别错误: ' + event.error });
    };

    recognition.onend = () => {
      // 如果仍在录音状态，自动重启（实现连续识别）
      if (useRecognitionStore.getState().isRecording) {
        try {
          recognition.start();
        } catch {
          // 已停止的情况忽略
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    useRecognitionStore.setState({
      isRecording: true,
      engineType: 'webspeech',
      engineAvailable: true,
      error: null,
      partialText: '',
    });
  }, [settings.language]);

  /**
   * 停止 Web Speech API
   *
   * 先标记 isRecording=false，再调 abort()。
   * 同时将 finalResults 写入 store.history 供历史页面使用。
   */
  const stopWebSpeech = useCallback(() => {
    const { finalResults, history } = useRecognitionStore.getState();

    // 将本次识别结果写入历史
    const newHistory = [...history, ...finalResults];

    // 先标记停止，防止 onend 自动重启
    useRecognitionStore.setState({
      isRecording: false,
      partialText: '',
      history: newHistory,
    });

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // 已停止的情况忽略
      }
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    const { engineType } = useRecognitionStore.getState();
    const api = window.voiceInput;

    if (engineType === 'unavailable') {
      useRecognitionStore.setState({
        error: '语音识别不可用：请用 Chrome 打开 http://localhost:5173，或在控制面板安装 C++ 编译工具后重装 vosk',
      });
      return;
    }

    // 非 Vosk 模式（浏览器/Web Speech）使用 Web Speech API
    if (engineType !== 'vosk') {
      startWebSpeech();
      return;
    }

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
  }, [settings.offlineOnly, startWebSpeech]);

  const stopRecording = useCallback(async () => {
    const { engineType } = useRecognitionStore.getState();

    // Web Speech API 模式
    if (engineType === 'webspeech') {
      stopWebSpeech();
      return;
    }

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
  }, [cleanupRefs, stopWebSpeech]);

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
