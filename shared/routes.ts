
import { z } from 'zod';
import { insertDailyReportSchema, insertExpenseItemSchema, selectDailyReportSchema, selectExpenseItemSchema, selectVegetableItemSchema } from './schema';

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
    // ... reports endpoints
  },
  vegetables: {
    list: {
      method: 'GET' as const,
      path: '/api/vegetables' as const,
      responses: {
        200: z.array(selectVegetableItemSchema),
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
