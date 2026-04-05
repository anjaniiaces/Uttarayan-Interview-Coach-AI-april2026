import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useInterviews() {
  return useQuery({
    queryKey: [api.interviews.list.path],
    queryFn: async () => {
      const res = await fetch(api.interviews.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch interviews");
      const data = await res.json();
      return parseWithLogging(api.interviews.list.responses[200], data, "interviews.list");
    },
  });
}

export function useInterview(id: number) {
  return useQuery({
    queryKey: [api.interviews.get.path, id],
    queryFn: async () => {
      if (isNaN(id) || id <= 0) return null;
      const url = buildUrl(api.interviews.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch interview");
      const data = await res.json();
      return parseWithLogging(api.interviews.get.responses[200], data, "interviews.get");
    },
    enabled: !!id,
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: z.infer<typeof api.interviews.create.input>) => {
      const res = await fetch(api.interviews.create.path, {
        method: api.interviews.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.interviews.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create interview");
      }
      return parseWithLogging(api.interviews.create.responses[201], await res.json(), "interviews.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.interviews.list.path] });
    },
  });
}
