
import { pgTable, text, serial, integer, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

// Stores the header information for each day's report
export const dailyReports = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  reportNumber: serial("report_number"), // Auto-incrementing report number
  date: date("date").notNull().unique(), // One report per day
  openingBalance: numeric("opening_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  receivedAmount: numeric("received_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stores predefined vegetable names for selection
export const vegetableItems = pgTable("vegetable_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Stores individual line items (both fixed and vegetable)
export const expenseItems = pgTable("expense_items", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => dailyReports.id, { onDelete: 'cascade' }),
  category: text("category").notNull(), // 'fixed' | 'vegetable'
  description: text("description").notNull(),
  uom: text("uom").notNull(), // Unit of Measure (Kg, Pcs, etc.)
  qty: numeric("qty", { precision: 10, scale: 2 }).default("0"),
  rate: numeric("rate", { precision: 10, scale: 2 }).default("0"),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
});

// === RELATIONS ===
export const dailyReportsRelations = relations(dailyReports, ({ many }) => ({
  items: many(expenseItems),
}));

export const expenseItemsRelations = relations(expenseItems, ({ one }) => ({
  report: one(dailyReports, {
    fields: [expenseItems.reportId],
    references: [dailyReports.id],
  }),
}));

// === ZOD SCHEMAS ===
export const insertDailyReportSchema = createInsertSchema(dailyReports).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  openingBalance: z.coerce.number().min(0),
  receivedAmount: z.coerce.number().min(0),
});

export const insertExpenseItemSchema = createInsertSchema(expenseItems).omit({ 
  id: true 
}).extend({
  reportId: z.coerce.number().optional(),
  qty: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
  amount: z.coerce.number().min(0),
});

export const selectDailyReportSchema = createSelectSchema(dailyReports);
export const selectExpenseItemSchema = createSelectSchema(expenseItems);
export const selectVegetableItemSchema = createSelectSchema(vegetableItems);

// === API TYPES ===
export type DailyReport = typeof dailyReports.$inferSelect;
export type ExpenseItem = typeof expenseItems.$inferSelect;

export type CreateReportRequest = z.infer<typeof insertDailyReportSchema> & {
  items: z.infer<typeof insertExpenseItemSchema>[];
};

export type UpdateReportRequest = Partial<z.infer<typeof insertDailyReportSchema>> & {
  items?: (z.infer<typeof insertExpenseItemSchema> & { id?: number })[];
};

export type ReportWithItems = DailyReport & {
  items: ExpenseItem[];
};

export type VegetableItem = typeof vegetableItems.$inferSelect;
