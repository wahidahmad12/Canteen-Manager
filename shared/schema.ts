
import { pgTable, text, serial, integer, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

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

// Saved menus
export const savedMenus = pgTable("saved_menus", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  menuData: text("menu_data").notNull(), // JSON string of cell values
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase requests
export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  serialNumber: serial("serial_number"),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  status: text("status").notNull().default("pending"),
  createdBy: text("created_by"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase request line items
export const purchaseRequestItems = pgTable("purchase_request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  itemName: text("item_name").notNull(),
  uom: text("uom").notNull(),
  requestQty: numeric("request_qty", { precision: 10, scale: 2 }).default("0"),
  approveQty: numeric("approve_qty", { precision: 10, scale: 2 }),
  approved: boolean("approved").notNull().default(false),
});

// Vendors
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  phone: text("phone").default(""),
  address: text("address").default(""),
  gstNo: text("gst_no").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase invoices
export const purchaseInvoices = pgTable("purchase_invoices", {
  id: serial("id").primaryKey(),
  serialNumber: serial("serial_number"),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id),
  clientName: text("client_name").notNull(),
  vendorName: text("vendor_name").notNull(),
  vendorInvoiceNo: text("vendor_invoice_no").notNull().default(""),
  date: date("date").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0"),
  totalGst: numeric("total_gst", { precision: 12, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).default("0"),
  paymentGiven: boolean("payment_given").default(false).notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase invoice line items
export const purchaseInvoiceItems = pgTable("purchase_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: 'cascade' }),
  itemName: text("item_name").notNull(),
  uom: text("uom").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).default("0"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).default("0"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).default("0"),
});

// Saved item names for autocomplete in purchase requests and menus
export const savedItemNames = pgTable("saved_item_names", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  source: text("source").notNull().default("purchase"),
  categoryId: integer("category_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("user"),
  clientName: text("client_name"),
  permissions: text("permissions").array().notNull().default(sql`ARRAY['expense','cashseal','inventory','menu']::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
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

export type SavedMenu = typeof savedMenus.$inferSelect;
export const selectSavedMenuSchema = createSelectSchema(savedMenus, {
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string().or(z.date()),
});

export type AdminSettingsType = typeof adminSettings.$inferSelect;
export type ClientName = typeof clientNames.$inferSelect;
export const selectClientNameSchema = createSelectSchema(clientNames);

// Purchase request types and schemas
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type PurchaseRequestWithItems = PurchaseRequest & { items: PurchaseRequestItem[] };

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({ id: true, serialNumber: true, createdAt: true });
export const insertPurchaseRequestItemSchema = createInsertSchema(purchaseRequestItems).omit({ id: true });
export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests, {
  date: z.string(),
  createdAt: z.string().or(z.date()),
});
export const selectPurchaseRequestItemSchema = createSelectSchema(purchaseRequestItems);

export const purchaseRequestWithItemsSchema = selectPurchaseRequestSchema.extend({
  items: z.array(selectPurchaseRequestItemSchema),
});

export type SavedItemName = typeof savedItemNames.$inferSelect;
export const insertSavedItemNameSchema = createInsertSchema(savedItemNames).omit({ id: true, createdAt: true });
export const selectSavedItemNameSchema = createSelectSchema(savedItemNames, { createdAt: z.string().or(z.date()) });

export const ALL_PERMISSIONS = ['expense', 'cashseal', 'inventory', 'menu', 'purchase'] as const;
export type Permission = typeof ALL_PERMISSIONS[number];

export type User = typeof users.$inferSelect;
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, passwordHash: true }).extend({
  password: z.string().min(4),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([...ALL_PERMISSIONS]),
});
export const selectUserSchema = createSelectSchema(users, {
  createdAt: z.string().or(z.date()),
}).omit({ passwordHash: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SafeUser = z.infer<typeof selectUserSchema>;

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

// Vendor types and schemas
export type Vendor = typeof vendors.$inferSelect;
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
export const selectVendorSchema = createSelectSchema(vendors, { createdAt: z.string().or(z.date()) });

// Purchase invoice types and schemas
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItems.$inferSelect;
export type PurchaseInvoiceWithItems = PurchaseInvoice & { items: PurchaseInvoiceItem[] };

export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices).omit({ id: true, serialNumber: true, createdAt: true });
export const insertPurchaseInvoiceItemSchema = createInsertSchema(purchaseInvoiceItems).omit({ id: true });
export const selectPurchaseInvoiceSchema = createSelectSchema(purchaseInvoices, {
  date: z.string(),
  createdAt: z.string().or(z.date()),
});
export const selectPurchaseInvoiceItemSchema = createSelectSchema(purchaseInvoiceItems);

export const purchaseInvoiceWithItemsSchema = selectPurchaseInvoiceSchema.extend({
  items: z.array(selectPurchaseInvoiceItemSchema),
});
