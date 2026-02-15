
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all reports
  app.get(api.reports.list.path, async (req, res) => {
    const reports = await storage.getReports();
    res.json(reports);
  });

  // Get single report
  app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  });

  // Create report
  app.post(api.reports.create.path, async (req, res) => {
    try {
      const input = api.reports.create.input.parse(req.body);
      const report = await storage.createReport(input);
      res.status(201).json(report);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      // Check for unique constraint violation on date
      if (err instanceof Error && 'code' in err && err.code === '23505') {
        return res.status(400).json({ message: 'A report for this date already exists.' });
      }
      throw err;
    }
  });

  // Update report
  app.put(api.reports.update.path, async (req, res) => {
    try {
      const input = api.reports.update.input.parse(req.body);
      const report = await storage.updateReport(Number(req.params.id), input);
      res.json(report);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      if (err instanceof Error && err.message === "Report not found") {
        return res.status(404).json({ message: "Report not found" });
      }
      throw err;
    }
  });

  // Delete report
  app.delete(api.reports.delete.path, async (req, res) => {
    await storage.deleteReport(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}

// Helper to seed some initial data
async function seedDatabase() {
  const reports = await storage.getReports();
  if (reports.length === 0) {
    console.log("Seeding database...");
    const today = new Date().toISOString().split('T')[0];
    
    await storage.createReport({
      date: today,
      openingBalance: 5000,
      receivedAmount: 2000,
      items: [
        { category: "fixed", description: "Ginger (Adarak)", uom: "Kg", qty: 2, rate: 50, amount: 100 },
        { category: "fixed", description: "Garlic (Lahasun)", uom: "Kg", qty: 1, rate: 150, amount: 150 },
        { category: "fixed", description: "Milk", uom: "Ltr", qty: 10, rate: 60, amount: 600 },
        { category: "vegetable", description: "Spinach", uom: "Kg", qty: 5, rate: 40, amount: 200 },
        { category: "vegetable", description: "Potatoes", uom: "Kg", qty: 20, rate: 20, amount: 400 },
      ]
    });
    console.log("Database seeded!");
  }
}

// Run seeder
setTimeout(seedDatabase, 1000);
