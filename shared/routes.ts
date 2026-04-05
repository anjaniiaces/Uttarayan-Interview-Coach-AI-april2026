import { z } from 'zod';
import { insertInterviewSchema, insertQuestionSchema, interviews, questions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  interviews: {
    list: {
      method: 'GET' as const,
      path: '/api/interviews' as const,
      responses: {
        200: z.array(z.custom<typeof interviews.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/interviews/:id' as const,
      responses: {
        200: z.custom<typeof interviews.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/interviews' as const,
      input: insertInterviewSchema,
      responses: {
        201: z.custom<typeof interviews.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  questions: {
    list: {
      method: 'GET' as const,
      path: '/api/interviews/:interviewId/questions' as const,
      responses: {
        200: z.array(z.custom<typeof questions.$inferSelect>()),
      },
    },
    answer: {
      method: 'POST' as const,
      path: '/api/questions/:id/answer' as const,
      input: z.object({
        transcript: z.string(),
      }),
      responses: {
        200: z.custom<typeof questions.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type InterviewResponse = z.infer<typeof api.interviews.create.responses[201]>;
export type QuestionResponse = z.infer<typeof api.questions.answer.responses[200]>;
