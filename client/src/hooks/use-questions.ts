import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useQuestions(interviewId: number) {
  return useQuery({
    queryKey: ['/api/interviews', interviewId, 'questions'],
    queryFn: async () => {
      const url = buildUrl(api.questions.list.path, { interviewId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json() as Promise<{
        id: number;
        interviewId: number;
        questionText: string;
        transcript: string | null;
        feedback: string | null;
        score: number | null;
        speechClarity: number | null;
        confidence: number | null;
        structure: number | null;
        suggestedAnswer: string | null;
        improvementPointers: string | null;
        status: string | null;
      }[]>;
    },
    enabled: !!interviewId && interviewId > 0,
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, transcript }: { id: number; transcript: string }) => {
      const url = buildUrl(api.questions.answer.path, { id });
      const res = await fetch(url, {
        method: api.questions.answer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit answer");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
    },
  });
}

export function useResetQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/questions/${id}/reset`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reset question");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
    },
  });
}
