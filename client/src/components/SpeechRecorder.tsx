import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Loader2, AlertCircle,
  Play, Pause, RotateCcw, Send, CheckCircle2,
  Wand2, AudioLines,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface SpeechRecorderProps {
  onComplete: (transcript: string) => void;
  isProcessing: boolean;
}

type Phase = "idle" | "recording" | "reviewing";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function SpeechRecorder({ onComplete, isProcessing }: SpeechRecorderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveTranscript, setLiveTranscript]     = useState("");
  const [webSpeechText, setWebSpeechText]       = useState("");
  const [whisperText, setWhisperText]           = useState<string | null>(null);
  const [finalText, setFinalText]               = useState("");
  const [isTranscribing, setIsTranscribing]     = useState(false);
  const [isPlaying, setIsPlaying]               = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [isSupported, setIsSupported]           = useState(true);

  const recognitionRef   = useRef<any>(null);
  const finalTransRef    = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const audioBlobRef     = useRef<Blob | null>(null);
  const audioUrlRef      = useRef<string | null>(null);
  const audioElRef       = useRef<HTMLAudioElement | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const mimeTypeRef      = useRef("audio/webm");

  // ── Setup Web Speech API ──
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setIsSupported(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = "en-IN";
    if ("grammars" in recognition) {
      recognition.grammars = new (window as any).SpeechGrammarList();
    }

    recognition.onresult = (event: any) => {
      let interim = "";
      let final   = finalTransRef.current;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + " ";
        else                          interim += t;
      }
      finalTransRef.current = final;
      setLiveTranscript(final + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech")
        setError(`Microphone error: ${event.error}`);
    };

    recognitionRef.current = recognition;
    return () => { try { recognition.abort(); } catch {} };
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const resetState = useCallback(() => {
    audioElRef.current?.pause();
    audioElRef.current = null;
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current    = null;
    audioChunksRef.current = [];
    audioBlobRef.current   = null;
    finalTransRef.current  = "";
    setIsPlaying(false);
    setLiveTranscript("");
    setWebSpeechText("");
    setWhisperText(null);
    setFinalText("");
    setError(null);
    setIsTranscribing(false);
  }, []);

  const startRecording = useCallback(async () => {
    resetState();
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setError("Microphone access denied. Please grant permission and try again.");
      return;
    }

    const mimeType =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
      MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm"             :
      MediaRecorder.isTypeSupported("audio/mp4")              ? "audio/mp4"              :
      "audio/ogg";
    mimeTypeRef.current = mimeType;

    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      const wsText = finalTransRef.current.trim();
      setWebSpeechText(wsText);

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioBlobRef.current = blob;
      audioUrlRef.current  = URL.createObjectURL(blob);

      setPhase("reviewing");
      setIsTranscribing(true);

      try {
        const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
        const fd  = new FormData();
        fd.append("audio", blob, `recording.${ext}`);
        const resp = await fetch("/api/transcribe-audio", { method: "POST", body: fd });
        if (resp.ok) {
          const data = await resp.json();
          const wt   = (data.transcript as string) || "";
          setWhisperText(wt);
          setFinalText(wt || wsText);
        } else {
          setWhisperText(null);
          setFinalText(wsText);
        }
      } catch {
        setWhisperText(null);
        setFinalText(wsText);
      } finally {
        setIsTranscribing(false);
      }
    };

    mr.start(200);

    try { recognitionRef.current?.start(); } catch {}
    setPhase("recording");
  }, [resetState]);

  const stopRecording = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    mediaRecorderRef.current?.stop();
  }, []);

  const togglePlayback = useCallback(() => {
    if (!audioUrlRef.current) return;
    if (!audioElRef.current) {
      audioElRef.current       = new Audio(audioUrlRef.current);
      audioElRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioElRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElRef.current.currentTime = 0;
      audioElRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleReRecord = useCallback(() => {
    resetState();
    setPhase("idle");
  }, [resetState]);

  const handleSubmit = useCallback(() => {
    const text = finalText.trim();
    if (text) {
      audioElRef.current?.pause();
      onComplete(text);
    }
  }, [finalText, onComplete]);

  // ── Unsupported Browser ──
  if (!isSupported) {
    return (
      <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <h3 className="text-destructive font-semibold mb-1">Browser Not Supported</h3>
        <p className="text-sm text-destructive/80">
          Your browser does not support the Web Speech API. Please use Google Chrome or Microsoft Edge.
        </p>
      </div>
    );
  }

  // ── REVIEW PHASE ──
  if (phase === "reviewing") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col w-full max-w-2xl mx-auto space-y-5 px-4 sm:px-0"
      >
        {/* Playback row */}
        <div className="flex items-center gap-4 glass-card px-5 py-3 rounded-2xl">
          <button
            onClick={togglePlayback}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-all shrink-0"
            data-testid="button-playback"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Your Recording
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary/40 rounded-full"
                  style={{
                    width: "3px",
                    height: `${8 + Math.sin(i * 0.9) * 6}px`,
                    opacity: isPlaying ? 1 : 0.5,
                  }}
                />
              ))}
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {isPlaying ? "Playing…" : "Click to play"}
          </span>
        </div>

        {/* Transcript comparison */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Browser transcript */}
          <div className="glass-card p-4 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Browser Transcript
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/70 italic min-h-[60px]">
              {webSpeechText || <span className="text-muted-foreground/50">Nothing captured</span>}
            </p>
          </div>

          {/* Whisper transcript */}
          <div className="glass-card p-4 rounded-2xl space-y-2 border border-primary/20">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                AI Transcript
              </span>
              {isTranscribing && <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />}
              {!isTranscribing && whisperText !== null && (
                <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 min-h-[60px]">
              {isTranscribing
                ? <span className="text-muted-foreground/50 animate-pulse">Analysing recording…</span>
                : whisperText
                  ? whisperText
                  : <span className="text-muted-foreground/50">Unavailable — using browser transcript</span>
              }
            </p>
          </div>
        </div>

        {/* Editable final answer */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            Final Answer — review &amp; edit before submitting
          </label>
          <textarea
            data-testid="input-final-transcript"
            value={finalText}
            onChange={e => setFinalText(e.target.value)}
            disabled={isTranscribing || isProcessing}
            rows={5}
            className="w-full px-4 py-3 rounded-xl glass-card text-foreground text-base leading-relaxed
                       border border-white/10 focus:border-primary/50 focus:outline-none
                       resize-none disabled:opacity-50 transition-colors"
            placeholder={isTranscribing ? "Waiting for AI transcript…" : "Your answer will appear here…"}
          />
          <p className="text-xs text-muted-foreground">
            The AI transcript is pre-filled above. Compare with the browser version and edit anything that looks wrong before submitting.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReRecord}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10
                       text-muted-foreground text-sm font-semibold hover:bg-white/10 transition-all
                       disabled:opacity-40"
            data-testid="button-rerecord"
          >
            <RotateCcw className="w-4 h-4" />
            Re-record
          </button>

          <Button
            onClick={handleSubmit}
            disabled={isProcessing || isTranscribing || !finalText.trim()}
            className="flex-1 h-12 rounded-xl font-semibold bg-white text-black hover:bg-white/90 shadow-xl"
            data-testid="button-submit-answer"
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" /> Analysing…</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Submit Answer</>
            )}
          </Button>
        </div>
      </motion.div>
    );
  }

  // ── IDLE / RECORDING PHASE ──
  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">

      {/* Live transcript display */}
      <div className="w-full relative">
        <div className={`min-h-[150px] sm:min-h-[200px] w-full p-4 sm:p-6 rounded-2xl glass-card transition-all duration-500 ${phase === "recording" ? "border-primary/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]" : ""}`}>
          {liveTranscript ? (
            <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {liveTranscript}
            </p>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/60">
              <p className="text-center font-medium text-sm sm:text-base">
                {phase === "recording" ? "Listening…" : "Your answer will appear here…"}
              </p>
            </div>
          )}

          <AnimatePresence>
            {phase === "recording" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold tracking-wider uppercase"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className="mt-2 text-center text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
        <button
          onClick={phase === "recording" ? stopRecording : startRecording}
          disabled={isProcessing}
          data-testid="button-record-toggle"
          className={`
            relative group flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 rounded-full
            transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
            ${phase === "recording"
              ? "bg-red-500 hover:bg-red-600 text-white animate-record-pulse"
              : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 shadow-xl shadow-primary/20 hover:shadow-primary/40"
            }
          `}
        >
          {phase === "recording"
            ? <Square className="w-6 sm:w-8 h-6 sm:h-8 fill-current" />
            : <Mic className="w-6 sm:w-8 h-6 sm:h-8" />
          }
        </button>
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md px-2">
        {phase === "recording"
          ? "Speak clearly. Click stop when finished — you can review and edit before submitting."
          : "Click the microphone to start recording your answer."}
      </p>
    </div>
  );
}
