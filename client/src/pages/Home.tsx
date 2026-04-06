import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Briefcase, Calendar, ChevronRight, Loader2, Upload, X, FileText, User } from "lucide-react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useInterviews, useCreateInterview } from "@/hooks/use-interviews";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

async function parseDocumentFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/parse-document", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to read file" }));
    throw new Error(err.message || "Failed to read file");
  }
  const data = await res.json();
  return data.text as string;
}

interface DocFieldProps {
  id: string;
  testIdArea: string;
  testIdUpload: string;
  testIdClear: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}

function DocField({ id, testIdArea, testIdUpload, testIdClear, label, icon, placeholder, value, onChange }: DocFieldProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await parseDocumentFile(file);
      onChange(text);
      setFileName(file.name);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = () => {
    onChange("");
    setFileName(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-foreground/80 font-medium flex items-center gap-1.5">
          {icon}
          {label}
          <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
        </Label>
        <div className="flex items-center gap-2">
          {fileName && (
            <span className="text-xs text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1 max-w-[160px] truncate">
              <FileText className="w-3 h-3 flex-shrink-0" />
              {fileName}
            </span>
          )}
          {value && (
            <button
              type="button"
              data-testid={testIdClear}
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            type="button"
            data-testid={testIdUpload}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Reading…" : "Upload file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf,.docx"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>
      <Textarea
        id={id}
        data-testid={testIdArea}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!e.target.value) setFileName(null); }}
        className="bg-background border-white/10 focus-visible:ring-primary/50 rounded-xl resize-none text-sm min-h-[110px]"
      />
      {!value && (
        <p className="text-xs text-muted-foreground">
          Paste content directly or upload a <span className="text-foreground/60">.txt, .pdf, or .docx</span> file.
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const [_, setLocation] = useLocation();
  const { data: interviews, isLoading } = useInterviews();
  const createInterview = useCreateInterview();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeSummary, setResumeSummary] = useState("");

  const resetForm = () => {
    setRole("");
    setJobDescription("");
    setResumeSummary("");
  };

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
      resetForm();
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[580px] bg-card border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">New Practice Session</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter the role you're preparing for. Add a job description and/or resume to get highly targeted questions.
              </DialogDescription>
            </DialogHeader>

            <div className="py-5 space-y-6">
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

              <div className="border-t border-white/8 pt-5 space-y-5">
                <p className="text-xs text-muted-foreground -mt-2">
                  The fields below are optional. When provided, the AI uses them to generate interview questions tailored specifically to the job and your experience.
                </p>

                {/* Job Description */}
                <DocField
                  id="jd"
                  testIdArea="textarea-job-description"
                  testIdUpload="button-upload-jd"
                  testIdClear="button-clear-jd"
                  label="Job Description"
                  icon={<FileText className="w-3.5 h-3.5 text-primary/70" />}
                  placeholder="Paste the job description here — responsibilities, required skills, qualifications, company overview…"
                  value={jobDescription}
                  onChange={setJobDescription}
                />

                {/* Resume / Summary */}
                <DocField
                  id="resume"
                  testIdArea="textarea-resume-summary"
                  testIdUpload="button-upload-resume"
                  testIdClear="button-clear-resume"
                  label="Resume / Experience Summary"
                  icon={<User className="w-3.5 h-3.5 text-primary/70" />}
                  placeholder="Paste your resume or a summary of your experience — past roles, key projects, achievements, skills, education…"
                  value={resumeSummary}
                  onChange={setResumeSummary}
                />
              </div>
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
