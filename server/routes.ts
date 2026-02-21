
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
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'A report for this date already exists. Each day can only have one report.' });
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

  // Get previous day balance
  app.get('/api/reports/previous-balance/:date', async (req, res) => {
    const balance = await storage.getPreviousDayBalance(req.params.date);
    res.json({ balance });
  });

  // Get vegetable items
  app.get(api.vegetables.list.path, async (req, res) => {
    const items = await storage.getVegetableItems();
    res.json(items);
  });

  // Create vegetable item
  app.post(api.vegetables.create.path, async (req, res) => {
    try {
      const input = api.vegetables.create.input.parse(req.body);
      const item = await storage.createVegetableItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Update vegetable item
  app.put(api.vegetables.update.path, async (req, res) => {
    try {
      const input = api.vegetables.update.input.parse(req.body);
      const item = await storage.updateVegetableItem(Number(req.params.id), input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      if (err instanceof Error && err.message === "Vegetable not found") {
        return res.status(404).json({ message: "Vegetable not found" });
      }
      throw err;
    }
  });

  // Delete vegetable item
  app.delete(api.vegetables.delete.path, async (req, res) => {
    await storage.deleteVegetableItem(Number(req.params.id));
    res.status(204).send();
  });

  // === CASH SEAL ROUTES ===
  app.get(api.cashSeals.list.path, async (req, res) => {
    const seals = await storage.getCashSeals();
    res.json(seals);
  });

  app.post(api.cashSeals.create.path, async (req, res) => {
    try {
      const input = api.cashSeals.create.input.parse(req.body);
      const seal = await storage.createCashSeal(input);
      res.status(201).json(seal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  // === INVENTORY ROUTES ===
  app.get(api.inventory.list.path, async (req, res) => {
    const inventories = await storage.getInventories();
    res.json(inventories);
  });

  app.get(api.inventory.get.path, async (req, res) => {
    const inv = await storage.getInventory(Number(req.params.id));
    if (!inv) return res.status(404).json({ message: 'Inventory not found' });
    res.json(inv);
  });

  app.post(api.inventory.create.path, async (req, res) => {
    try {
      const input = api.inventory.create.input.parse(req.body);
      const inv = await storage.createInventory(input);
      res.status(201).json(inv);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'An inventory record for this date already exists.' });
      }
      throw err;
    }
  });

  app.put(api.inventory.update.path, async (req, res) => {
    try {
      const input = api.inventory.update.input.parse(req.body);
      const inv = await storage.updateInventory(Number(req.params.id), input);
      res.json(inv);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && err.message === "Inventory not found") {
        return res.status(404).json({ message: "Inventory not found" });
      }
      throw err;
    }
  });

  app.delete(api.inventory.delete.path, async (req, res) => {
    await storage.deleteInventory(Number(req.params.id));
    res.status(204).send();
  });

  // === ADMIN ROUTES ===
  app.post(api.admin.verifyPin.path, async (req, res) => {
    const { pin } = api.admin.verifyPin.input.parse(req.body);
    const valid = await storage.verifyAdminPin(pin);
    if (valid) {
      (req as any).session = (req as any).session || {};
      (req as any).session.adminAuthenticated = true;
    }
    res.json({ valid });
  });

  app.post(api.admin.changePin.path, async (req, res) => {
    const { currentPin, newPin } = api.admin.changePin.input.parse(req.body);
    const valid = await storage.verifyAdminPin(currentPin);
    if (!valid) {
      return res.status(400).json({ message: "Current PIN is incorrect" });
    }
    await storage.setAdminPin(newPin);
    res.json({ success: true });
  });

  return httpServer;
}

// Helper to seed some initial data
async function seedDatabase() {
  // Seed vegetable items first
  const vegetableNames = [
    "Potato", "Onion", "Tomato", "Green Chilli", "Ginger", "Garlic", 
    "Cabbage", "Cauliflower", "Spinach", "Carrot", "Beans", "Lady Finger",
    "Brinjal", "Capsicum", "Bottle Gourd", "Bitter Gourd"
  ];
  await storage.seedVegetableItems(vegetableNames);

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
