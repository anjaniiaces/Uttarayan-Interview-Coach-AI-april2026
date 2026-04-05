import { useRoute, Link } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, FileText, Star, TrendingUp, AlertCircle, Lightbulb, CheckCircle2, User, Award, BarChart2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoSrc from "@assets/uttarayan_logo_1775291319502.jpeg";

interface SessionReport {
  id: number;
  interviewId: number;
  candidateName: string;
  overallScore: number | null;
  avgSpeechClarity: number | null;
  avgConfidence: number | null;
  avgStructure: number | null;
  totalFillerWords: number | null;
  performanceLevel: string | null;
  overallAnalysis: string | null;
  strengths: string | null;
  areasOfImprovement: string | null;
  recommendations: string | null;
  createdAt: string | null;
}

interface Question {
  id: number;
  questionText: string;
  score: number | null;
  speechClarity: number | null;
  confidence: number | null;
  structure: number | null;
  fillerCount: number | null;
  feedback: string | null;
  transcript: string | null;
  status: string | null;
}

interface Interview {
  id: number;
  role: string;
  createdAt: string | null;
}

function ScoreBadge({ score, max = 100 }: { score: number | null; max?: number }) {
  const val = score ?? 0;
  const pct = (val / max) * 100;
  const color = pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";
  const bg = pct >= 80 ? "bg-green-400/10 border-green-400/20" : pct >= 60 ? "bg-yellow-400/10 border-yellow-400/20" : "bg-red-400/10 border-red-400/20";
  return (
    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${bg} ${color}`}>
      {val}/{max}
    </span>
  );
}

function parseBulletText(text: string | null): string[] {
  if (!text) return [];
  let str = text.trim();
  // Handle PostgreSQL array format: {"item1","item2"} or {item1,item2}
  if (str.startsWith("{") && str.endsWith("}")) {
    const inner = str.slice(1, -1);
    const items = inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map(s => s.replace(/^"|"$/g, "").replace(/\\"/g, '"').trim())
      .filter(Boolean);
    return items.map(s => s.replace(/^[•\-]\s*/, ""));
  }
  // Handle JSON array format
  if (str.startsWith("[")) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.map((s: string) => String(s).replace(/^[•\-]\s*/, ""));
    } catch {}
  }
  // Handle newline-separated strings
  return str.split("\n").filter(l => l.trim()).map(l => l.replace(/^[•\-]\s*/, ""));
}

function BulletList({ text }: { text: string | null }) {
  if (!text) return <p className="text-muted-foreground italic">—</p>;
  const lines = parseBulletText(text);
  if (lines.length === 0) return <p className="text-muted-foreground italic">—</p>;
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-foreground/90">
          <span className="text-primary mt-1 flex-shrink-0">•</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SessionReport() {
  const [, params] = useRoute("/interview/:id/report");
  const interviewId = parseInt(params?.id || "0");
  const [candidateName, setCandidateName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: interview } = useQuery<Interview>({
    queryKey: ['/api/interviews', interviewId],
    queryFn: async () => {
      const res = await fetch(`/api/interviews/${interviewId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch interview");
      return res.json();
    },
    enabled: interviewId > 0,
  });

  const { data: questions } = useQuery<Question[]>({
    queryKey: ['/api/interviews', interviewId, 'questions'],
    queryFn: async () => {
      const res = await fetch(`/api/interviews/${interviewId}/questions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    enabled: interviewId > 0,
  });

  const { data: report, isLoading: isLoadingReport } = useQuery<SessionReport>({
    queryKey: ['/api/interviews', interviewId, 'report'],
    queryFn: async () => {
      const res = await fetch(`/api/interviews/${interviewId}/report`, { credentials: "include" });
      if (res.status === 404) return null as any;
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    enabled: interviewId > 0,
  });

  const generateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/interviews/${interviewId}/report`, { candidateName: name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interviews', interviewId, 'report'] });
      setShowForm(false);
    },
  });

  const completedQuestions = questions?.filter(q => q.status === "completed") ?? [];

  const downloadPDF = async () => {
    if (!report || !interview) return;

    // Load logo as base64
    const logoBase64 = await new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      };
      img.onerror = () => resolve("");
      img.src = logoSrc;
    });

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    let y = margin;

    // ── Header bar ──
    doc.setFillColor(205, 85, 0);
    doc.rect(0, 0, pageW, 30, "F");

    // Real logo top-right (square logo, 22×22mm)
    const logoSize = 22;
    const logoX = pageW - margin - logoSize;
    const logoY = 4;
    if (logoBase64) {
      doc.addImage(logoBase64, "JPEG", logoX, logoY, logoSize, logoSize, undefined, "FAST");
    } else {
      // fallback text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Uttarayan", pageW - margin, 11, { align: "right" });
    }

    // Title left (white text on orange bar)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text("Session Performance Report", margin, 13);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`, margin, 21);

    y = 38;

    // ── Candidate Profile ──
    doc.setFillColor(245, 245, 240);
    doc.roundedRect(margin, y, pageW - margin * 2, 32, 3, 3, "F");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CANDIDATE PROFILE", margin + 5, y + 8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`Name:`, margin + 5, y + 17);
    doc.setFont("helvetica", "bold");
    doc.text(report.candidateName, margin + 25, y + 17);

    doc.setFont("helvetica", "normal");
    doc.text(`Role:`, margin + 5, y + 24);
    doc.setFont("helvetica", "bold");
    doc.text(interview.role, margin + 25, y + 24);

    // Performance badge top right of profile box
    const perfColor = (report.overallScore ?? 0) >= 80 ? [34, 197, 94] as [number, number, number]
      : (report.overallScore ?? 0) >= 65 ? [234, 179, 8] as [number, number, number]
      : (report.overallScore ?? 0) >= 50 ? [249, 115, 22] as [number, number, number]
      : [239, 68, 68] as [number, number, number];

    doc.setFillColor(...perfColor);
    doc.roundedRect(pageW - margin - 42, y + 5, 42, 22, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`${report.overallScore ?? 0}`, pageW - margin - 21, y + 19, { align: "center" });
    doc.setFontSize(7);
    doc.text("OVERALL SCORE", pageW - margin - 21, y + 25, { align: "center" });

    y += 40;

    // ── Score Summary Table ──
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PERFORMANCE SUMMARY", margin, y + 5);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Metric", "Score", "Rating"]],
      body: [
        ["Overall Score", `${report.overallScore ?? 0} / 100`, performanceLabel(report.overallScore, 100)],
        ["Speech Clarity", `${report.avgSpeechClarity ?? 0} / 10`, performanceLabel(report.avgSpeechClarity, 10)],
        ["Confidence", `${report.avgConfidence ?? 0} / 10`, performanceLabel(report.avgConfidence, 10)],
        ["Answer Structure", `${report.avgStructure ?? 0} / 10`, performanceLabel(report.avgStructure, 10)],
        ["Total Filler Words", `${report.totalFillerWords ?? 0}`, (report.totalFillerWords ?? 0) <= 5 ? "Excellent" : (report.totalFillerWords ?? 0) <= 15 ? "Moderate" : "High"],
      ],
      headStyles: { fillColor: [205, 85, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [250, 247, 242] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 90 },
        1: { cellWidth: 42, halign: "center" },
        2: { fontStyle: "bold", cellWidth: 42, halign: "center" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Overall Analysis ──
    if (report.overallAnalysis) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("OVERALL ANALYSIS", margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const analysisLines = doc.splitTextToSize(report.overallAnalysis, pageW - margin * 2);
      doc.text(analysisLines, margin, y);
      y += analysisLines.length * 5 + 6;
    }

    // ── Strengths & Areas ──
    const halfW = (pageW - margin * 2 - 6) / 2;

    // Strengths
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(margin, y, halfW, 4, 1, 1, "F");
    doc.setTextColor(22, 101, 52);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("STRENGTHS", margin + 3, y + 3);
    y += 7;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const strengthLines = parseBulletText(report.strengths).map(l => "• " + l);
    strengthLines.forEach(line => {
      const wrapped = doc.splitTextToSize(line, halfW - 4);
      doc.text(wrapped, margin + 3, y);
      y += wrapped.length * 4.5;
    });

    // Areas (reset y to same level as strengths started)
    const areasX = margin + halfW + 6;
    let areasY = y - (strengthLines.reduce((sum, line) => {
      return sum + doc.splitTextToSize(line, halfW - 4).length * 4.5;
    }, 0)) - 7;

    doc.setFillColor(254, 226, 226);
    doc.roundedRect(areasX, areasY, halfW, 4, 1, 1, "F");
    doc.setTextColor(153, 27, 27);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("AREAS TO IMPROVE", areasX + 3, areasY + 3);
    areasY += 7;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const areaLines = parseBulletText(report.areasOfImprovement).map(l => "• " + l);
    areaLines.forEach(line => {
      const wrapped = doc.splitTextToSize(line, halfW - 4);
      doc.text(wrapped, areasX + 3, areasY);
      areasY += wrapped.length * 4.5;
    });

    y = Math.max(y, areasY) + 8;

    // ── Recommendations ──
    if (report.recommendations) {
      if (y > pageH - 60) { doc.addPage(); y = margin; }
      doc.setFillColor(237, 233, 254);
      doc.roundedRect(margin, y, pageW - margin * 2, 5, 1, 1, "F");
      doc.setTextColor(88, 28, 135);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RECOMMENDATIONS FOR CANDIDATE", margin + 3, y + 4);
      y += 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      const recLines = parseBulletText(report.recommendations).map(l => "• " + l);
      recLines.forEach(line => {
        const wrapped = doc.splitTextToSize(line, pageW - margin * 2 - 6);
        doc.text(wrapped, margin + 3, y);
        y += wrapped.length * 5;
      });
      y += 6;
    }

    // ── Per Question Analysis ──
    if (y > pageH - 60) { doc.addPage(); y = margin; }
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("QUESTION-BY-QUESTION ANALYSIS", margin, y);
    y += 6;

    const qBody = completedQuestions.map((q, i) => [
      `Q${i + 1}`,
      q.questionText.length > 55 ? q.questionText.slice(0, 52) + "..." : q.questionText,
      `${q.score ?? 0}/100`,
      `${q.speechClarity ?? 0}/10`,
      `${q.confidence ?? 0}/10`,
      `${q.structure ?? 0}/10`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Question", "Score", "Clarity", "Confid.", "Struct."]],
      body: qBody,
      headStyles: { fillColor: [75, 75, 80], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        0: { cellWidth: 9 },
        1: { cellWidth: 75 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Transcripts section
    completedQuestions.forEach((q, i) => {
      if (y > pageH - 50) { doc.addPage(); y = margin; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(`Q${i + 1}: ${q.questionText.length > 80 ? q.questionText.slice(0, 77) + "..." : q.questionText}`, margin, y);
      y += 5;
      if (q.feedback) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        const fbLines = doc.splitTextToSize(`Feedback: ${q.feedback}`, pageW - margin * 2);
        if (y + fbLines.length * 4 > pageH - 20) { doc.addPage(); y = margin; }
        doc.text(fbLines, margin, y);
        y += fbLines.length * 4 + 4;
      }
    });

    // ── Footer ──
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 160, 160);
      doc.text(`Uttarayan Interview Coach | Confidential Report | Page ${p} of ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
    }

    doc.save(`${report.candidateName.replace(/\s+/g, "_")}_Interview_Report.pdf`);
  };

  function performanceLabel(val: number | null, max: number): string {
    const pct = ((val ?? 0) / max) * 100;
    if (pct >= 80) return "Excellent";
    if (pct >= 65) return "Good";
    if (pct >= 50) return "Average";
    return "Needs Improvement";
  }

  const scoreColor = (score: number | null, max = 100) => {
    const pct = ((score ?? 0) / max) * 100;
    return pct >= 80 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400";
  };

  if (isLoadingReport) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link href={`/interview/${interviewId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Interview
        </Link>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">
                <FileText className="w-3 h-3" />
                Session Report
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-gradient">
                {interview?.role || "Interview"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {completedQuestions.length} of {questions?.length ?? 0} questions answered
              </p>
            </div>
            {report && (
              <button
                data-testid="button-download-pdf"
                onClick={downloadPDF}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            )}
          </div>
        </div>

        {/* No report yet — show generate form */}
        {!report && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-8 rounded-3xl text-center">
            {completedQuestions.length === 0 ? (
              <>
                <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No Answers Yet</h3>
                <p className="text-muted-foreground mb-6">Please answer at least one question before generating a report.</p>
                <Link href={`/interview/${interviewId}`}>
                  <button className="px-6 py-3 rounded-xl bg-primary text-white font-semibold">Go to Questions</button>
                </Link>
              </>
            ) : !showForm ? (
              <>
                <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Generate Your Session Report</h3>
                <p className="text-muted-foreground mb-6">
                  Get a comprehensive AI-powered analysis of your {completedQuestions.length} answered questions with candidate profile, scores, and recommendations.
                </p>
                <button
                  data-testid="button-generate-report"
                  onClick={() => setShowForm(true)}
                  className="px-8 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
                >
                  Generate Report
                </button>
              </>
            ) : (
              <div className="max-w-sm mx-auto">
                <User className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Enter Candidate Name</h3>
                <p className="text-muted-foreground mb-6 text-sm">This will appear on your report and PDF.</p>
                <input
                  data-testid="input-candidate-name"
                  type="text"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground mb-4 focus:outline-none focus:border-primary/50"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground font-semibold hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="button-submit-name"
                    onClick={() => candidateName.trim() && generateMutation.mutate(candidateName.trim())}
                    disabled={!candidateName.trim() || generateMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                    ) : "Generate"}
                  </button>
                </div>
                {generateMutation.isError && (
                  <p className="text-red-400 text-sm mt-3">Failed to generate report. Please try again.</p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Report Content */}
        {report && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Candidate Profile */}
            <div className="glass-panel p-6 rounded-3xl">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                <User className="w-4 h-4" />
                Candidate Profile
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <p className="text-xs text-muted-foreground mb-1">Name</p>
                  <p className="font-bold text-lg text-foreground">{report.candidateName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Role Applied</p>
                  <p className="font-semibold text-foreground">{interview?.role}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Questions</p>
                  <p className="font-semibold text-foreground">{completedQuestions.length} Answered</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Performance</p>
                  <span className={`font-bold text-lg ${
                    report.performanceLevel === "Excellent" ? "text-green-400" :
                    report.performanceLevel === "Good" ? "text-yellow-400" :
                    report.performanceLevel === "Average" ? "text-orange-400" : "text-red-400"
                  }`}>{report.performanceLevel}</span>
                </div>
              </div>
            </div>

            {/* Score Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Overall Score", value: report.overallScore, max: 100, icon: <Award className="w-5 h-5" /> },
                { label: "Speech Clarity", value: report.avgSpeechClarity, max: 10, icon: <BarChart2 className="w-5 h-5" /> },
                { label: "Confidence", value: report.avgConfidence, max: 10, icon: <Star className="w-5 h-5" /> },
                { label: "Structure", value: report.avgStructure, max: 10, icon: <TrendingUp className="w-5 h-5" /> },
                { label: "Filler Words", value: report.totalFillerWords, max: null, icon: <AlertCircle className="w-5 h-5" />, lower: true },
              ].map((item, i) => (
                <div key={i} className="glass-panel p-4 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-muted-foreground mb-2">{item.icon}</span>
                  <span className="text-2xl font-display font-bold text-foreground">
                    {item.value ?? 0}
                    {item.max && <span className="text-sm text-muted-foreground font-normal">/{item.max}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">{item.label}</span>
                  <span className={`text-xs font-bold mt-1 ${item.lower
                    ? ((item.value ?? 0) <= 5 ? "text-green-400" : (item.value ?? 0) <= 15 ? "text-yellow-400" : "text-red-400")
                    : scoreColor(item.value, item.max ?? 100)}`}>
                    {item.max ? performanceLabel(item.value, item.max) : ((item.value ?? 0) <= 5 ? "Excellent" : (item.value ?? 0) <= 15 ? "Moderate" : "High")}
                  </span>
                </div>
              ))}
            </div>

            {/* Overall Analysis */}
            {report.overallAnalysis && (
              <div className="glass-panel p-6 rounded-3xl">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Overall Analysis
                </h3>
                <p className="text-foreground/90 leading-relaxed text-base">{report.overallAnalysis}</p>
              </div>
            )}

            {/* Strengths & Areas */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-panel p-6 rounded-3xl border border-green-500/10">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-green-400 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Strengths
                </h3>
                <BulletList text={report.strengths} />
              </div>
              <div className="glass-panel p-6 rounded-3xl border border-red-500/10">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-red-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Areas to Improve
                </h3>
                <BulletList text={report.areasOfImprovement} />
              </div>
            </div>

            {/* Recommendations */}
            {report.recommendations && (
              <div className="glass-panel p-6 rounded-3xl border border-purple-500/10">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Recommendations
                </h3>
                <BulletList text={report.recommendations} />
              </div>
            )}

            {/* Per Question Analysis */}
            <div>
              <h3 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" />
                Question-by-Question Breakdown
              </h3>
              <div className="space-y-4">
                {completedQuestions.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    data-testid={`card-question-${q.id}`}
                    className="glass-panel p-5 rounded-2xl"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-foreground font-medium leading-snug">{q.questionText}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ScoreBadge score={q.score} max={100} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 ml-10 text-xs">
                      <span className="text-muted-foreground">Clarity: <span className={`font-bold ${scoreColor(q.speechClarity, 10)}`}>{q.speechClarity ?? 0}/10</span></span>
                      <span className="text-muted-foreground">Confidence: <span className={`font-bold ${scoreColor(q.confidence, 10)}`}>{q.confidence ?? 0}/10</span></span>
                      <span className="text-muted-foreground">Structure: <span className={`font-bold ${scoreColor(q.structure, 10)}`}>{q.structure ?? 0}/10</span></span>
                      <span className="text-muted-foreground">Fillers: <span className={`font-bold ${(q.fillerCount ?? 0) <= 5 ? "text-green-400" : "text-yellow-400"}`}>{q.fillerCount ?? 0}</span></span>
                    </div>
                    {q.feedback && (
                      <p className="ml-10 mt-2 text-sm text-foreground/70 leading-relaxed">{q.feedback}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Regenerate */}
            <div className="flex justify-between items-center pb-4">
              <button
                onClick={() => setShowForm(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Regenerate Report
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );

  function performanceLabel(val: number | null, max: number): string {
    const pct = ((val ?? 0) / max) * 100;
    if (pct >= 80) return "Excellent";
    if (pct >= 65) return "Good";
    if (pct >= 50) return "Average";
    return "Needs Improvement";
  }
}
