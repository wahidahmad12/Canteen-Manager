
import { db } from "./db";
import { 
  dailyReports, 
  expenseItems, 
  vegetableItems,
  dailyInventory,
  kitchenStockItems,
  biscuitItems,
  cashSeals,
  clientNames,
  savedMenus,
  adminSettings,
  users,
  purchaseRequests,
  purchaseRequestItems,
  savedItemNames,
  vendors,
  purchaseInvoices,
  purchaseInvoiceItems,
  purchaseInvoicePayments,
  itemMaster,
  employees,
  attendance,
  salaryRecords,
  fines,
  advances,
  overtimeRegister,
  damageDeductions,
  leaveWithWages,
  employeeWageRates,
  skillWageRates,
  halfYearlyReturns,
  bonusReturns,
  letters,
  purchaseOrders,
  salesInvoices,
  ublDateEntries,
  ciplaDateEntries,
  ublLunchEntries,
  ciplaaMachineSummary,
  unichEmSnackEntries,
  unichEmLunchEntries,
  hulDateEntries,
  hulKpfExecSnacks,
  dailyPnlEntries,
  pecVenturesEntries,
  type PecVenturesEntry,
  type DailyPnlEntry,
  type UblDateEntry,
  type CiplaDateEntry,
  type UblLunchEntry,
  type CiplaaMachineSummary,
  type UnichEmSnackEntry,
  type UnichEmLunchEntry,
  type HulDateEntry,
  type HulKpfExecSnack,
  type HulSpecialOrder,
  hulSpecialOrders,
  type DailyReport, 
  type ExpenseItem,
  type CreateReportRequest,
  type UpdateReportRequest,
  type ReportWithItems,
  type VegetableItem,
  type InventoryWithItems,
  type CreateInventoryRequest,
  type AdminSettingsType,
  type ClientName,
  type SavedMenu,
  type User,
  type SafeUser,
  type PurchaseRequestWithItems,
  type SavedItemName,
  type Vendor,
  type PurchaseInvoiceWithItems,
  type PurchaseInvoicePayment,
  type ItemMaster,
  type Employee,
  type Attendance,
  type SalaryRecord,
  type Fine,
  type Advance,
  type OvertimeRecord,
  type DamageDeduction,
  type LeaveWithWages,
  type EmployeeWageRate,
  type SkillWageRate,
  type HalfYearlyReturn,
  type BonusReturn,
  type Letter,
  type SalesInvoice,
  type PurchaseOrder,
  type PankajReport,
  pankajReports,
} from "@shared/schema";
import { eq, desc, lt, and, sql, gte, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function getInsertId(dbOrTx: any): Promise<number> {
  const result = await dbOrTx.execute(sql`SELECT LAST_INSERT_ID() as insertId`);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const row = rows[0];
  return Number(row?.insertId ?? 0);
}

async function insertAndGet<T>(table: any, values: any, dbOrTx: any = db): Promise<T> {
  return await dbOrTx.transaction(async (tx: any) => {
    await tx.insert(table).values(values);
    const id = await getInsertId(tx);
    const [row] = await tx.select().from(table).where(eq(table.id, id));
    return row as T;
  });
}

export interface IStorage {
  getReports(): Promise<ReportWithItems[]>;
  getReport(id: number): Promise<ReportWithItems | undefined>;
  getPreviousDayBalance(date: string): Promise<number>;
  createReport(report: CreateReportRequest): Promise<ReportWithItems>;
  updateReport(id: number, report: UpdateReportRequest): Promise<ReportWithItems>;
  deleteReport(id: number): Promise<void>;
  getVegetableItems(): Promise<VegetableItem[]>;
  createVegetableItem(item: { name: string }): Promise<VegetableItem>;
  updateVegetableItem(id: number, item: { name: string }): Promise<VegetableItem>;
  deleteVegetableItem(id: number): Promise<void>;
  seedVegetableItems(names: string[]): Promise<void>;
  getInventories(): Promise<InventoryWithItems[]>;
  getInventory(id: number): Promise<InventoryWithItems | undefined>;
  createInventory(data: CreateInventoryRequest): Promise<InventoryWithItems>;
  updateInventory(id: number, data: CreateInventoryRequest): Promise<InventoryWithItems>;
  deleteInventory(id: number): Promise<void>;
  getCashSeals(): Promise<any[]>;
  getCashSeal(id: number): Promise<any | undefined>;
  deleteCashSeal(id: number): Promise<void>;
  syncCashSealToReport(reportId: number, akbarAliAmount: number): Promise<void>;
  getSavedMenus(): Promise<SavedMenu[]>;
  getSavedMenu(id: number): Promise<SavedMenu | undefined>;
  createSavedMenu(data: { clientName: string; startDate: string; endDate: string; menuData: string }): Promise<SavedMenu>;
  updateSavedMenu(id: number, data: { clientName?: string; startDate?: string; endDate?: string; menuData?: string }): Promise<SavedMenu>;
  deleteSavedMenu(id: number): Promise<void>;
  getClientNames(): Promise<ClientName[]>;
  createClientName(item: { name: string; address?: string; gstNo?: string; stateName?: string; stateCode?: string; agreementValidTill?: string | null }): Promise<ClientName>;
  updateClientName(id: number, item: { name?: string; address?: string; gstNo?: string; stateName?: string; stateCode?: string; agreementValidTill?: string | null }): Promise<ClientName>;
  deleteClientName(id: number): Promise<void>;
  seedClientNames(names: string[]): Promise<void>;
  getAdminPin(): Promise<string>;
  setAdminPin(pin: string): Promise<void>;
  verifyAdminPin(pin: string): Promise<boolean>;
  getUsers(): Promise<SafeUser[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; password: string; displayName: string; role: string; clientName: string | null; permissions?: string[]; employeeId?: number | null }): Promise<SafeUser>;
  updateUser(id: number, data: { displayName?: string; password?: string; role?: string; clientName?: string | null; permissions?: string[] }): Promise<SafeUser>;
  deleteUser(id: number): Promise<void>;
  seedAdminUser(): Promise<void>;
  getPurchaseRequests(): Promise<PurchaseRequestWithItems[]>;
  getPurchaseRequest(id: number): Promise<PurchaseRequestWithItems | undefined>;
  createPurchaseRequest(data: { clientName: string; date: string; createdBy?: string; items: { itemName: string; uom: string; requestQty: number }[] }): Promise<PurchaseRequestWithItems>;
  updatePurchaseRequest(id: number, data: { clientName?: string; date?: string; status?: string; approvedBy?: string; items?: { id?: number; itemName: string; uom: string; requestQty: number; approveQty?: number | null; approved: boolean }[] }): Promise<PurchaseRequestWithItems>;
  deletePurchaseRequest(id: number): Promise<void>;
  getSavedItemNames(source?: string): Promise<SavedItemName[]>;
  saveItemNames(names: string[], source: string, categoryId?: number): Promise<void>;
  getVendors(): Promise<Vendor[]>;
  createVendor(data: { name: string; phone?: string; address?: string; gstNo?: string; linkedClients?: string[] }): Promise<Vendor>;
  updateVendor(id: number, data: { name: string; phone?: string; address?: string; gstNo?: string; linkedClients?: string[] }): Promise<Vendor>;
  deleteVendor(id: number): Promise<void>;
  getPurchaseInvoices(): Promise<PurchaseInvoiceWithItems[]>;
  getPurchaseInvoice(id: number): Promise<PurchaseInvoiceWithItems | undefined>;
  createPurchaseInvoice(data: { purchaseRequestId?: number | null; allPrIds?: number[]; clientName: string; vendorName: string; vendorInvoiceNo: string; date: string; paymentGiven?: boolean; createdBy?: string; items: { itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems>;
  updatePurchaseInvoice(id: number, data: { purchaseRequestId?: number | null; clientName?: string; vendorName?: string; vendorInvoiceNo?: string; date?: string; paymentGiven?: boolean; items?: { id?: number; itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems>;
  deletePurchaseInvoice(id: number): Promise<void>;
  getLastPurchasePrices(): Promise<{ itemName: string; unitPrice: number; gstRate: number; uom: string }[]>;
  getLastVegetablePrices(): Promise<{ description: string; rate: number }[]>;
  getItemMasterItems(itemType?: string): Promise<ItemMaster[]>;
  createItemMasterItem(data: { itemName: string; uom?: string; rate?: string; hsnCode?: string; gstPercent?: string; itemType?: string }): Promise<ItemMaster>;
  updateItemMasterItem(id: number, data: { itemName?: string; uom?: string; rate?: string; hsnCode?: string; gstPercent?: string; itemType?: string }): Promise<ItemMaster>;
  deleteItemMasterItem(id: number): Promise<void>;
  syncItemMasterRates(): Promise<{ updated: number; skipped: number; noMatch: number; details: Array<{ name: string; oldRate: string; newRate: string; source: string }> }>;
  getPriceHistory(itemSearch: string, from?: string, to?: string): Promise<{ id: number; date: string; djInvoiceNo: string | null; vendorName: string; clientName: string; itemName: string; uom: string; qty: number; unitPrice: number; gstRate: number; totalPrice: number }[]>;
  renumberDjInvoiceNos(): Promise<{ updated: number }>;
  getEmployees(clientName?: string): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(data: any): Promise<Employee>;
  updateEmployee(id: number, data: any): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;
  getAttendanceByEmployeeId(employeeId: number, month: number, year: number): Promise<Attendance | undefined>;
  getSalaryByEmployeeId(employeeId: number, month: number, year: number): Promise<SalaryRecord | undefined>;
  getAttendance(clientName: string, month: number, year: number): Promise<Attendance[]>;
  saveAttendance(data: any): Promise<Attendance>;
  getSalaryRecords(clientName: string, month: number, year: number): Promise<SalaryRecord[]>;
  getSalaryRecord(id: number): Promise<SalaryRecord | undefined>;
  saveSalaryRecord(data: any): Promise<SalaryRecord>;
  deleteSalaryRecord(id: number): Promise<void>;
  generateSalary(clientName: string, month: number, year: number, paidOn?: string): Promise<SalaryRecord[]>;
  updateSalaryPaidDate(clientName: string, month: number, year: number, paidOn: string | null): Promise<number>;
  getAnnualSalary(clientName: string, fyStartYear: number): Promise<SalaryRecord[]>;
  getFines(clientName?: string): Promise<Fine[]>;
  createFine(data: any): Promise<Fine>;
  updateFine(id: number, data: any): Promise<Fine>;
  deleteFine(id: number): Promise<void>;
  getAdvances(clientName?: string): Promise<Advance[]>;
  createAdvance(data: any): Promise<Advance>;
  updateAdvance(id: number, data: any): Promise<Advance>;
  deleteAdvance(id: number): Promise<void>;
  getOvertimeRecords(clientName?: string): Promise<OvertimeRecord[]>;
  createOvertimeRecord(data: any): Promise<OvertimeRecord>;
  updateOvertimeRecordFull(id: number, data: any): Promise<OvertimeRecord>;
  deleteOvertimeRecord(id: number): Promise<void>;
  updateOvertimeRecord(id: number, data: { overtimeRate?: string; overtimeAmount?: string }): Promise<void>;
  getDamageDeductions(clientName?: string): Promise<DamageDeduction[]>;
  createDamageDeduction(data: any): Promise<DamageDeduction>;
  updateDamageDeduction(id: number, data: any): Promise<DamageDeduction>;
  deleteDamageDeduction(id: number): Promise<void>;
  getLeaveWithWages(employeeId: number): Promise<LeaveWithWages[]>;
  getLeaveWithWagesByClient(clientName: string): Promise<LeaveWithWages[]>;
  createLeaveWithWages(data: any): Promise<LeaveWithWages>;
  updateLeaveWithWages(id: number, data: any): Promise<LeaveWithWages>;
  deleteLeaveWithWages(id: number): Promise<void>;
  getEmployeeWageRates(employeeId: number): Promise<EmployeeWageRate[]>;
  getEmployeeWageRate(employeeId: number, year: number): Promise<EmployeeWageRate | undefined>;
  createEmployeeWageRate(data: any): Promise<EmployeeWageRate>;
  updateEmployeeWageRate(id: number, data: any): Promise<EmployeeWageRate>;
  deleteEmployeeWageRate(id: number): Promise<void>;
  getSkillWageRates(year?: number): Promise<SkillWageRate[]>;
  getSkillWageRate(skillCategory: string, month: number, year: number): Promise<SkillWageRate | undefined>;
  createOrUpdateSkillWageRate(data: any): Promise<SkillWageRate>;
  deleteSkillWageRate(id: number): Promise<void>;
  getHalfYearlyReturns(clientName?: string): Promise<HalfYearlyReturn[]>;
  getHalfYearlyReturn(clientName: string, halfYear: string, year: number): Promise<HalfYearlyReturn | undefined>;
  saveHalfYearlyReturn(data: any): Promise<HalfYearlyReturn>;
  deleteHalfYearlyReturn(id: number): Promise<void>;
  getBonusReturn(clientName: string, fyStartYear: number): Promise<BonusReturn | undefined>;
  saveBonusReturn(data: any): Promise<BonusReturn>;
  deleteBonusReturn(id: number): Promise<void>;
  getLetters(): Promise<Letter[]>;
  getLetter(id: number): Promise<Letter | undefined>;
  getNextLetterSerialNumber(): Promise<number>;
  createLetter(data: any): Promise<Letter>;
  updateLetter(id: number, data: any): Promise<Letter>;
  deleteLetter(id: number): Promise<void>;
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(data: any): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: number, data: any): Promise<PurchaseOrder>;
  deletePurchaseOrder(id: number): Promise<void>;
  getSalesInvoices(): Promise<SalesInvoice[]>;
  getSalesInvoice(id: number): Promise<SalesInvoice | undefined>;
  createSalesInvoice(data: any): Promise<SalesInvoice>;
  updateSalesInvoice(id: number, data: any): Promise<SalesInvoice>;
  deleteSalesInvoice(id: number): Promise<void>;
  getPankajReports(month: number, year: number): Promise<PankajReport[]>;
  savePankajReport(data: any): Promise<PankajReport>;
  updatePankajReport(id: number, data: any): Promise<PankajReport>;
  deletePankajReport(id: number): Promise<void>;
  // UBL Date Entries
  getUblDateEntries(month: number, year: number): Promise<UblDateEntry[]>;
  createUblDateEntry(data: any): Promise<UblDateEntry>;
  updateUblDateEntry(id: number, data: any): Promise<UblDateEntry>;
  deleteUblDateEntry(id: number): Promise<void>;
  // Cipla Date Entries
  getCiplaDateEntries(month: number, year: number): Promise<CiplaDateEntry[]>;
  createCiplaDateEntry(data: any): Promise<CiplaDateEntry>;
  updateCiplaDateEntry(id: number, data: any): Promise<CiplaDateEntry>;
  deleteCiplaDateEntry(id: number): Promise<void>;
  // UBL Lunch Entries (Format 2)
  getUblLunchEntries(month: number, year: number): Promise<UblLunchEntry[]>;
  createUblLunchEntry(data: any): Promise<UblLunchEntry>;
  updateUblLunchEntry(id: number, data: any): Promise<UblLunchEntry>;
  deleteUblLunchEntry(id: number): Promise<void>;
  getCiplaaMachineSummary(month: number, year: number): Promise<CiplaaMachineSummary | null>;
  upsertCiplaaMachineSummary(month: number, year: number, data: { bfMachine: number; luMachine: number; diMachine: number }): Promise<CiplaaMachineSummary>;
  // Unichem Snack Entries (Form 1)
  getUnichEmSnackEntries(month: number, year: number, location: string): Promise<UnichEmSnackEntry[]>;
  createUnichEmSnackEntry(data: any): Promise<UnichEmSnackEntry>;
  updateUnichEmSnackEntry(id: number, data: any): Promise<UnichEmSnackEntry>;
  deleteUnichEmSnackEntry(id: number): Promise<void>;
  // Unichem Lunch Entries (Form 2)
  getUnichEmLunchEntries(month: number, year: number, location: string, mealType?: string): Promise<UnichEmLunchEntry[]>;
  createUnichEmLunchEntry(data: any): Promise<UnichEmLunchEntry>;
  updateUnichEmLunchEntry(id: number, data: any): Promise<UnichEmLunchEntry>;
  deleteUnichEmLunchEntry(id: number): Promise<void>;
  getUnichEmSundayLunchYearlySummary(year: number): Promise<{ month: number; sundayLunch: number }[]>;
  // Daily P&L
  getDailyPnlEntry(date: string, clientName: string): Promise<any | null>;
  saveDailyPnlEntry(data: any): Promise<number>;
  getPrevDailyPnlBalance(date: string, clientName: string): Promise<number>;
  getDailyPnlMonthSummary(month: number, year: number): Promise<any[]>;
  getDailyPnlMonthlySummary(year: number, clientName?: string): Promise<any[]>;
  getDailyPnlYearlySummary(clientName?: string): Promise<any[]>;
  getCashSealForDate(date: string): Promise<any | null>;
  getLastPurchasePrice(itemName: string): Promise<number>;
  // PEC Ventures Entries
  getPecVenturesEntries(month: number, year: number): Promise<PecVenturesEntry[]>;
  createPecVenturesEntry(data: any): Promise<PecVenturesEntry>;
  updatePecVenturesEntry(id: number, data: any): Promise<PecVenturesEntry>;
  deletePecVenturesEntry(id: number): Promise<void>;
  getPecVenturesYearlySummary(year: number): Promise<any[]>;
  getPecVenturesLunchYearlySummary(year: number): Promise<{ month: number; lunchOrder: number; lunchBill: number; lunchTotal: number; dinnerOrder: number; dinnerBill: number; dinnerTotal: number }[]>;
  getMonthlyPnl(month: number, year: number, clients?: string[]): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getVegetableItems(): Promise<VegetableItem[]> {
    return await db.select().from(vegetableItems).orderBy(vegetableItems.name);
  }

  async createVegetableItem(item: { name: string }): Promise<VegetableItem> {
    const [newItem] = await db.transaction(async (tx) => {

      await tx.insert(vegetableItems).values(item);

      const __iid = await getInsertId(tx);

      return await tx.select().from(vegetableItems).where(eq(vegetableItems.id, __iid));

    });
    return newItem;
  }

  async updateVegetableItem(id: number, item: { name: string }): Promise<VegetableItem> {
    await db.update(vegetableItems).set(item).where(eq(vegetableItems.id, id));
    const [updated] = await db.select().from(vegetableItems).where(eq(vegetableItems.id, id));
    if (!updated) throw new Error("Vegetable not found");
    return updated;
  }

  async deleteVegetableItem(id: number): Promise<void> {
    await db.delete(vegetableItems).where(eq(vegetableItems.id, id));
  }

  async seedVegetableItems(names: string[]): Promise<void> {
    for (const name of names) {
      try { await db.insert(vegetableItems).values({ name }); } catch(e: any) { if (e?.code !== 'ER_DUP_ENTRY') throw e; }
    }
  }

  async getReports(): Promise<ReportWithItems[]> {
    const reports = await db.select().from(dailyReports).orderBy(desc(dailyReports.date));
    return await Promise.all(reports.map(async (report) => {
      const items = await db.select().from(expenseItems).where(eq(expenseItems.reportId, report.id));
      return { ...report, items: items.sort((a, b) => a.id - b.id) };
    }));
  }

  async getReport(id: number): Promise<ReportWithItems | undefined> {
    const report = await db.select().from(dailyReports).where(eq(dailyReports.id, id));
    
    if (report.length === 0) {
      return undefined;
    }

    const items = await db.select().from(expenseItems).where(eq(expenseItems.reportId, id));

    return {
      ...report[0],
      items: items.sort((a, b) => a.id - b.id), // Maintain insertion order roughly
    };
  }

  async getPreviousDayBalance(dateStr: string): Promise<number> {
    const prevReport = await db.select()
      .from(dailyReports)
      .where(lt(dailyReports.date, dateStr))
      .orderBy(desc(dailyReports.date))
      .limit(1);

    if (prevReport.length === 0) return 0;

    const report = prevReport[0];
    const items = await db.select().from(expenseItems).where(eq(expenseItems.reportId, report.id));
    
    const totalExpense = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalCash = Number(report.openingBalance) + Number(report.receivedAmount) + Number(report.giveByWahid || 0);
    return totalCash - totalExpense;
  }

  async createReport(request: CreateReportRequest): Promise<ReportWithItems> {
    return await db.transaction(async (tx) => {
      const [maxRow] = await tx.select({ maxNum: sql<number>`COALESCE(MAX(report_number), 0)` }).from(dailyReports);
      const nextReportNumber = (maxRow?.maxNum ?? 0) + 1;
      await tx.insert(dailyReports).values({
        date: request.date,
        openingBalance: request.openingBalance.toString(),
        receivedAmount: request.receivedAmount.toString(),
        giveByWahid: (request.giveByWahid ?? 0).toString(),
        reportNumber: nextReportNumber,
      });
      const __iid = await getInsertId(tx);
      const [report] = await tx.select().from(dailyReports).where(eq(dailyReports.id, __iid));

      if (request.items.length > 0) {
        await tx.insert(expenseItems).values(
          request.items.map(item => ({
            ...item,
            reportId: report.id,
            qty: item.qty.toString(),
            rate: item.rate.toString(),
            amount: item.amount.toString(),
          }))
        );
      }

      const items = await tx.select().from(expenseItems).where(eq(expenseItems.reportId, report.id));
      
      return { ...report, items };
    });
  }

  async updateReport(id: number, request: UpdateReportRequest): Promise<ReportWithItems> {
    return await db.transaction(async (tx) => {
      // Update report header
      await tx.update(dailyReports)
        .set({
          ...(request.date ? { date: request.date } : {}),
          ...(request.openingBalance !== undefined ? { openingBalance: request.openingBalance.toString() } : {}),
          ...(request.receivedAmount !== undefined ? { receivedAmount: request.receivedAmount.toString() } : {}),
          ...(request.giveByWahid !== undefined ? { giveByWahid: request.giveByWahid.toString() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dailyReports.id, id));
      const [report] = await tx.select().from(dailyReports).where(eq(dailyReports.id, id));

      if (!report) throw new Error("Report not found");

      // Handle items if provided
      if (request.items) {
        // Simple strategy: Delete all and recreate (or we could try to diff, but replace is safer for full form saves)
        // However, for better UX with IDs, let's just delete all for this report and re-insert.
        // In a high-concurrency app, this might be bad, but for a single-user canteen app, it's fine.
        
        await tx.delete(expenseItems).where(eq(expenseItems.reportId, id));

        if (request.items.length > 0) {
          await tx.insert(expenseItems).values(
            request.items.map(item => ({
              reportId: id,
              category: item.category,
              description: item.description,
              uom: item.uom,
              qty: item.qty.toString(),
              rate: item.rate.toString(),
              amount: item.amount.toString(),
            }))
          );
        }
      }

      const items = await tx.select().from(expenseItems).where(eq(expenseItems.reportId, id));
      return { ...report, items };
    });
  }

  async deleteReport(id: number): Promise<void> {
    await db.delete(dailyReports).where(eq(dailyReports.id, id));
  }

  async getInventories(): Promise<InventoryWithItems[]> {
    const inventories = await db.select().from(dailyInventory).orderBy(desc(dailyInventory.date));
    return await Promise.all(inventories.map(async (inv) => {
      const stock = await db.select().from(kitchenStockItems).where(eq(kitchenStockItems.inventoryId, inv.id));
      const biscuits = await db.select().from(biscuitItems).where(eq(biscuitItems.inventoryId, inv.id));
      return { ...inv, kitchenStock: stock, biscuits };
    }));
  }

  async getInventory(id: number): Promise<InventoryWithItems | undefined> {
    const inv = await db.select().from(dailyInventory).where(eq(dailyInventory.id, id));
    if (inv.length === 0) return undefined;
    const stock = await db.select().from(kitchenStockItems).where(eq(kitchenStockItems.inventoryId, id));
    const biscuits = await db.select().from(biscuitItems).where(eq(biscuitItems.inventoryId, id));
    return { ...inv[0], kitchenStock: stock, biscuits };
  }

  async createInventory(data: CreateInventoryRequest): Promise<InventoryWithItems> {
    return await db.transaction(async (tx) => {
      await tx.insert(dailyInventory).values({ date: data.date });
      const __iid = await getInsertId(tx);
      const [inv] = await tx.select().from(dailyInventory).where(eq(dailyInventory.id, __iid));
      if (data.kitchenStock.length > 0) {
        await tx.insert(kitchenStockItems).values(
          data.kitchenStock.map(item => ({
            ...item,
            inventoryId: inv.id,
            open: (item.open || 0).toString(),
            used: (item.used || 0).toString(),
            balance: (item.balance || 0).toString(),
          }))
        );
      }
      if (data.biscuits.length > 0) {
        await tx.insert(biscuitItems).values(
          data.biscuits.map(item => ({
            ...item,
            inventoryId: inv.id,
            given: (item.given || 0).toString(),
            used: (item.used || 0).toString(),
            balance: (item.balance || 0).toString(),
          }))
        );
      }
      const stock = await tx.select().from(kitchenStockItems).where(eq(kitchenStockItems.inventoryId, inv.id));
      const biscuitsResult = await tx.select().from(biscuitItems).where(eq(biscuitItems.inventoryId, inv.id));
      return { ...inv, kitchenStock: stock, biscuits: biscuitsResult };
    });
  }

  async updateInventory(id: number, data: CreateInventoryRequest): Promise<InventoryWithItems> {
    return await db.transaction(async (tx) => {
      await tx.update(dailyInventory)
        .set({ date: data.date, updatedAt: new Date() })
        .where(eq(dailyInventory.id, id));
      const [inv] = await tx.select().from(dailyInventory).where(eq(dailyInventory.id, id));
      if (!inv) throw new Error("Inventory not found");
      await tx.delete(kitchenStockItems).where(eq(kitchenStockItems.inventoryId, id));
      await tx.delete(biscuitItems).where(eq(biscuitItems.inventoryId, id));
      if (data.kitchenStock.length > 0) {
        await tx.insert(kitchenStockItems).values(
          data.kitchenStock.map(item => ({
            ...item,
            inventoryId: id,
            open: (item.open || 0).toString(),
            used: (item.used || 0).toString(),
            balance: (item.balance || 0).toString(),
          }))
        );
      }
      if (data.biscuits.length > 0) {
        await tx.insert(biscuitItems).values(
          data.biscuits.map(item => ({
            ...item,
            inventoryId: id,
            given: (item.given || 0).toString(),
            used: (item.used || 0).toString(),
            balance: (item.balance || 0).toString(),
          }))
        );
      }
      const stock = await tx.select().from(kitchenStockItems).where(eq(kitchenStockItems.inventoryId, id));
      const biscuitsResult = await tx.select().from(biscuitItems).where(eq(biscuitItems.inventoryId, id));
      return { ...inv, kitchenStock: stock, biscuits: biscuitsResult };
    });
  }

  async deleteInventory(id: number): Promise<void> {
    await db.delete(dailyInventory).where(eq(dailyInventory.id, id));
  }

  async getCashSeals(): Promise<any[]> {
    const seals = await db.select({
      cashSeal: cashSeals,
      report: dailyReports,
    }).from(cashSeals)
      .innerJoin(dailyReports, eq(cashSeals.reportId, dailyReports.id))
      .orderBy(desc(dailyReports.date));
    return seals.map(s => ({ ...s.cashSeal, date: s.report.date }));
  }

  async getCashSeal(id: number): Promise<any | undefined> {
    const result = await db.select({
      cashSeal: cashSeals,
      report: dailyReports,
    }).from(cashSeals)
      .innerJoin(dailyReports, eq(cashSeals.reportId, dailyReports.id))
      .where(eq(cashSeals.id, id));
    if (result.length === 0) return undefined;
    return { ...result[0].cashSeal, date: result[0].report.date };
  }

  async createCashSeal(data: any): Promise<any> {
    return await db.transaction(async (tx) => {
      let report = await tx.select().from(dailyReports).where(eq(dailyReports.date, data.date));
      let reportId: number;
      if (report.length === 0) {
        await tx.insert(dailyReports).values({
          date: data.date,
          openingBalance: "0",
          receivedAmount: "0",
        });
        const __iid = await getInsertId(tx);
        const [newReport] = await tx.select().from(dailyReports).where(eq(dailyReports.id, __iid));
        reportId = newReport.id;
      } else {
        reportId = report[0].id;
      }
      const existing = await tx.select().from(cashSeals).where(eq(cashSeals.reportId, reportId));
      if (existing.length > 0) {
        await tx.update(cashSeals).set({
          incomeMorningQty: data.incomeMorningQty?.toString() || "0",
          incomeLunchQty: data.incomeLunchQty?.toString() || "0",
          incomeEveningQty: data.incomeEveningQty?.toString() || "0",
          incomeNightQty: data.incomeNightQty?.toString() || "0",
          incomeNonVegRate: data.incomeNonVegRate?.toString() || "0",
          incomeNonVegQty: data.incomeNonVegQty?.toString() || "0",
          incomeVegRate: data.incomeVegRate?.toString() || "0",
          incomeVegQty: data.incomeVegQty?.toString() || "0",
          incomeMorningCashRate: data.incomeMorningCashRate?.toString() || "0",
          incomeMorningCashQty: data.incomeMorningCashQty?.toString() || "0",
          incomeEveningCashRate: data.incomeEveningCashRate?.toString() || "0",
          incomeEveningCashQty: data.incomeEveningCashQty?.toString() || "0",
          expenseBananaQty: data.expenseBananaQty?.toString() || "0",
          expenseDahiBharQty: data.expenseDahiBharQty?.toString() || "0",
          expenseDahiBharRate: data.expenseDahiBharRate?.toString() || "0",
          expenseOtherAmount: data.expenseOtherAmount?.toString() || "0",
          totalGivenToAkbarAli: data.totalGivenToAkbarAli?.toString() || "0",
          incomeOnlineBreakfastQty: data.incomeOnlineBreakfastQty?.toString() || "0",
          incomeOnlineLunchQty: data.incomeOnlineLunchQty?.toString() || "0",
          incomeOnlineEveningSnacksQty: data.incomeOnlineEveningSnacksQty?.toString() || "0",
          incomeOnlineNightQty: data.incomeOnlineNightQty?.toString() || "0",
          incomePsBreakfastCashQty: data.incomePsBreakfastCashQty?.toString() || "0",
          incomePsLunchCashQty: data.incomePsLunchCashQty?.toString() || "0",
          incomePsEveningCashQty: data.incomePsEveningCashQty?.toString() || "0",
          incomePsNightCashQty: data.incomePsNightCashQty?.toString() || "0",
          incomePsRechargeRate: data.incomePsRechargeRate?.toString() || "0",
          incomePsRechargeCashQty: data.incomePsRechargeCashQty?.toString() || "0",
          incomePsBreakfastOnlineQty: data.incomePsBreakfastOnlineQty?.toString() || "0",
          incomePsLunchOnlineQty: data.incomePsLunchOnlineQty?.toString() || "0",
          incomePsEveningOnlineQty: data.incomePsEveningOnlineQty?.toString() || "0",
          incomePsNightOnlineQty: data.incomePsNightOnlineQty?.toString() || "0",
          incomePsRechargeOnlineQty: data.incomePsRechargeOnlineQty?.toString() || "0",
          incomeTpBreakfastCashQty: data.incomeTpBreakfastCashQty?.toString() || "0",
          incomeTpLunchVegCashQty: data.incomeTpLunchVegCashQty?.toString() || "0",
          incomeTpLunchNvRate: data.incomeTpLunchNvRate?.toString() || "0",
          incomeTpLunchNvCashQty: data.incomeTpLunchNvCashQty?.toString() || "0",
          incomeTpLunchEggCashQty: data.incomeTpLunchEggCashQty?.toString() || "0",
          incomeTpLunchFishCashQty: data.incomeTpLunchFishCashQty?.toString() || "0",
          incomeTpLunchChickenCashQty: data.incomeTpLunchChickenCashQty?.toString() || "0",
          incomeTpEveningCashQty: data.incomeTpEveningCashQty?.toString() || "0",
          incomeTpNightCashQty: data.incomeTpNightCashQty?.toString() || "0",
          incomeTpBreakfastOnlineQty: data.incomeTpBreakfastOnlineQty?.toString() || "0",
          incomeTpLunchVegOnlineQty: data.incomeTpLunchVegOnlineQty?.toString() || "0",
          incomeTpLunchNvOnlineQty: data.incomeTpLunchNvOnlineQty?.toString() || "0",
          incomeTpLunchEggOnlineQty: data.incomeTpLunchEggOnlineQty?.toString() || "0",
          incomeTpLunchFishOnlineQty: data.incomeTpLunchFishOnlineQty?.toString() || "0",
          incomeTpLunchChickenOnlineQty: data.incomeTpLunchChickenOnlineQty?.toString() || "0",
          incomeTpEveningOnlineQty: data.incomeTpEveningOnlineQty?.toString() || "0",
          incomeTpNightOnlineQty: data.incomeTpNightOnlineQty?.toString() || "0",
          putDays: data.putDays != null ? Number(data.putDays) : 0,
        }).where(eq(cashSeals.id, existing[0].id));
        const [updated] = await tx.select().from(cashSeals).where(eq(cashSeals.id, existing[0].id));
        return { ...updated, date: data.date };
      } else {
        await tx.insert(cashSeals).values({
          reportId,
          incomeMorningQty: data.incomeMorningQty?.toString() || "0",
          incomeLunchQty: data.incomeLunchQty?.toString() || "0",
          incomeEveningQty: data.incomeEveningQty?.toString() || "0",
          incomeNightQty: data.incomeNightQty?.toString() || "0",
          incomeNonVegRate: data.incomeNonVegRate?.toString() || "0",
          incomeNonVegQty: data.incomeNonVegQty?.toString() || "0",
          incomeVegRate: data.incomeVegRate?.toString() || "0",
          incomeVegQty: data.incomeVegQty?.toString() || "0",
          incomeMorningCashRate: data.incomeMorningCashRate?.toString() || "0",
          incomeMorningCashQty: data.incomeMorningCashQty?.toString() || "0",
          incomeEveningCashRate: data.incomeEveningCashRate?.toString() || "0",
          incomeEveningCashQty: data.incomeEveningCashQty?.toString() || "0",
          expenseBananaQty: data.expenseBananaQty?.toString() || "0",
          expenseDahiBharQty: data.expenseDahiBharQty?.toString() || "0",
          expenseDahiBharRate: data.expenseDahiBharRate?.toString() || "0",
          expenseOtherAmount: data.expenseOtherAmount?.toString() || "0",
          totalGivenToAkbarAli: data.totalGivenToAkbarAli?.toString() || "0",
          incomeOnlineBreakfastQty: data.incomeOnlineBreakfastQty?.toString() || "0",
          incomeOnlineLunchQty: data.incomeOnlineLunchQty?.toString() || "0",
          incomeOnlineEveningSnacksQty: data.incomeOnlineEveningSnacksQty?.toString() || "0",
          incomeOnlineNightQty: data.incomeOnlineNightQty?.toString() || "0",
          incomePsBreakfastCashQty: data.incomePsBreakfastCashQty?.toString() || "0",
          incomePsLunchCashQty: data.incomePsLunchCashQty?.toString() || "0",
          incomePsEveningCashQty: data.incomePsEveningCashQty?.toString() || "0",
          incomePsNightCashQty: data.incomePsNightCashQty?.toString() || "0",
          incomePsRechargeRate: data.incomePsRechargeRate?.toString() || "0",
          incomePsRechargeCashQty: data.incomePsRechargeCashQty?.toString() || "0",
          incomePsBreakfastOnlineQty: data.incomePsBreakfastOnlineQty?.toString() || "0",
          incomePsLunchOnlineQty: data.incomePsLunchOnlineQty?.toString() || "0",
          incomePsEveningOnlineQty: data.incomePsEveningOnlineQty?.toString() || "0",
          incomePsNightOnlineQty: data.incomePsNightOnlineQty?.toString() || "0",
          incomePsRechargeOnlineQty: data.incomePsRechargeOnlineQty?.toString() || "0",
          incomeTpBreakfastCashQty: data.incomeTpBreakfastCashQty?.toString() || "0",
          incomeTpLunchVegCashQty: data.incomeTpLunchVegCashQty?.toString() || "0",
          incomeTpLunchNvRate: data.incomeTpLunchNvRate?.toString() || "0",
          incomeTpLunchNvCashQty: data.incomeTpLunchNvCashQty?.toString() || "0",
          incomeTpLunchEggCashQty: data.incomeTpLunchEggCashQty?.toString() || "0",
          incomeTpLunchFishCashQty: data.incomeTpLunchFishCashQty?.toString() || "0",
          incomeTpLunchChickenCashQty: data.incomeTpLunchChickenCashQty?.toString() || "0",
          incomeTpEveningCashQty: data.incomeTpEveningCashQty?.toString() || "0",
          incomeTpNightCashQty: data.incomeTpNightCashQty?.toString() || "0",
          incomeTpBreakfastOnlineQty: data.incomeTpBreakfastOnlineQty?.toString() || "0",
          incomeTpLunchVegOnlineQty: data.incomeTpLunchVegOnlineQty?.toString() || "0",
          incomeTpLunchNvOnlineQty: data.incomeTpLunchNvOnlineQty?.toString() || "0",
          incomeTpLunchEggOnlineQty: data.incomeTpLunchEggOnlineQty?.toString() || "0",
          incomeTpLunchFishOnlineQty: data.incomeTpLunchFishOnlineQty?.toString() || "0",
          incomeTpLunchChickenOnlineQty: data.incomeTpLunchChickenOnlineQty?.toString() || "0",
          incomeTpEveningOnlineQty: data.incomeTpEveningOnlineQty?.toString() || "0",
          incomeTpNightOnlineQty: data.incomeTpNightOnlineQty?.toString() || "0",
          putDays: data.putDays != null ? Number(data.putDays) : 0,
        });
        const __iid = await getInsertId(tx);
        const [created] = await tx.select().from(cashSeals).where(eq(cashSeals.id, __iid));
        return { ...created, date: data.date };
      }
    });
  }

  async updateCashSeal(id: number, data: any): Promise<any> {
    await db.update(cashSeals).set({
      incomeMorningQty: data.incomeMorningQty?.toString() || "0",
      incomeLunchQty: data.incomeLunchQty?.toString() || "0",
      incomeEveningQty: data.incomeEveningQty?.toString() || "0",
      incomeNightQty: data.incomeNightQty?.toString() || "0",
      incomeNonVegRate: data.incomeNonVegRate?.toString() || "0",
      incomeNonVegQty: data.incomeNonVegQty?.toString() || "0",
      incomeVegRate: data.incomeVegRate?.toString() || "0",
      incomeVegQty: data.incomeVegQty?.toString() || "0",
      incomeMorningCashRate: data.incomeMorningCashRate?.toString() || "0",
      incomeMorningCashQty: data.incomeMorningCashQty?.toString() || "0",
      incomeEveningCashRate: data.incomeEveningCashRate?.toString() || "0",
      incomeEveningCashQty: data.incomeEveningCashQty?.toString() || "0",
      expenseBananaQty: data.expenseBananaQty?.toString() || "0",
      expenseDahiBharQty: data.expenseDahiBharQty?.toString() || "0",
      expenseDahiBharRate: data.expenseDahiBharRate?.toString() || "0",
      expenseOtherAmount: data.expenseOtherAmount?.toString() || "0",
      totalGivenToAkbarAli: data.totalGivenToAkbarAli?.toString() || "0",
      incomeOnlineBreakfastQty: data.incomeOnlineBreakfastQty?.toString() || "0",
      incomeOnlineLunchQty: data.incomeOnlineLunchQty?.toString() || "0",
      incomeOnlineEveningSnacksQty: data.incomeOnlineEveningSnacksQty?.toString() || "0",
      incomeOnlineNightQty: data.incomeOnlineNightQty?.toString() || "0",
      incomePsBreakfastCashQty: data.incomePsBreakfastCashQty?.toString() || "0",
      incomePsLunchCashQty: data.incomePsLunchCashQty?.toString() || "0",
      incomePsEveningCashQty: data.incomePsEveningCashQty?.toString() || "0",
      incomePsNightCashQty: data.incomePsNightCashQty?.toString() || "0",
      incomePsRechargeRate: data.incomePsRechargeRate?.toString() || "0",
      incomePsRechargeCashQty: data.incomePsRechargeCashQty?.toString() || "0",
      incomePsBreakfastOnlineQty: data.incomePsBreakfastOnlineQty?.toString() || "0",
      incomePsLunchOnlineQty: data.incomePsLunchOnlineQty?.toString() || "0",
      incomePsEveningOnlineQty: data.incomePsEveningOnlineQty?.toString() || "0",
      incomePsNightOnlineQty: data.incomePsNightOnlineQty?.toString() || "0",
      incomePsRechargeOnlineQty: data.incomePsRechargeOnlineQty?.toString() || "0",
      incomeTpBreakfastCashQty: data.incomeTpBreakfastCashQty?.toString() || "0",
      incomeTpLunchVegCashQty: data.incomeTpLunchVegCashQty?.toString() || "0",
      incomeTpLunchNvRate: data.incomeTpLunchNvRate?.toString() || "0",
      incomeTpLunchNvCashQty: data.incomeTpLunchNvCashQty?.toString() || "0",
      incomeTpLunchEggCashQty: data.incomeTpLunchEggCashQty?.toString() || "0",
      incomeTpLunchFishCashQty: data.incomeTpLunchFishCashQty?.toString() || "0",
      incomeTpLunchChickenCashQty: data.incomeTpLunchChickenCashQty?.toString() || "0",
      incomeTpEveningCashQty: data.incomeTpEveningCashQty?.toString() || "0",
      incomeTpNightCashQty: data.incomeTpNightCashQty?.toString() || "0",
      incomeTpBreakfastOnlineQty: data.incomeTpBreakfastOnlineQty?.toString() || "0",
      incomeTpLunchVegOnlineQty: data.incomeTpLunchVegOnlineQty?.toString() || "0",
      incomeTpLunchNvOnlineQty: data.incomeTpLunchNvOnlineQty?.toString() || "0",
      incomeTpLunchEggOnlineQty: data.incomeTpLunchEggOnlineQty?.toString() || "0",
      incomeTpLunchFishOnlineQty: data.incomeTpLunchFishOnlineQty?.toString() || "0",
      incomeTpLunchChickenOnlineQty: data.incomeTpLunchChickenOnlineQty?.toString() || "0",
      incomeTpEveningOnlineQty: data.incomeTpEveningOnlineQty?.toString() || "0",
      incomeTpNightOnlineQty: data.incomeTpNightOnlineQty?.toString() || "0",
      putDays: data.putDays != null ? Number(data.putDays) : 0,
    }).where(eq(cashSeals.id, id));
    return this.getCashSeal(id);
  }

  async deleteCashSeal(id: number): Promise<void> {
    await db.delete(cashSeals).where(eq(cashSeals.id, id));
  }

  async syncCashSealToReport(reportId: number, akbarAliAmount: number): Promise<void> {
    await db.update(dailyReports)
      .set({ receivedAmount: akbarAliAmount.toFixed(2) })
      .where(eq(dailyReports.id, reportId));
  }

  async getSavedMenus(): Promise<SavedMenu[]> {
    return await db.select().from(savedMenus).orderBy(desc(savedMenus.createdAt));
  }

  async getSavedMenu(id: number): Promise<SavedMenu | undefined> {
    const [menu] = await db.select().from(savedMenus).where(eq(savedMenus.id, id));
    return menu;
  }

  async createSavedMenu(data: { clientName: string; startDate: string; endDate: string; menuData: string }): Promise<SavedMenu> {
    const [menu] = await db.transaction(async (tx) => {

      await tx.insert(savedMenus).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(savedMenus).where(eq(savedMenus.id, __iid));

    });
    return menu;
  }

  async updateSavedMenu(id: number, data: { clientName?: string; startDate?: string; endDate?: string; menuData?: string }): Promise<SavedMenu> {
    await db.update(savedMenus).set(data).where(eq(savedMenus.id, id));
    const [updated] = await db.select().from(savedMenus).where(eq(savedMenus.id, id));
    return updated;
  }

  async deleteSavedMenu(id: number): Promise<void> {
    await db.delete(savedMenus).where(eq(savedMenus.id, id));
  }

  async getClientNames(): Promise<ClientName[]> {
    return await db.select().from(clientNames).orderBy(clientNames.name);
  }

  async createClientName(item: { name: string; address?: string; gstNo?: string; agreementValidTill?: string | null }): Promise<ClientName> {
    const [newItem] = await db.transaction(async (tx) => {

      await tx.insert(clientNames).values(item);

      const __iid = await getInsertId(tx);

      return await tx.select().from(clientNames).where(eq(clientNames.id, __iid));

    });
    return newItem;
  }

  async updateClientName(id: number, item: { name?: string; address?: string; gstNo?: string; stateName?: string; stateCode?: string; agreementValidTill?: string | null }): Promise<ClientName> {
    await db.update(clientNames).set(item).where(eq(clientNames.id, id));
    const [updated] = await db.select().from(clientNames).where(eq(clientNames.id, id));
    if (!updated) throw new Error("Client not found");
    return updated;
  }

  async deleteClientName(id: number): Promise<void> {
    await db.delete(clientNames).where(eq(clientNames.id, id));
  }

  async seedClientNames(names: string[]): Promise<void> {
    for (const name of names) {
      try { await db.insert(clientNames).values({ name }); } catch(e: any) { if (e?.code !== 'ER_DUP_ENTRY') throw e; }
    }
  }

  async getAdminPin(): Promise<string> {
    const settings = await db.select().from(adminSettings);
    if (settings.length === 0) {
      await db.insert(adminSettings).values({ adminPin: "1234" });
      return "1234";
    }
    return settings[0].adminPin;
  }

  async setAdminPin(pin: string): Promise<void> {
    const settings = await db.select().from(adminSettings);
    if (settings.length === 0) {
      await db.insert(adminSettings).values({ adminPin: pin });
    } else {
      await db.update(adminSettings).set({ adminPin: pin }).where(eq(adminSettings.id, settings[0].id));
    }
  }

  async verifyAdminPin(pin: string): Promise<boolean> {
    const storedPin = await this.getAdminPin();
    return storedPin === pin;
  }

  async getUsers(): Promise<SafeUser[]> {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      clientName: users.clientName,
      permissions: users.permissions,
      employeeId: users.employeeId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users).orderBy(users.username);
    return allUsers as SafeUser[];
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(data: { username: string; password: string; displayName: string; role: string; clientName: string | null; permissions?: string[]; employeeId?: number | null }): Promise<SafeUser> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const [user] = await db.transaction(async (tx) => {

      await tx.insert(users).values({
      username: data.username,
      passwordHash,
      displayName: data.displayName,
      role: data.role,
      clientName: data.clientName,
      permissions: data.permissions || ['expense', 'cashseal', 'inventory', 'menu', 'salesinvoice'],
      employeeId: data.employeeId || null,
    });

      const __iid = await getInsertId(tx);

      return await tx.select().from(users).where(eq(users.id, __iid));

    });
    const { passwordHash: _, ...safeUser } = user;
    return safeUser as SafeUser;
  }

  async updateUser(id: number, data: { displayName?: string; password?: string; role?: string; clientName?: string | null; permissions?: string[]; employeeId?: number | null }): Promise<SafeUser> {
    const updates: any = {};
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.role !== undefined) updates.role = data.role;
    if (data.clientName !== undefined) updates.clientName = data.clientName;
    if (data.permissions !== undefined) updates.permissions = data.permissions;
    if (data.password) updates.passwordHash = await bcrypt.hash(data.password, 10);
    if ('employeeId' in data) updates.employeeId = data.employeeId ?? null;
    await db.update(users).set(updates).where(eq(users.id, id));
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...safeUser } = user;
    return safeUser as SafeUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getPurchaseRequests(): Promise<PurchaseRequestWithItems[]> {
    const requests = await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
    return await Promise.all(requests.map(async (req) => {
      const items = await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.requestId, req.id));
      return { ...req, items };
    }));
  }

  async getPurchaseRequest(id: number): Promise<PurchaseRequestWithItems | undefined> {
    const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
    if (!req) return undefined;
    const items = await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.requestId, id));
    return { ...req, items };
  }

  private generateClientAbbr(clientName: string): string {
    const words = clientName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(w => w[0]).join('').toUpperCase();
  }

  private async getNextPrCode(clientName: string, year: string): Promise<string> {
    const abbr = this.generateClientAbbr(clientName);
    const prefix = `DJ-${abbr}-${year}-`;
    const existing = await db.select({ prCode: purchaseRequests.prCode })
      .from(purchaseRequests)
      .where(sql`${purchaseRequests.prCode} LIKE ${prefix + '%'}`);
    let maxNum = 0;
    for (const row of existing) {
      if (row.prCode) {
        const parts = row.prCode.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `${prefix}${maxNum + 1}`;
  }

  async createPurchaseRequest(data: { clientName: string; date: string; createdBy?: string; items: { itemName: string; uom: string; requestQty: number }[] }): Promise<PurchaseRequestWithItems> {
    const year = data.date.slice(2, 4); // YY from YYYY-MM-DD
    const prCode = await this.getNextPrCode(data.clientName, year);
    return await db.transaction(async (tx) => {
      await tx.insert(purchaseRequests).values({
        clientName: data.clientName,
        date: data.date,
        createdBy: data.createdBy || null,
        prCode,
      });
      const __iid = await getInsertId(tx);
      const [req] = await tx.select().from(purchaseRequests).where(eq(purchaseRequests.id, __iid));
      if (data.items.length > 0) {
        await tx.insert(purchaseRequestItems).values(
          data.items.map(item => ({
            requestId: req.id,
            itemName: item.itemName,
            uom: item.uom,
            requestQty: item.requestQty.toString(),
          }))
        );
      }
      const items = await tx.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.requestId, req.id));
      return { ...req, items };
    });
  }

  async updatePurchaseRequest(id: number, data: { clientName?: string; date?: string; status?: string; approvedBy?: string; items?: { id?: number; itemName: string; uom: string; requestQty: number; approveQty?: number | null; approved: boolean }[] }): Promise<PurchaseRequestWithItems> {
    return await db.transaction(async (tx) => {
      await tx.update(purchaseRequests).set({
        ...(data.clientName ? { clientName: data.clientName } : {}),
        ...(data.date ? { date: data.date } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.approvedBy !== undefined ? { approvedBy: data.approvedBy } : {}),
      }).where(eq(purchaseRequests.id, id));
      const [req] = await tx.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
      if (!req) throw new Error("Purchase request not found");
      if (data.items) {
        await tx.delete(purchaseRequestItems).where(eq(purchaseRequestItems.requestId, id));
        if (data.items.length > 0) {
          await tx.insert(purchaseRequestItems).values(
            data.items.map(item => ({
              requestId: id,
              itemName: item.itemName,
              uom: item.uom,
              requestQty: item.requestQty.toString(),
              approveQty: item.approveQty != null ? item.approveQty.toString() : null,
              approved: item.approved,
            }))
          );
        }
      }
      const items = await tx.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.requestId, id));
      return { ...req, items };
    });
  }

  async deletePurchaseRequest(id: number): Promise<void> {
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));
  }

  async getSavedItemNames(source?: string): Promise<SavedItemName[]> {
    if (source) {
      return await db.select().from(savedItemNames).where(eq(savedItemNames.source, source)).orderBy(savedItemNames.name);
    }
    return await db.select().from(savedItemNames).orderBy(savedItemNames.name);
  }

  async saveItemNames(names: string[], source: string, categoryId?: number): Promise<void> {
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      try {
        await db.insert(savedItemNames).values({
          name: trimmed,
          source,
          categoryId: categoryId || null,
        });
      } catch {
      }
    }
  }

  async seedAdminUser(): Promise<void> {
    const existing = await db.select().from(users).where(eq(users.username, "admin"));
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await db.insert(users).values({
        username: "admin",
        passwordHash,
        displayName: "Administrator",
        role: "admin",
        clientName: null,
        permissions: ['expense','cashseal','inventory','menu','purchase','labour'],
      });
    }
  }

  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(vendors.name);
  }

  async createVendor(data: { name: string; phone?: string; address?: string; gstNo?: string; linkedClients?: string[] }): Promise<Vendor> {
    const [vendor] = await db.transaction(async (tx) => {
      const insertData: Record<string, any> = {
        name: data.name,
        phone: data.phone ?? "",
        address: data.address ?? "",
        gstNo: data.gstNo ?? "",
        linkedClients: data.linkedClients && data.linkedClients.length > 0 ? JSON.stringify(data.linkedClients) : null,
      };
      await tx.insert(vendors).values(insertData);
      const __iid = await getInsertId(tx);
      return await tx.select().from(vendors).where(eq(vendors.id, __iid));
    });
    return vendor;
  }

  async updateVendor(id: number, data: { name: string; phone?: string; address?: string; gstNo?: string; linkedClients?: string[] }): Promise<Vendor> {
    const updateData: Record<string, any> = { name: data.name };
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.gstNo !== undefined) updateData.gstNo = data.gstNo;
    updateData.linkedClients = data.linkedClients && data.linkedClients.length > 0 ? JSON.stringify(data.linkedClients) : null;
    await db.update(vendors).set(updateData).where(eq(vendors.id, id));
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    if (!vendor) throw new Error("Vendor not found");
    return vendor;
  }

  async deleteVendor(id: number): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  async getPurchaseInvoices(): Promise<PurchaseInvoiceWithItems[]> {
    const invoices = await db.select().from(purchaseInvoices).orderBy(desc(purchaseInvoices.createdAt));
    return await Promise.all(invoices.map(async (inv) => {
      const items = await db.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, inv.id));
      const payments = await db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, inv.id)).orderBy(purchaseInvoicePayments.paymentDate);
      return { ...inv, items, payments };
    }));
  }

  async getPurchaseInvoice(id: number): Promise<PurchaseInvoiceWithItems | undefined> {
    const [inv] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    if (!inv) return undefined;
    const items = await db.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id));
    const payments = await db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, id)).orderBy(purchaseInvoicePayments.paymentDate);
    return { ...inv, items, payments };
  }

  async renumberDjInvoiceNos(): Promise<{ updated: number }> {
    const [rows] = await db.execute(sql`SELECT id FROM purchase_invoices ORDER BY id ASC`) as any;
    const allRows = Array.isArray(rows) ? rows : [];
    let updated = 0;
    for (let i = 0; i < allRows.length; i++) {
      const newNo = 'DJ' + String(i + 1).padStart(3, '0');
      await db.execute(sql`UPDATE purchase_invoices SET dj_invoice_no = ${newNo} WHERE id = ${allRows[i].id}`);
      updated++;
    }
    return { updated };
  }

  async getNextDjInvoiceNo(): Promise<string> {
    // Use MAX of numeric part so we never produce a duplicate regardless of ordering
    const [row] = await db.execute(sql`SELECT MAX(CAST(REGEXP_REPLACE(dj_invoice_no, '[^0-9]', '') AS UNSIGNED)) AS maxNum FROM purchase_invoices WHERE dj_invoice_no IS NOT NULL`) as any;
    const rows = Array.isArray(row) ? row : [];
    const maxNum = Number(rows[0]?.maxNum) || 0;
    return 'DJ' + String(maxNum + 1).padStart(3, '0');
  }

  async createPurchaseInvoice(data: { purchaseRequestId?: number | null; allPrIds?: number[]; clientName: string; vendorName: string; vendorInvoiceNo: string; date: string; paymentGiven?: boolean; djInvoiceNo?: string; createdBy?: string; items: { itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems> {
    // Block duplicate DJ invoice numbers
    if (data.djInvoiceNo) {
      const [dupRows] = await db.execute(sql`SELECT id FROM purchase_invoices WHERE dj_invoice_no = ${data.djInvoiceNo} LIMIT 1`) as any;
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        throw new Error(`DJ Invoice No "${data.djInvoiceNo}" already exists. Use a different number.`);
      }
    }
    const result = await db.transaction(async (tx) => {
      const totalAmount = data.items.reduce((sum, i) => sum + i.totalPrice, 0);
      const totalGst = data.items.reduce((sum, i) => sum + i.gstAmount, 0);
      const grandTotal = data.items.reduce((sum, i) => sum + i.netAmount, 0);
      await tx.insert(purchaseInvoices).values({
        purchaseRequestId: data.purchaseRequestId || null,
        djInvoiceNo: data.djInvoiceNo || null,
        clientName: data.clientName,
        vendorName: data.vendorName,
        vendorInvoiceNo: data.vendorInvoiceNo || "",
        date: data.date,
        paymentGiven: data.paymentGiven || false,
        createdBy: data.createdBy || null,
        totalAmount: totalAmount.toString(),
        totalGst: totalGst.toString(),
        grandTotal: grandTotal.toString(),
      });
      const __iid = await getInsertId(tx);
      const [inv] = await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, __iid));
      if (data.items.length > 0) {
        await tx.insert(purchaseInvoiceItems).values(
          data.items.map(item => ({
            invoiceId: inv.id,
            itemName: item.itemName,
            uom: item.uom,
            qty: item.qty.toString(),
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice.toString(),
            gstRate: item.gstRate.toString(),
            gstAmount: item.gstAmount.toString(),
            netAmount: item.netAmount.toString(),
          }))
        );
      }
      const items = await tx.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, inv.id));
      return { ...inv, items, payments: [] };
    });
    // Mark all linked PRs as invoiced
    const prIds = data.allPrIds?.length ? data.allPrIds : (data.purchaseRequestId ? [data.purchaseRequestId] : []);
    if (prIds.length > 0) {
      await db.update(purchaseRequests).set({ invoiced: 1 }).where(sql`${purchaseRequests.id} IN (${sql.join(prIds.map(id => sql`${id}`), sql`, `)})`);
    }
    return result;
  }

  async updatePurchaseInvoice(id: number, data: { purchaseRequestId?: number | null; clientName?: string; vendorName?: string; vendorInvoiceNo?: string; date?: string; paymentGiven?: boolean; djInvoiceNo?: string; items?: { id?: number; itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems> {
    // Block duplicate DJ invoice numbers (allow same invoice to keep its own number)
    if (data.djInvoiceNo) {
      const [dupRows] = await db.execute(sql`SELECT id FROM purchase_invoices WHERE dj_invoice_no = ${data.djInvoiceNo} AND id != ${id} LIMIT 1`) as any;
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        throw new Error(`DJ Invoice No "${data.djInvoiceNo}" already exists. Use a different number.`);
      }
    }
    return await db.transaction(async (tx) => {
      const updateFields: any = {};
      if (data.clientName) updateFields.clientName = data.clientName;
      if (data.vendorName) updateFields.vendorName = data.vendorName;
      if (data.vendorInvoiceNo !== undefined) updateFields.vendorInvoiceNo = data.vendorInvoiceNo;
      if (data.date) updateFields.date = data.date;
      if (data.purchaseRequestId !== undefined) updateFields.purchaseRequestId = data.purchaseRequestId;
      if (data.paymentGiven !== undefined) updateFields.paymentGiven = data.paymentGiven;
      if (data.djInvoiceNo !== undefined) updateFields.djInvoiceNo = data.djInvoiceNo;
      if (data.items) {
        const totalAmount = data.items.reduce((sum, i) => sum + i.totalPrice, 0);
        const totalGst = data.items.reduce((sum, i) => sum + i.gstAmount, 0);
        const grandTotal = data.items.reduce((sum, i) => sum + i.netAmount, 0);
        updateFields.totalAmount = totalAmount.toString();
        updateFields.totalGst = totalGst.toString();
        updateFields.grandTotal = grandTotal.toString();
      }
      await tx.update(purchaseInvoices).set(updateFields).where(eq(purchaseInvoices.id, id));
      const [inv] = await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
      if (!inv) throw new Error("Purchase invoice not found");
      if (data.items) {
        await tx.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id));
        if (data.items.length > 0) {
          await tx.insert(purchaseInvoiceItems).values(
            data.items.map(item => ({
              invoiceId: id,
              itemName: item.itemName,
              uom: item.uom,
              qty: item.qty.toString(),
              unitPrice: item.unitPrice.toString(),
              totalPrice: item.totalPrice.toString(),
              gstRate: item.gstRate.toString(),
              gstAmount: item.gstAmount.toString(),
              netAmount: item.netAmount.toString(),
            }))
          );
        }
      }
      const items = await tx.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id));
      const payments = await tx.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, id)).orderBy(purchaseInvoicePayments.paymentDate);
      return { ...inv, items, payments };
    });
  }

  async deletePurchaseInvoice(id: number): Promise<void> {
    await db.delete(purchaseInvoices).where(eq(purchaseInvoices.id, id));
  }

  async getPurchaseInvoicePayments(invoiceId: number): Promise<PurchaseInvoicePayment[]> {
    return await db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, invoiceId)).orderBy(purchaseInvoicePayments.paymentDate);
  }

  async addPurchaseInvoicePayment(data: { invoiceId: number; paymentDate: string; amount: number; notes?: string }): Promise<PurchaseInvoicePayment> {
    await db.insert(purchaseInvoicePayments).values({
      invoiceId: data.invoiceId,
      paymentDate: data.paymentDate,
      amount: data.amount.toString(),
      notes: data.notes || null,
    });
    const id = await getInsertId(db);
    const [payment] = await db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.id, id));
    return payment;
  }

  async updatePurchaseInvoicePayment(id: number, data: { paymentDate: string; amount: number; notes?: string }): Promise<PurchaseInvoicePayment> {
    await db.update(purchaseInvoicePayments).set({
      paymentDate: data.paymentDate,
      amount: String(data.amount),
      notes: data.notes ?? null,
    }).where(eq(purchaseInvoicePayments.id, id));
    const [payment] = await db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.id, id));
    return payment;
  }

  async deletePurchaseInvoicePayment(id: number): Promise<void> {
    await db.delete(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.id, id));
  }

  async getLastVegetablePrices(): Promise<{ description: string; rate: number }[]> {
    const result = await db.execute(sql`
      SELECT e.description, e.rate
      FROM expense_items e
      INNER JOIN (
        SELECT description, MAX(id) AS max_id
        FROM expense_items
        WHERE category = 'vegetable' AND description IS NOT NULL AND description != ''
        GROUP BY description
      ) latest ON e.id = latest.max_id
      ORDER BY e.description
    `);
    const rows = Array.isArray((result as any)[0]) ? (result as any)[0] : (result.rows || []);
    return rows.map((row: any) => ({
      description: row.description,
      rate: Number(row.rate) || 0,
    }));
  }

  async getLastPurchasePrices(): Promise<{ itemName: string; unitPrice: number; gstRate: number; uom: string }[]> {
    const result = await db.execute(sql`
      SELECT t.item_name, t.unit_price, t.gst_rate, t.uom
      FROM purchase_invoice_items t
      INNER JOIN (
        SELECT item_name, MAX(id) AS max_id
        FROM purchase_invoice_items
        GROUP BY item_name
      ) latest ON t.id = latest.max_id
      ORDER BY t.item_name
    `);
    return (result.rows || []).map((row: any) => ({
      itemName: row.item_name,
      unitPrice: Number(row.unit_price) || 0,
      gstRate: Number(row.gst_rate) || 0,
      uom: String(row.uom || ''),
    }));
  }

  async getItemMasterItems(itemType?: string): Promise<ItemMaster[]> {
    if (itemType) {
      return await db.select().from(itemMaster)
        .where(sql`${itemMaster.itemType} = ${itemType} OR ${itemMaster.itemType} = 'both'`)
        .orderBy(itemMaster.itemName);
    }
    return await db.select().from(itemMaster).orderBy(itemMaster.itemName);
  }

  async createItemMasterItem(data: { itemName: string; uom?: string; rate?: string; hsnCode?: string; gstPercent?: string; itemType?: string; itemCategory?: string }): Promise<ItemMaster> {
    const normalizedName = data.itemName.trim();
    const existing = await db.select({ id: itemMaster.id }).from(itemMaster).where(eq(itemMaster.itemName, normalizedName));
    if (existing.length > 0) {
      throw new Error(`Item "${normalizedName}" already exists in Item Master.`);
    }
    const [item] = await db.transaction(async (tx) => {
      await tx.insert(itemMaster).values({
        itemName: normalizedName,
        uom: data.uom || "Kg",
        rate: data.rate || "0",
        hsnCode: data.hsnCode || "",
        gstPercent: data.gstPercent || "0",
        itemType: data.itemType || "purchase",
        itemCategory: data.itemCategory || "General",
      });
      const __iid = await getInsertId(tx);
      return await tx.select().from(itemMaster).where(eq(itemMaster.id, __iid));
    });
    return item;
  }

  async updateItemMasterItem(id: number, data: { itemName?: string; uom?: string; rate?: string; hsnCode?: string; gstPercent?: string; itemType?: string; itemCategory?: string }): Promise<ItemMaster> {
    const updateFields: any = {};
    if (data.itemName !== undefined) updateFields.itemName = data.itemName;
    if (data.uom !== undefined) updateFields.uom = data.uom;
    if (data.rate !== undefined) updateFields.rate = data.rate;
    if (data.hsnCode !== undefined) updateFields.hsnCode = data.hsnCode;
    if (data.gstPercent !== undefined) updateFields.gstPercent = data.gstPercent;
    if (data.itemType !== undefined) updateFields.itemType = data.itemType;
    if (data.itemCategory !== undefined) updateFields.itemCategory = data.itemCategory;
    await db.update(itemMaster).set(updateFields).where(eq(itemMaster.id, id));
    const [item] = await db.select().from(itemMaster).where(eq(itemMaster.id, id));
    if (!item) throw new Error("Item not found");
    return item;
  }

  async deleteItemMasterItem(id: number): Promise<void> {
    await db.delete(itemMaster).where(eq(itemMaster.id, id));
  }

  async getPriceHistory(itemSearch: string, from?: string, to?: string): Promise<{ id: number; date: string; djInvoiceNo: string | null; vendorName: string; clientName: string; itemName: string; uom: string; qty: number; unitPrice: number; gstRate: number; totalPrice: number }[]> {
    const likePattern = `%${itemSearch}%`;
    let query = sql`
      SELECT
        pii.id,
        pi.date,
        pi.dj_invoice_no,
        pi.vendor_name,
        pi.client_name,
        pii.item_name,
        pii.uom,
        pii.qty,
        pii.unit_price,
        pii.gst_rate,
        pii.total_price
      FROM purchase_invoice_items pii
      JOIN purchase_invoices pi ON pii.invoice_id = pi.id
      WHERE pii.item_name LIKE ${likePattern}
    `;
    if (from) query = sql`${query} AND pi.date >= ${from}`;
    if (to)   query = sql`${query} AND pi.date <= ${to}`;
    query = sql`${query} ORDER BY pi.date DESC, pii.id DESC LIMIT 500`;

    const result = await db.execute(query);
    return (result.rows || []).map((row: any) => ({
      id: Number(row.id),
      date: String(row.date || ''),
      djInvoiceNo: row.dj_invoice_no ? String(row.dj_invoice_no) : null,
      vendorName: String(row.vendor_name || ''),
      clientName: String(row.client_name || ''),
      itemName: String(row.item_name || ''),
      uom: String(row.uom || ''),
      qty: Number(row.qty || 0),
      unitPrice: Number(row.unit_price || 0),
      gstRate: Number(row.gst_rate || 0),
      totalPrice: Number(row.total_price || 0),
    }));
  }

  async syncItemMasterRates(): Promise<{ updated: number; skipped: number; noMatch: number; details: Array<{ name: string; oldRate: string; newRate: string; source: string }> }> {
    // 1. All item master entries
    const items = await db.select().from(itemMaster).orderBy(itemMaster.itemName);

    // 2. Last purchase invoice price per item (MySQL-compatible MAX(id) subquery)
    const invResult = await db.execute(sql`
      SELECT t.item_name, t.unit_price
      FROM purchase_invoice_items t
      INNER JOIN (
        SELECT item_name, MAX(id) AS max_id
        FROM purchase_invoice_items
        WHERE unit_price > 0
        GROUP BY item_name
      ) latest ON t.id = latest.max_id
    `);
    const invPrices = new Map<string, number>();
    (invResult.rows || []).forEach((row: any) => {
      const k = String(row.item_name || '').toLowerCase().trim();
      if (k) invPrices.set(k, Number(row.unit_price) || 0);
    });

    // 3. Last daily cash expense price per description (all categories)
    const expResult = await db.execute(sql`
      SELECT ei.description, ei.rate
      FROM expense_items ei
      INNER JOIN (
        SELECT description, MAX(id) AS max_id
        FROM expense_items
        WHERE description IS NOT NULL AND description != '' AND rate > 0
        GROUP BY description
      ) latest ON ei.id = latest.max_id
    `);
    const expPrices = new Map<string, number>();
    (expResult.rows || []).forEach((row: any) => {
      const k = String(row.description || '').toLowerCase().trim();
      if (k) expPrices.set(k, Number(row.rate) || 0);
    });

    let updated = 0, skipped = 0, noMatch = 0;
    const details: Array<{ name: string; oldRate: string; newRate: string; source: string }> = [];

    for (const item of items) {
      const nameKey = item.itemName.toLowerCase().trim();
      let newRate: number | null = null;
      let source = '';

      // Step 1: Exact match — Purchase Invoice
      if (invPrices.has(nameKey) && invPrices.get(nameKey)! > 0) {
        newRate = invPrices.get(nameKey)!;
        source = 'Purchase Invoice';
      }
      // Step 2: Fuzzy match — Purchase Invoice
      if (!newRate) {
        for (const [ik, iv] of invPrices) {
          if (iv > 0 && (nameKey.includes(ik) || ik.includes(nameKey))) {
            newRate = iv; source = `Purchase Invoice (~${ik})`; break;
          }
        }
      }
      // Step 3: Exact match — Daily Cash Expense
      if (!newRate && expPrices.has(nameKey) && expPrices.get(nameKey)! > 0) {
        newRate = expPrices.get(nameKey)!;
        source = 'Cash Expense';
      }
      // Step 4: Fuzzy match — Daily Cash Expense
      if (!newRate) {
        for (const [ek, ev] of expPrices) {
          if (ev > 0 && (nameKey.includes(ek) || ek.includes(nameKey))) {
            newRate = ev; source = `Cash Expense (~${ek})`; break;
          }
        }
      }

      if (!newRate || newRate <= 0) { noMatch++; continue; }

      const oldRate = Number(item.rate || '0');
      if (Math.abs(oldRate - newRate) < 0.005) { skipped++; continue; }

      await db.update(itemMaster).set({ rate: String(newRate.toFixed(2)) }).where(eq(itemMaster.id, item.id));
      details.push({ name: item.itemName, oldRate: oldRate.toFixed(2), newRate: newRate.toFixed(2), source });
      updated++;
    }

    return { updated, skipped, noMatch, details };
  }

  // === EMPLOYEE MASTER ===
  async getEmployees(clientName?: string): Promise<Employee[]> {
    if (clientName) {
      return await db.select().from(employees).where(eq(employees.clientName, clientName)).orderBy(employees.name);
    }
    return await db.select().from(employees).orderBy(employees.name);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    return emp;
  }

  async createEmployee(data: any): Promise<Employee> {
    const [emp] = await db.transaction(async (tx) => {

      await tx.insert(employees).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(employees).where(eq(employees.id, __iid));

    });
    return emp;
  }

  async updateEmployee(id: number, data: any): Promise<Employee> {
    const updateFields: any = {};
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) updateFields[key] = data[key];
    }
    if (updateFields.leavingDate) {
      const leaveDate = new Date(updateFields.leavingDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (leaveDate <= today) {
        updateFields.isActive = false;
      }
    }
    if (updateFields.leavingDate === null || updateFields.leavingDate === '') {
      updateFields.leavingDate = null;
      updateFields.isActive = true;
    }
    await db.update(employees).set(updateFields).where(eq(employees.id, id));
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    if (!emp) throw new Error("Employee not found");
    return emp;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // === ATTENDANCE / MUSTER ROLL ===
  async getAttendanceByEmployeeId(employeeId: number, month: number, year: number): Promise<Attendance | undefined> {
    const [record] = await db.select().from(attendance)
      .where(and(eq(attendance.employeeId, employeeId), eq(attendance.month, month), eq(attendance.year, year)));
    return record;
  }

  async getSalaryByEmployeeId(employeeId: number, month: number, year: number): Promise<SalaryRecord | undefined> {
    const [record] = await db.select().from(salaryRecords)
      .where(and(eq(salaryRecords.employeeId, employeeId), eq(salaryRecords.month, month), eq(salaryRecords.year, year)));
    return record;
  }

  async getAttendance(clientName: string, month: number, year: number): Promise<Attendance[]> {
    return await db.select().from(attendance)
      .where(and(eq(attendance.clientName, clientName), eq(attendance.month, month), eq(attendance.year, year)));
  }

  async saveAttendance(data: any): Promise<Attendance> {
    const existing = await db.select().from(attendance)
      .where(and(eq(attendance.employeeId, data.employeeId), eq(attendance.month, data.month), eq(attendance.year, data.year)));
    if (existing.length > 0) {
      await db.update(attendance).set(data)
        .where(eq(attendance.id, existing[0].id));
      const [updated] = await db.select().from(attendance).where(eq(attendance.id, existing[0].id));
      return updated;
    }
    const [created] = await db.transaction(async (tx) => {

      await tx.insert(attendance).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(attendance).where(eq(attendance.id, __iid));

    });
    return created;
  }

  // === SALARY RECORDS ===
  async getSalaryRecords(clientName: string, month: number, year: number): Promise<SalaryRecord[]> {
    return await db.select().from(salaryRecords)
      .where(and(eq(salaryRecords.clientName, clientName), eq(salaryRecords.month, month), eq(salaryRecords.year, year)));
  }

  async getSalaryRecord(id: number): Promise<SalaryRecord | undefined> {
    const [record] = await db.select().from(salaryRecords).where(eq(salaryRecords.id, id));
    return record;
  }

  async saveSalaryRecord(data: any): Promise<SalaryRecord> {
    if (data.id) {
      const { id, ...updateData } = data;
      await db.update(salaryRecords).set(updateData).where(eq(salaryRecords.id, id));
      const [updated] = await db.select().from(salaryRecords).where(eq(salaryRecords.id, id));
      return updated;
    }
    const existing = await db.select().from(salaryRecords)
      .where(and(eq(salaryRecords.employeeId, data.employeeId), eq(salaryRecords.month, data.month), eq(salaryRecords.year, data.year)));
    if (existing.length > 0) {
      await db.update(salaryRecords).set(data).where(eq(salaryRecords.id, existing[0].id));
      const [updated] = await db.select().from(salaryRecords).where(eq(salaryRecords.id, existing[0].id));
      return updated;
    }
    const [created] = await db.transaction(async (tx) => {

      await tx.insert(salaryRecords).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(salaryRecords).where(eq(salaryRecords.id, __iid));

    });
    return created;
  }

  async deleteSalaryRecord(id: number): Promise<void> {
    await db.delete(salaryRecords).where(eq(salaryRecords.id, id));
  }

  async updateSalaryPaidDate(clientName: string, month: number, year: number, paidOn: string | null): Promise<number> {
    const result = await db.update(salaryRecords)
      .set({ paidOn })
      .where(and(eq(salaryRecords.clientName, clientName), eq(salaryRecords.month, month), eq(salaryRecords.year, year)));
    return (result as any)[0]?.affectedRows || 0;
  }

  async generateSalary(clientName: string, month: number, year: number, paidOn?: string): Promise<SalaryRecord[]> {
    const emps = await this.getEmployees(clientName);
    const lastDayOfMonth = new Date(year, month, 0);
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const activeEmps = emps.filter(e => {
      if (!e.isActive) return false;
      if (e.joiningDate) {
        const joinDate = new Date(e.joiningDate);
        if (joinDate > lastDayOfMonth) return false;
      }
      if (e.leavingDate) {
        const leaveDate = new Date(e.leavingDate);
        if (leaveDate < firstDayOfMonth) return false;
      }
      return true;
    });
    const attendanceRecords = await this.getAttendance(clientName, month, year);
    const allOtRecords = await this.getOvertimeRecords(clientName);
    const results: SalaryRecord[] = [];

    for (const emp of activeEmps) {
      const att = attendanceRecords.find(a => a.employeeId === emp.id);
      const daysWorked = att ? Number(att.totalPresent) : 0;
      const skillRate = await this.getSkillWageRate(emp.skills || "", month, year);
      const dailyRate = skillRate ? Number(skillRate.dailyRate) : (Number(emp.dailyRate) || 0);
      const basicWage = daysWorked * dailyRate;
      const da = 0;
      const hra5 = Math.round(basicWage * 0.05 * 100) / 100;
      const fixedHraAmount = Number(emp.fixedHra) || 0;
      const fixedHra = fixedHraAmount > 0 ? Math.round((fixedHraAmount / 26) * daysWorked * 100) / 100 : 0;
      const empOtRecords = allOtRecords.filter(ot => {
        if (ot.employeeId !== emp.id) return false;
        const d = new Date(ot.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      let overtimeHrs = 0;
      let overtimeAmountSum = 0;
      for (const ot of empOtRecords) {
        overtimeHrs += Number(ot.overtimeHours) || 0;
        // Auto-fetch actual OT amount from OT register
        overtimeAmountSum += Number(ot.overtimeAmount) || 0;
      }
      overtimeHrs = Math.round(overtimeHrs * 100) / 100;
      const overtimeRate = Math.round((dailyRate * 1.05) / 4 * 100) / 100;
      const overtimeAmount = Math.round(overtimeAmountSum);
      const grossWage = basicWage + hra5 + fixedHra + overtimeAmount + da;
      const pfDeduction = Math.round(basicWage * 0.12 * 100) / 100;
      const esicDeduction = grossWage <= 21000 ? Math.round(grossWage * 0.0075 * 100) / 100 : 0;
      const professionalTax = grossWage > 40000 ? 200 : grossWage > 25000 ? 150 : grossWage > 15000 ? 130 : grossWage > 10000 ? 110 : 0;
      const lwf = (month === 6 || month === 12) ? 3 : 0;
      const totalDeduction = pfDeduction + esicDeduction + professionalTax + lwf;
      const netPay = grossWage - totalDeduction;

      const record = await this.saveSalaryRecord({
        employeeId: emp.id,
        clientName,
        month,
        year,
        daysWorked: String(daysWorked),
        basicWage: String(basicWage),
        da: String(da),
        hra: String(fixedHra),
        otherAllowance: String(hra5),
        grossWage: String(grossWage),
        pfDeduction: String(pfDeduction),
        esicDeduction: String(esicDeduction),
        professionalTax: String(professionalTax),
        advanceDeduction: "0",
        fineDeduction: "0",
        lwf: String(lwf),
        otherDeduction: "0",
        totalDeduction: String(totalDeduction),
        netPay: String(netPay),
        overtimeHours: String(overtimeHrs),
        overtimeRate: String(overtimeRate),
        overtimeAmount: String(overtimeAmount),
        ...(paidOn ? { paidOn } : {}),
      });
      results.push(record);
    }
    return results;
  }

  async getAnnualSalary(clientName: string, fyStartYear: number): Promise<SalaryRecord[]> {
    const results = await db.select().from(salaryRecords)
      .where(eq(salaryRecords.clientName, clientName));
    return results.filter(r => {
      const m = r.month;
      const y = r.year;
      return (y === fyStartYear && m >= 4) || (y === fyStartYear + 1 && m <= 3);
    });
  }

  // === FINES ===
  async getFines(clientName?: string): Promise<Fine[]> {
    if (clientName) return await db.select().from(fines).where(eq(fines.clientName, clientName)).orderBy(desc(fines.date));
    return await db.select().from(fines).orderBy(desc(fines.date));
  }
  async createFine(data: any): Promise<Fine> {
    const [fine] = await db.transaction(async (tx) => {

      await tx.insert(fines).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(fines).where(eq(fines.id, __iid));

    });
    return fine;
  }
  async updateFine(id: number, data: any): Promise<Fine> {
    const updates: any = {};
    if (data.date !== undefined) updates.date = data.date;
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.reason !== undefined) updates.reason = data.reason;
    if (data.realized !== undefined) updates.realized = data.realized;
    await db.update(fines).set(updates).where(eq(fines.id, id));
    const [updated] = await db.select().from(fines).where(eq(fines.id, id));
    return updated;
  }
  async deleteFine(id: number): Promise<void> {
    await db.delete(fines).where(eq(fines.id, id));
  }

  // === ADVANCES ===
  async getAdvances(clientName?: string): Promise<Advance[]> {
    if (clientName) return await db.select().from(advances).where(eq(advances.clientName, clientName)).orderBy(desc(advances.date));
    return await db.select().from(advances).orderBy(desc(advances.date));
  }
  async createAdvance(data: any): Promise<Advance> {
    const [adv] = await db.transaction(async (tx) => {

      await tx.insert(advances).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(advances).where(eq(advances.id, __iid));

    });
    return adv;
  }
  async updateAdvance(id: number, data: any): Promise<Advance> {
    const updates: any = {};
    if (data.date !== undefined) updates.date = data.date;
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.purpose !== undefined) updates.purpose = data.purpose;
    if (data.installments !== undefined) updates.installments = data.installments;
    if (data.recoveredAmount !== undefined) updates.recoveredAmount = data.recoveredAmount;
    await db.update(advances).set(updates).where(eq(advances.id, id));
    const [updated] = await db.select().from(advances).where(eq(advances.id, id));
    return updated;
  }
  async deleteAdvance(id: number): Promise<void> {
    await db.delete(advances).where(eq(advances.id, id));
  }

  // === OVERTIME ===
  async getOvertimeRecords(clientName?: string): Promise<OvertimeRecord[]> {
    if (clientName) return await db.select().from(overtimeRegister).where(eq(overtimeRegister.clientName, clientName)).orderBy(desc(overtimeRegister.date));
    return await db.select().from(overtimeRegister).orderBy(desc(overtimeRegister.date));
  }
  async createOvertimeRecord(data: any): Promise<OvertimeRecord> {
    const [ot] = await db.transaction(async (tx) => {

      await tx.insert(overtimeRegister).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(overtimeRegister).where(eq(overtimeRegister.id, __iid));

    });
    return ot;
  }
  async deleteOvertimeRecord(id: number): Promise<void> {
    await db.delete(overtimeRegister).where(eq(overtimeRegister.id, id));
  }

  async updateOvertimeRecordFull(id: number, data: any): Promise<OvertimeRecord> {
    const updates: any = {};
    if (data.date !== undefined) updates.date = data.date;
    if (data.normalHours !== undefined) updates.normalHours = data.normalHours;
    if (data.overtimeHours !== undefined) updates.overtimeHours = data.overtimeHours;
    if (data.overtimeRate !== undefined) updates.overtimeRate = data.overtimeRate;
    if (data.overtimeAmount !== undefined) updates.overtimeAmount = data.overtimeAmount;
    if (data.paidDate !== undefined) updates.paidDate = data.paidDate;
    await db.update(overtimeRegister).set(updates).where(eq(overtimeRegister.id, id));
    const [updated] = await db.select().from(overtimeRegister).where(eq(overtimeRegister.id, id));
    return updated;
  }
  async updateOvertimeRecord(id: number, data: { overtimeRate?: string; overtimeAmount?: string }): Promise<void> {
    await db.update(overtimeRegister).set(data).where(eq(overtimeRegister.id, id));
  }

  // === DAMAGE DEDUCTIONS ===
  async getDamageDeductions(clientName?: string): Promise<DamageDeduction[]> {
    if (clientName) return await db.select().from(damageDeductions).where(eq(damageDeductions.clientName, clientName)).orderBy(desc(damageDeductions.date));
    return await db.select().from(damageDeductions).orderBy(desc(damageDeductions.date));
  }
  async createDamageDeduction(data: any): Promise<DamageDeduction> {
    const [dd] = await db.transaction(async (tx) => {

      await tx.insert(damageDeductions).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(damageDeductions).where(eq(damageDeductions.id, __iid));

    });
    return dd;
  }
  async updateDamageDeduction(id: number, data: any): Promise<DamageDeduction> {
    const updates: any = {};
    if (data.date !== undefined) updates.date = data.date;
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.description !== undefined) updates.description = data.description;
    await db.update(damageDeductions).set(updates).where(eq(damageDeductions.id, id));
    const [updated] = await db.select().from(damageDeductions).where(eq(damageDeductions.id, id));
    return updated;
  }
  async deleteDamageDeduction(id: number): Promise<void> {
    await db.delete(damageDeductions).where(eq(damageDeductions.id, id));
  }

  // === LEAVE WITH WAGES (Form 15) ===
  async getLeaveWithWages(employeeId: number): Promise<LeaveWithWages[]> {
    return await db.select().from(leaveWithWages).where(eq(leaveWithWages.employeeId, employeeId)).orderBy(leaveWithWages.calendarYear);
  }
  async getLeaveWithWagesByClient(clientName: string): Promise<LeaveWithWages[]> {
    return await db.select().from(leaveWithWages).where(eq(leaveWithWages.clientName, clientName)).orderBy(leaveWithWages.calendarYear);
  }
  async createLeaveWithWages(data: any): Promise<LeaveWithWages> {
    const [rec] = await db.transaction(async (tx) => {

      await tx.insert(leaveWithWages).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(leaveWithWages).where(eq(leaveWithWages.id, __iid));

    });
    return rec;
  }
  async updateLeaveWithWages(id: number, data: any): Promise<LeaveWithWages> {
    await db.update(leaveWithWages).set(data).where(eq(leaveWithWages.id, id));
    const [rec] = await db.select().from(leaveWithWages).where(eq(leaveWithWages.id, id));
    return rec;
  }
  async deleteLeaveWithWages(id: number): Promise<void> {
    await db.delete(leaveWithWages).where(eq(leaveWithWages.id, id));
  }

  // === EMPLOYEE WAGE RATES (Year-wise) ===
  async getEmployeeWageRates(employeeId: number): Promise<EmployeeWageRate[]> {
    return await db.select().from(employeeWageRates).where(eq(employeeWageRates.employeeId, employeeId)).orderBy(desc(employeeWageRates.calendarYear));
  }
  async getEmployeeWageRate(employeeId: number, year: number): Promise<EmployeeWageRate | undefined> {
    const [rec] = await db.select().from(employeeWageRates).where(and(eq(employeeWageRates.employeeId, employeeId), eq(employeeWageRates.calendarYear, year)));
    return rec;
  }
  async createEmployeeWageRate(data: any): Promise<EmployeeWageRate> {
    const [rec] = await db.transaction(async (tx) => {

      await tx.insert(employeeWageRates).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(employeeWageRates).where(eq(employeeWageRates.id, __iid));

    });
    return rec;
  }
  async updateEmployeeWageRate(id: number, data: any): Promise<EmployeeWageRate> {
    await db.update(employeeWageRates).set(data).where(eq(employeeWageRates.id, id));
    const [rec] = await db.select().from(employeeWageRates).where(eq(employeeWageRates.id, id));
    return rec;
  }
  async deleteEmployeeWageRate(id: number): Promise<void> {
    await db.delete(employeeWageRates).where(eq(employeeWageRates.id, id));
  }

  // === SKILL WAGE RATES (Month/Year-wise by Skill Category) ===
  async getSkillWageRates(year?: number): Promise<SkillWageRate[]> {
    if (year) {
      return await db.select().from(skillWageRates).where(eq(skillWageRates.year, year)).orderBy(skillWageRates.skillCategory, skillWageRates.month);
    }
    return await db.select().from(skillWageRates).orderBy(desc(skillWageRates.year), skillWageRates.month, skillWageRates.skillCategory);
  }
  async getSkillWageRate(skillCategory: string, month: number, year: number): Promise<SkillWageRate | undefined> {
    const [rec] = await db.select().from(skillWageRates).where(
      and(eq(skillWageRates.skillCategory, skillCategory), eq(skillWageRates.month, month), eq(skillWageRates.year, year))
    );
    return rec;
  }
  async createOrUpdateSkillWageRate(data: any): Promise<SkillWageRate> {
    const existing = await this.getSkillWageRate(data.skillCategory, data.month, data.year);
    if (existing) {
      await db.update(skillWageRates).set({ dailyRate: data.dailyRate, remarks: data.remarks || "" }).where(eq(skillWageRates.id, existing.id));
      const [rec] = await db.select().from(skillWageRates).where(eq(skillWageRates.id, existing.id));
      return rec;
    }
    const [rec] = await db.transaction(async (tx) => {

      await tx.insert(skillWageRates).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(skillWageRates).where(eq(skillWageRates.id, __iid));

    });
    return rec;
  }
  async deleteSkillWageRate(id: number): Promise<void> {
    await db.delete(skillWageRates).where(eq(skillWageRates.id, id));
  }

  async getHalfYearlyReturns(clientName?: string): Promise<HalfYearlyReturn[]> {
    if (clientName) {
      return await db.select().from(halfYearlyReturns).where(eq(halfYearlyReturns.clientName, clientName)).orderBy(desc(halfYearlyReturns.year));
    }
    return await db.select().from(halfYearlyReturns).orderBy(desc(halfYearlyReturns.year));
  }

  async getHalfYearlyReturn(clientName: string, halfYear: string, year: number): Promise<HalfYearlyReturn | undefined> {
    const [record] = await db.select().from(halfYearlyReturns).where(
      and(eq(halfYearlyReturns.clientName, clientName), eq(halfYearlyReturns.halfYear, halfYear), eq(halfYearlyReturns.year, year))
    );
    return record;
  }

  async saveHalfYearlyReturn(data: any): Promise<HalfYearlyReturn> {
    const existing = await this.getHalfYearlyReturn(data.clientName, data.halfYear, data.year);
    if (existing) {
      await db.update(halfYearlyReturns).set({ ...data, updatedAt: new Date() }).where(eq(halfYearlyReturns.id, existing.id));
      const [updated] = await db.select().from(halfYearlyReturns).where(eq(halfYearlyReturns.id, existing.id));
      return updated;
    }
    const [created] = await db.transaction(async (tx) => {

      await tx.insert(halfYearlyReturns).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(halfYearlyReturns).where(eq(halfYearlyReturns.id, __iid));

    });
    return created;
  }

  async deleteHalfYearlyReturn(id: number): Promise<void> {
    await db.delete(halfYearlyReturns).where(eq(halfYearlyReturns.id, id));
  }

  async getBonusReturn(clientName: string, fyStartYear: number): Promise<BonusReturn | undefined> {
    const [record] = await db.select().from(bonusReturns).where(
      and(eq(bonusReturns.clientName, clientName), eq(bonusReturns.fyStartYear, fyStartYear))
    );
    return record;
  }

  async saveBonusReturn(data: any): Promise<BonusReturn> {
    const existing = await this.getBonusReturn(data.clientName, data.fyStartYear);
    if (existing) {
      await db.update(bonusReturns).set({ ...data, updatedAt: new Date() }).where(eq(bonusReturns.id, existing.id));
      const [updated] = await db.select().from(bonusReturns).where(eq(bonusReturns.id, existing.id));
      return updated;
    }
    const [created] = await db.transaction(async (tx) => {

      await tx.insert(bonusReturns).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(bonusReturns).where(eq(bonusReturns.id, __iid));

    });
    return created;
  }

  async deleteBonusReturn(id: number): Promise<void> {
    await db.delete(bonusReturns).where(eq(bonusReturns.id, id));
  }

  async getLetters(): Promise<Letter[]> {
    return await db.select().from(letters).orderBy(desc(letters.id));
  }

  async getLetter(id: number): Promise<Letter | undefined> {
    const [letter] = await db.select().from(letters).where(eq(letters.id, id));
    return letter;
  }

  async getNextLetterSerialNumber(): Promise<number> {
    const result = await db.select({ maxSerial: sql<number>`COALESCE(MAX(${letters.serialNumber}), 0)` }).from(letters);
    return (result[0]?.maxSerial || 0) + 1;
  }

  async createLetter(data: any): Promise<Letter> {
    const [created] = await db.transaction(async (tx) => {

      await tx.insert(letters).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(letters).where(eq(letters.id, __iid));

    });
    return created;
  }

  async updateLetter(id: number, data: any): Promise<Letter> {
    await db.update(letters).set({ ...data, updatedAt: new Date() }).where(eq(letters.id, id));
    const [updated] = await db.select().from(letters).where(eq(letters.id, id));
    return updated;
  }

  async deleteLetter(id: number): Promise<void> {
    await db.delete(letters).where(eq(letters.id, id));
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.id));
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined> {
    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return row;
  }

  async createPurchaseOrder(data: any): Promise<PurchaseOrder> {
    return await insertAndGet<PurchaseOrder>(purchaseOrders, data);
  }

  async updatePurchaseOrder(id: number, data: any): Promise<PurchaseOrder> {
    await db.update(purchaseOrders).set({ ...data, updatedAt: new Date() }).where(eq(purchaseOrders.id, id));
    const [updated] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return updated;
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  async getSalesInvoices(): Promise<SalesInvoice[]> {
    return await db.select().from(salesInvoices).orderBy(desc(salesInvoices.id));
  }

  async getSalesInvoice(id: number): Promise<SalesInvoice | undefined> {
    const [row] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, id));
    return row;
  }

  async createSalesInvoice(data: any): Promise<SalesInvoice> {
    const nextSlNo = await db.select({ maxSl: sql<number>`COALESCE(MAX(${salesInvoices.slNo}), 0)` }).from(salesInvoices);
    const slNo = (nextSlNo[0]?.maxSl || 0) + 1;
    return await insertAndGet<SalesInvoice>(salesInvoices, { ...data, slNo });
  }

  async updateSalesInvoice(id: number, data: any): Promise<SalesInvoice> {
    await db.update(salesInvoices).set({ ...data, updatedAt: new Date() }).where(eq(salesInvoices.id, id));
    const [updated] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, id));
    return updated;
  }

  async deleteSalesInvoice(id: number): Promise<void> {
    await db.delete(salesInvoices).where(eq(salesInvoices.id, id));
  }

  async getPankajReports(month: number, year: number): Promise<PankajReport[]> {
    return await db.select().from(pankajReports)
      .where(and(eq(pankajReports.month, month), eq(pankajReports.year, year)))
      .orderBy(pankajReports.slNo);
  }

  async savePankajReport(data: any): Promise<PankajReport> {
    return await insertAndGet<PankajReport>(pankajReports, data);
  }

  async updatePankajReport(id: number, data: any): Promise<PankajReport> {
    await db.update(pankajReports).set({ ...data, updatedAt: new Date() }).where(eq(pankajReports.id, id));
    const [updated] = await db.select().from(pankajReports).where(eq(pankajReports.id, id));
    return updated;
  }

  async deletePankajReport(id: number): Promise<void> {
    await db.delete(pankajReports).where(eq(pankajReports.id, id));
  }

  async getUblDateEntries(month: number, year: number): Promise<UblDateEntry[]> {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const startDate = `${year}-${String(month).padStart(2,'0')}-21`;
    const endDate   = `${nextYear}-${String(nextMonth).padStart(2,'0')}-20`;
    return await db.select().from(ublDateEntries)
      .where(and(gte(ublDateEntries.entryDate, startDate), lte(ublDateEntries.entryDate, endDate)))
      .orderBy(ublDateEntries.entryDate);
  }
  async createUblDateEntry(data: any): Promise<UblDateEntry> {
    return await insertAndGet<UblDateEntry>(ublDateEntries, data);
  }
  async updateUblDateEntry(id: number, data: any): Promise<UblDateEntry> {
    await db.update(ublDateEntries).set({ ...data, updatedAt: new Date() }).where(eq(ublDateEntries.id, id));
    const [updated] = await db.select().from(ublDateEntries).where(eq(ublDateEntries.id, id));
    return updated;
  }
  async deleteUblDateEntry(id: number): Promise<void> {
    await db.delete(ublDateEntries).where(eq(ublDateEntries.id, id));
  }

  async getCiplaDateEntries(month: number, year: number): Promise<CiplaDateEntry[]> {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const startDate = `${year}-${String(month).padStart(2,'0')}-21`;
    const endDate   = `${nextYear}-${String(nextMonth).padStart(2,'0')}-20`;
    return await db.select().from(ciplaDateEntries)
      .where(and(gte(ciplaDateEntries.entryDate, startDate), lte(ciplaDateEntries.entryDate, endDate)))
      .orderBy(ciplaDateEntries.entryDate);
  }
  async createCiplaDateEntry(data: any): Promise<CiplaDateEntry> {
    return await insertAndGet<CiplaDateEntry>(ciplaDateEntries, data);
  }
  async updateCiplaDateEntry(id: number, data: any): Promise<CiplaDateEntry> {
    await db.update(ciplaDateEntries).set({ ...data, updatedAt: new Date() }).where(eq(ciplaDateEntries.id, id));
    const [updated] = await db.select().from(ciplaDateEntries).where(eq(ciplaDateEntries.id, id));
    return updated;
  }
  async deleteCiplaDateEntry(id: number): Promise<void> {
    await db.delete(ciplaDateEntries).where(eq(ciplaDateEntries.id, id));
  }

  async getUblLunchEntries(month: number, year: number): Promise<UblLunchEntry[]> {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    const startDate = `${year}-${String(month).padStart(2,'0')}-21`;
    const endDate   = `${nextYear}-${String(nextMonth).padStart(2,'0')}-20`;
    return await db.select().from(ublLunchEntries)
      .where(and(gte(ublLunchEntries.entryDate, startDate), lte(ublLunchEntries.entryDate, endDate)))
      .orderBy(ublLunchEntries.entryDate);
  }
  async createUblLunchEntry(data: any): Promise<UblLunchEntry> {
    return await insertAndGet<UblLunchEntry>(ublLunchEntries, data);
  }
  async updateUblLunchEntry(id: number, data: any): Promise<UblLunchEntry> {
    await db.update(ublLunchEntries).set({ ...data, updatedAt: new Date() }).where(eq(ublLunchEntries.id, id));
    const [updated] = await db.select().from(ublLunchEntries).where(eq(ublLunchEntries.id, id));
    return updated;
  }
  async deleteUblLunchEntry(id: number): Promise<void> {
    await db.delete(ublLunchEntries).where(eq(ublLunchEntries.id, id));
  }

  async getCiplaaMachineSummary(month: number, year: number): Promise<CiplaaMachineSummary | null> {
    const rows = await db.select().from(ciplaaMachineSummary)
      .where(and(eq(ciplaaMachineSummary.month, month), eq(ciplaaMachineSummary.year, year)));
    return rows[0] || null;
  }

  async upsertCiplaaMachineSummary(month: number, year: number, data: { bfMachine: number; luMachine: number; diMachine: number }): Promise<CiplaaMachineSummary> {
    const existing = await this.getCiplaaMachineSummary(month, year);
    if (existing) {
      await db.update(ciplaaMachineSummary)
        .set({ bfMachine: data.bfMachine, luMachine: data.luMachine, diMachine: data.diMachine })
        .where(eq(ciplaaMachineSummary.id, existing.id));
      const updated = await this.getCiplaaMachineSummary(month, year);
      return updated!;
    } else {
      return await insertAndGet<CiplaaMachineSummary>(ciplaaMachineSummary, { month, year, ...data });
    }
  }

  // Unichem Snack Entries (Form 1)
  async getUnichEmSnackEntries(month: number, year: number, location: string): Promise<UnichEmSnackEntry[]> {
    return await db.select().from(unichEmSnackEntries)
      .where(and(eq(unichEmSnackEntries.month, month), eq(unichEmSnackEntries.year, year), eq(unichEmSnackEntries.location, location)))
      .orderBy(unichEmSnackEntries.entryDate);
  }
  async createUnichEmSnackEntry(data: any): Promise<UnichEmSnackEntry> {
    const { location, entryDate, month, year, weekDay, breakfast, eveningSnacks, nightSnacks, sundayExtraSnacks, remarks } = data;
    await db.execute(sql`
      INSERT INTO unichem_snack_entries (location, entry_date, month, year, week_day, breakfast, evening_snacks, night_snacks, sunday_extra_snacks, remarks)
      VALUES (${location}, ${entryDate}, ${month}, ${year}, ${weekDay || null}, ${breakfast || 0}, ${eveningSnacks || 0}, ${nightSnacks || 0}, ${sundayExtraSnacks || 0}, ${remarks || ''})
      ON DUPLICATE KEY UPDATE
        breakfast = VALUES(breakfast), evening_snacks = VALUES(evening_snacks), night_snacks = VALUES(night_snacks),
        sunday_extra_snacks = VALUES(sunday_extra_snacks), remarks = VALUES(remarks), week_day = VALUES(week_day), updated_at = NOW()
    `);
    const rows = await db.select().from(unichEmSnackEntries)
      .where(and(eq(unichEmSnackEntries.location, location), eq(unichEmSnackEntries.entryDate, entryDate)));
    return rows[0];
  }
  async updateUnichEmSnackEntry(id: number, data: any): Promise<UnichEmSnackEntry> {
    const { id: _id, entryDate, createdAt, _dirty, ...safeData } = data;
    await db.update(unichEmSnackEntries).set({ ...safeData, updatedAt: new Date() }).where(eq(unichEmSnackEntries.id, id));
    const rows = await db.select().from(unichEmSnackEntries).where(eq(unichEmSnackEntries.id, id));
    return rows[0];
  }
  async deleteUnichEmSnackEntry(id: number): Promise<void> {
    await db.delete(unichEmSnackEntries).where(eq(unichEmSnackEntries.id, id));
  }

  // Unichem Lunch Entries (Form 2)
  async getUnichEmLunchEntries(month: number, year: number, location: string, mealType?: string): Promise<UnichEmLunchEntry[]> {
    const conditions = [
      eq(unichEmLunchEntries.month, month),
      eq(unichEmLunchEntries.year, year),
      eq(unichEmLunchEntries.location, location),
    ];
    if (mealType) conditions.push(eq(unichEmLunchEntries.mealType, mealType));
    return await db.select().from(unichEmLunchEntries).where(and(...conditions)).orderBy(unichEmLunchEntries.entryDate);
  }
  async createUnichEmLunchEntry(data: any): Promise<UnichEmLunchEntry> {
    // Use upsert to handle the unique constraint on (location, entry_date, meal_type)
    const { location, entryDate, month, year, weekDay, mealType, orderQty, actual, total, billQty } = data;
    await db.execute(sql`
      INSERT INTO unichem_lunch_entries (location, entry_date, month, year, week_day, meal_type, order_qty, actual, total, bill_qty)
      VALUES (${location}, ${entryDate}, ${month}, ${year}, ${weekDay || null}, ${mealType || 'lunch'}, ${orderQty || 0}, ${actual || 0}, ${total || 0}, ${billQty || 0})
      ON DUPLICATE KEY UPDATE
        order_qty = VALUES(order_qty), actual = VALUES(actual), total = VALUES(total), bill_qty = VALUES(bill_qty), week_day = VALUES(week_day), updated_at = NOW()
    `);
    const rows = await db.select().from(unichEmLunchEntries)
      .where(and(eq(unichEmLunchEntries.location, location), eq(unichEmLunchEntries.entryDate, entryDate), eq(unichEmLunchEntries.mealType, mealType || 'lunch')));
    return rows[0];
  }
  async updateUnichEmLunchEntry(id: number, data: any): Promise<UnichEmLunchEntry> {
    const { id: _id, entryDate, createdAt, _dirty, ...safeData } = data;
    await db.update(unichEmLunchEntries).set({ ...safeData, updatedAt: new Date() }).where(eq(unichEmLunchEntries.id, id));
    const rows = await db.select().from(unichEmLunchEntries).where(eq(unichEmLunchEntries.id, id));
    return rows[0];
  }
  async deleteUnichEmLunchEntry(id: number): Promise<void> {
    await db.delete(unichEmLunchEntries).where(eq(unichEmLunchEntries.id, id));
  }

  // HUL Date Entries (Hindustan Unilever Limited — KPF / TEC)
  async getHulDateEntries(month: number, year: number, location: string): Promise<HulDateEntry[]> {
    return await db.select().from(hulDateEntries)
      .where(and(eq(hulDateEntries.month, month), eq(hulDateEntries.year, year), eq(hulDateEntries.location, location)))
      .orderBy(hulDateEntries.entryDate);
  }
  async createHulDateEntry(data: any): Promise<HulDateEntry> {
    const { location, entryDate, month, year, weekDay, breakfast, lunch, eveningSnacks, nightSnacks, guestBreakfast, guestLunch, guestEveningSnacks, guestNightSnacks } = data;
    await db.execute(sql`
      INSERT INTO hul_date_entries (location, entry_date, month, year, week_day, breakfast, lunch, evening_snacks, night_snacks, guest_breakfast, guest_lunch, guest_evening_snacks, guest_night_snacks)
      VALUES (${location}, ${entryDate}, ${month}, ${year}, ${weekDay || null}, ${breakfast || 0}, ${lunch || 0}, ${eveningSnacks || 0}, ${nightSnacks || 0}, ${guestBreakfast || 0}, ${guestLunch || 0}, ${guestEveningSnacks || 0}, ${guestNightSnacks || 0})
      ON DUPLICATE KEY UPDATE
        breakfast = VALUES(breakfast), lunch = VALUES(lunch), evening_snacks = VALUES(evening_snacks), night_snacks = VALUES(night_snacks),
        guest_breakfast = VALUES(guest_breakfast), guest_lunch = VALUES(guest_lunch), guest_evening_snacks = VALUES(guest_evening_snacks),
        guest_night_snacks = VALUES(guest_night_snacks), week_day = VALUES(week_day), updated_at = NOW()
    `);
    const rows = await db.select().from(hulDateEntries)
      .where(and(eq(hulDateEntries.location, location), eq(hulDateEntries.entryDate, entryDate)));
    return rows[0];
  }
  async updateHulDateEntry(id: number, data: any): Promise<HulDateEntry> {
    const { id: _id, entryDate, createdAt, _dirty, ...safeData } = data;
    await db.update(hulDateEntries).set({ ...safeData, updatedAt: new Date() }).where(eq(hulDateEntries.id, id));
    const rows = await db.select().from(hulDateEntries).where(eq(hulDateEntries.id, id));
    return rows[0];
  }
  async deleteHulDateEntry(id: number): Promise<void> {
    await db.delete(hulDateEntries).where(eq(hulDateEntries.id, id));
  }

  // HUL KPF Executive/Manager Snacks
  async getUblDateYearlySummary(year: number): Promise<{ month: number; breakfast: number; lunch: number; dinner: number; tea: number; mutton: number; tiffin: number; boiledEgg: number; biscuit: number }[]> {
    // Group by billing period (21st–20th) using entry_date, consistent with monthly view
    const startDate = `${year}-01-21`;
    const endDate = `${year + 1}-01-20`;
    const [rows] = await db.execute(sql`
      SELECT
        CASE
          WHEN DAY(entry_date) >= 21 THEN MONTH(entry_date)
          ELSE IF(MONTH(entry_date) = 1, 12, MONTH(entry_date) - 1)
        END AS billing_month,
        COALESCE(SUM(breakfast),0) AS breakfast,
        COALESCE(SUM(lunch),0) AS lunch,
        COALESCE(SUM(dinner),0) AS dinner,
        COALESCE(SUM(tea1)+SUM(tea2)+SUM(tea3)+SUM(tea4)+SUM(tea5)+SUM(tea6),0) AS tea,
        COALESCE(SUM(mutton),0) AS mutton,
        COALESCE(SUM(tiffin),0) AS tiffin,
        COALESCE(SUM(boiled_egg),0) AS boiledEgg,
        COALESCE(SUM(biscuit1)+SUM(biscuit2),0) AS biscuit
      FROM ubl_date_entries
      WHERE entry_date >= ${startDate} AND entry_date <= ${endDate}
      GROUP BY billing_month ORDER BY billing_month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.billing_month), breakfast: Number(r.breakfast), lunch: Number(r.lunch),
      dinner: Number(r.dinner), tea: Number(r.tea), mutton: Number(r.mutton),
      tiffin: Number(r.tiffin), boiledEgg: Number(r.boiledEgg), biscuit: Number(r.biscuit),
    }));
  }

  async getUblLunchYearlySummary(year: number): Promise<{ month: number; perment: number; casual: number; contractual: number; canteen: number }[]> {
    // Group by billing period (21st–20th) using entry_date, consistent with monthly view
    const startDate = `${year}-01-21`;
    const endDate = `${year + 1}-01-20`;
    const [rows] = await db.execute(sql`
      SELECT
        CASE
          WHEN DAY(entry_date) >= 21 THEN MONTH(entry_date)
          ELSE IF(MONTH(entry_date) = 1, 12, MONTH(entry_date) - 1)
        END AS billing_month,
        COALESCE(SUM(perment),0) AS perment,
        COALESCE(SUM(casual),0) AS casual,
        COALESCE(SUM(contractual),0) AS contractual,
        COALESCE(SUM(canteen),0) AS canteen
      FROM ubl_lunch_entries
      WHERE entry_date >= ${startDate} AND entry_date <= ${endDate}
      GROUP BY billing_month ORDER BY billing_month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.billing_month), perment: Number(r.perment), casual: Number(r.casual),
      contractual: Number(r.contractual), canteen: Number(r.canteen),
    }));
  }

  async getCiplaYearlySummary(year: number): Promise<{ month: number; breakfast: number; lunch: number; dinner: number }[]> {
    // Group by billing period (21st–20th) using entry_date, consistent with monthly view
    const startDate = `${year}-01-21`;
    const endDate = `${year + 1}-01-20`;
    const [rows] = await db.execute(sql`
      SELECT
        CASE
          WHEN DAY(entry_date) >= 21 THEN MONTH(entry_date)
          ELSE IF(MONTH(entry_date) = 1, 12, MONTH(entry_date) - 1)
        END AS billing_month,
        COALESCE(SUM(breakfast_coopen)+SUM(breakfast_coin)+SUM(breakfast_sign)+SUM(breakfast_machine),0) AS breakfast,
        COALESCE(SUM(lunch_coopen)+SUM(lunch_coin)+SUM(lunch_sign)+SUM(lunch_machine),0) AS lunch,
        COALESCE(SUM(dinner_coopen)+SUM(dinner_coin)+SUM(dinner_sign)+SUM(dinner_machine),0) AS dinner
      FROM cipla_date_entries
      WHERE entry_date >= ${startDate} AND entry_date <= ${endDate}
      GROUP BY billing_month ORDER BY billing_month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.billing_month), breakfast: Number(r.breakfast), lunch: Number(r.lunch), dinner: Number(r.dinner),
    }));
  }

  async getUnichEmSnackYearlySummary(year: number): Promise<{ month: number; breakfast: number; eveningSnacks: number; nightSnacks: number; sundayExtraSnacks: number }[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(breakfast),0) AS breakfast,
        COALESCE(SUM(evening_snacks),0) AS eveningSnacks,
        COALESCE(SUM(night_snacks),0) AS nightSnacks,
        COALESCE(SUM(sunday_extra_snacks),0) AS sundayExtraSnacks
      FROM unichem_snack_entries WHERE year = ${year}
      GROUP BY month ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.month), breakfast: Number(r.breakfast), eveningSnacks: Number(r.eveningSnacks),
      nightSnacks: Number(r.nightSnacks), sundayExtraSnacks: Number(r.sundayExtraSnacks),
    }));
  }

  async getUnichEmLunchYearlySummary(year: number): Promise<{ month: number; lunch: number; dinner: number }[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(CASE WHEN meal_type='lunch' THEN bill_qty ELSE 0 END),0) AS lunch,
        COALESCE(SUM(CASE WHEN meal_type='dinner' THEN bill_qty ELSE 0 END),0) AS dinner
      FROM unichem_lunch_entries WHERE year = ${year}
      GROUP BY month ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.month), lunch: Number(r.lunch), dinner: Number(r.dinner),
    }));
  }

  async getUnichEmSundayLunchYearlySummary(year: number): Promise<{ month: number; sundayLunch: number }[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(CASE WHEN meal_type='lunch' THEN bill_qty ELSE 0 END),0) AS sundayLunch
      FROM unichem_lunch_entries
      WHERE year = ${year} AND DAYOFWEEK(entry_date) = 1
      GROUP BY month ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.month), sundayLunch: Number(r.sundayLunch),
    }));
  }

  async getHulYearlySummary(year: number, location: string): Promise<{ month: number; breakfast: number; lunch: number; eveningSnacks: number; nightSnacks: number; guestBreakfast: number; guestLunch: number; guestEveningSnacks: number; guestNightSnacks: number }[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(breakfast),0) AS breakfast,
        COALESCE(SUM(lunch),0) AS lunch,
        COALESCE(SUM(evening_snacks),0) AS eveningSnacks,
        COALESCE(SUM(night_snacks),0) AS nightSnacks,
        COALESCE(SUM(guest_breakfast),0) AS guestBreakfast,
        COALESCE(SUM(guest_lunch),0) AS guestLunch,
        COALESCE(SUM(guest_evening_snacks),0) AS guestEveningSnacks,
        COALESCE(SUM(guest_night_snacks),0) AS guestNightSnacks
      FROM hul_date_entries
      WHERE year = ${year} AND location = ${location}
      GROUP BY month
      ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.month),
      breakfast: Number(r.breakfast), lunch: Number(r.lunch),
      eveningSnacks: Number(r.eveningSnacks), nightSnacks: Number(r.nightSnacks),
      guestBreakfast: Number(r.guestBreakfast), guestLunch: Number(r.guestLunch),
      guestEveningSnacks: Number(r.guestEveningSnacks), guestNightSnacks: Number(r.guestNightSnacks),
    }));
  }

  async getHulExecYearlySummary(year: number): Promise<{ month: number; snacks: number; biscuit: number; chips: number; coldDrinkWater: number; shiftOfficerBreakfast: number }[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(snacks),0) AS snacks,
        COALESCE(SUM(biscuit),0) AS biscuit,
        COALESCE(SUM(chips),0) AS chips,
        COALESCE(SUM(cold_drink_water),0) AS coldDrinkWater,
        COALESCE(SUM(shift_officer_breakfast),0) AS shiftOfficerBreakfast
      FROM hul_kpf_exec_snacks
      WHERE year = ${year}
      GROUP BY month
      ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.month),
      snacks: Number(r.snacks), biscuit: Number(r.biscuit),
      chips: Number(r.chips), coldDrinkWater: Number(r.coldDrinkWater),
      shiftOfficerBreakfast: Number(r.shiftOfficerBreakfast),
    }));
  }

  async getHulKpfExecSnacks(month: number, year: number): Promise<HulKpfExecSnack[]> {
    return await db.select().from(hulKpfExecSnacks)
      .where(and(eq(hulKpfExecSnacks.month, month), eq(hulKpfExecSnacks.year, year)))
      .orderBy(hulKpfExecSnacks.entryDate);
  }
  async createHulKpfExecSnack(data: any): Promise<HulKpfExecSnack> {
    const { entryDate, month, year, weekDay, snacks, biscuit, chips, coldDrinkWater, shiftOfficerBreakfast } = data;
    await db.execute(sql`
      INSERT INTO hul_kpf_exec_snacks (entry_date, month, year, week_day, snacks, biscuit, chips, cold_drink_water, shift_officer_breakfast)
      VALUES (${entryDate}, ${month}, ${year}, ${weekDay || null}, ${snacks || 0}, ${biscuit || 0}, ${chips || 0}, ${coldDrinkWater || 0}, ${shiftOfficerBreakfast || 0})
      ON DUPLICATE KEY UPDATE
        snacks = VALUES(snacks), biscuit = VALUES(biscuit), chips = VALUES(chips),
        cold_drink_water = VALUES(cold_drink_water), shift_officer_breakfast = VALUES(shift_officer_breakfast),
        week_day = VALUES(week_day), updated_at = NOW()
    `);
    const rows = await db.select().from(hulKpfExecSnacks).where(eq(hulKpfExecSnacks.entryDate, entryDate));
    return rows[0];
  }
  async updateHulKpfExecSnack(id: number, data: any): Promise<HulKpfExecSnack> {
    const { id: _id, entryDate, createdAt, _dirty, ...safeData } = data;
    await db.update(hulKpfExecSnacks).set({ ...safeData, updatedAt: new Date() }).where(eq(hulKpfExecSnacks.id, id));
    const rows = await db.select().from(hulKpfExecSnacks).where(eq(hulKpfExecSnacks.id, id));
    return rows[0];
  }
  async deleteHulKpfExecSnack(id: number): Promise<void> {
    await db.delete(hulKpfExecSnacks).where(eq(hulKpfExecSnacks.id, id));
  }

  // === HUL SPECIAL ORDERS ===
  async getHulSpecialOrders(month: number, year: number): Promise<HulSpecialOrder[]> {
    return await db.select().from(hulSpecialOrders)
      .where(and(eq(hulSpecialOrders.month, month), eq(hulSpecialOrders.year, year)))
      .orderBy(hulSpecialOrders.slNo);
  }
  async createHulSpecialOrder(data: any): Promise<HulSpecialOrder> {
    const { month, year, slNo, dateOfSupply, particulars, qty, ratePerPlate, total } = data;
    const [result] = await db.execute(sql`
      INSERT INTO hul_special_orders (month, year, sl_no, date_of_supply, particulars, qty, rate_per_plate, total)
      VALUES (${month}, ${year}, ${slNo}, ${dateOfSupply || ''}, ${particulars || ''}, ${qty || 0}, ${ratePerPlate || 0}, ${total || 0})
    `);
    const id = (result as any).insertId;
    const rows = await db.select().from(hulSpecialOrders).where(eq(hulSpecialOrders.id, id));
    return rows[0];
  }
  async updateHulSpecialOrder(id: number, data: any): Promise<HulSpecialOrder> {
    const { id: _id, createdAt, ...safeData } = data;
    await db.update(hulSpecialOrders).set({ ...safeData, updatedAt: new Date() }).where(eq(hulSpecialOrders.id, id));
    const rows = await db.select().from(hulSpecialOrders).where(eq(hulSpecialOrders.id, id));
    return rows[0];
  }
  async deleteHulSpecialOrder(id: number): Promise<void> {
    await db.delete(hulSpecialOrders).where(eq(hulSpecialOrders.id, id));
  }

  // === DAILY P&L ===
  async getDailyPnlEntry(date: string, clientName: string): Promise<DailyPnlEntry | null> {
    const rows = await db.select().from(dailyPnlEntries)
      .where(and(eq(dailyPnlEntries.entryDate, date), eq(dailyPnlEntries.clientName, clientName)));
    return rows[0] ?? null;
  }

  async saveDailyPnlEntry(data: any): Promise<number> {
    const { id, createdAt, updatedAt, ...fields } = data;
    if (id) {
      await db.update(dailyPnlEntries).set({ ...fields, updatedAt: new Date() }).where(eq(dailyPnlEntries.id, id));
      return id;
    }
    await db.insert(dailyPnlEntries).values(fields);
    const [r] = await db.execute(sql`SELECT LAST_INSERT_ID() as insertId`) as any;
    return Number(r[0]?.insertId ?? 0);
  }

  async getPrevDailyPnlBalance(date: string, clientName: string): Promise<number> {
    const [rows] = await db.execute(sql`
      SELECT balance_in_hand FROM daily_pnl_entries
      WHERE entry_date < ${date} AND client_name = ${clientName}
      ORDER BY entry_date DESC LIMIT 1
    `) as any;
    const row = (rows as any[])[0];
    return row ? Number(row.balance_in_hand) || 0 : 0;
  }

  async getDailyPnlMonthSummary(month: number, year: number): Promise<DailyPnlEntry[]> {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const rows = await db.select().from(dailyPnlEntries)
      .where(and(gte(dailyPnlEntries.entryDate, startDate), lte(dailyPnlEntries.entryDate, endDate)))
      .orderBy(dailyPnlEntries.entryDate);
    return rows;
  }

  async getDailyPnlMonthlySummary(year: number, clientName?: string): Promise<any[]> {
    const [rows] = await db.execute(sql`
      SELECT
        MONTH(entry_date) AS month,
        YEAR(entry_date)  AS year,
        SUM(total_expense) AS totalExpense,
        SUM(total_sale)    AS totalSale,
        SUM(profit_loss)   AS profitLoss
      FROM daily_pnl_entries
      WHERE YEAR(entry_date) = ${year}
        ${clientName ? sql`AND client_name = ${clientName}` : sql``}
      GROUP BY YEAR(entry_date), MONTH(entry_date)
      ORDER BY MONTH(entry_date)
    `) as any;
    return rows as any[];
  }

  async getDailyPnlYearlySummary(clientName?: string): Promise<any[]> {
    const [rows] = await db.execute(sql`
      SELECT
        YEAR(entry_date)   AS year,
        SUM(total_expense) AS totalExpense,
        SUM(total_sale)    AS totalSale,
        SUM(profit_loss)   AS profitLoss
      FROM daily_pnl_entries
      ${clientName ? sql`WHERE client_name = ${clientName}` : sql``}
      GROUP BY YEAR(entry_date)
      ORDER BY YEAR(entry_date)
    `) as any;
    return rows as any[];
  }

  async getCashSealForDate(date: string): Promise<any | null> {
    const [rows] = await db.execute(sql`
      SELECT cs.* FROM cash_seals cs
      JOIN daily_reports dr ON cs.report_id = dr.id
      WHERE dr.date = ${date}
      LIMIT 1
    `) as any;
    return (rows as any[])[0] ?? null;
  }

  async getLastPurchasePrice(itemName: string): Promise<number> {
    const [rows] = await db.execute(sql`
      SELECT pii.unit_price FROM purchase_invoice_items pii
      JOIN purchase_invoices pi ON pii.invoice_id = pi.id
      WHERE LOWER(pii.item_name) LIKE LOWER(${`%${itemName}%`})
      ORDER BY pi.date DESC, pi.id DESC
      LIMIT 1
    `) as any;
    const row = (rows as any[])[0];
    return row ? Number(row.unit_price) : 0;
  }

  // PEC Ventures Entries
  async getPecVenturesEntries(month: number, year: number): Promise<PecVenturesEntry[]> {
    return await db.select().from(pecVenturesEntries)
      .where(and(eq(pecVenturesEntries.month, month), eq(pecVenturesEntries.year, year)))
      .orderBy(pecVenturesEntries.entryDate);
  }
  async createPecVenturesEntry(data: any): Promise<PecVenturesEntry> {
    const { entryDate, month, year, weekDay, redLabelQty, tataTeaQty, coffeeQty, sugarQty, gingerQty, biscuitQty, teaCupQty, greenElaychiQty, greenTeaQty, blackSaltQty, milkMorningQty, milkEveningQty } = data;
    await db.execute(sql`
      INSERT INTO pec_ventures_entries (entry_date, month, year, week_day, red_label_qty, tata_tea_qty, coffee_qty, sugar_qty, ginger_qty, biscuit_qty, tea_cup_qty, green_elaychi_qty, green_tea_qty, black_salt_qty, milk_morning_qty, milk_evening_qty)
      VALUES (${entryDate}, ${month}, ${year}, ${weekDay || null}, ${redLabelQty || 0}, ${tataTeaQty || 0}, ${coffeeQty || 0}, ${sugarQty || 0}, ${gingerQty || 0}, ${biscuitQty || 0}, ${teaCupQty || 0}, ${greenElaychiQty || 0}, ${greenTeaQty || 0}, ${blackSaltQty || 0}, ${milkMorningQty || 0}, ${milkEveningQty || 0})
      ON DUPLICATE KEY UPDATE
        red_label_qty = VALUES(red_label_qty), tata_tea_qty = VALUES(tata_tea_qty), coffee_qty = VALUES(coffee_qty),
        sugar_qty = VALUES(sugar_qty), ginger_qty = VALUES(ginger_qty), biscuit_qty = VALUES(biscuit_qty),
        tea_cup_qty = VALUES(tea_cup_qty), green_elaychi_qty = VALUES(green_elaychi_qty), green_tea_qty = VALUES(green_tea_qty),
        black_salt_qty = VALUES(black_salt_qty), milk_morning_qty = VALUES(milk_morning_qty), milk_evening_qty = VALUES(milk_evening_qty),
        week_day = VALUES(week_day), updated_at = NOW()
    `);
    const rows = await db.select().from(pecVenturesEntries).where(eq(pecVenturesEntries.entryDate, entryDate));
    return rows[0];
  }
  async updatePecVenturesEntry(id: number, data: any): Promise<PecVenturesEntry> {
    const { id: _id, entryDate, createdAt, _dirty, ...safeData } = data;
    await db.update(pecVenturesEntries).set({ ...safeData, updatedAt: new Date() }).where(eq(pecVenturesEntries.id, id));
    const rows = await db.select().from(pecVenturesEntries).where(eq(pecVenturesEntries.id, id));
    return rows[0];
  }
  async deletePecVenturesEntry(id: number): Promise<void> {
    await db.delete(pecVenturesEntries).where(eq(pecVenturesEntries.id, id));
  }
  async getPecVenturesLunchYearlySummary(year: number): Promise<{ month: number; lunchOrder: number; lunchBill: number; lunchTotal: number; dinnerOrder: number; dinnerBill: number; dinnerTotal: number }[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(CASE WHEN meal_type='lunch'  THEN order_qty ELSE 0 END),0) AS lunch_order,
        COALESCE(SUM(CASE WHEN meal_type='lunch'  THEN bill_qty  ELSE 0 END),0) AS lunch_bill,
        COALESCE(SUM(CASE WHEN meal_type='lunch'  THEN total     ELSE 0 END),0) AS lunch_total,
        COALESCE(SUM(CASE WHEN meal_type='dinner' THEN order_qty ELSE 0 END),0) AS dinner_order,
        COALESCE(SUM(CASE WHEN meal_type='dinner' THEN bill_qty  ELSE 0 END),0) AS dinner_bill,
        COALESCE(SUM(CASE WHEN meal_type='dinner' THEN total     ELSE 0 END),0) AS dinner_total
      FROM unichem_lunch_entries
      WHERE year = ${year} AND location = 'PEC Ventures'
      GROUP BY month ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month:       Number(r.month),
      lunchOrder:  Number(r.lunch_order),  lunchBill:  Number(r.lunch_bill),  lunchTotal:  Number(r.lunch_total),
      dinnerOrder: Number(r.dinner_order), dinnerBill: Number(r.dinner_bill), dinnerTotal: Number(r.dinner_total),
    }));
  }

  async getPecVenturesYearlySummary(year: number): Promise<any[]> {
    const [rows] = await db.execute(sql`
      SELECT month,
        COALESCE(SUM(red_label_qty),0)    AS redLabel,
        COALESCE(SUM(tata_tea_qty),0)     AS tataTea,
        COALESCE(SUM(coffee_qty),0)       AS coffee,
        COALESCE(SUM(sugar_qty),0)        AS sugar,
        COALESCE(SUM(ginger_qty),0)       AS ginger,
        COALESCE(SUM(biscuit_qty),0)      AS biscuit,
        COALESCE(SUM(tea_cup_qty),0)      AS teaCup,
        COALESCE(SUM(green_elaychi_qty),0)AS greenElaychi,
        COALESCE(SUM(green_tea_qty),0)    AS greenTea,
        COALESCE(SUM(black_salt_qty),0)   AS blackSalt,
        COALESCE(SUM(milk_morning_qty),0) AS milkMorning,
        COALESCE(SUM(milk_evening_qty),0) AS milkEvening
      FROM pec_ventures_entries WHERE year = ${year}
      GROUP BY month ORDER BY month
    `) as any;
    return (rows as any[]).map((r: any) => ({
      month: Number(r.month),
      redLabel: Number(r.redLabel), tataTea: Number(r.tataTea), coffee: Number(r.coffee),
      sugar: Number(r.sugar), ginger: Number(r.ginger), biscuit: Number(r.biscuit),
      teaCup: Number(r.teaCup), greenElaychi: Number(r.greenElaychi), greenTea: Number(r.greenTea),
      blackSalt: Number(r.blackSalt), milkMorning: Number(r.milkMorning), milkEvening: Number(r.milkEvening),
    }));
  }

  // === EMPLOYEE SHIFT DUTIES ===
  async getShiftDuties(month: number, year: number): Promise<any[]> {
    const { employeeShiftDuties, employees } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const rows = await db
      .select({ duty: employeeShiftDuties, emp: { id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, designation: employees.designation, clientName: employees.clientName } })
      .from(employeeShiftDuties)
      .leftJoin(employees, eq(employeeShiftDuties.employeeId, employees.id))
      .where(and(eq(employeeShiftDuties.month, month), eq(employeeShiftDuties.year, year)));
    return rows.map(r => ({ ...r.duty, employeeName: r.emp?.name, employeeCode: r.emp?.employeeCode, department: r.emp?.department, designation: r.emp?.designation, clientName: r.emp?.clientName }));
  }

  async upsertShiftDuty(data: any): Promise<any> {
    const { employeeShiftDuties } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const existing = await db.select({ id: employeeShiftDuties.id }).from(employeeShiftDuties).where(and(eq(employeeShiftDuties.employeeId, data.employeeId), eq(employeeShiftDuties.month, data.month), eq(employeeShiftDuties.year, data.year)));
    if (existing.length > 0) {
      await db.update(employeeShiftDuties).set({ ...data, updatedAt: new Date() }).where(eq(employeeShiftDuties.id, existing[0].id));
      const updated = await db.select().from(employeeShiftDuties).where(eq(employeeShiftDuties.id, existing[0].id));
      return updated[0];
    } else {
      const result = await db.insert(employeeShiftDuties).values(data);
      const inserted = await db.select().from(employeeShiftDuties).where(eq(employeeShiftDuties.id, (result as any).insertId));
      return inserted[0];
    }
  }

  async getEmployeeShiftDuty(employeeId: number, month: number, year: number): Promise<any | null> {
    const { employeeShiftDuties } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const rows = await db.select().from(employeeShiftDuties).where(and(eq(employeeShiftDuties.employeeId, employeeId), eq(employeeShiftDuties.month, month), eq(employeeShiftDuties.year, year)));
    return rows[0] || null;
  }

  // === FLASH MESSAGES ===
  async getFlashMessages(activeOnly = false): Promise<any[]> {
    const { flashMessages } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    let rows: any[];
    if (activeOnly) {
      rows = await db.select().from(flashMessages).where(eq(flashMessages.isActive, true));
    } else {
      rows = await db.select().from(flashMessages);
    }
    const today = new Date().toISOString().split('T')[0];
    return rows.filter((r: any) => !r.expiresAt || r.expiresAt >= today).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createFlashMessage(data: any): Promise<any> {
    const { flashMessages } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    const result = await db.insert(flashMessages).values(data);
    const inserted = await db.select().from(flashMessages).where(eq(flashMessages.id, (result as any).insertId));
    return inserted[0];
  }

  async updateFlashMessage(id: number, data: Partial<any>): Promise<any> {
    const { flashMessages } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(flashMessages).set(data).where(eq(flashMessages.id, id));
    const rows = await db.select().from(flashMessages).where(eq(flashMessages.id, id));
    return rows[0];
  }

  async deleteFlashMessage(id: number): Promise<void> {
    const { flashMessages } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(flashMessages).where(eq(flashMessages.id, id));
  }

  // === BILL OF MATERIAL ===
  async getBomItems(clientName: string, mealType: string): Promise<any[]> {
    const { bomItems } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    return db.select().from(bomItems).where(and(eq(bomItems.clientName, clientName), eq(bomItems.mealType, mealType))).orderBy(bomItems.dishName, bomItems.categoryName, bomItems.sortOrder, bomItems.ingredientName);
  }
  async createBomItem(data: any): Promise<any> {
    const { bomItems } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    const result = await db.insert(bomItems).values(data);
    const rows = await db.select().from(bomItems).where(eq(bomItems.id, (result as any).insertId));
    return rows[0];
  }
  async updateBomItem(id: number, data: any): Promise<any> {
    const { bomItems } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(bomItems).set({ ...data, updatedAt: new Date() }).where(eq(bomItems.id, id));
    const rows = await db.select().from(bomItems).where(eq(bomItems.id, id));
    return rows[0];
  }
  async deleteBomItem(id: number): Promise<void> {
    const { bomItems } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(bomItems).where(eq(bomItems.id, id));
  }

  async getMonthlyPnl(month: number, year: number, clients?: string[]): Promise<any> {
    const monthStr = String(month).padStart(2, '0');
    const likePrefix = `${year}-${monthStr}%`;

    const hasClients = clients && clients.length > 0;
    const clientFilter = hasClients
      ? sql` AND client_name IN (${sql.join(clients!.map(c => sql`${c}`), sql`, `)})`
      : sql``;

    const [salesTotalR] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(bill_amount AS DECIMAL(15,2))), 0) as total
      FROM sales_invoices WHERE bill_date LIKE ${likePrefix}${clientFilter}`);
    const [salesByClientR] = await db.execute(sql`
      SELECT client_name, COALESCE(SUM(CAST(bill_amount AS DECIMAL(15,2))), 0) as total
      FROM sales_invoices WHERE bill_date LIKE ${likePrefix}${clientFilter}
      GROUP BY client_name ORDER BY total DESC`);

    const purchaseClientFilter = hasClients
      ? sql` AND client_name IN (${sql.join(clients!.map(c => sql`${c}`), sql`, `)})`
      : sql``;

    const [purchaseTotalR] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(grand_total AS DECIMAL(15,2))), 0) as total
      FROM purchase_invoices WHERE date LIKE ${likePrefix}${purchaseClientFilter}`);
    const [purchaseByVendorR] = await db.execute(sql`
      SELECT vendor_name, COALESCE(SUM(CAST(grand_total AS DECIMAL(15,2))), 0) as total
      FROM purchase_invoices WHERE date LIKE ${likePrefix}${purchaseClientFilter}
      GROUP BY vendor_name ORDER BY total DESC`);
    const [purchaseByClientR] = await db.execute(sql`
      SELECT client_name, COALESCE(SUM(CAST(grand_total AS DECIMAL(15,2))), 0) as total
      FROM purchase_invoices WHERE date LIKE ${likePrefix}${purchaseClientFilter}
      GROUP BY client_name ORDER BY total DESC`);

    const salaryClientFilter = hasClients
      ? sql` AND client_name IN (${sql.join(clients!.map(c => sql`${c}`), sql`, `)})`
      : sql``;

    const [salaryTotalR] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(net_pay AS DECIMAL(15,2))), 0) as total
      FROM salary_records WHERE month = ${month} AND year = ${year}${salaryClientFilter}`);
    const [salaryByClientR] = await db.execute(sql`
      SELECT client_name, COALESCE(SUM(CAST(net_pay AS DECIMAL(15,2))), 0) as total
      FROM salary_records WHERE month = ${month} AND year = ${year}${salaryClientFilter}
      GROUP BY client_name ORDER BY total DESC`);
    const [salaryStatutoryR] = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(pf_deduction      AS DECIMAL(15,2))), 0) AS employee_pf,
        COALESCE(SUM(CAST(esic_deduction    AS DECIMAL(15,2))), 0) AS employee_esic,
        COALESCE(SUM(CAST(professional_tax  AS DECIMAL(15,2))), 0) AS ptax,
        COALESCE(SUM(CAST(lwf               AS DECIMAL(15,2))), 0) AS lwf,
        COALESCE(SUM(CAST(gross_wage        AS DECIMAL(15,2))), 0) AS gross_wage,
        ROUND(COALESCE(SUM(CAST(basic_wage  AS DECIMAL(15,2))), 0) * 0.0833, 2) AS bonus
      FROM salary_records WHERE month = ${month} AND year = ${year}${salaryClientFilter}`);

    const [expenseTotalR] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(ei.amount AS DECIMAL(15,2))), 0) as total
      FROM expense_items ei
      JOIN daily_reports dr ON ei.report_id = dr.id
      WHERE dr.date LIKE ${likePrefix}`);

    const [cashSealR] = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(cs.total_given_to_akbar_ali AS DECIMAL(15,2))), 0) as total
      FROM cash_seals cs
      JOIN daily_reports dr ON cs.report_id = dr.id
      WHERE dr.date LIKE ${likePrefix}`);

    const [cashSealExpenseR] = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(cs.expense_banana_qty AS DECIMAL(15,2)) * 4.5), 0)                                           AS banana_expense,
        COALESCE(SUM(CAST(cs.expense_dahi_bhar_qty AS DECIMAL(15,2)) * CAST(COALESCE(cs.expense_dahi_bhar_rate, 0) AS DECIMAL(15,2))), 0) AS dahi_bhar_expense,
        COALESCE(SUM(CAST(cs.expense_other_amount AS DECIMAL(15,2))), 0)                                               AS other_expense
      FROM cash_seals cs
      JOIN daily_reports dr ON cs.report_id = dr.id
      WHERE dr.date LIKE ${likePrefix}`);

    const [cashSealIncomeR] = await db.execute(sql`
      SELECT
        COALESCE(SUM(
          CAST(cs.income_ps_breakfast_cash_qty   AS DECIMAL(15,2)) * 5  +
          CAST(cs.income_ps_lunch_cash_qty        AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_ps_evening_cash_qty      AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_ps_night_cash_qty        AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_ps_recharge_cash_qty     AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_ps_recharge_rate, 1) AS DECIMAL(15,2)) +
          CAST(cs.income_ps_breakfast_online_qty  AS DECIMAL(15,2)) * 5  +
          CAST(cs.income_ps_lunch_online_qty      AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_ps_evening_online_qty    AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_ps_night_online_qty      AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_ps_recharge_online_qty   AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_ps_recharge_rate, 1) AS DECIMAL(15,2))
        ), 0) as ps_income,
        COALESCE(SUM(
          CAST(cs.income_tp_breakfast_cash_qty        AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_tp_lunch_veg_cash_qty        AS DECIMAL(15,2)) * 35 +
          CAST(cs.income_tp_lunch_nv_cash_qty         AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_tp_lunch_nv_rate, 0) AS DECIMAL(15,2)) +
          CAST(cs.income_tp_lunch_egg_cash_qty        AS DECIMAL(15,2)) * 45 +
          CAST(cs.income_tp_lunch_fish_cash_qty       AS DECIMAL(15,2)) * 55 +
          CAST(cs.income_tp_lunch_chicken_cash_qty    AS DECIMAL(15,2)) * 65 +
          CAST(cs.income_tp_evening_cash_qty          AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_tp_night_cash_qty            AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_tp_breakfast_online_qty      AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_tp_lunch_veg_online_qty      AS DECIMAL(15,2)) * 35 +
          CAST(cs.income_tp_lunch_nv_online_qty       AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_tp_lunch_nv_rate, 0) AS DECIMAL(15,2)) +
          CAST(cs.income_tp_lunch_egg_online_qty      AS DECIMAL(15,2)) * 45 +
          CAST(cs.income_tp_lunch_fish_online_qty     AS DECIMAL(15,2)) * 55 +
          CAST(cs.income_tp_lunch_chicken_online_qty  AS DECIMAL(15,2)) * 65 +
          CAST(cs.income_tp_evening_online_qty        AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_tp_night_online_qty          AS DECIMAL(15,2)) * 20
        ), 0) as tp_income,
        COALESCE(SUM(
          CAST(cs.income_morning_qty              AS DECIMAL(15,2)) * 5  +
          CAST(cs.income_lunch_qty                AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_evening_qty              AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_night_qty                AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_non_veg_qty              AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_non_veg_rate, 0) AS DECIMAL(15,2)) +
          CAST(cs.income_veg_qty                  AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_veg_rate, 0) AS DECIMAL(15,2)) +
          CAST(cs.income_morning_cash_qty         AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_morning_cash_rate, 0) AS DECIMAL(15,2)) +
          CAST(cs.income_evening_cash_qty         AS DECIMAL(15,2)) * CAST(COALESCE(cs.income_evening_cash_rate, 0) AS DECIMAL(15,2)) +
          CAST(cs.income_online_breakfast_qty     AS DECIMAL(15,2)) * 5  +
          CAST(cs.income_online_lunch_qty         AS DECIMAL(15,2)) * 20 +
          CAST(cs.income_online_evening_snacks_qty AS DECIMAL(15,2)) * 10 +
          CAST(cs.income_online_night_qty         AS DECIMAL(15,2)) * 10
        ), 0) as legacy_income
      FROM cash_seals cs
      JOIN daily_reports dr ON cs.report_id = dr.id
      WHERE dr.date LIKE ${likePrefix}`);

    const n = (v: any) => Number(v ?? 0);
    const sr = (salesTotalR as any[])[0];
    const pr = (purchaseTotalR as any[])[0];
    const salr = (salaryTotalR as any[])[0];
    const ssr = (salaryStatutoryR as any[])[0];
    const expr = (expenseTotalR as any[])[0];
    const csr = (cashSealR as any[])[0];
    const csir = (cashSealIncomeR as any[])[0];
    const cser = (cashSealExpenseR as any[])[0];

    const psIncome = n(csir?.ps_income);
    const tpIncome = n(csir?.tp_income);
    const legacyIncome = n(csir?.legacy_income);
    const cashSealIncome = psIncome + tpIncome + legacyIncome;

    const bananaExpense   = n(cser?.banana_expense);
    const dahiBharExpense = n(cser?.dahi_bhar_expense);
    const otherExpense    = n(cser?.other_expense);
    const cashSealExpense = bananaExpense + dahiBharExpense + otherExpense;

    const employeePF   = n(ssr?.employee_pf);
    const employerPF   = employeePF;                                              // 12% = 12%
    const employeeESIC = n(ssr?.employee_esic);
    const employerESIC = Math.round((employeeESIC * (3.25 / 0.75)) * 100) / 100; // 3.25% vs 0.75%
    const ptax         = n(ssr?.ptax);
    const lwfTotal     = n(ssr?.lwf);
    const grossWage    = n(ssr?.gross_wage);
    const bonusAmount  = n(ssr?.bonus);
    const epfoTotal    = employeePF + employerPF;
    const esicTotal    = employeeESIC + employerESIC;

    return {
      salesTotal: n(sr?.total),
      salesByClient: (salesByClientR as any[]).map(r => ({ clientName: r.client_name, total: n(r.total) })),
      purchaseTotal: n(pr?.total),
      purchaseByVendor: (purchaseByVendorR as any[]).map(r => ({ vendorName: r.vendor_name, total: n(r.total) })),
      purchaseByClient: (purchaseByClientR as any[]).map(r => ({ clientName: r.client_name, total: n(r.total) })),
      salaryTotal: n(salr?.total),
      salaryByClient: (salaryByClientR as any[]).map(r => ({ clientName: r.client_name, total: n(r.total) })),
      grossWage,
      employeePF, employerPF, epfoTotal,
      employeeESIC, employerESIC, esicTotal,
      ptax, lwfTotal, bonusAmount,
      expenseTotal: n(expr?.total),
      cashSealIncome,
      psIncome,
      tpIncome,
      legacyIncome,
      cashSealExpense,
      bananaExpense,
      dahiBharExpense,
      otherExpense,
      cashSealTotal: n(csr?.total),
      filteredByClients: hasClients ? clients : [],
    };
  }
}

export const storage = new DatabaseStorage();
