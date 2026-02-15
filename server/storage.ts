
import { db } from "./db";
import { 
  dailyReports, 
  expenseItems, 
  vegetableItems,
  type DailyReport, 
  type ExpenseItem,
  type CreateReportRequest,
  type UpdateReportRequest,
  type ReportWithItems,
  type VegetableItem
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getReports(): Promise<DailyReport[]>;
  getReport(id: number): Promise<ReportWithItems | undefined>;
  createReport(report: CreateReportRequest): Promise<ReportWithItems>;
  updateReport(id: number, report: UpdateReportRequest): Promise<ReportWithItems>;
  deleteReport(id: number): Promise<void>;
  getVegetableItems(): Promise<VegetableItem[]>;
  seedVegetableItems(names: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getVegetableItems(): Promise<VegetableItem[]> {
    return await db.select().from(vegetableItems);
  }

  async seedVegetableItems(names: string[]): Promise<void> {
    for (const name of names) {
      await db.insert(vegetableItems).values({ name }).onConflictDoNothing();
    }
  }

  async getReports(): Promise<DailyReport[]> {
    return await db.select().from(dailyReports).orderBy(desc(dailyReports.date));
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
}

export const storage = new DatabaseStorage();
