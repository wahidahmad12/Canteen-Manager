
import { mysqlTable, varchar, text, int, decimal, date, timestamp, boolean, json } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

// Stores the header information for each day's report
export const dailyReports = mysqlTable("daily_reports", {
  id: int("id").autoincrement().primaryKey(),
  reportNumber: int("report_number"), // Auto-incrementing report number
  date: date("date").notNull().unique(), // One report per day
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  receivedAmount: decimal("received_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stores predefined vegetable names for selection
export const vegetableItems = mysqlTable("vegetable_items", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
});

// Stores individual line items (both fixed and vegetable)
export const expenseItems = mysqlTable("expense_items", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("report_id").notNull().references(() => dailyReports.id, { onDelete: 'cascade' }),
  category: text("category").notNull(), // 'fixed' | 'vegetable'
  description: text("description").notNull(),
  uom: text("uom").notNull(), // Unit of Measure (Kg, Pcs, etc.)
  qty: decimal("qty", { precision: 10, scale: 2 }).default("0"),
  rate: decimal("rate", { precision: 10, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
});

// Stores cash seal (income vs expense) per day
export const cashSeals = mysqlTable("cash_seals", {
  id: int("id").autoincrement().primaryKey(),
  serialNumber: int("serial_number"),
  reportId: int("report_id").notNull().references(() => dailyReports.id, { onDelete: 'cascade' }),
  incomeMorningQty: decimal("income_morning_qty", { precision: 10, scale: 2 }).default("0"),
  incomeLunchQty: decimal("income_lunch_qty", { precision: 10, scale: 2 }).default("0"),
  incomeEveningQty: decimal("income_evening_qty", { precision: 10, scale: 2 }).default("0"),
  incomeNightQty: decimal("income_night_qty", { precision: 10, scale: 2 }).default("0"),
  incomeNonVegRate: decimal("income_non_veg_rate", { precision: 10, scale: 2 }).default("0"),
  incomeNonVegQty: decimal("income_non_veg_qty", { precision: 10, scale: 2 }).default("0"),
  incomeVegRate: decimal("income_veg_rate", { precision: 10, scale: 2 }).default("0"),
  incomeVegQty: decimal("income_veg_qty", { precision: 10, scale: 2 }).default("0"),
  incomeMorningCashRate: decimal("income_morning_cash_rate", { precision: 10, scale: 2 }).default("0"),
  incomeMorningCashQty: decimal("income_morning_cash_qty", { precision: 10, scale: 2 }).default("0"),
  incomeEveningCashRate: decimal("income_evening_cash_rate", { precision: 10, scale: 2 }).default("0"),
  incomeEveningCashQty: decimal("income_evening_cash_qty", { precision: 10, scale: 2 }).default("0"),
  expenseBananaQty: decimal("expense_banana_qty", { precision: 10, scale: 2 }).default("0"),
  expenseDahiBharQty: decimal("expense_dahi_bhar_qty", { precision: 10, scale: 2 }).default("0"),
  expenseDahiBharRate: decimal("expense_dahi_bhar_rate", { precision: 10, scale: 2 }).default("0"),
  expenseOtherAmount: decimal("expense_other_amount", { precision: 10, scale: 2 }).default("0"),
  totalGivenToAkbarAli: decimal("total_given_to_akbar_ali", { precision: 10, scale: 2 }).default("0"),
});

// Daily Inventory records
export const dailyInventory = mysqlTable("daily_inventory", {
  id: int("id").autoincrement().primaryKey(),
  serialNumber: int("serial_number"),
  date: date("date").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Kitchen stock items for daily inventory
export const kitchenStockItems = mysqlTable("kitchen_stock_items", {
  id: int("id").autoincrement().primaryKey(),
  inventoryId: int("inventory_id").notNull().references(() => dailyInventory.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  open: decimal("open", { precision: 10, scale: 2 }).default("0"),
  used: decimal("used", { precision: 10, scale: 2 }).default("0"),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  remarks: varchar("remarks", { length: 500 }).default(""),
});

// Biscuit items for daily inventory
export const biscuitItems = mysqlTable("biscuit_items", {
  id: int("id").autoincrement().primaryKey(),
  inventoryId: int("inventory_id").notNull().references(() => dailyInventory.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  expDate: varchar("exp_date", { length: 500 }).default(""),
  brand: varchar("brand", { length: 500 }).default(""),
  given: decimal("given", { precision: 10, scale: 2 }).default("0"),
  used: decimal("used", { precision: 10, scale: 2 }).default("0"),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
});

// Client names for menu manager
export const clientNames = mysqlTable("client_names", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  address: varchar("address", { length: 500 }).default(""),
  gstNo: varchar("gst_no", { length: 500 }).default(""),
  stateName: varchar("state_name", { length: 100 }).default(""),
  stateCode: varchar("state_code", { length: 10 }).default(""),
  agreementValidTill: date("agreement_valid_till"),
});

// Saved menus
export const savedMenus = mysqlTable("saved_menus", {
  id: int("id").autoincrement().primaryKey(),
  clientName: text("client_name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  menuData: text("menu_data").notNull(), // JSON string of cell values
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase requests
export const purchaseRequests = mysqlTable("purchase_requests", {
  id: int("id").autoincrement().primaryKey(),
  serialNumber: int("serial_number"),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  status: varchar("status", { length: 500 }).notNull().default("pending"),
  createdBy: text("created_by"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase request line items
export const purchaseRequestItems = mysqlTable("purchase_request_items", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("request_id").notNull().references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  itemName: text("item_name").notNull(),
  uom: text("uom").notNull(),
  requestQty: decimal("request_qty", { precision: 10, scale: 2 }).default("0"),
  approveQty: decimal("approve_qty", { precision: 10, scale: 2 }),
  approved: boolean("approved").notNull().default(false),
});

// Vendors
export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 500 }).default(""),
  address: varchar("address", { length: 500 }).default(""),
  gstNo: varchar("gst_no", { length: 500 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase invoices
export const purchaseInvoices = mysqlTable("purchase_invoices", {
  id: int("id").autoincrement().primaryKey(),
  serialNumber: int("serial_number"),
  purchaseRequestId: int("purchase_request_id").references(() => purchaseRequests.id),
  clientName: text("client_name").notNull(),
  vendorName: text("vendor_name").notNull(),
  vendorInvoiceNo: varchar("vendor_invoice_no", { length: 500 }).notNull().default(""),
  date: date("date").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default("0"),
  totalGst: decimal("total_gst", { precision: 12, scale: 2 }).default("0"),
  grandTotal: decimal("grand_total", { precision: 12, scale: 2 }).default("0"),
  paymentGiven: boolean("payment_given").default(false).notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase invoice line items
export const purchaseInvoiceItems = mysqlTable("purchase_invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: 'cascade' }),
  itemName: text("item_name").notNull(),
  uom: text("uom").notNull(),
  qty: decimal("qty", { precision: 10, scale: 2 }).default("0"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).default("0"),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).default("0"),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("0"),
  gstAmount: decimal("gst_amount", { precision: 12, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).default("0"),
});

// Item Master - unified item database
export const itemMaster = mysqlTable("item_master", {
  id: int("id").autoincrement().primaryKey(),
  itemName: varchar("item_name", { length: 255 }).notNull().unique(),
  uom: varchar("uom", { length: 500 }).notNull().default("Kg"),
  rate: decimal("rate", { precision: 10, scale: 2 }).default("0"),
  hsnCode: varchar("hsn_code", { length: 500 }).notNull().default(""),
  gstPercent: decimal("gst_percent", { precision: 5, scale: 2 }).default("0"),
  itemType: varchar("item_type", { length: 500 }).notNull().default("purchase"),
  itemCategory: varchar("item_category", { length: 500 }).notNull().default("General"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SALARY & PAYROLL TABLES ===

// Employee Master
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  employeeCode: varchar("employee_code", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  fatherName: varchar("father_name", { length: 500 }).default(""),
  designation: varchar("designation", { length: 500 }).default(""),
  department: varchar("department", { length: 500 }).default(""),
  clientName: text("client_name").notNull(),
  esicNo: varchar("esic_no", { length: 500 }).default(""),
  pfNo: varchar("pf_no", { length: 500 }).default(""),
  uanNo: varchar("uan_no", { length: 500 }).default(""),
  aadhaarNo: varchar("aadhaar_no", { length: 500 }).default(""),
  panNo: varchar("pan_no", { length: 500 }).default(""),
  bankName: varchar("bank_name", { length: 500 }).default(""),
  accountNo: varchar("account_no", { length: 500 }).default(""),
  ifscCode: varchar("ifsc_code", { length: 500 }).default(""),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).default("0"),
  fixedHra: decimal("fixed_hra", { precision: 10, scale: 2 }).default("0"),
  gender: varchar("gender", { length: 500 }).default("Male"),
  dob: date("dob"),
  address: varchar("address", { length: 500 }).default(""),
  permanentAddress: varchar("permanent_address", { length: 500 }).default(""),
  localAddress: varchar("local_address", { length: 500 }).default(""),
  skills: varchar("skills", { length: 500 }).default(""),
  joiningDate: date("joining_date"),
  leavingDate: date("leaving_date"),
  leavingReason: varchar("leaving_reason", { length: 500 }).default(""),
  mobile: varchar("mobile", { length: 500 }).default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance / Muster Roll (Form XVI)
export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  day1: text("day1"), day2: text("day2"), day3: text("day3"), day4: text("day4"), day5: text("day5"),
  day6: text("day6"), day7: text("day7"), day8: text("day8"), day9: text("day9"), day10: text("day10"),
  day11: text("day11"), day12: text("day12"), day13: text("day13"), day14: text("day14"), day15: text("day15"),
  day16: text("day16"), day17: text("day17"), day18: text("day18"), day19: text("day19"), day20: text("day20"),
  day21: text("day21"), day22: text("day22"), day23: text("day23"), day24: text("day24"), day25: text("day25"),
  day26: text("day26"), day27: text("day27"), day28: text("day28"), day29: text("day29"), day30: text("day30"),
  day31: text("day31"),
  totalPresent: decimal("total_present", { precision: 5, scale: 1 }).default("0"),
  totalAbsent: decimal("total_absent", { precision: 5, scale: 1 }).default("0"),
  overtimeHours: decimal("overtime_hours", { precision: 6, scale: 2 }).default("0"),
  remarks: varchar("remarks", { length: 500 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Salary Records / Register of Wages (Form XVII)
export const salaryRecords = mysqlTable("salary_records", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  daysWorked: decimal("days_worked", { precision: 5, scale: 1 }).default("0"),
  basicWage: decimal("basic_wage", { precision: 12, scale: 2 }).default("0"),
  da: decimal("da", { precision: 12, scale: 2 }).default("0"),
  hra: decimal("hra", { precision: 12, scale: 2 }).default("0"),
  otherAllowance: decimal("other_allowance", { precision: 12, scale: 2 }).default("0"),
  grossWage: decimal("gross_wage", { precision: 12, scale: 2 }).default("0"),
  pfDeduction: decimal("pf_deduction", { precision: 12, scale: 2 }).default("0"),
  esicDeduction: decimal("esic_deduction", { precision: 12, scale: 2 }).default("0"),
  professionalTax: decimal("professional_tax", { precision: 12, scale: 2 }).default("0"),
  advanceDeduction: decimal("advance_deduction", { precision: 12, scale: 2 }).default("0"),
  fineDeduction: decimal("fine_deduction", { precision: 12, scale: 2 }).default("0"),
  lwf: decimal("lwf", { precision: 12, scale: 2 }).default("0"),
  otherDeduction: decimal("other_deduction", { precision: 12, scale: 2 }).default("0"),
  totalDeduction: decimal("total_deduction", { precision: 12, scale: 2 }).default("0"),
  netPay: decimal("net_pay", { precision: 12, scale: 2 }).default("0"),
  overtimeHours: decimal("overtime_hours", { precision: 6, scale: 2 }).default("0"),
  overtimeRate: decimal("overtime_rate", { precision: 10, scale: 2 }).default("0"),
  overtimeAmount: decimal("overtime_amount", { precision: 12, scale: 2 }).default("0"),
  paymentMode: varchar("payment_mode", { length: 500 }).default("Bank Transfer"),
  paidOn: date("paid_on"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Fines (Form XXI)
export const fines = mysqlTable("fines", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  reason: varchar("reason", { length: 500 }).default(""),
  realized: boolean("realized").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Advances (Form XXII)
export const advances = mysqlTable("advances", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  purpose: varchar("purpose", { length: 500 }).default(""),
  installments: int("installments").default(1),
  recoveredAmount: decimal("recovered_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Overtime (Form XXIII)
export const overtimeRegister = mysqlTable("overtime_register", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  normalHours: decimal("normal_hours", { precision: 5, scale: 2 }).default("8"),
  overtimeHours: decimal("overtime_hours", { precision: 5, scale: 2 }).default("0"),
  overtimeRate: decimal("overtime_rate", { precision: 10, scale: 2 }).default("0"),
  overtimeAmount: decimal("overtime_amount", { precision: 12, scale: 2 }).default("0"),
  paidDate: date("paid_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Deductions for Damage or Loss (Form XX)
export const damageDeductions = mysqlTable("damage_deductions", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  description: varchar("description", { length: 500 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Register of Leave With Wages (Form No. 15)
export const leaveWithWages = mysqlTable("leave_with_wages", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  clientName: text("client_name").notNull(),
  calendarYear: int("calendar_year").notNull(),
  daysLeaveEarned: decimal("days_leave_earned", { precision: 6, scale: 1 }).default("0"),
  daysLeaveBroughtForward: decimal("days_leave_brought_forward", { precision: 6, scale: 1 }).default("0"),
  layOffDays: decimal("lay_off_days", { precision: 6, scale: 1 }).default("0"),
  maternityLeaveDays: decimal("maternity_leave_days", { precision: 6, scale: 1 }).default("0"),
  leaveEarned: decimal("leave_earned", { precision: 6, scale: 1 }).default("0"),
  leaveEnjoyed: decimal("leave_enjoyed", { precision: 6, scale: 1 }).default("0"),
  otherAbsenceDays: decimal("other_absence_days", { precision: 6, scale: 1 }).default("0"),
  actualDaysWorked: decimal("actual_days_worked", { precision: 6, scale: 1 }).default("0"),
  leaveAllowedDate: varchar("leave_allowed_date", { length: 500 }).default("NA"),
  leaveAllowedDays: varchar("leave_allowed_days", { length: 500 }).default("NA"),
  rateOfWagesRs: decimal("rate_of_wages_rs", { precision: 10, scale: 2 }).default("0"),
  rateOfWagesP: decimal("rate_of_wages_p", { precision: 4, scale: 0 }).default("0"),
  amountOfWagesRs: decimal("amount_of_wages_rs", { precision: 10, scale: 2 }).default("0"),
  amountOfWagesP: decimal("amount_of_wages_p", { precision: 4, scale: 0 }).default("0"),
  dateOfPayment: varchar("date_of_payment", { length: 500 }).default(""),
  remarks: varchar("remarks", { length: 500 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeWageRates = mysqlTable("employee_wage_rates", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  calendarYear: int("calendar_year").notNull(),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  effectiveFrom: varchar("effective_from", { length: 500 }).default(""),
  remarks: varchar("remarks", { length: 500 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skillWageRates = mysqlTable("skill_wage_rates", {
  id: int("id").autoincrement().primaryKey(),
  skillCategory: text("skill_category").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  remarks: varchar("remarks", { length: 500 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved item names for autocomplete in purchase requests and menus
export const savedItemNames = mysqlTable("saved_item_names", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  source: varchar("source", { length: 500 }).notNull().default("purchase"),
  categoryId: int("category_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table for authentication
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: varchar("role", { length: 500 }).notNull().default("user"),
  clientName: text("client_name"),
  permissions: json("permissions").$type<string[]>().notNull().default(['expense','cashseal','inventory','menu']),
  employeeId: int("employee_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin settings for access control
export const adminSettings = mysqlTable("admin_settings", {
  id: int("id").autoincrement().primaryKey(),
  adminPin: varchar("admin_pin", { length: 500 }).notNull().default("1234"),
});

export const halfYearlyReturns = mysqlTable("half_yearly_returns", {
  id: int("id").autoincrement().primaryKey(),
  clientName: text("client_name").notNull(),
  halfYear: text("half_year").notNull(),
  year: int("year").notNull(),
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

export const bonusReturns = mysqlTable("bonus_returns", {
  id: int("id").autoincrement().primaryKey(),
  clientName: text("client_name").notNull(),
  fyStartYear: int("fy_start_year").notNull(),
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

export const letters = mysqlTable("letters", {
  id: int("id").autoincrement().primaryKey(),
  serialNumber: int("serial_number"),
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

export const salesInvoices = mysqlTable("sales_invoices", {
  id: int("id").autoincrement().primaryKey(),
  slNo: int("sl_no"),
  clientName: text("client_name").notNull(),
  billDate: text("bill_date").notNull(),
  billNumber: varchar("bill_number", { length: 100 }).notNull(),
  billAmount: decimal("bill_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  gstPercent: decimal("gst_percent", { precision: 5, scale: 2 }).default("0").notNull(),
  gstAmount: decimal("gst_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  totalBillAmount: decimal("total_bill_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  tdsPercent: decimal("tds_percent", { precision: 5, scale: 2 }).default("0").notNull(),
  tdsAmount: decimal("tds_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  paymentReceivedDate: text("payment_received_date"),
  paymentReceivedAmount: decimal("payment_received_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export type SalesInvoice = typeof salesInvoices.$inferSelect;
export const insertSalesInvoiceSchema = createInsertSchema(salesInvoices).omit({ id: true, slNo: true, createdAt: true, updatedAt: true });
export const selectSalesInvoiceSchema = createSelectSchema(salesInvoices, {
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const ALL_PAYROLL_PERMISSIONS = [...ALL_PERMISSIONS, 'salary'] as const;

export type HalfYearlyReturn = typeof halfYearlyReturns.$inferSelect;
export const insertHalfYearlyReturnSchema = createInsertSchema(halfYearlyReturns).omit({ id: true, createdAt: true, updatedAt: true });
export const selectHalfYearlyReturnSchema = createSelectSchema(halfYearlyReturns, { createdAt: z.string().or(z.date()), updatedAt: z.string().or(z.date()) });
