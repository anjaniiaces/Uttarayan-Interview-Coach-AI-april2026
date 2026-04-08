import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Loader2, AlertCircle,
  Play, Pause, RotateCcw, Send, CheckCircle2,
  Wand2, AudioLines, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface SpeechRecorderProps {
  onComplete: (transcript: string) => void;
  isProcessing: boolean;
}

type Phase = "idle" | "recording" | "reviewing";
type TranscriptSource = "whisper" | "browser" | "none";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function SpeechRecorder({ onComplete, isProcessing }: SpeechRecorderProps) {
  const [phase, setPhase]               = useState<Phase>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [webSpeechText, setWebSpeechText]   = useState("");
  const [whisperText, setWhisperText]       = useState<string | null>(null);
  const [finalText, setFinalText]           = useState("");
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource>("none");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [whisperError, setWhisperError]     = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [isSupported, setIsSupported]       = useState(true);

  const recognitionRef   = useRef<any>(null);
  const finalTransRef    = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const audioBlobRef     = useRef<Blob | null>(null);
  const audioUrlRef      = useRef<string | null>(null);
  const audioElRef       = useRef<HTMLAudioElement | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const mimeTypeRef      = useRef("audio/webm");

  // ── Setup Web Speech API ──────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setIsSupported(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = "en-IN";
    if ("grammars" in recognition)
      recognition.grammars = new (window as any).SpeechGrammarList();

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
        console.warn("[SpeechRecognition] error:", event.error);
    };

    recognitionRef.current = recognition;
    return () => { try { recognition.abort(); } catch {} };
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
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
    streamRef.current     = null;
    audioChunksRef.current  = [];
    audioBlobRef.current    = null;
    finalTransRef.current   = "";
    setIsPlaying(false);
    setLiveTranscript("");
    setWebSpeechText("");
    setWhisperText(null);
    setFinalText("");
    setTranscriptSource("none");
    setError(null);
    setWhisperError(null);
    setIsTranscribing(false);
  }, []);

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    resetState();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (e: any) {
      console.error("[MediaRecorder] getUserMedia failed:", e);
      setError("Microphone access denied. Please grant permission and try again.");
      return;
    }

    const mimeType =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
      MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm"             :
      MediaRecorder.isTypeSupported("audio/mp4")              ? "audio/mp4"              :
      "audio/ogg";
    mimeTypeRef.current = mimeType;
    console.log("[MediaRecorder] using mimeType:", mimeType);

    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      const wsText = finalTransRef.current.trim();
      setWebSpeechText(wsText);

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      console.log(`[MediaRecorder] blob size: ${blob.size} bytes, chunks: ${audioChunksRef.current.length}`);
      audioBlobRef.current = blob;
      audioUrlRef.current  = URL.createObjectURL(blob);

      setPhase("reviewing");
      setIsTranscribing(true);
      setWhisperError(null);

      if (blob.size < 500) {
        console.warn("[Whisper] Skipping — blob too small:", blob.size, "bytes");
        setWhisperError("Recording was too short — using browser transcript.");
        setFinalText(wsText);
        setTranscriptSource("browser");
        setIsTranscribing(false);
        return;
      }

      try {
        const base  = mimeType.split(";")[0];
        const extMap: Record<string, string> = {
          "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg",
        };
        const ext = extMap[base] || "webm";
        const fd  = new FormData();
        fd.append("audio", blob, `recording.${ext}`);
        console.log(`[Whisper] Sending ${blob.size} bytes as ${ext}…`);
        const resp = await fetch("/api/transcribe-audio", { method: "POST", body: fd });
        const data = await resp.json();
        if (resp.ok && data.transcript) {
          console.log("[Whisper] Success:", data.transcript.slice(0, 80));
          setWhisperText(data.transcript);
          setFinalText(data.transcript);
          setTranscriptSource("whisper");
        } else {
          throw new Error(data.message || "Empty response");
        }
      } catch (e: any) {
        console.error("[Whisper] Failed:", e?.message ?? e);
        setWhisperError(`AI transcription unavailable — using browser transcript.`);
        setFinalText(wsText);
        setTranscriptSource(wsText ? "browser" : "none");
      } finally {
        setIsTranscribing(false);
      }
    };

    mr.start(250); // collect every 250ms
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
      audioElRef.current = new Audio(audioUrlRef.current);
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
    if (!text) return;
    audioElRef.current?.pause();
    onComplete(text);
  }, [finalText, onComplete]);

  // ── Unsupported browser ───────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <h3 className="text-destructive font-semibold mb-1">Browser Not Supported</h3>
        <p className="text-sm text-destructive/80">
          Please use Google Chrome or Microsoft Edge to record your answer.
        </p>
      </div>
    );
  }

  // ── REVIEW PHASE ──────────────────────────────────────────────────────────
  if (phase === "reviewing") {
    const sourceLabel =
      transcriptSource === "whisper" ? "AI Transcript (Whisper)" :
      transcriptSource === "browser" ? "Browser Transcript (fallback)" : "";

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col w-full max-w-2xl mx-auto space-y-5 px-4 sm:px-0"
      >
        {/* Playback bar */}
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
              Playback your recording
            </p>
            <div className="flex items-end gap-[3px] h-4">
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-opacity ${isPlaying ? "bg-primary" : "bg-primary/40"}`}
                  style={{ width: 3, height: `${50 + Math.sin(i * 0.85) * 50}%` }}
                />
              ))}
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {isPlaying ? "Playing…" : "Click ▶"}
          </span>
        </div>

        {/* Transcript comparison (reference only) */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="glass-card p-4 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <AudioLines className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Browser (reference)
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/60 italic min-h-[48px]">
              {webSpeechText || <span className="text-muted-foreground/40">Nothing captured</span>}
            </p>
          </div>

          <div className="glass-card p-4 rounded-2xl space-y-2 border border-primary/20">
            <div className="flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                AI (Whisper)
              </span>
              {isTranscribing && <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />}
              {!isTranscribing && transcriptSource === "whisper" && (
                <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 min-h-[48px]">
              {isTranscribing
                ? <span className="text-muted-foreground/50 animate-pulse">Analysing recording…</span>
                : whisperText
                  ? whisperText
                  : <span className="text-muted-foreground/40">—</span>
              }
            </p>
          </div>
        </div>

        {/* Final read-only transcript */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${transcriptSource === "whisper" ? "text-green-400" : "text-yellow-400"}`} />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Transcript to be submitted
              {sourceLabel ? ` · ${sourceLabel}` : ""}
            </span>
          </div>

          {isTranscribing ? (
            <div className="min-h-[120px] w-full px-4 py-3 rounded-xl glass-card flex items-center justify-center gap-2 text-muted-foreground/60 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              AI is processing your recording…
            </div>
          ) : finalText ? (
            <div
              data-testid="display-final-transcript"
              className="min-h-[120px] w-full px-4 py-3 rounded-xl glass-card text-foreground text-base leading-relaxed border border-white/10 select-text"
            >
              {finalText}
            </div>
          ) : (
            <div className="min-h-[120px] w-full px-4 py-3 rounded-xl glass-card flex items-center justify-center text-muted-foreground/40 text-sm border border-white/5">
              No transcript captured — please re-record.
            </div>
          )}

          {whisperError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-300">{whisperError}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Listen to your recording above, then submit. Use Re-record if you want to try again.
          </p>
        </div>

        {/* Actions */}
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

  // ── IDLE / RECORDING PHASE ────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">

      {/* Live transcript display */}
      <div className="w-full relative">
        <div className={`min-h-[150px] sm:min-h-[200px] w-full p-4 sm:p-6 rounded-2xl glass-card transition-all duration-500
          ${phase === "recording" ? "border-primary/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]" : ""}`}>
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

      {/* Mic button */}
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
          ? "Speak clearly. Click stop when done — the AI will transcribe your recording."
          : "Click the microphone to start recording your answer."}
      </p>
    </div>
  );
}
