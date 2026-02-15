
import { z } from 'zod';
import { insertDailyReportSchema, insertExpenseItemSchema, selectDailyReportSchema, selectExpenseItemSchema } from './schema';

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

// Report with items schema for responses
const expenseItemSchema = selectExpenseItemSchema;
const dailyReportSchema = selectDailyReportSchema;

const reportWithItemsSchema = dailyReportSchema.extend({
  items: z.array(expenseItemSchema)
});

// Input schema for creating a report with items
const createReportInput = insertDailyReportSchema.extend({
  items: z.array(insertExpenseItemSchema.omit({ reportId: true }))
});

// Input schema for updating a report
const updateReportInput = insertDailyReportSchema.partial().extend({
  items: z.array(insertExpenseItemSchema.omit({ reportId: true }).extend({ id: z.number().optional() })).optional()
});

export const api = {
  reports: {
    list: {
      method: 'GET' as const,
      path: '/api/reports' as const,
      responses: {
        200: z.array(dailyReportSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/reports/:id' as const,
      responses: {
        200: reportWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reports' as const,
      input: createReportInput,
      responses: {
        201: reportWithItemsSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/reports/:id' as const,
      input: updateReportInput,
      responses: {
        200: reportWithItemsSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/reports/:id' as const,
      responses: {
        204: z.void(),
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
