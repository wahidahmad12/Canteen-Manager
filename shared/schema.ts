
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

// Stores cash seal (income vs expense) per day
export const cashSeals = pgTable("cash_seals", {
  id: serial("id").primaryKey(),
  serialNumber: serial("serial_number"),
  reportId: integer("report_id").notNull().references(() => dailyReports.id, { onDelete: 'cascade' }),
  incomeMorningQty: numeric("income_morning_qty", { precision: 10, scale: 2 }).default("0"),
  incomeLunchQty: numeric("income_lunch_qty", { precision: 10, scale: 2 }).default("0"),
  incomeEveningQty: numeric("income_evening_qty", { precision: 10, scale: 2 }).default("0"),
  incomeNightQty: numeric("income_night_qty", { precision: 10, scale: 2 }).default("0"),
  incomeNonVegRate: numeric("income_non_veg_rate", { precision: 10, scale: 2 }).default("0"),
  incomeNonVegQty: numeric("income_non_veg_qty", { precision: 10, scale: 2 }).default("0"),
  incomeVegRate: numeric("income_veg_rate", { precision: 10, scale: 2 }).default("0"),
  incomeVegQty: numeric("income_veg_qty", { precision: 10, scale: 2 }).default("0"),
  incomeMorningCashRate: numeric("income_morning_cash_rate", { precision: 10, scale: 2 }).default("0"),
  incomeMorningCashQty: numeric("income_morning_cash_qty", { precision: 10, scale: 2 }).default("0"),
  incomeEveningCashRate: numeric("income_evening_cash_rate", { precision: 10, scale: 2 }).default("0"),
  incomeEveningCashQty: numeric("income_evening_cash_qty", { precision: 10, scale: 2 }).default("0"),
  expenseBananaQty: numeric("expense_banana_qty", { precision: 10, scale: 2 }).default("0"),
  expenseDahiBharQty: numeric("expense_dahi_bhar_qty", { precision: 10, scale: 2 }).default("0"),
  expenseDahiBharRate: numeric("expense_dahi_bhar_rate", { precision: 10, scale: 2 }).default("0"),
  expenseOtherAmount: numeric("expense_other_amount", { precision: 10, scale: 2 }).default("0"),
  totalGivenToAkbarAli: numeric("total_given_to_akbar_ali", { precision: 10, scale: 2 }).default("0"),
});

// Daily Inventory records
export const dailyInventory = pgTable("daily_inventory", {
  id: serial("id").primaryKey(),
  serialNumber: serial("serial_number"),
  date: date("date").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Kitchen stock items for daily inventory
export const kitchenStockItems = pgTable("kitchen_stock_items", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").notNull().references(() => dailyInventory.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  open: numeric("open", { precision: 10, scale: 2 }).default("0"),
  used: numeric("used", { precision: 10, scale: 2 }).default("0"),
  balance: numeric("balance", { precision: 10, scale: 2 }).default("0"),
  remarks: text("remarks").default(""),
});

// Biscuit items for daily inventory
export const biscuitItems = pgTable("biscuit_items", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").notNull().references(() => dailyInventory.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  expDate: text("exp_date").default(""),
  brand: text("brand").default(""),
  given: numeric("given", { precision: 10, scale: 2 }).default("0"),
  used: numeric("used", { precision: 10, scale: 2 }).default("0"),
  balance: numeric("balance", { precision: 10, scale: 2 }).default("0"),
});

// Client names for menu manager
export const clientNames = pgTable("client_names", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Admin settings for access control
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  adminPin: text("admin_pin").notNull().default("1234"),
});

// === RELATIONS ===
export const dailyReportsRelations = relations(dailyReports, ({ many, one }) => ({
  items: many(expenseItems),
  cashSeal: one(cashSeals, {
    fields: [dailyReports.id],
    references: [cashSeals.reportId],
  }),
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

export const selectDailyReportSchema = createSelectSchema(dailyReports, {
  date: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
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

// Inventory types
export type DailyInventoryRecord = typeof dailyInventory.$inferSelect;
export type KitchenStockItem = typeof kitchenStockItems.$inferSelect;
export type BiscuitItem = typeof biscuitItems.$inferSelect;

export type InventoryWithItems = DailyInventoryRecord & {
  kitchenStock: KitchenStockItem[];
  biscuits: BiscuitItem[];
};

export type CreateInventoryRequest = {
  date: string;
  kitchenStock: { name: string; unit: string; open: number; used: number; balance: number; remarks: string; }[];
  biscuits: { name: string; expDate: string; brand: string; given: number; used: number; balance: number; }[];
};

export type AdminSettingsType = typeof adminSettings.$inferSelect;
export type ClientName = typeof clientNames.$inferSelect;
export const selectClientNameSchema = createSelectSchema(clientNames);

export const insertKitchenStockSchema = createInsertSchema(kitchenStockItems).omit({ id: true });
export const insertBiscuitSchema = createInsertSchema(biscuitItems).omit({ id: true });
export const selectKitchenStockSchema = createSelectSchema(kitchenStockItems);
export const selectBiscuitSchema = createSelectSchema(biscuitItems);
export const selectDailyInventorySchema = createSelectSchema(dailyInventory, {
  date: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const inventoryWithItemsSchema = selectDailyInventorySchema.extend({
  kitchenStock: z.array(selectKitchenStockSchema),
  biscuits: z.array(selectBiscuitSchema),
});
