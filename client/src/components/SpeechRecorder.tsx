import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface SpeechRecorderProps {
  onComplete: (transcript: string) => void;
  isProcessing: boolean;
}

// Global declaration for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function SpeechRecorder({ onComplete, isProcessing }: SpeechRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    // Disable any potential browser-side grammar correction/autocorrect
    if ('grammars' in recognition) {
      recognition.grammars = new (window as any).SpeechGrammarList();
    }

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = finalTranscriptRef.current;

      // Only process from the current result index to avoid duplicates on mobile
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      finalTranscriptRef.current = finalTranscript;
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error !== 'no-speech') {
        setError(`Microphone error: ${event.error}. Please ensure permissions are granted.`);
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setTranscript("");
      finalTranscriptRef.current = "";
      setError(null);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    }
  }, [isRecording]);

  const handleSubmit = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    }
    if (transcript.trim()) {
      onComplete(transcript.trim());
    }
  };

  if (!isSupported) {
    return (
      <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <h3 className="text-destructive font-semibold mb-1">Browser Not Supported</h3>
        <p className="text-sm text-destructive/80">
          Your browser does not support the Web Speech API. Please try using Google Chrome or Microsoft Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
      
      {/* Transcript Display Area */}
      <div className="w-full relative">
        <div className={`min-h-[150px] sm:min-h-[200px] w-full p-4 sm:p-6 rounded-2xl glass-card transition-all duration-500 ${isRecording ? 'border-primary/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]' : ''}`}>
          {transcript ? (
            <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {transcript}
            </p>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/60">
              <p className="text-center font-medium text-sm sm:text-base">
                {isRecording ? "Listening..." : "Your answer will appear here..."}
              </p>
            </div>
          )}
          
          <AnimatePresence>
            {isRecording && (
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
          <p className="absolute -bottom-8 left-0 right-0 text-center text-sm text-destructive mt-2">
            {error}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
        <button
          onClick={toggleRecording}
          disabled={isProcessing}
          className={`
            relative group flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 rounded-full
            transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white animate-record-pulse' 
              : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 shadow-xl shadow-primary/20 hover:shadow-primary/40'
            }
          `}
        >
          {isRecording ? (
            <Square className="w-6 sm:w-8 h-6 sm:h-8 fill-current" />
          ) : (
            <Mic className="w-6 sm:w-8 h-6 sm:h-8" />
          )}
        </button>

        <AnimatePresence>
          {(transcript.trim().length > 0 || isProcessing) && (
            <motion.div
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              className="w-full sm:w-auto"
            >
              <Button 
                onClick={handleSubmit} 
                disabled={isProcessing || transcript.trim().length === 0 || isRecording}
                size="lg"
                className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl font-semibold bg-white text-black hover:bg-white/90 shadow-xl w-full sm:w-auto text-sm sm:text-base"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 mr-2 animate-spin text-primary" />
                    Analyzing...
                  </>
                ) : (
                  "Submit Answer"
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md px-2">
        {isRecording 
          ? "Speak clearly into your microphone. Click the stop button when finished." 
          : "Click the microphone to start recording your answer."}
      </p>
    </div>
  );
}
