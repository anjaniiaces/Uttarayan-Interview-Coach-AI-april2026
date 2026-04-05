import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.interviews.list.path, async (req, res) => {
    const interviews = await storage.getInterviews();
    res.json(interviews);
  });

  app.get(api.interviews.get.path, async (req, res) => {
    const interview = await storage.getInterview(Number(req.params.id));
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    res.json(interview);
  });

  app.post(api.interviews.create.path, async (req, res) => {
    try {
      const input = api.interviews.create.input.parse(req.body);
      const interview = await storage.createInterview(input);

      // Generate some default questions for the role
      const prompt = `Generate 5 standard behavioral interview questions for a ${input.role} position. Format the output as a JSON array of strings. Only return the JSON array, no other text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
      });

      let questionsList = [];
      try {
        const content = response.choices[0]?.message?.content || "[]";
        // Clean up markdown code blocks if present
        const cleanedContent = content.replace(/```json\n|\n```|```/g, '');
        questionsList = JSON.parse(cleanedContent);
      } catch (e) {
        questionsList = [
          "Tell me about a time you faced a difficult challenge at work.",
          "Describe a situation where you had to work with a difficult team member.",
          "Where do you see yourself in 5 years?"
        ];
      }

      for (const q of questionsList) {
        await storage.createQuestion({ interviewId: interview.id, questionText: q });
      }

      res.status(201).json(interview);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.questions.list.path, async (req, res) => {
    const questions = await storage.getQuestions(Number(req.params.interviewId));
    res.json(questions);
  });

  app.post(api.questions.answer.path, async (req, res) => {
    try {
      const input = api.questions.answer.input.parse(req.body);
      const questionId = Number(req.params.id);

      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }

      // Analyze transcript with OpenAI
              const prompt = `
You are an expert interview coach and communication mentor evaluating a spoken interview answer.

The candidate was asked the interview question:
"${question.questionText}"

The transcript below was captured via speech-to-text and may contain minor transcription artifacts (spelling inconsistencies, missing punctuation, odd word substitutions). Do NOT penalise for these — focus on the spoken intent and actual content.

Candidate's transcript:
"${input.transcript}"

─────────────────────────────────────────────
SCORING PRIORITIES (in order of importance)
─────────────────────────────────────────────

1. CONTENT & RELEVANCE (highest weight — drives the overall score)
   - Does the answer actually address the question asked?
   - Are there concrete examples, facts, or outcomes mentioned?
   - Is the depth of the answer appropriate for the question?
   - Reward substance over style.

2. STAR STRUCTURE (important, but flexible)
   - Recognise STAR elements (Situation, Task, Action, Result) even if presented in a non-chronological order.
   - Partial STAR (e.g., strong Action + Result without an explicit Situation) should still be rewarded.
   - Do NOT penalise heavily if the candidate naturally weaves all elements in without using the rigid S→T→A→R sequence.

3. SPEECH DELIVERY (secondary — weight it less)
   - Clarity of expression and confidence.
   - Filler words / hesitation patterns (e.g., "um", "you know", "basically").
   - Identify recurring catchphrases or pet phrases the candidate overuses.
   - Pacing and fluency.
   - NOTE: grammatical imperfections are largely ignored because this is a speech-to-text transcription. Only flag severe incoherence that genuinely hinders understanding.

4. PROFESSIONAL COMMUNICATION
   - Vocabulary suited to the role.
   - Conciseness and persuasiveness.

─────────────────────────────────────────────
FEEDBACK TONE
─────────────────────────────────────────────
- If score > 50: open with a highly positive, encouraging statement (e.g., "Excellent progress! You're showing great potential...").
- If this is a retry and the score improved: open with even more enthusiastic acknowledgement of their growth.
- Always be constructive, specific, and actionable.

─────────────────────────────────────────────
Return ONLY valid JSON — no markdown, no extra text.
─────────────────────────────────────────────

{
  "feedback": "string",
  "score": number,
  "speechClarity": number,
  "confidence": number,
  "structure": number,
  "suggestedAnswer": "STAR model answer for this question",
  "improvementPointers": "specific, actionable improvement tips",
  "fillerCount": number,
  "gapAnalysis": "analysis of gaps, hesitations, or pacing issues in the spoken answer",
  "catchphrases": ["string"]
}

Rules:
- score: 0–100 (content + relevance weigh most heavily)
- speechClarity: 0–10
- confidence: 0–10
- structure: 0–10 (give partial credit for non-chronological STAR)
- Do not omit any field.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      let feedback = "No feedback generated.";
      let score = 0;
      let speechClarity = 0;
      let confidence = 0;
      let structure = 0;
      let suggestedAnswer = "";
      let improvementPointers = "";
      let fillerCount = 0;
      let gapAnalysis = "";
      let catchphrases: string[] = [];

      const raw = response.choices[0].message.content || "{}";
      console.log("DEBUG: RAW AI RESPONSE:", raw);

      let analysis: any = {};

      try {
        const cleanedRaw = raw.replace(/```json\n|\n```|```/g, '').trim();
        analysis = JSON.parse(cleanedRaw);
      } catch (e) {
        console.error("DEBUG: JSON parse failed", e);
      }

      feedback = analysis.feedback ?? "No feedback generated";
      score = analysis.score ?? 0;
      speechClarity = analysis.speechClarity ?? 0;
      confidence = analysis.confidence ?? 0;
      structure = analysis.structure ?? 0;
      suggestedAnswer = analysis.suggestedAnswer ?? "";
      improvementPointers = analysis.improvementPointers ?? "";
      fillerCount = analysis.fillerCount ?? 0;
      gapAnalysis = analysis.gapAnalysis ?? "";
      catchphrases = analysis.catchphrases ?? [];

      console.log("DEBUG: Parsed AI Analysis:", {
        score,
        speechClarity,
        confidence,
        structure,
        fillerCount,
        catchphrases
      });

      const updatedQuestion = await storage.updateQuestionWithAnswer(
        questionId,
        input.transcript,
        feedback,
        score,
        speechClarity,
        confidence,
        structure,
        suggestedAnswer,
        improvementPointers,
        fillerCount,
        gapAnalysis,
        catchphrases
      );

      // Logic for follow-up questions
      if (score > 70) {
        const followUpPrompt = `Based on the candidate's answer: "${input.transcript}", generate a challenging follow-up question. Return ONLY the question text as a string.`;
        const followUpRes = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: followUpPrompt }],
        });
        const followUpText = followUpRes.choices[0].message.content;
        if (followUpText) {
          await storage.createQuestion({ interviewId: question.interviewId, questionText: followUpText });
        }
      }

      console.log("DEBUG: Updated Question from Storage:", updatedQuestion);

      res.status(200).json(updatedQuestion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post("/api/questions/:id/reset", async (req, res) => {
    try {
      const questionId = Number(req.params.id);
      const updated = await storage.resetQuestion(questionId);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to reset question" });
    }
  });

  // GET session report for an interview
  app.get("/api/interviews/:id/report", async (req, res) => {
    try {
      const interviewId = Number(req.params.id);
      const report = await storage.getSessionReport(interviewId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // POST generate and save session report
  app.post("/api/interviews/:id/report", async (req, res) => {
    try {
      const interviewId = Number(req.params.id);
      const { candidateName } = z.object({ candidateName: z.string().min(1) }).parse(req.body);

      const interview = await storage.getInterview(interviewId);
      if (!interview) return res.status(404).json({ message: "Interview not found" });

      const allQuestions = await storage.getQuestions(interviewId);
      const completedQuestions = allQuestions.filter(q => q.status === "completed");

      if (completedQuestions.length === 0) {
        return res.status(400).json({ message: "No completed answers to analyze" });
      }

      // Compute aggregate stats
      const avgScore = Math.round(completedQuestions.reduce((s, q) => s + (q.score || 0), 0) / completedQuestions.length);
      const avgSpeechClarity = Math.round(completedQuestions.reduce((s, q) => s + (q.speechClarity || 0), 0) / completedQuestions.length);
      const avgConfidence = Math.round(completedQuestions.reduce((s, q) => s + (q.confidence || 0), 0) / completedQuestions.length);
      const avgStructure = Math.round(completedQuestions.reduce((s, q) => s + (q.structure || 0), 0) / completedQuestions.length);
      const totalFillerWords = completedQuestions.reduce((s, q) => s + (q.fillerCount || 0), 0);

      const performanceLevel = avgScore >= 80 ? "Excellent" : avgScore >= 65 ? "Good" : avgScore >= 50 ? "Average" : "Needs Improvement";

      // Generate overall analysis with OpenAI
      const questionsContext = completedQuestions.map((q, i) =>
        `Q${i + 1}: "${q.questionText}"\nAnswer: "${q.transcript}"\nScore: ${q.score}/100\nFeedback: ${q.feedback}`
      ).join("\n\n---\n\n");

      const reportPrompt = `
You are an expert career coach and interview evaluator.

Candidate: ${candidateName}
Role Applied For: ${interview.role}
Interview Date: ${new Date().toLocaleDateString("en-IN")}

Here are all ${completedQuestions.length} answered interview questions:

${questionsContext}

Based on the above, generate a comprehensive session report in VALID JSON with these exact fields:

{
  "overallAnalysis": "2-3 sentence executive summary of the candidate's overall performance",
  "strengths": "3-4 bullet points of key strengths (start each with •)",
  "areasOfImprovement": "3-4 bullet points of areas that need improvement (start each with •)",
  "recommendations": "3-4 specific, actionable recommendations for the candidate to improve (start each with •)"
}

Be specific, constructive, and encouraging. Reference actual answers where possible.
Return ONLY valid JSON.`;

      const reportResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: reportPrompt }],
      });

      let reportData: any = {};
      try {
        const raw = reportResponse.choices[0].message.content || "{}";
        reportData = JSON.parse(raw);
      } catch {
        reportData = {
          overallAnalysis: "Session analysis could not be generated.",
          strengths: "• Communication skills\n• Willingness to participate",
          areasOfImprovement: "• Further practice needed",
          recommendations: "• Continue practicing with mock interviews"
        };
      }

      // Ensure array fields are always stored as newline-separated strings
      const toStr = (val: any): string => {
        if (Array.isArray(val)) return val.join("\n");
        if (typeof val === "string") return val;
        return String(val || "");
      };

      const savedReport = await storage.createOrUpdateSessionReport({
        interviewId,
        candidateName,
        overallScore: avgScore,
        avgSpeechClarity,
        avgConfidence,
        avgStructure,
        totalFillerWords,
        performanceLevel,
        overallAnalysis: toStr(reportData.overallAnalysis),
        strengths: toStr(reportData.strengths),
        areasOfImprovement: toStr(reportData.areasOfImprovement),
        recommendations: toStr(reportData.recommendations),
      });

      res.status(201).json(savedReport);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      console.error("Report generation error:", err);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Seed initial data if none exists
  const existingInterviews = await storage.getInterviews();
  if (existingInterviews.length === 0) {
    const interview = await storage.createInterview({ role: "Software Engineer" });
    await storage.createQuestion({ interviewId: interview.id, questionText: "Tell me about a time you had to optimize a piece of code that was running too slowly." });
    await storage.createQuestion({ interviewId: interview.id, questionText: "How do you handle disagreements with teammates on technical architecture?" });
  }

  return httpServer;
}
