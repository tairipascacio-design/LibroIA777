import { useState, useEffect, useRef, useCallback } from "react";

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  AndroidBridge?: {
    isNativeAndroid: () => boolean;
    startSpeech: (lang: string) => void;
    stopSpeech: () => void;
  };
  __androidSpeechStart?: () => void;
  __androidSpeechEnd?: () => void;
  __androidSpeechLevel?: (level: number) => void;
  __androidSpeechResult?: (text: string, isFinal: boolean) => void;
  __androidSpeechError?: (msg: string) => void;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({
  lang = "es-MX",
  onResult,
  onError,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const isNativeAndroid =
    typeof window !== "undefined" &&
    !!(window as unknown as IWindow).AndroidBridge?.isNativeAndroid?.();

  // Check support
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionAPI =
      win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI && !isNativeAndroid) {
      setIsSupported(false);
    }
  }, [isNativeAndroid]);

  // Wire Native Android Speech Bridge callbacks if inside APK
  useEffect(() => {
    if (!isNativeAndroid) return;
    const win = window as unknown as IWindow;

    win.__androidSpeechStart = () => {
      setIsListening(true);
      setErrorMessage(null);
    };
    win.__androidSpeechEnd = () => {
      setIsListening(false);
      setInterimTranscript("");
      setAudioLevel(0);
    };
    win.__androidSpeechLevel = (level: number) => {
      setAudioLevel(level);
    };
    win.__androidSpeechResult = (text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscript((prev) => {
          const next = (prev ? prev.trim() + " " : "") + text.trim();
          onResult?.(next, true);
          return next;
        });
        setInterimTranscript("");
      } else {
        setInterimTranscript(text);
        onResult?.(text, false);
      }
    };
    win.__androidSpeechError = (msg: string) => {
      setIsListening(false);
      setErrorMessage(msg);
      onError?.(msg);
    };

    return () => {
      delete win.__androidSpeechStart;
      delete win.__androidSpeechEnd;
      delete win.__androidSpeechLevel;
      delete win.__androidSpeechResult;
      delete win.__androidSpeechError;
    };
  }, [isNativeAndroid, onError, onResult]);

  // Audio level visualizer loop (Web)
  const startAudioAnalysis = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err: any) {
      console.warn("Could not start audio visualizer:", err);
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startListening = useCallback(() => {
    setErrorMessage(null);
    const win = window as unknown as IWindow;

    if (isNativeAndroid && win.AndroidBridge) {
      win.AndroidBridge.startSpeech(lang);
      return;
    }

    const SpeechRecognitionAPI =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      const msg =
        "Tu navegador actual no soporta reconocimiento de voz nativo. Puedes escribir o pegar tu dictado directamente en el cuadro de texto.";
      setErrorMessage(msg);
      onError?.(msg);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        startAudioAnalysis();
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalChunk += item[0].transcript + " ";
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalChunk) {
          setTranscript((prev) => {
            const next = (prev ? prev.trim() + " " : "") + finalChunk.trim();
            onResult?.(next, true);
            return next;
          });
        }

        setInterimTranscript(currentInterim);
        if (currentInterim) {
          onResult?.(currentInterim, false);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          const msg =
            "Permiso de micrófono denegado. Por favor permite el acceso al micrófono en los ajustes.";
          setErrorMessage(msg);
          onError?.(msg);
        } else if (event.error !== "no-speech") {
          setErrorMessage(`Aviso de micrófono: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        stopAudioAnalysis();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setErrorMessage(err?.message || "Error al iniciar el dictado por voz");
      onError?.(err?.message);
      setIsListening(false);
      stopAudioAnalysis();
    }
  }, [isNativeAndroid, lang, onError, onResult, startAudioAnalysis, stopAudioAnalysis]);

  const stopListening = useCallback(() => {
    const win = window as unknown as IWindow;
    if (isNativeAndroid && win.AndroidBridge) {
      win.AndroidBridge.stopSpeech();
      setIsListening(false);
      setInterimTranscript("");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current.abort();
      }
    }
    setIsListening(false);
    setInterimTranscript("");
    stopAudioAnalysis();
  }, [isNativeAndroid, stopAudioAnalysis]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const setManualTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]);

  return {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
    setManualTranscript,
  };
}
