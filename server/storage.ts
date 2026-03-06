
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
} from "@shared/schema";
import { eq, desc, lt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

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
  getSavedMenus(): Promise<SavedMenu[]>;
  getSavedMenu(id: number): Promise<SavedMenu | undefined>;
  createSavedMenu(data: { clientName: string; startDate: string; endDate: string; menuData: string }): Promise<SavedMenu>;
  deleteSavedMenu(id: number): Promise<void>;
  getClientNames(): Promise<ClientName[]>;
  createClientName(item: { name: string }): Promise<ClientName>;
  updateClientName(id: number, item: { name: string }): Promise<ClientName>;
  deleteClientName(id: number): Promise<void>;
  seedClientNames(names: string[]): Promise<void>;
  getAdminPin(): Promise<string>;
  setAdminPin(pin: string): Promise<void>;
  verifyAdminPin(pin: string): Promise<boolean>;
  getUsers(): Promise<SafeUser[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; password: string; displayName: string; role: string; clientName: string | null; permissions?: string[] }): Promise<SafeUser>;
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
}

export class DatabaseStorage implements IStorage {
  async getVegetableItems(): Promise<VegetableItem[]> {
    return await db.select().from(vegetableItems).orderBy(vegetableItems.name);
  }

  async createVegetableItem(item: { name: string }): Promise<VegetableItem> {
    const [newItem] = await db.insert(vegetableItems).values(item).returning();
    return newItem;
  }

  async updateVegetableItem(id: number, item: { name: string }): Promise<VegetableItem> {
    const [updated] = await db.update(vegetableItems)
      .set(item)
      .where(eq(vegetableItems.id, id))
      .returning();
    if (!updated) throw new Error("Vegetable not found");
    return updated;
  }

  async deleteVegetableItem(id: number): Promise<void> {
    await db.delete(vegetableItems).where(eq(vegetableItems.id, id));
  }

  async seedVegetableItems(names: string[]): Promise<void> {
    for (const name of names) {
      await db.insert(vegetableItems).values({ name }).onConflictDoNothing();
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
      const [report] = await tx.insert(dailyReports).values({
        date: request.date,
        openingBalance: request.openingBalance.toString(),
        receivedAmount: request.receivedAmount.toString(),
      }).returning();

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
      const [report] = await tx.update(dailyReports)
        .set({
          ...(request.date ? { date: request.date } : {}),
          ...(request.openingBalance !== undefined ? { openingBalance: request.openingBalance.toString() } : {}),
          ...(request.receivedAmount !== undefined ? { receivedAmount: request.receivedAmount.toString() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dailyReports.id, id))
        .returning();

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
      const [inv] = await tx.insert(dailyInventory).values({ date: data.date }).returning();
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
      const [inv] = await tx.update(dailyInventory)
        .set({ date: data.date, updatedAt: new Date() })
        .where(eq(dailyInventory.id, id))
        .returning();
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
        const [newReport] = await tx.insert(dailyReports).values({
          date: data.date,
          openingBalance: "0",
          receivedAmount: "0",
        }).returning();
        reportId = newReport.id;
      } else {
        reportId = report[0].id;
      }
      const existing = await tx.select().from(cashSeals).where(eq(cashSeals.reportId, reportId));
      if (existing.length > 0) {
        const [updated] = await tx.update(cashSeals).set({
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
        }).where(eq(cashSeals.id, existing[0].id)).returning();
        return { ...updated, date: data.date };
      } else {
        const [created] = await tx.insert(cashSeals).values({
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
        }).returning();
        return { ...created, date: data.date };
      }
    });
  }

  async getSavedMenus(): Promise<SavedMenu[]> {
    return await db.select().from(savedMenus).orderBy(desc(savedMenus.createdAt));
  }

  async getSavedMenu(id: number): Promise<SavedMenu | undefined> {
    const [menu] = await db.select().from(savedMenus).where(eq(savedMenus.id, id));
    return menu;
  }

  async createSavedMenu(data: { clientName: string; startDate: string; endDate: string; menuData: string }): Promise<SavedMenu> {
    const [menu] = await db.insert(savedMenus).values(data).returning();
    return menu;
  }

  async deleteSavedMenu(id: number): Promise<void> {
    await db.delete(savedMenus).where(eq(savedMenus.id, id));
  }

  async getClientNames(): Promise<ClientName[]> {
    return await db.select().from(clientNames).orderBy(clientNames.name);
  }

  async createClientName(item: { name: string }): Promise<ClientName> {
    const [newItem] = await db.insert(clientNames).values(item).returning();
    return newItem;
  }

  async updateClientName(id: number, item: { name: string }): Promise<ClientName> {
    const [updated] = await db.update(clientNames)
      .set(item)
      .where(eq(clientNames.id, id))
      .returning();
    if (!updated) throw new Error("Client not found");
    return updated;
  }

  async deleteClientName(id: number): Promise<void> {
    await db.delete(clientNames).where(eq(clientNames.id, id));
  }

  async seedClientNames(names: string[]): Promise<void> {
    for (const name of names) {
      await db.insert(clientNames).values({ name }).onConflictDoNothing();
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

  async createUser(data: { username: string; password: string; displayName: string; role: string; clientName: string | null; permissions?: string[] }): Promise<SafeUser> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username,
      passwordHash,
      displayName: data.displayName,
      role: data.role,
      clientName: data.clientName,
      permissions: data.permissions || ['expense', 'cashseal', 'inventory', 'menu'],
    }).returning();
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
      const [req] = await tx.insert(purchaseRequests).values({
        clientName: data.clientName,
        date: data.date,
        createdBy: data.createdBy || null,
      }).returning();
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
      const [req] = await tx.update(purchaseRequests).set({
        ...(data.clientName ? { clientName: data.clientName } : {}),
        ...(data.date ? { date: data.date } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.approvedBy !== undefined ? { approvedBy: data.approvedBy } : {}),
      }).where(eq(purchaseRequests.id, id)).returning();
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
        }).onConflictDoNothing();
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
      });
    }
  }

  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(vendors.name);
  }

  async createVendor(data: { name: string; phone?: string; address?: string; gstNo?: string }): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(data).returning();
    return vendor;
  }

  async updateVendor(id: number, data: { name: string; phone?: string; address?: string; gstNo?: string }): Promise<Vendor> {
    const updateData: Record<string, any> = { name: data.name };
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.gstNo !== undefined) updateData.gstNo = data.gstNo;
    const [vendor] = await db.update(vendors).set(updateData).where(eq(vendors.id, id)).returning();
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
      const [inv] = await tx.insert(purchaseInvoices).values({
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
      }).returning();
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
      const [inv] = await tx.update(purchaseInvoices).set(updateFields).where(eq(purchaseInvoices.id, id)).returning();
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
    const [item] = await db.insert(itemMaster).values({
      itemName: data.itemName,
      uom: data.uom || "Kg",
      rate: data.rate || "0",
      hsnCode: data.hsnCode || "",
      gstPercent: data.gstPercent || "0",
      itemType: data.itemType || "purchase",
      itemCategory: data.itemCategory || "General",
    }).returning();
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
    const [item] = await db.update(itemMaster).set(updateFields).where(eq(itemMaster.id, id)).returning();
    if (!item) throw new Error("Item not found");
    return item;
  }

  async deleteItemMasterItem(id: number): Promise<void> {
    await db.delete(itemMaster).where(eq(itemMaster.id, id));
  }
}

export const storage = new DatabaseStorage();
