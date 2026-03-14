
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
import { eq, desc, lt, and, sql } from "drizzle-orm";
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
  getSavedMenus(): Promise<SavedMenu[]>;
  getSavedMenu(id: number): Promise<SavedMenu | undefined>;
  createSavedMenu(data: { clientName: string; startDate: string; endDate: string; menuData: string }): Promise<SavedMenu>;
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
  createVendor(data: { name: string; phone?: string; address?: string; gstNo?: string }): Promise<Vendor>;
  updateVendor(id: number, data: { name: string; phone?: string; address?: string; gstNo?: string }): Promise<Vendor>;
  deleteVendor(id: number): Promise<void>;
  getPurchaseInvoices(): Promise<PurchaseInvoiceWithItems[]>;
  getPurchaseInvoice(id: number): Promise<PurchaseInvoiceWithItems | undefined>;
  createPurchaseInvoice(data: { purchaseRequestId?: number | null; clientName: string; vendorName: string; vendorInvoiceNo: string; date: string; paymentGiven?: boolean; createdBy?: string; items: { itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems>;
  updatePurchaseInvoice(id: number, data: { purchaseRequestId?: number | null; clientName?: string; vendorName?: string; vendorInvoiceNo?: string; date?: string; paymentGiven?: boolean; items?: { id?: number; itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems>;
  deletePurchaseInvoice(id: number): Promise<void>;
  getLastPurchasePrices(): Promise<{ itemName: string; unitPrice: number; gstRate: number }[]>;
  getLastVegetablePrices(): Promise<{ description: string; rate: number }[]>;
  getItemMasterItems(itemType?: string): Promise<ItemMaster[]>;
  createItemMasterItem(data: { itemName: string; uom?: string; rate?: string; hsnCode?: string; gstPercent?: string; itemType?: string }): Promise<ItemMaster>;
  updateItemMasterItem(id: number, data: { itemName?: string; uom?: string; rate?: string; hsnCode?: string; gstPercent?: string; itemType?: string }): Promise<ItemMaster>;
  deleteItemMasterItem(id: number): Promise<void>;
  getEmployees(clientName?: string): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(data: any): Promise<Employee>;
  updateEmployee(id: number, data: any): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;
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
    const totalCash = Number(report.openingBalance) + Number(report.receivedAmount);
    return totalCash - totalExpense;
  }

  async createReport(request: CreateReportRequest): Promise<ReportWithItems> {
    return await db.transaction(async (tx) => {
      await tx.insert(dailyReports).values({
        date: request.date,
        openingBalance: request.openingBalance.toString(),
        receivedAmount: request.receivedAmount.toString(),
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
          incomeTpEveningCashQty: data.incomeTpEveningCashQty?.toString() || "0",
          incomeTpNightCashQty: data.incomeTpNightCashQty?.toString() || "0",
          incomeTpBreakfastOnlineQty: data.incomeTpBreakfastOnlineQty?.toString() || "0",
          incomeTpLunchVegOnlineQty: data.incomeTpLunchVegOnlineQty?.toString() || "0",
          incomeTpLunchNvOnlineQty: data.incomeTpLunchNvOnlineQty?.toString() || "0",
          incomeTpEveningOnlineQty: data.incomeTpEveningOnlineQty?.toString() || "0",
          incomeTpNightOnlineQty: data.incomeTpNightOnlineQty?.toString() || "0",
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
          incomeTpEveningCashQty: data.incomeTpEveningCashQty?.toString() || "0",
          incomeTpNightCashQty: data.incomeTpNightCashQty?.toString() || "0",
          incomeTpBreakfastOnlineQty: data.incomeTpBreakfastOnlineQty?.toString() || "0",
          incomeTpLunchVegOnlineQty: data.incomeTpLunchVegOnlineQty?.toString() || "0",
          incomeTpLunchNvOnlineQty: data.incomeTpLunchNvOnlineQty?.toString() || "0",
          incomeTpEveningOnlineQty: data.incomeTpEveningOnlineQty?.toString() || "0",
          incomeTpNightOnlineQty: data.incomeTpNightOnlineQty?.toString() || "0",
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
      incomeTpEveningCashQty: data.incomeTpEveningCashQty?.toString() || "0",
      incomeTpNightCashQty: data.incomeTpNightCashQty?.toString() || "0",
      incomeTpBreakfastOnlineQty: data.incomeTpBreakfastOnlineQty?.toString() || "0",
      incomeTpLunchVegOnlineQty: data.incomeTpLunchVegOnlineQty?.toString() || "0",
      incomeTpLunchNvOnlineQty: data.incomeTpLunchNvOnlineQty?.toString() || "0",
      incomeTpEveningOnlineQty: data.incomeTpEveningOnlineQty?.toString() || "0",
      incomeTpNightOnlineQty: data.incomeTpNightOnlineQty?.toString() || "0",
    }).where(eq(cashSeals.id, id));
    return this.getCashSeal(id);
  }

  async deleteCashSeal(id: number): Promise<void> {
    await db.delete(cashSeals).where(eq(cashSeals.id, id));
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

  async updateClientName(id: number, item: { name?: string; address?: string; gstNo?: string; agreementValidTill?: string | null }): Promise<ClientName> {
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
      permissions: data.permissions || ['expense', 'cashseal', 'inventory', 'menu'],
      employeeId: data.employeeId || null,
    });

      const __iid = await getInsertId(tx);

      return await tx.select().from(users).where(eq(users.id, __iid));

    });
    const { passwordHash: _, ...safeUser } = user;
    return safeUser as SafeUser;
  }

  async updateUser(id: number, data: { displayName?: string; password?: string; role?: string; clientName?: string | null; permissions?: string[] }): Promise<SafeUser> {
    const updates: any = {};
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.role !== undefined) updates.role = data.role;
    if (data.clientName !== undefined) updates.clientName = data.clientName;
    if (data.permissions !== undefined) updates.permissions = data.permissions;
    if (data.password) updates.passwordHash = await bcrypt.hash(data.password, 10);
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

  async createPurchaseRequest(data: { clientName: string; date: string; createdBy?: string; items: { itemName: string; uom: string; requestQty: number }[] }): Promise<PurchaseRequestWithItems> {
    return await db.transaction(async (tx) => {
      await tx.insert(purchaseRequests).values({
        clientName: data.clientName,
        date: data.date,
        createdBy: data.createdBy || null,
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

  async createVendor(data: { name: string; phone?: string; address?: string; gstNo?: string }): Promise<Vendor> {
    const [vendor] = await db.transaction(async (tx) => {

      await tx.insert(vendors).values(data);

      const __iid = await getInsertId(tx);

      return await tx.select().from(vendors).where(eq(vendors.id, __iid));

    });
    return vendor;
  }

  async updateVendor(id: number, data: { name: string; phone?: string; address?: string; gstNo?: string }): Promise<Vendor> {
    const updateData: Record<string, any> = { name: data.name };
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.gstNo !== undefined) updateData.gstNo = data.gstNo;
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
      return { ...inv, items };
    }));
  }

  async getPurchaseInvoice(id: number): Promise<PurchaseInvoiceWithItems | undefined> {
    const [inv] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id));
    if (!inv) return undefined;
    const items = await db.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id));
    return { ...inv, items };
  }

  async createPurchaseInvoice(data: { purchaseRequestId?: number | null; clientName: string; vendorName: string; vendorInvoiceNo: string; date: string; paymentGiven?: boolean; createdBy?: string; items: { itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems> {
    return await db.transaction(async (tx) => {
      const totalAmount = data.items.reduce((sum, i) => sum + i.totalPrice, 0);
      const totalGst = data.items.reduce((sum, i) => sum + i.gstAmount, 0);
      const grandTotal = data.items.reduce((sum, i) => sum + i.netAmount, 0);
      await tx.insert(purchaseInvoices).values({
        purchaseRequestId: data.purchaseRequestId || null,
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
      return { ...inv, items };
    });
  }

  async updatePurchaseInvoice(id: number, data: { purchaseRequestId?: number | null; clientName?: string; vendorName?: string; vendorInvoiceNo?: string; date?: string; paymentGiven?: boolean; items?: { id?: number; itemName: string; uom: string; qty: number; unitPrice: number; totalPrice: number; gstRate: number; gstAmount: number; netAmount: number }[] }): Promise<PurchaseInvoiceWithItems> {
    return await db.transaction(async (tx) => {
      const updateFields: any = {};
      if (data.clientName) updateFields.clientName = data.clientName;
      if (data.vendorName) updateFields.vendorName = data.vendorName;
      if (data.vendorInvoiceNo !== undefined) updateFields.vendorInvoiceNo = data.vendorInvoiceNo;
      if (data.date) updateFields.date = data.date;
      if (data.purchaseRequestId !== undefined) updateFields.purchaseRequestId = data.purchaseRequestId;
      if (data.paymentGiven !== undefined) updateFields.paymentGiven = data.paymentGiven;
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
      return { ...inv, items };
    });
  }

  async deletePurchaseInvoice(id: number): Promise<void> {
    await db.delete(purchaseInvoices).where(eq(purchaseInvoices.id, id));
  }

  async getLastVegetablePrices(): Promise<{ description: string; rate: number }[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (description)
        description,
        rate
      FROM expense_items
      WHERE category = 'vegetable' AND description IS NOT NULL AND description != ''
      ORDER BY description, id DESC
    `);
    return (result.rows || []).map((row: any) => ({
      description: row.description,
      rate: Number(row.rate) || 0,
    }));
  }

  async getLastPurchasePrices(): Promise<{ itemName: string; unitPrice: number; gstRate: number }[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (item_name)
        item_name,
        unit_price,
        gst_rate
      FROM purchase_invoice_items
      ORDER BY item_name, id DESC
    `);
    return (result.rows || []).map((row: any) => ({
      itemName: row.item_name,
      unitPrice: Number(row.unit_price) || 0,
      gstRate: Number(row.gst_rate) || 0,
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
    const [item] = await db.transaction(async (tx) => {

      await tx.insert(itemMaster).values({
      itemName: data.itemName,
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
}

export const storage = new DatabaseStorage();
