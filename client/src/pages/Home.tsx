import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Briefcase, Calendar, ChevronRight, Loader2, ChevronDown, ChevronUp, FileText, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useInterviews, useCreateInterview } from "@/hooks/use-interviews";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Home() {
  const [_, setLocation] = useLocation();
  const { data: interviews, isLoading } = useInterviews();
  const createInterview = useCreateInterview();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeSummary, setResumeSummary] = useState("");
  const [showContext, setShowContext] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) return;
    
    try {
      const result = await createInterview.mutateAsync({
        role: role.trim(),
        jobDescription: jobDescription.trim() || undefined,
        resumeSummary: resumeSummary.trim() || undefined,
      });
      setIsDialogOpen(false);
      setRole("");
      setJobDescription("");
      setResumeSummary("");
      setShowContext(false);
      setLocation(`/interview/${result.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h2 className="text-4xl font-display font-bold text-foreground mb-2">Your Dashboard</h2>
          <p className="text-lg text-muted-foreground">Master your communication skills with AI feedback.</p>
        </div>
        
        <Button 
          onClick={() => setIsDialogOpen(true)}
          size="lg"
          className="rounded-xl px-6 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 shadow-lg shadow-primary/25 border-0 text-white font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Interview
        </Button>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-semibold flex items-center gap-2 text-foreground/90">
          <Briefcase className="w-5 h-5 text-primary" />
          Recent Sessions
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-2xl glass-card animate-pulse bg-white/5" />
            ))}
          </div>
        ) : !interviews || interviews.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-3xl border-dashed">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No interviews yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Start your first AI mock interview to practice your speech and receive actionable feedback.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {interviews.map((interview, idx) => (
              <Link key={interview.id} href={`/interview/${interview.id}`}>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group block h-full rounded-2xl glass-card p-6 cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-colors">
                      <Briefcase className="w-6 h-6 text-primary/80 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <h4 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {interview.role}
                  </h4>
                  
                  <div className="flex items-center text-sm text-muted-foreground mt-auto">
                    <Calendar className="w-4 h-4 mr-2 opacity-70" />
                    {interview.createdAt ? format(new Date(interview.createdAt), "MMM d, yyyy") : "Unknown date"}
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) { setRole(""); setJobDescription(""); setResumeSummary(""); setShowContext(false); }
      }}>
        <DialogContent className="sm:max-w-[540px] bg-card border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">New Practice Session</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter the role you're interviewing for. Optionally add a JD or resume summary to get highly targeted questions.
              </DialogDescription>
            </DialogHeader>

            <div className="py-5 space-y-5">
              {/* Role — required */}
              <div className="space-y-2">
                <Label htmlFor="role" className="text-foreground/80 font-medium">
                  Target Role <span className="text-primary">*</span>
                </Label>
                <Input
                  id="role"
                  data-testid="input-role"
                  placeholder="e.g., Senior Frontend Engineer, Product Manager"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-background border-white/10 h-12 text-base focus-visible:ring-primary/50 rounded-xl"
                  autoFocus
                />
              </div>

              {/* Toggle for optional context */}
              <button
                type="button"
                data-testid="button-toggle-context"
                onClick={() => setShowContext(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="w-4 h-4 text-primary/70" />
                  Add Job Description &amp; Resume Context
                  <span className="text-xs bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Optional</span>
                </span>
                {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Expandable context fields */}
              <AnimatePresence initial={false}>
                {showContext && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-1">
                      {/* Job Description */}
                      <div className="space-y-2">
                        <Label htmlFor="jd" className="text-foreground/80 font-medium flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-primary/70" />
                          Job Description
                        </Label>
                        <Textarea
                          id="jd"
                          data-testid="textarea-job-description"
                          placeholder="Paste the job description here — responsibilities, required skills, qualifications…"
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          className="bg-background border-white/10 focus-visible:ring-primary/50 rounded-xl resize-none text-sm min-h-[110px]"
                        />
                      </div>

                      {/* Resume / Summary */}
                      <div className="space-y-2">
                        <Label htmlFor="resume" className="text-foreground/80 font-medium flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-primary/70" />
                          Resume / Experience Summary
                        </Label>
                        <Textarea
                          id="resume"
                          data-testid="textarea-resume-summary"
                          placeholder="Paste a resume summary or key highlights — past roles, projects, achievements, skills…"
                          value={resumeSummary}
                          onChange={(e) => setResumeSummary(e.target.value)}
                          className="bg-background border-white/10 focus-visible:ring-primary/50 rounded-xl resize-none text-sm min-h-[110px]"
                        />
                      </div>

                      <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                        When provided, the AI will generate questions specifically aligned to the job requirements and your experience — making the practice session much more realistic.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-white/5 rounded-xl">
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="button-create-session"
                disabled={createInterview.isPending || !role.trim()}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20"
              >
                {createInterview.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {createInterview.isPending ? "Generating Questions…" : "Create Session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
