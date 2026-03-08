
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
  address: text("address").default(""),
  gstNo: text("gst_no").default(""),
  agreementValidTill: date("agreement_valid_till"),
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

// Item Master - unified item database
export const itemMaster = pgTable("item_master", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull().unique(),
  uom: text("uom").notNull().default("Kg"),
  rate: numeric("rate", { precision: 10, scale: 2 }).default("0"),
  hsnCode: text("hsn_code").notNull().default(""),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }).default("0"),
  itemType: text("item_type").notNull().default("purchase"),
  itemCategory: text("item_category").notNull().default("General"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SALARY & PAYROLL TABLES ===

// Employee Master
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  name: text("name").notNull(),
  fatherName: text("father_name").default(""),
  designation: text("designation").default(""),
  department: text("department").default(""),
  clientName: text("client_name").notNull(),
  esicNo: text("esic_no").default(""),
  pfNo: text("pf_no").default(""),
  uanNo: text("uan_no").default(""),
  aadhaarNo: text("aadhaar_no").default(""),
  panNo: text("pan_no").default(""),
  bankName: text("bank_name").default(""),
  accountNo: text("account_no").default(""),
  ifscCode: text("ifsc_code").default(""),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).default("0"),
  fixedHra: numeric("fixed_hra", { precision: 10, scale: 2 }).default("0"),
  gender: text("gender").default("Male"),
  dob: date("dob"),
  address: text("address").default(""),
  permanentAddress: text("permanent_address").default(""),
  localAddress: text("local_address").default(""),
  skills: text("skills").default(""),
  joiningDate: date("joining_date"),
  leavingDate: date("leaving_date"),
  leavingReason: text("leaving_reason").default(""),
  mobile: text("mobile").default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance / Muster Roll (Form XVI)
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  day1: text("day1"), day2: text("day2"), day3: text("day3"), day4: text("day4"), day5: text("day5"),
  day6: text("day6"), day7: text("day7"), day8: text("day8"), day9: text("day9"), day10: text("day10"),
  day11: text("day11"), day12: text("day12"), day13: text("day13"), day14: text("day14"), day15: text("day15"),
  day16: text("day16"), day17: text("day17"), day18: text("day18"), day19: text("day19"), day20: text("day20"),
  day21: text("day21"), day22: text("day22"), day23: text("day23"), day24: text("day24"), day25: text("day25"),
  day26: text("day26"), day27: text("day27"), day28: text("day28"), day29: text("day29"), day30: text("day30"),
  day31: text("day31"),
  totalPresent: numeric("total_present", { precision: 5, scale: 1 }).default("0"),
  totalAbsent: numeric("total_absent", { precision: 5, scale: 1 }).default("0"),
  overtimeHours: numeric("overtime_hours", { precision: 6, scale: 2 }).default("0"),
  remarks: text("remarks").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Salary Records / Register of Wages (Form XVII)
