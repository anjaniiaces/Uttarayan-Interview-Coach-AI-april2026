import { useRoute, Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock, MessageSquareQuote, FileText } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useInterview } from "@/hooks/use-interviews";
import { useQuestions } from "@/hooks/use-questions";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function InterviewDetail() {
  const [, params] = useRoute("/interview/:id");
  const interviewId = parseInt(params?.id || "0");
  
  const { data: interview, isLoading: isLoadingInterview } = useInterview(interviewId);
  const { data: questions, isLoading: isLoadingQuestions } = useQuestions(interviewId);

  if (isLoadingInterview || isLoadingQuestions) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!interview) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Interview Not Found</h2>
          <Link href="/" className="text-primary hover:underline">Return to Dashboard</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
        
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          
          <div className="relative z-10">
            <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-4">
              Session Overview
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 text-gradient">
              {interview.role}
            </h2>
            <div className="flex items-center text-muted-foreground text-sm">
              <Clock className="w-4 h-4 mr-2" />
              {interview.createdAt ? format(new Date(interview.createdAt), "MMMM d, yyyy • h:mm a") : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold font-display flex items-center gap-2">
            <MessageSquareQuote className="w-6 h-6 text-primary" />
            Interview Questions
          </h3>
          {questions && questions.some(q => q.status === "completed") && (
            <Link href={`/interview/${interviewId}/report`}>
              <button
                data-testid="button-view-report"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5"
              >
                <FileText className="w-4 h-4" />
                Session Report
              </button>
            </Link>
          )}
        </div>
        
        {(!questions || questions.length === 0) ? (
          <div className="glass-card p-10 rounded-2xl text-center border-dashed">
            <p className="text-muted-foreground">
              No questions have been generated for this interview yet.
              (Backend integration pending)
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {questions.map((question, index) => {
              const isCompleted = question.status === 'completed';
              
              return (
                <Link key={question.id} href={`/interview/${interviewId}/question/${question.id}`}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`block p-6 rounded-2xl border transition-all duration-300 cursor-pointer
                      ${isCompleted 
                        ? 'bg-card/40 border-white/5 hover:bg-card/60' 
                        : 'bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40 shadow-[0_0_15px_rgba(59,130,246,0.05)]'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {isCompleted ? (
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                            {index + 1}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-foreground leading-snug mb-2">
                          {question.questionText}
                        </h4>
                        
                        {isCompleted && question.score !== null && (
                          <div className="flex items-center gap-2 mt-3">
                            <div className="text-sm font-semibold px-2.5 py-1 rounded bg-white/5 border border-white/10 text-foreground">
                              Score: <span className={
                                question.score >= 80 ? "text-green-400" : 
                                question.score >= 60 ? "text-yellow-400" : "text-red-400"
                              }>{question.score}/100</span>
                            </div>
                            <span className="text-sm text-muted-foreground line-clamp-1 flex-1">
                              {question.feedback}
                            </span>
                          </div>
                        )}
                        
                        {!isCompleted && (
                          <span className="inline-block mt-2 text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                            Pending Response
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
