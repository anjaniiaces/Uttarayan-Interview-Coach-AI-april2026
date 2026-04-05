import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").notNull(),
  questionText: text("question_text").notNull(),
  transcript: text("transcript"),
  feedback: text("feedback"),
  score: integer("score"),

  speechClarity: integer("speech_clarity"),
  confidence: integer("confidence"),
  structure: integer("structure"),

  suggestedAnswer: text("suggested_answer"),
  improvementPointers: text("improvement_pointers"),

  fillerCount: integer("filler_count"),
  gapAnalysis: text("gap_analysis"),
  catchphrases: text("catchphrases").array(),

  status: text("status"),
});

export const sessionReports = pgTable("session_reports", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").notNull(),
  candidateName: text("candidate_name").notNull(),
  overallScore: integer("overall_score"),
  avgSpeechClarity: integer("avg_speech_clarity"),
  avgConfidence: integer("avg_confidence"),
  avgStructure: integer("avg_structure"),
  totalFillerWords: integer("total_filler_words"),
  strengths: text("strengths"),
  areasOfImprovement: text("areas_of_improvement"),
  recommendations: text("recommendations"),
  overallAnalysis: text("overall_analysis"),
  performanceLevel: text("performance_level"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInterviewSchema = createInsertSchema(interviews).pick({ role: true });
export const insertQuestionSchema = createInsertSchema(questions).pick({ interviewId: true, questionText: true });
export const insertSessionReportSchema = createInsertSchema(sessionReports).omit({ id: true, createdAt: true });

export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type SessionReport = typeof sessionReports.$inferSelect;
export type InsertSessionReport = z.infer<typeof insertSessionReportSchema>;