export const salaryRecords = pgTable("salary_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  daysWorked: numeric("days_worked", { precision: 5, scale: 1 }).default("0"),
  basicWage: numeric("basic_wage", { precision: 12, scale: 2 }).default("0"),
  da: numeric("da", { precision: 12, scale: 2 }).default("0"),
  hra: numeric("hra", { precision: 12, scale: 2 }).default("0"),
  otherAllowance: numeric("other_allowance", { precision: 12, scale: 2 }).default("0"),
  grossWage: numeric("gross_wage", { precision: 12, scale: 2 }).default("0"),
  pfDeduction: numeric("pf_deduction", { precision: 12, scale: 2 }).default("0"),
  esicDeduction: numeric("esic_deduction", { precision: 12, scale: 2 }).default("0"),
  professionalTax: numeric("professional_tax", { precision: 12, scale: 2 }).default("0"),
  advanceDeduction: numeric("advance_deduction", { precision: 12, scale: 2 }).default("0"),
  fineDeduction: numeric("fine_deduction", { precision: 12, scale: 2 }).default("0"),
  lwf: numeric("lwf", { precision: 12, scale: 2 }).default("0"),
  otherDeduction: numeric("other_deduction", { precision: 12, scale: 2 }).default("0"),
  totalDeduction: numeric("total_deduction", { precision: 12, scale: 2 }).default("0"),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).default("0"),
  overtimeHours: numeric("overtime_hours", { precision: 6, scale: 2 }).default("0"),
  overtimeRate: numeric("overtime_rate", { precision: 10, scale: 2 }).default("0"),
  overtimeAmount: numeric("overtime_amount", { precision: 12, scale: 2 }).default("0"),
  paymentMode: text("payment_mode").default("Bank Transfer"),
  paidOn: date("paid_on"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Fines (Form XXI)
export const fines = pgTable("fines", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
  reason: text("reason").default(""),
  realized: boolean("realized").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Advances (Form XXII)
export const advances = pgTable("advances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
  purpose: text("purpose").default(""),
  installments: integer("installments").default(1),
  recoveredAmount: numeric("recovered_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Overtime (Form XXIII)
export const overtimeRegister = pgTable("overtime_register", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  normalHours: numeric("normal_hours", { precision: 5, scale: 2 }).default("8"),
  overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).default("0"),
  overtimeRate: numeric("overtime_rate", { precision: 10, scale: 2 }).default("0"),
  overtimeAmount: numeric("overtime_amount", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Deductions for Damage or Loss (Form XX)
export const damageDeductions = pgTable("damage_deductions", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Leave With Wages (Form No. 15)
export const leaveWithWages = pgTable("leave_with_wages", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  calendarYear: integer("calendar_year").notNull(),
  daysLeaveEarned: numeric("days_leave_earned", { precision: 6, scale: 1 }).default("0"),
  daysLeaveBroughtForward: numeric("days_leave_brought_forward", { precision: 6, scale: 1 }).default("0"),
  layOffDays: numeric("lay_off_days", { precision: 6, scale: 1 }).default("0"),
  maternityLeaveDays: numeric("maternity_leave_days", { precision: 6, scale: 1 }).default("0"),
  leaveEarned: numeric("leave_earned", { precision: 6, scale: 1 }).default("0"),
  leaveEnjoyed: numeric("leave_enjoyed", { precision: 6, scale: 1 }).default("0"),
  otherAbsenceDays: numeric("other_absence_days", { precision: 6, scale: 1 }).default("0"),
  actualDaysWorked: numeric("actual_days_worked", { precision: 6, scale: 1 }).default("0"),
  leaveAllowedDate: text("leave_allowed_date").default("NA"),
  leaveAllowedDays: text("leave_allowed_days").default("NA"),
  rateOfWagesRs: numeric("rate_of_wages_rs", { precision: 10, scale: 2 }).default("0"),
  rateOfWagesP: numeric("rate_of_wages_p", { precision: 4, scale: 0 }).default("0"),
  amountOfWagesRs: numeric("amount_of_wages_rs", { precision: 10, scale: 2 }).default("0"),
  amountOfWagesP: numeric("amount_of_wages_p", { precision: 4, scale: 0 }).default("0"),
  dateOfPayment: text("date_of_payment").default(""),
  remarks: text("remarks").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeWageRates = pgTable("employee_wage_rates", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  calendarYear: integer("calendar_year").notNull(),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  effectiveFrom: text("effective_from").default(""),
  remarks: text("remarks").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skillWageRates = pgTable("skill_wage_rates", {
  id: serial("id").primaryKey(),
  skillCategory: text("skill_category").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  remarks: text("remarks").default(""),
  createdAt: timestamp("created_at").defaultNow(),
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
  employeeId: integer("employee_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin settings for access control
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  adminPin: text("admin_pin").notNull().default("1234"),
});

export const halfYearlyReturns = pgTable("half_yearly_returns", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  halfYear: text("half_year").notNull(),
  year: integer("year").notNull(),
  refNumber: text("ref_number"),
  letterDate: text("letter_date"),
  formDate: text("form_date"),
  contractFrom: text("contract_from"),
  contractTo: text("contract_to"),
  principalDays: text("principal_days"),
  contractorDays: text("contractor_days"),
  dailyHours: text("daily_hours"),
  weeklyHoliday: text("weekly_holiday"),
  holidayPaid: text("holiday_paid"),
  lwfMen: text("lwf_men"),
  lwfWomen: text("lwf_women"),
  canteen: text("canteen"),
  restRoom: text("rest_room"),
  drinkingWater: text("drinking_water"),
  creches: text("creches"),
  firstAid: text("first_aid"),
  licenceNo: text("licence_no"),
  principalAddress: text("principal_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bonusReturns = pgTable("bonus_returns", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  fyStartYear: integer("fy_start_year").notNull(),
  bonusDate: text("bonus_date"),
  workingDays: text("working_days"),
  refNumber: text("ref_number"),
  letterDate: text("letter_date"),
  formDNatureOfIndustry: text("form_d_nature_of_industry"),
  formDEmployerName: text("form_d_employer_name"),
  formDSettlement: text("form_d_settlement"),
  formDPercentage: text("form_d_percentage"),
  formDPaidToAll: text("form_d_paid_to_all"),
  formDRemarks: text("form_d_remarks"),
  formDPaymentDate: text("form_d_payment_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BonusReturn = typeof bonusReturns.$inferSelect;

export const letters = pgTable("letters", {
  id: serial("id").primaryKey(),
  serialNumber: serial("serial_number"),
  refNumber: text("ref_number").notNull(),
  letterDate: text("letter_date").notNull(),
  toName: text("to_name"),
  toAddress: text("to_address"),
  toGstin: text("to_gstin"),
  subject: text("subject"),
  body: text("body"),
  regards: text("regards"),
  clientName: text("client_name"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Letter = typeof letters.$inferSelect;
export const insertLetterSchema = createInsertSchema(letters).omit({ id: true, serialNumber: true, createdAt: true, updatedAt: true });

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

// Item Master types and schemas
export type ItemMaster = typeof itemMaster.$inferSelect;
export const insertItemMasterSchema = createInsertSchema(itemMaster).omit({ id: true, createdAt: true });
export const selectItemMasterSchema = createSelectSchema(itemMaster, { createdAt: z.string().or(z.date()) });

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

// === SALARY & PAYROLL TYPES ===

export type Employee = typeof employees.$inferSelect;
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const selectEmployeeSchema = createSelectSchema(employees, {
  dob: z.string().nullable(),
  joiningDate: z.string().nullable(),
  leavingDate: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Attendance = typeof attendance.$inferSelect;
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const selectAttendanceSchema = createSelectSchema(attendance, {
  createdAt: z.string().or(z.date()),
});

export type SalaryRecord = typeof salaryRecords.$inferSelect;
export const insertSalaryRecordSchema = createInsertSchema(salaryRecords).omit({ id: true, createdAt: true });
export const selectSalaryRecordSchema = createSelectSchema(salaryRecords, {
  paidOn: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});

export type Fine = typeof fines.$inferSelect;
export const insertFineSchema = createInsertSchema(fines).omit({ id: true, createdAt: true });
export const selectFineSchema = createSelectSchema(fines, { date: z.string(), createdAt: z.string().or(z.date()) });

export type Advance = typeof advances.$inferSelect;
export const insertAdvanceSchema = createInsertSchema(advances).omit({ id: true, createdAt: true });
export const selectAdvanceSchema = createSelectSchema(advances, { date: z.string(), createdAt: z.string().or(z.date()) });

export type OvertimeRecord = typeof overtimeRegister.$inferSelect;
export const insertOvertimeSchema = createInsertSchema(overtimeRegister).omit({ id: true, createdAt: true });
export const selectOvertimeSchema = createSelectSchema(overtimeRegister, { date: z.string(), createdAt: z.string().or(z.date()) });

export type DamageDeduction = typeof damageDeductions.$inferSelect;
export const insertDamageDeductionSchema = createInsertSchema(damageDeductions).omit({ id: true, createdAt: true });
export const selectDamageDeductionSchema = createSelectSchema(damageDeductions, { date: z.string(), createdAt: z.string().or(z.date()) });

export type LeaveWithWages = typeof leaveWithWages.$inferSelect;
export const insertLeaveWithWagesSchema = createInsertSchema(leaveWithWages).omit({ id: true, createdAt: true });
export const selectLeaveWithWagesSchema = createSelectSchema(leaveWithWages, { createdAt: z.string().or(z.date()) });

export type EmployeeWageRate = typeof employeeWageRates.$inferSelect;
export const insertEmployeeWageRateSchema = createInsertSchema(employeeWageRates).omit({ id: true, createdAt: true });
export const selectEmployeeWageRateSchema = createSelectSchema(employeeWageRates, { createdAt: z.string().or(z.date()) });

export type SkillWageRate = typeof skillWageRates.$inferSelect;
export const insertSkillWageRateSchema = createInsertSchema(skillWageRates).omit({ id: true, createdAt: true });
export const selectSkillWageRateSchema = createSelectSchema(skillWageRates, { createdAt: z.string().or(z.date()) });

export const SKILL_CATEGORIES = ["Unskilled", "Semi Skilled", "Skilled", "High Skilled", "Partner"] as const;

export const ALL_PAYROLL_PERMISSIONS = [...ALL_PERMISSIONS, 'salary'] as const;

export type HalfYearlyReturn = typeof halfYearlyReturns.$inferSelect;
export const insertHalfYearlyReturnSchema = createInsertSchema(halfYearlyReturns).omit({ id: true, createdAt: true, updatedAt: true });
export const selectHalfYearlyReturnSchema = createSelectSchema(halfYearlyReturns, { createdAt: z.string().or(z.date()), updatedAt: z.string().or(z.date()) });
