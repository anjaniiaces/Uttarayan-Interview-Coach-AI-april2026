import { useRoute, Link } from "wouter";
import { ArrowLeft, BrainCircuit, Quote, ChevronRight, RotateCcw, Lightbulb, Sparkles, UserCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useQuestions, useAnswerQuestion, useResetQuestion } from "@/hooks/use-questions";
import { SpeechRecorder } from "@/components/SpeechRecorder";
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function QuestionSession() {
  const [, params] = useRoute("/interview/:interviewId/question/:id");
  const interviewId = parseInt(params?.interviewId || "0");
  const questionId = parseInt(params?.id || "0");
  
  const { data: questions, isLoading } = useQuestions(interviewId);
  const answerMutation = useAnswerQuestion();
  const resetMutation = useResetQuestion();

  const question = questions?.find(q => q.id === questionId);
  const isCompleted = question?.status === 'completed';
  
  // Text-to-Speech for the question
  useEffect(() => {
    if (question && !isCompleted) {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(question.questionText);
      utterance.lang = 'en-IN';
      // Find an Indian voice if available
      const voices = synth.getVoices();
      const indianVoice = voices.find(v => v.lang === 'en-IN' || v.name.includes('India'));
      if (indianVoice) utterance.voice = indianVoice;
      synth.speak(utterance);
      return () => synth.cancel();
    }
  }, [question?.id, isCompleted]);

  // Find next question for flow
  const currentIndex = questions?.findIndex(q => q.id === questionId) ?? -1;
  const nextQuestion = (questions && currentIndex >= 0 && currentIndex < questions.length - 1) 
    ? questions[currentIndex + 1] 
    : null;

  const handleComplete = async (transcript: string) => {
    try {
      await answerMutation.mutateAsync({ id: questionId, transcript });
    } catch (error) {
      console.error("Failed to submit:", error);
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync(questionId);
    } catch (error) {
      console.error("Failed to reset:", error);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!question) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Question Not Found</h2>
          <Link href={`/interview/${interviewId}`} className="text-primary hover:underline">
            Return to Interview
          </Link>
        </div>
      </Layout>
    );
  }

  // Circular progress math
  const score = question.score || 0;
  const circumference = 2 * Math.PI * 45; // radius 45
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const scoreColor = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171';

  return (
    <Layout>
      <div className="mb-8">
        <Link href={`/interview/${interviewId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Questions
        </Link>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        {/* Question Header */}
        <div className="mb-10 text-center">
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 1, -1, 0]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity,
                ease: "easeInOut" 
              }}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/20 to-blue-400/20 flex items-center justify-center border-2 border-primary/30 relative"
            >
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-20" />
              <UserCircle className="w-16 h-16 text-primary" />
            </motion.div>
          </div>
          <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm font-bold text-primary mb-6">
            Question {currentIndex + 1}
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground leading-tight">
            {question.questionText}
          </h2>
        </div>

        {!isCompleted ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-12"
          >
            <SpeechRecorder 
              onComplete={handleComplete} 
              isProcessing={answerMutation.isPending} 
            />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 mt-8"
          >
            {/* Results Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              
              {/* Score Card */}
              <div className="glass-panel p-4 sm:p-8 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4 sm:mb-6">Overall Score</h3>
                
                <div className="relative w-24 sm:w-32 h-24 sm:h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background track */}
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/5" />
                    {/* Progress track */}
                    <motion.circle 
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      cx="50" cy="50" r="45" 
                      stroke={scoreColor} 
                      strokeWidth="8" 
                      fill="none" 
                      strokeLinecap="round"
                      style={{ strokeDasharray: circumference }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl sm:text-4xl font-display font-bold text-foreground">{score}</span>
                  </div>
                </div>
              </div>
              {/* Speech Coaching Scores */}
              <div className="glass-panel p-4 sm:p-6 rounded-3xl">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">
                  Speech Coaching
                </h3>

                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">

                  <div className="flex justify-between">
                    <span>Speech Clarity</span>
                    <span>{question.speechClarity ?? "-"} / 10</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Confidence</span>
                    <span>{question.confidence ?? "-"} / 10</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Answer Structure</span>
                    <span>{question.structure ?? "-"} / 10</span>
                  </div>

                  <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                    <span className="text-muted-foreground">Filler Words</span>
                    <span className={question.fillerCount && question.fillerCount > 5 ? "text-red-400" : "text-green-400"}>
                      {question.fillerCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              {/* Feedback Card */}
              <div className="col-span-1 md:col-span-2 glass-panel p-4 sm:p-8 rounded-3xl relative">
                <div className="absolute top-6 right-6 text-primary/20">
                  <BrainCircuit className="w-12 h-12" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-primary mb-4">AI Analysis</h3>
                <div className="prose prose-invert max-w-none space-y-4">
                  <p className="text-sm sm:text-lg leading-relaxed text-foreground/90 font-medium">
                    {question.feedback || "No feedback generated."}
                  </p>
                  {question.gapAnalysis && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <p className="text-sm text-muted-foreground">Speech Gap Analysis:</p>
                      <p className="text-sm italic">{question.gapAnalysis}</p>
                    </div>
                  )}
                  {question.catchphrases && question.catchphrases.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-full mb-1">Catchphrases Detected:</span>
                      {question.catchphrases.map((phrase, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transcript Card */}
            <div className="glass-card p-8 rounded-3xl border border-white/5">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground mb-4 uppercase tracking-widest">
                <Quote className="w-4 h-4" />
                Your Transcript
              </h3>
              <p className="text-foreground/80 leading-relaxed italic text-lg border-l-2 border-primary/50 pl-4">
                "{question.transcript}"
              </p>
            </div>

            {/* Improvement Pointers */}
            {question.improvementPointers && (
              <div className="glass-panel p-8 rounded-3xl border border-blue-500/10">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-400 mb-4 uppercase tracking-widest">
                  <Lightbulb className="w-4 h-4" />
                  Speech & Delivery Pointers
                </h3>
                <p className="text-foreground/90 leading-relaxed font-medium">
                  {question.improvementPointers}
                </p>
              </div>
            )}

            {/* Suggested Answer (STAR Model) */}
            {question.suggestedAnswer && (
              <div className="glass-panel p-8 rounded-3xl border border-purple-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Sparkles className="w-24 h-24 text-purple-500" />
                </div>
                <h3 className="text-sm font-semibold flex items-center gap-2 text-purple-400 mb-4 uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" />
                  Suggested Reply
                </h3>
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground/90 leading-relaxed italic border-l-4 border-purple-500/30 pl-6 relative">
                    <span className="absolute -left-2 top-0 text-4xl text-purple-500/20 font-serif">"</span>
                    {question.suggestedAnswer}
                    <span className="absolute -right-2 bottom-0 text-4xl text-purple-500/20 font-serif">"</span>
                  </p>
                </div>
              </div>
            )}
            
            {/* Next Actions */}
            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="flex items-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-semibold hover:bg-white/10 transition-all"
              >
                <RotateCcw className={`w-5 h-5 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
                Try Again
              </button>

              {nextQuestion ? (
                <Link href={`/interview/${interviewId}/question/${nextQuestion.id}`}>
                  <button className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all shadow-xl hover:-translate-y-1">
                    Next Question
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </Link>
              ) : (
                <Link href={`/interview/${interviewId}`}>
                  <button className="flex items-center gap-2 px-8 py-4 rounded-xl bg-secondary border border-border text-foreground font-semibold hover:bg-secondary/80 transition-all">
                    Finish Session
                  </button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
