
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { insertPankajReportSchema } from "@shared/schema";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.session.role === "admin") {
      return next();
    }
    const perms = req.session.permissions || [];
    if (!perms.includes(perm)) {
      return res.status(403).json({ message: "You do not have permission to access this feature" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === AUTH ROUTES (no auth required) ===
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.clientName = user.clientName;
      req.session.displayName = user.displayName;
      req.session.permissions = user.permissions;
      req.session.employeeId = user.employeeId;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session save failed" });
        }
        res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, clientName: user.clientName, permissions: user.permissions, employeeId: user.employeeId });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Failed to logout" });
      res.json({ success: true });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({
      id: req.session.userId,
      displayName: req.session.displayName,
      role: req.session.role,
      clientName: req.session.clientName,
      username: req.session.username || "",
      permissions: req.session.permissions || [],
      employeeId: req.session.employeeId || null,
    });
  });

  // === EMPLOYEE SELF-SERVICE ROUTES ===
  app.get("/api/employee/me", requireAuth, async (req, res) => {
    const employeeId = req.session.employeeId;
    if (!employeeId) return res.status(404).json({ message: "No linked employee" });
    const emp = await storage.getEmployee(employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    res.json(emp);
  });

  app.get("/api/employee/me/attendance", requireAuth, async (req, res) => {
    const employeeId = req.session.employeeId;
    if (!employeeId) return res.status(404).json({ message: "No linked employee" });
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "month and year required" });
    const records = await storage.getAttendance(
      req.session.clientName || "",
      Number(month),
      Number(year)
    );
    const record = records.find((r: any) => r.employeeId === employeeId);
    if (!record) return res.status(404).json({ message: "No attendance record" });
    res.json(record);
  });

  app.get("/api/employee/me/salary", requireAuth, async (req, res) => {
    const employeeId = req.session.employeeId;
    if (!employeeId) return res.status(404).json({ message: "No linked employee" });
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "month and year required" });
    const records = await storage.getSalaryRecords(
      req.session.clientName || "",
      Number(month),
      Number(year)
    );
    const record = records.find((r: any) => r.employeeId === employeeId);
    if (!record) return res.status(404).json({ message: "No salary record" });
    const otRecords = await storage.getOvertimeRecords(req.session.clientName || "");
    const empOt = otRecords.filter(ot => {
      if (ot.employeeId !== employeeId) return false;
      const d = new Date(ot.date);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    });
    let otHours = 0, otAmount = 0;
    for (const ot of empOt) {
      otHours += Number(ot.overtimeHours) || 0;
      otAmount += Number(ot.overtimeAmount) || 0;
    }
    const result = {
      ...record,
      overtimeHours: String(Math.round(otHours * 100) / 100),
      overtimeAmount: String(Math.round(otAmount)),
    };
    res.json(result);
  });

  // === USER MANAGEMENT ROUTES (admin only) ===
  app.get(api.users.list.path, requireAdmin, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post(api.users.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'This username already exists.' });
      }
      throw err;
    }
  });

  app.patch(api.users.update.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ message: "User not found" });
      if (existing.username === 'admin') return res.status(403).json({ message: "Cannot edit the admin account" });
      const input = api.users.update.input.parse(req.body);
      const user = await storage.updateUser(id, input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.users.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    res.status(204).send();
  });

  // === PROTECTED ROUTES (require auth) ===

  // Get all reports
  app.get(api.reports.list.path, requirePermission('expense'), async (req, res) => {
    const reports = await storage.getReports();
    res.json(reports);
  });

  // Get single report
  app.get(api.reports.get.path, requirePermission('expense'), async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  });

  // Create report
  app.post(api.reports.create.path, requirePermission('expense'), async (req, res) => {
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
  app.put(api.reports.update.path, requirePermission('expense'), async (req, res) => {
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
  app.delete(api.reports.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteReport(Number(req.params.id));
    res.status(204).send();
  });

  // Get previous day balance
  app.get('/api/reports/previous-balance/:date', requirePermission('expense'), async (req, res) => {
    const balance = await storage.getPreviousDayBalance(req.params.date as string);
    res.json({ balance });
  });

  // Get last vegetable prices
  app.get(api.vegetables.lastPrices.path, requirePermission('expense'), async (req, res) => {
    const prices = await storage.getLastVegetablePrices();
    res.json(prices);
  });

  // Get vegetable items
  app.get(api.vegetables.list.path, requirePermission('expense'), async (req, res) => {
    const items = await storage.getVegetableItems();
    res.json(items);
  });

  // Create vegetable item
  app.post(api.vegetables.create.path, requireAdmin, async (req, res) => {
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
  app.put(api.vegetables.update.path, requireAdmin, async (req, res) => {
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
  app.delete(api.vegetables.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteVegetableItem(Number(req.params.id));
    res.status(204).send();
  });

  // === CASH SEAL ROUTES ===
  // Get Cash Seal Akbar Ali amount by date (for auto-fill in expense report)
  app.get('/api/cash-seals/by-date/:date', requireAuth, async (req, res) => {
    const dateStr = req.params.date;
    const seals = await storage.getCashSeals();
    const seal = seals.find((s: any) => s.date === dateStr);
    res.json({ totalGivenToAkbarAli: seal ? Number(seal.totalGivenToAkbarAli) || 0 : 0 });
  });

  app.get(api.cashSeals.list.path, requirePermission('cashseal'), async (req, res) => {
    const seals = await storage.getCashSeals();
    res.json(seals);
  });

  app.get('/api/cash-seals/:id', requirePermission('cashseal'), async (req, res) => {
    const id = Number(req.params.id);
    const seal = await storage.getCashSeal(id);
    if (!seal) return res.status(404).json({ message: "Cash seal not found" });
    res.json(seal);
  });

  app.post(api.cashSeals.create.path, requirePermission('cashseal'), async (req, res) => {
    try {
      const input = api.cashSeals.create.input.parse(req.body);
      const seal = await storage.createCashSeal(input);
      // Auto-sync Akbar Ali total → expense report receivedAmount
      if (seal?.reportId) {
        await storage.syncCashSealToReport(seal.reportId, Number(input.totalGivenToAkbarAli) || 0);
      }
      res.status(201).json(seal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.put('/api/cash-seals/:id', requirePermission('cashseal'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const seal = await storage.updateCashSeal(id, req.body);
      // Auto-sync Akbar Ali total → expense report receivedAmount
      if (seal?.reportId) {
        await storage.syncCashSealToReport(seal.reportId, Number(req.body.totalGivenToAkbarAli) || 0);
      }
      res.json(seal);
    } catch (err) {
      throw err;
    }
  });

  app.delete('/api/cash-seals/:id', requirePermission('cashseal'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteCashSeal(id);
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === INVENTORY ROUTES ===
  app.get(api.inventory.list.path, requirePermission('inventory'), async (req, res) => {
    const inventories = await storage.getInventories();
    res.json(inventories);
  });

  app.get(api.inventory.get.path, requirePermission('inventory'), async (req, res) => {
    const inv = await storage.getInventory(Number(req.params.id));
    if (!inv) return res.status(404).json({ message: 'Inventory not found' });
    res.json(inv);
  });

  app.post(api.inventory.create.path, requirePermission('inventory'), async (req, res) => {
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

  app.put(api.inventory.update.path, requirePermission('inventory'), async (req, res) => {
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

  app.delete(api.inventory.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteInventory(Number(req.params.id));
    res.status(204).send();
  });

  // === MENU ROUTES ===
  app.get(api.menus.list.path, requirePermission('menu'), async (req, res) => {
    const menus = await storage.getSavedMenus();
    res.json(menus);
  });

  app.get(api.menus.get.path, requirePermission('menu'), async (req, res) => {
    const menu = await storage.getSavedMenu(Number(req.params.id));
    if (!menu) return res.status(404).json({ message: "Menu not found" });
    res.json(menu);
  });

  app.post(api.menus.create.path, requirePermission('menu'), async (req, res) => {
    try {
      const input = api.menus.create.input.parse(req.body);
      const menu = await storage.createSavedMenu(input);
      try {
        const menuData = JSON.parse(input.menuData);
        const menuItemNames = Array.from(new Set(Object.values(menuData).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)));
        if (menuItemNames.length > 0) {
          await storage.saveItemNames(menuItemNames as string[], 'menu');
        }
      } catch {}
      res.status(201).json(menu);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.put('/api/menus/:id', requirePermission('menu'), async (req, res) => {
    try {
      const { clientName, startDate, endDate, menuData } = req.body;
      const menu = await storage.updateSavedMenu(Number(req.params.id), {
        ...(clientName !== undefined && { clientName }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(menuData !== undefined && { menuData }),
      });
      if (!menu) return res.status(404).json({ message: "Menu not found" });
      if (menuData) {
        try {
          const parsed = JSON.parse(menuData);
          const names = Array.from(new Set(Object.values(parsed).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)));
          if (names.length > 0) await storage.saveItemNames(names as string[], 'menu');
        } catch {}
      }
      res.json(menu);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete(api.menus.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteSavedMenu(Number(req.params.id));
    res.status(204).send();
  });

  // === PURCHASE REQUEST ROUTES ===
  app.get(api.purchaseRequests.list.path, requirePermission('purchase'), async (req, res) => {
    const requests = await storage.getPurchaseRequests();
    if (req.session.role === 'admin') {
      res.json(requests);
    } else {
      const username = req.session.displayName || req.session.username || '';
      res.json(requests.filter(r => r.createdBy === username));
    }
  });

  app.get(api.purchaseRequests.get.path, requirePermission('purchase'), async (req, res) => {
    const request = await storage.getPurchaseRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ message: "Purchase request not found" });
    if (req.session.role !== 'admin') {
      const username = req.session.displayName || req.session.username || '';
      if (request.createdBy !== username) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    res.json(request);
  });

  app.post(api.purchaseRequests.create.path, requirePermission('purchase'), async (req, res) => {
    try {
      const input = api.purchaseRequests.create.input.parse(req.body);
      const { status, ...safeInput } = input as any;
      const createdByName = req.session.displayName || req.session.username || '';
      const request = await storage.createPurchaseRequest({ ...safeInput, createdBy: createdByName });
      const itemNames = safeInput.items.map((i: any) => i.itemName).filter((n: string) => n.trim());
      if (itemNames.length > 0) {
        await storage.saveItemNames(itemNames, 'purchase');
      }
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.put(api.purchaseRequests.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.purchaseRequests.update.input.parse(req.body);
      const updateData: any = { ...input };
      if (input.status === 'approved') {
        updateData.approvedBy = req.session.displayName || req.session.username || '';
      }
      const request = await storage.updatePurchaseRequest(Number(req.params.id), updateData);
      res.json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && err.message === "Purchase request not found") {
        return res.status(404).json({ message: "Purchase request not found" });
      }
      throw err;
    }
  });

  app.delete(api.purchaseRequests.delete.path, requireAdmin, async (req, res) => {
    await storage.deletePurchaseRequest(Number(req.params.id));
    res.status(204).send();
  });

  // === VENDOR ROUTES ===
  app.get(api.vendors.list.path, requireAuth, async (req, res) => {
    const vendorsList = await storage.getVendors();
    res.json(vendorsList);
  });

  app.post(api.vendors.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.vendors.create.input.parse(req.body);
      const vendor = await storage.createVendor(input);
      res.status(201).json(vendor);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'This vendor already exists.' });
      }
      throw err;
    }
  });

  app.put(api.vendors.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.vendors.update.input.parse(req.body);
      const vendor = await storage.updateVendor(Number(req.params.id), input);
      res.json(vendor);
    } catch (err) {
      if (err instanceof Error && err.message === "Vendor not found") {
        return res.status(404).json({ message: "Vendor not found" });
      }
      throw err;
    }
  });

  app.delete(api.vendors.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteVendor(Number(req.params.id));
    res.status(204).send();
  });

  // === PURCHASE INVOICE ROUTES ===
  app.get(api.purchaseInvoices.lastPrices.path, requirePermission('purchase'), async (req, res) => {
    const prices = await storage.getLastPurchasePrices();
    res.json(prices);
  });

  app.get(api.purchaseInvoices.nextDjNo.path, requirePermission('purchase'), async (req, res) => {
    const djInvoiceNo = await storage.getNextDjInvoiceNo();
    res.json({ djInvoiceNo });
  });

  app.get(api.purchaseInvoices.list.path, requirePermission('purchase'), async (req, res) => {
    const invoices = await storage.getPurchaseInvoices();
    if (req.session.role !== 'admin') {
      const filtered = invoices.filter(inv => inv.createdBy === req.session.displayName || inv.createdBy === req.session.username);
      return res.json(filtered);
    }
    res.json(invoices);
  });

  app.get(api.purchaseInvoices.get.path, requirePermission('purchase'), async (req, res) => {
    const invoice = await storage.getPurchaseInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (req.session.role !== 'admin' && invoice.createdBy !== req.session.displayName && invoice.createdBy !== req.session.username) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(invoice);
  });

  app.post(api.purchaseInvoices.create.path, requirePermission('purchase'), async (req, res) => {
    try {
      const input = api.purchaseInvoices.create.input.parse(req.body);
      const createdByName = req.session.displayName || req.session.username || '';
      const invoice = await storage.createPurchaseInvoice({ ...input, createdBy: createdByName });
      res.status(201).json(invoice);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.put(api.purchaseInvoices.update.path, requirePermission('purchase'), async (req, res) => {
    try {
      const input = api.purchaseInvoices.update.input.parse(req.body);
      const invoice = await storage.updatePurchaseInvoice(Number(req.params.id), input);
      res.json(invoice);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && err.message === "Purchase invoice not found") {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      throw err;
    }
  });

  app.delete(api.purchaseInvoices.delete.path, requireAdmin, async (req, res) => {
    await storage.deletePurchaseInvoice(Number(req.params.id));
    res.status(204).send();
  });

  app.get(api.purchaseInvoices.getPayments.path, requirePermission('purchase'), async (req, res) => {
    const payments = await storage.getPurchaseInvoicePayments(Number(req.params.id));
    res.json(payments);
  });

  app.post(api.purchaseInvoices.addPayment.path, requirePermission('purchase'), async (req, res) => {
    try {
      const input = api.purchaseInvoices.addPayment.input.parse(req.body);
      const payment = await storage.addPurchaseInvoicePayment({ ...input, invoiceId: Number(req.params.id) });
      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.purchaseInvoices.updatePayment.path, requirePermission('purchase'), async (req, res) => {
    try {
      const input = api.purchaseInvoices.updatePayment.input.parse(req.body);
      const payment = await storage.updatePurchaseInvoicePayment(Number(req.params.id), input);
      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete(api.purchaseInvoices.deletePayment.path, requireAdmin, async (req, res) => {
    await storage.deletePurchaseInvoicePayment(Number(req.params.id));
    res.status(204).send();
  });

  // === SAVED ITEM NAMES ROUTES ===
  app.get(api.savedItems.list.path, requireAuth, async (req, res) => {
    const source = req.query.source as string | undefined;
    const items = await storage.getSavedItemNames(source);
    res.json(items);
  });

  // === CLIENT ROUTES ===
  app.get(api.clients.list.path, requireAuth, async (req, res) => {
    const items = await storage.getClientNames();
    res.json(items);
  });

  app.post(api.clients.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      const item = await storage.createClientName(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'This client name already exists.' });
      }
      throw err;
    }
  });

  app.put(api.clients.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.clients.update.input.parse(req.body);
      const item = await storage.updateClientName(Number(req.params.id), input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && err.message === "Client not found") {
        return res.status(404).json({ message: "Client not found" });
      }
      throw err;
    }
  });

  app.delete(api.clients.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteClientName(Number(req.params.id));
    res.status(204).send();
  });

  // === ADMIN ROUTES ===
  app.post(api.admin.verifyPin.path, requireAdmin, async (req, res) => {
    const { pin } = api.admin.verifyPin.input.parse(req.body);
    const valid = await storage.verifyAdminPin(pin);
    if (valid) {
      (req as any).session = (req as any).session || {};
      (req as any).session.adminAuthenticated = true;
    }
    res.json({ valid });
  });

  app.post(api.admin.changePin.path, requireAdmin, async (req, res) => {
    const { currentPin, newPin } = api.admin.changePin.input.parse(req.body);
    const valid = await storage.verifyAdminPin(currentPin);
    if (!valid) {
      return res.status(400).json({ message: "Current PIN is incorrect" });
    }
    await storage.setAdminPin(newPin);
    res.json({ success: true });
  });

  // === ITEM MASTER ROUTES ===
  app.get(api.itemMaster.list.path, requireAuth, async (req, res) => {
    const itemType = req.query.type as string | undefined;
    const items = await storage.getItemMasterItems(itemType);
    res.json(items);
  });

  app.post(api.itemMaster.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.itemMaster.create.input.parse(req.body);
      const item = await storage.createItemMasterItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'This item name already exists.' });
      }
      throw err;
    }
  });

  app.put(api.itemMaster.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.itemMaster.update.input.parse(req.body);
      const item = await storage.updateItemMasterItem(Number(req.params.id), input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err instanceof Error && err.message === "Item not found") {
        return res.status(404).json({ message: "Item not found" });
      }
      if (err instanceof Error && 'code' in (err as any) && (err as any).code === '23505') {
        return res.status(400).json({ message: 'This item name already exists.' });
      }
      throw err;
    }
  });

  app.delete(api.itemMaster.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteItemMasterItem(Number(req.params.id));
    res.status(204).send();
  });

  // === EMPLOYEE MASTER ===
  app.get("/api/employees", requireAuth, async (req, res) => {
    const clientName = req.query.clientName as string | undefined;
    const employees = await storage.getEmployees(clientName);
    res.json(employees);
  });

  app.get("/api/employees/:id", requireAuth, async (req, res) => {
    const emp = await storage.getEmployee(Number(req.params.id));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    res.json(emp);
  });

  app.post("/api/employees", requireAdmin, async (req, res) => {
    try {
      const emp = await storage.createEmployee(req.body);
      res.status(201).json(emp);
    } catch (err: any) {
      if (err.code === '23505') return res.status(400).json({ message: "Employee code already exists" });
      throw err;
    }
  });

  app.put("/api/employees/:id", requireAdmin, async (req, res) => {
    try {
      const emp = await storage.updateEmployee(Number(req.params.id), req.body);
      res.json(emp);
    } catch (err: any) {
      if (err.message === "Employee not found") return res.status(404).json({ message: err.message });
      if (err.code === '23505') return res.status(400).json({ message: "Employee code already exists" });
      throw err;
    }
  });

  app.delete("/api/employees/:id", requireAdmin, async (req, res) => {
    await storage.deleteEmployee(Number(req.params.id));
    res.status(204).send();
  });

  // === ATTENDANCE / MUSTER ROLL ===
  app.get("/api/attendance", requireAuth, async (req, res) => {
    const { clientName, month, year } = req.query;
    if (!clientName || !month || !year) return res.status(400).json({ message: "clientName, month, year required" });
    const records = await storage.getAttendance(clientName as string, Number(month), Number(year));
    res.json(records);
  });

  app.post("/api/attendance", requireAuth, async (req, res) => {
    const record = await storage.saveAttendance(req.body);
    res.json(record);
  });

  // === SALARY RECORDS ===
  app.get("/api/salary/annual", requireAuth, async (req, res) => {
    const { clientName, fyStart } = req.query;
    if (!clientName || !fyStart) return res.status(400).json({ message: "clientName and fyStart required" });
    const startYear = Number(fyStart);
    const records = await storage.getAnnualSalary(clientName as string, startYear);
    res.json(records);
  });

  app.get("/api/salary", requireAuth, async (req, res) => {
    const { clientName, month, year, months: monthsParam } = req.query;
    if (!clientName || !year) return res.status(400).json({ message: "clientName, year required" });

    // Helper: merge OT register amounts into salary records and cascade-recalculate dependent fields
    const mergeOt = async (records: any[], m: number, y: number) => {
      const allOt = await storage.getOvertimeRecords(clientName as string);
      return records.map(rec => {
        const empOt = allOt.filter((ot: any) => {
          if (ot.employeeId !== rec.employeeId) return false;
          const d = new Date(ot.date);
          return d.getMonth() + 1 === m && d.getFullYear() === y;
        });
        if (empOt.length === 0) return rec;
        let otHrs = 0, otAmt = 0;
        for (const ot of empOt) {
          otHrs += Number(ot.overtimeHours) || 0;
          otAmt += Number(ot.overtimeAmount) || 0;
        }
        otHrs = Math.round(otHrs * 100) / 100;
        otAmt = Math.round(otAmt);
        // Cascade-recalculate all fields that depend on OT amount
        const basicWage = Number(rec.basicWage) || 0;
        const hra5 = Number(rec.otherAllowance) || 0;
        const fixedHra = Number(rec.hra) || 0;
        const da = Number(rec.da) || 0;
        const grossWage = Math.round((basicWage + hra5 + fixedHra + otAmt + da) * 100) / 100;
        const pfDeduction = Number(rec.pfDeduction) || 0;
        const esicDeduction = grossWage <= 21000 ? Math.round(grossWage * 0.0075 * 100) / 100 : 0;
        const professionalTax = grossWage > 40000 ? 200 : grossWage > 25000 ? 150 : grossWage > 15000 ? 130 : grossWage > 10000 ? 110 : 0;
        const lwf = Number(rec.lwf) || 0;
        const advanceDeduction = Number(rec.advanceDeduction) || 0;
        const fineDeduction = Number(rec.fineDeduction) || 0;
        const otherDeduction = Number(rec.otherDeduction) || 0;
        const totalDeduction = Math.round((pfDeduction + esicDeduction + professionalTax + lwf + advanceDeduction + fineDeduction + otherDeduction) * 100) / 100;
        const netPay = Math.round((grossWage - totalDeduction) * 100) / 100;
        return {
          ...rec,
          overtimeHours: String(otHrs),
          overtimeAmount: String(otAmt),
          grossWage: String(grossWage),
          esicDeduction: String(esicDeduction),
          professionalTax: String(professionalTax),
          totalDeduction: String(totalDeduction),
          netPay: String(netPay),
        };
      });
    };

    if (monthsParam) {
      const monthsList = (monthsParam as string).split(',').map(Number);
      const allRecords = [];
      for (const m of monthsList) {
        const records = await storage.getSalaryRecords(clientName as string, m, Number(year));
        allRecords.push(...(await mergeOt(records, m, Number(year))));
      }
      return res.json(allRecords);
    }
    if (!month) return res.status(400).json({ message: "month required" });
    const records = await storage.getSalaryRecords(clientName as string, Number(month), Number(year));
    res.json(await mergeOt(records, Number(month), Number(year)));
  });

  app.get("/api/salary/:id", requireAuth, async (req, res) => {
    const record = await storage.getSalaryRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ message: "Salary record not found" });
    res.json(record);
  });

  app.post("/api/salary/generate", requireAdmin, async (req, res) => {
    const { clientName, month, year, paidOn } = req.body;
    if (!clientName || !month || !year) return res.status(400).json({ message: "clientName, month, year required" });
    const records = await storage.generateSalary(clientName, Number(month), Number(year), paidOn || undefined);
    res.json(records);
  });

  app.put("/api/salary/paid-date", requireAdmin, async (req, res) => {
    const { clientName, month, year, paidOn } = req.body;
    if (!clientName || !month || !year) return res.status(400).json({ message: "clientName, month, year required" });
    const updated = await storage.updateSalaryPaidDate(clientName, Number(month), Number(year), paidOn || null);
    res.json({ updated });
  });

  app.put("/api/salary/:id", requireAdmin, async (req, res) => {
    const record = await storage.saveSalaryRecord({ ...req.body, id: Number(req.params.id) });
    res.json(record);
  });

  app.delete("/api/salary/:id", requireAdmin, async (req, res) => {
    await storage.deleteSalaryRecord(Number(req.params.id));
    res.status(204).send();
  });

  // === FINES ===
  app.get("/api/fines", requireAuth, async (req, res) => {
    const records = await storage.getFines(req.query.clientName as string | undefined);
    res.json(records);
  });

  app.post("/api/fines", requireAdmin, async (req, res) => {
    const record = await storage.createFine(req.body);
    res.status(201).json(record);
  });

  app.put("/api/fines/:id", requireAdmin, async (req, res) => {
    const record = await storage.updateFine(Number(req.params.id), req.body);
    res.json(record);
  });

  app.delete("/api/fines/:id", requireAdmin, async (req, res) => {
    await storage.deleteFine(Number(req.params.id));
    res.status(204).send();
  });

  // === ADVANCES ===
  app.get("/api/advances", requireAuth, async (req, res) => {
    const records = await storage.getAdvances(req.query.clientName as string | undefined);
    res.json(records);
  });

  app.post("/api/advances", requireAdmin, async (req, res) => {
    const record = await storage.createAdvance(req.body);
    res.status(201).json(record);
  });

  app.put("/api/advances/:id", requireAdmin, async (req, res) => {
    const record = await storage.updateAdvance(Number(req.params.id), req.body);
    res.json(record);
  });

  app.delete("/api/advances/:id", requireAdmin, async (req, res) => {
    await storage.deleteAdvance(Number(req.params.id));
    res.status(204).send();
  });

  // === OVERTIME REGISTER ===
  app.get("/api/overtime", requireAuth, async (req, res) => {
    const records = await storage.getOvertimeRecords(req.query.clientName as string | undefined);
    res.json(records);
  });

  app.post("/api/overtime", requireAdmin, async (req, res) => {
    const record = await storage.createOvertimeRecord(req.body);
    res.status(201).json(record);
  });

  app.put("/api/overtime/:id", requireAdmin, async (req, res) => {
    const record = await storage.updateOvertimeRecordFull(Number(req.params.id), req.body);
    res.json(record);
  });

  app.delete("/api/overtime/:id", requireAdmin, async (req, res) => {
    await storage.deleteOvertimeRecord(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/overtime/recalculate-rates", requireAdmin, async (req, res) => {
    const { clientName } = req.body;
    if (!clientName) return res.status(400).json({ error: "clientName required" });
    const allOt = await storage.getOvertimeRecords(clientName);
    const allEmployees = await storage.getEmployees(clientName);
    const empMap = new Map(allEmployees.map(e => [e.id, e]));
    let updated = 0;
    for (const ot of allOt) {
      const emp = empMap.get(ot.employeeId);
      if (!emp) continue;
      const d = new Date(ot.date);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      let dailyRate = parseFloat(emp.dailyRate) || 0;
      if (emp.skills) {
        const skillRate = await storage.getSkillWageRate(emp.skills, month, year);
        if (skillRate && Number(skillRate.dailyRate) > 0) {
          dailyRate = Number(skillRate.dailyRate);
        }
      }
      // Formula: ROUND(((Basic Rate + Basic Rate×5%) / 4) × OT Hrs, 0)
      const overtimeRate = Math.round((dailyRate * 1.05) / 4 * 100) / 100;
      const hours = Number(ot.overtimeHours) || 0;
      const overtimeAmount = Math.round(overtimeRate * hours);
      await storage.updateOvertimeRecord(ot.id, {
        overtimeRate: String(overtimeRate),
        overtimeAmount: String(overtimeAmount),
      });
      updated++;
    }
    res.json({ updated });
  });

  // === DAMAGE DEDUCTIONS ===
  app.get("/api/damage-deductions", requireAuth, async (req, res) => {
    const records = await storage.getDamageDeductions(req.query.clientName as string | undefined);
    res.json(records);
  });

  app.post("/api/damage-deductions", requireAdmin, async (req, res) => {
    const record = await storage.createDamageDeduction(req.body);
    res.status(201).json(record);
  });

  app.put("/api/damage-deductions/:id", requireAdmin, async (req, res) => {
    const record = await storage.updateDamageDeduction(Number(req.params.id), req.body);
    res.json(record);
  });

  app.delete("/api/damage-deductions/:id", requireAdmin, async (req, res) => {
    await storage.deleteDamageDeduction(Number(req.params.id));
    res.status(204).send();
  });

  // === LEAVE WITH WAGES (Form 15) ===
  app.get("/api/leave-with-wages", requireAuth, async (req, res) => {
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const clientName = req.query.clientName as string | undefined;
    if (employeeId) {
      const records = await storage.getLeaveWithWages(employeeId);
      res.json(records);
    } else if (clientName) {
      const records = await storage.getLeaveWithWagesByClient(clientName);
      res.json(records);
    } else {
      res.json([]);
    }
  });

  app.get("/api/leave-with-wages/yearly-present", requireAuth, async (req, res) => {
    const employeeId = Number(req.query.employeeId);
    const year = Number(req.query.year);
    if (!employeeId || !year) return res.status(400).json({ error: "employeeId and year required" });
    const { attendance } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("./db");
    const records = await db.select().from(attendance).where(
      and(eq(attendance.employeeId, employeeId), eq(attendance.year, year))
    );

    let totalDaysInYear = 0;
    let weeklyOffs = 0;
    let paidHolidays = 0;
    let leavesAvailed = 0;
    let absences = 0;
    let totalPresent = 0;

    let holidayWork = 0;
    for (const rec of records) {
      const daysInMonth = new Date(year, rec.month, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const val = (rec as any)[`day${d}`] as string | null;
        if (!val) continue;
        totalDaysInYear++;
        const upper = val.toUpperCase().trim();
        if (upper === "P") {
          totalPresent++;
        } else if (upper === "H" || upper.startsWith("P/") || (upper.includes("HL") && upper !== "PH")) {
          holidayWork++; // holiday working — not counted for leave entitlement
        } else if (upper === "WO") {
          weeklyOffs++;
        } else if (upper === "PH") {
          paidHolidays++;
        } else if (upper === "CL" || upper === "SL" || upper === "EL") {
          leavesAvailed++;
        } else if (upper === "A") {
          absences++;
        }
      }
    }

    const actualDaysWorked = totalDaysInYear - (weeklyOffs + paidHolidays + leavesAvailed + absences + holidayWork);
    const leaveEarned = Math.floor(actualDaysWorked / 20);

    const { employees, skillWageRates: swrTable } = await import("@shared/schema");
    const empRows = await db.select().from(employees).where(eq(employees.id, employeeId));
    const empSkill = empRows.length > 0 ? (empRows[0].skills || "") : "";
    let dailyRate = empRows.length > 0 ? Number(empRows[0].dailyRate || 0) : 0;

    const monthsWithRates: number[] = [];
    let totalSkillRate = 0;
    for (let m = 1; m <= 12; m++) {
      const sr = await db.select().from(swrTable).where(
        and(eq(swrTable.skillCategory, empSkill), eq(swrTable.month, m), eq(swrTable.year, year))
      );
      if (sr.length > 0) {
        totalSkillRate += Number(sr[0].dailyRate);
        monthsWithRates.push(m);
      }
    }
    if (monthsWithRates.length > 0) {
      dailyRate = Math.round((totalSkillRate / monthsWithRates.length) * 100) / 100;
    }
    const amountOfWages = 0;

    res.json({ totalDaysInYear, weeklyOffs, paidHolidays, leavesAvailed, absences, actualDaysWorked, totalPresent, leaveEarned, dailyRate, amountOfWages });
  });

  app.post("/api/leave-with-wages/generate", requireAdmin, async (req, res) => {
    try {
      const employeeId = Number(req.body.employeeId);
      const clientName = req.body.clientName as string;
      if (!employeeId || !clientName) return res.status(400).json({ error: "employeeId and clientName required" });

      const { attendance, employees, skillWageRates: swrTable, leaveWithWages: lwwTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { db } = await import("./db");

      const empRows = await db.select().from(employees).where(eq(employees.id, employeeId));
      if (empRows.length === 0) return res.status(404).json({ error: "Employee not found" });
      const emp = empRows[0];
      const empSkill = emp.skills || "";

      const allAttendance = await db.select().from(attendance).where(eq(attendance.employeeId, employeeId));
      if (allAttendance.length === 0) return res.json({ generated: 0, message: "No attendance records found" });

      const yearSet = new Set<number>();
      for (const rec of allAttendance) yearSet.add(rec.year);
      const years = Array.from(yearSet).sort();

      const existingRecords = await db.select().from(lwwTable).where(eq(lwwTable.employeeId, employeeId));
      const existingYears = new Set(existingRecords.map(r => r.calendarYear));

      let generated = 0;
      let prevLeaveBalance = 0;

      for (const year of years) {
        const yearAttendance = allAttendance.filter(r => r.year === year);
        let totalDaysInYear = 0;
        let weeklyOffs = 0;
        let paidHolidays = 0;
        let leavesAvailed = 0;
        let absences = 0;
        let holidayWork = 0;

        for (const rec of yearAttendance) {
          const daysInMonth = new Date(year, rec.month, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            const val = (rec as any)[`day${d}`] as string | null;
            if (!val) continue;
            totalDaysInYear++;
            const upper = val.toUpperCase().trim();
            if (upper === "WO") weeklyOffs++;
            else if (upper === "PH") paidHolidays++;
            else if (upper === "CL" || upper === "SL" || upper === "EL") leavesAvailed++;
            else if (upper === "A") absences++;
            else if (upper === "H" || upper.startsWith("P/") || (upper.includes("HL") && upper !== "PH")) holidayWork++;
          }
        }

        const actualDaysWorked = totalDaysInYear - (weeklyOffs + paidHolidays + leavesAvailed + absences + holidayWork);
        const leaveEarned = Math.floor(actualDaysWorked / 20);

        let dailyRate = Number(emp.dailyRate || 0);
        const monthsWithRates: number[] = [];
        let totalSkillRate = 0;
        for (let m = 1; m <= 12; m++) {
          const sr = await db.select().from(swrTable).where(
            and(eq(swrTable.skillCategory, empSkill), eq(swrTable.month, m), eq(swrTable.year, year))
          );
          if (sr.length > 0) {
            totalSkillRate += Number(sr[0].dailyRate);
            monthsWithRates.push(m);
          }
        }
        if (monthsWithRates.length > 0) {
          dailyRate = Math.round((totalSkillRate / monthsWithRates.length) * 100) / 100;
        }

        if (existingYears.has(year)) {
          const existing = existingRecords.find(r => r.calendarYear === year)!;
          const enjoyed = Number(existing.leaveEnjoyed || 0);
          const totalLeaveForAmt = leaveEarned + prevLeaveBalance;
          const amtRs = enjoyed > 0
            ? Math.round(dailyRate * enjoyed)
            : Math.round(dailyRate * totalLeaveForAmt);
          await storage.updateLeaveWithWages(existing.id, {
            daysLeaveEarned: String(leaveEarned),
            daysLeaveBroughtForward: String(prevLeaveBalance),
            leaveEarned: String(leaveEarned),
            otherAbsenceDays: String(absences),
            actualDaysWorked: String(actualDaysWorked),
            rateOfWagesRs: String(dailyRate),
            rateOfWagesP: "0",
            amountOfWagesRs: String(amtRs),
            amountOfWagesP: "0",
          });
          const totalLeave = leaveEarned + prevLeaveBalance;
          const wasPaid = existing.dateOfPayment && existing.dateOfPayment.trim() !== "" && existing.dateOfPayment.trim().toUpperCase() !== "NA";
          if (wasPaid) {
            // Leave was encashed/paid — nothing carries forward to next year
            prevLeaveBalance = 0;
          } else {
            // Leave not yet paid — remaining balance carries forward (always integer)
            prevLeaveBalance = Math.floor(Math.max(0, totalLeave - Number(existing.leaveEnjoyed || 0)));
          }
        } else {
          const newTotalLeave = Math.floor(leaveEarned + prevLeaveBalance);
          await storage.createLeaveWithWages({
            employeeId,
            clientName,
            calendarYear: year,
            daysLeaveEarned: String(leaveEarned),
            daysLeaveBroughtForward: String(prevLeaveBalance),
            layOffDays: "0",
            maternityLeaveDays: "0",
            leaveEarned: String(leaveEarned),
            leaveEnjoyed: "0",
            otherAbsenceDays: String(absences),
            actualDaysWorked: String(actualDaysWorked),
            leaveAllowedDate: "NA",
            leaveAllowedDays: "NA",
            rateOfWagesRs: String(dailyRate),
            rateOfWagesP: "0",
            amountOfWagesRs: String(Math.round(dailyRate * newTotalLeave)),
            amountOfWagesP: "0",
            dateOfPayment: "",
            remarks: "",
          });
          prevLeaveBalance = Math.floor(newTotalLeave);
        }
        generated++;
      }

      res.json({ generated, years, message: `Generated/updated ${generated} year(s) of leave records` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leave-with-wages", requireAdmin, async (req, res) => {
    const { insertLeaveWithWagesSchema } = await import("@shared/schema");
    const parsed = insertLeaveWithWagesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const record = await storage.createLeaveWithWages(parsed.data);
    res.status(201).json(record);
  });

  app.put("/api/leave-with-wages/:id", requireAdmin, async (req, res) => {
    const { insertLeaveWithWagesSchema } = await import("@shared/schema");
    const parsed = insertLeaveWithWagesSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const record = await storage.updateLeaveWithWages(Number(req.params.id), parsed.data);
    res.json(record);
  });

  app.delete("/api/leave-with-wages/:id", requireAdmin, async (req, res) => {
    await storage.deleteLeaveWithWages(Number(req.params.id));
    res.status(204).send();
  });

  // === EMPLOYEE WAGE RATES (Year-wise) ===
  app.get("/api/employee-wage-rates", requireAdmin, async (req, res) => {
    const employeeId = Number(req.query.employeeId);
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });
    const rates = await storage.getEmployeeWageRates(employeeId);
    res.json(rates);
  });

  app.get("/api/employee-wage-rates/by-year", requireAdmin, async (req, res) => {
    const employeeId = Number(req.query.employeeId);
    const year = Number(req.query.year);
    if (!employeeId || !year) return res.status(400).json({ error: "employeeId and year required" });
    const rate = await storage.getEmployeeWageRate(employeeId, year);
    res.json(rate || null);
  });

  app.post("/api/employee-wage-rates", requireAdmin, async (req, res) => {
    const { insertEmployeeWageRateSchema } = await import("@shared/schema");
    const parsed = insertEmployeeWageRateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await storage.getEmployeeWageRate(parsed.data.employeeId, parsed.data.calendarYear);
    if (existing) {
      const updated = await storage.updateEmployeeWageRate(existing.id, parsed.data);
      return res.json(updated);
    }
    const rec = await storage.createEmployeeWageRate(parsed.data);
    res.status(201).json(rec);
  });

  app.put("/api/employee-wage-rates/:id", requireAdmin, async (req, res) => {
    const { insertEmployeeWageRateSchema } = await import("@shared/schema");
    const parsed = insertEmployeeWageRateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const rec = await storage.updateEmployeeWageRate(Number(req.params.id), parsed.data);
    res.json(rec);
  });

  app.delete("/api/employee-wage-rates/:id", requireAdmin, async (req, res) => {
    await storage.deleteEmployeeWageRate(Number(req.params.id));
    res.status(204).send();
  });

  // === SKILL WAGE RATES (Month/Year-wise by Skill Category) ===
  app.get("/api/skill-wage-rates", requireAuth, async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const rates = await storage.getSkillWageRates(year);
    res.json(rates);
  });

  app.get("/api/skill-wage-rates/lookup", requireAuth, async (req, res) => {
    const { skillCategory, month, year } = req.query;
    if (!skillCategory || !month || !year) return res.status(400).json({ error: "skillCategory, month, year required" });
    const rate = await storage.getSkillWageRate(String(skillCategory), Number(month), Number(year));
    res.json(rate || null);
  });

  app.post("/api/skill-wage-rates", requireAdmin, async (req, res) => {
    const { insertSkillWageRateSchema } = await import("@shared/schema");
    const parsed = insertSkillWageRateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const rec = await storage.createOrUpdateSkillWageRate(parsed.data);
    res.json(rec);
  });

  app.post("/api/skill-wage-rates/bulk", requireAdmin, async (req, res) => {
    const { rates } = req.body;
    if (!Array.isArray(rates)) return res.status(400).json({ error: "rates array required" });
    const { insertSkillWageRateSchema } = await import("@shared/schema");
    const results = [];
    for (const r of rates) {
      const parsed = insertSkillWageRateSchema.safeParse(r);
      if (!parsed.success) continue;
      const rec = await storage.createOrUpdateSkillWageRate(parsed.data);
      results.push(rec);
    }
    res.json(results);
  });

  app.delete("/api/skill-wage-rates/:id", requireAdmin, async (req, res) => {
    await storage.deleteSkillWageRate(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/half-yearly-returns", requireAuth, async (req, res) => {
    const clientName = req.query.clientName as string | undefined;
    const records = await storage.getHalfYearlyReturns(clientName);
    res.json(records);
  });

  app.get("/api/half-yearly-returns/lookup", requireAuth, async (req, res) => {
    const { clientName, halfYear, year } = req.query;
    if (!clientName || !halfYear || !year) return res.status(400).json({ message: "clientName, halfYear, year required" });
    const record = await storage.getHalfYearlyReturn(clientName as string, halfYear as string, Number(year));
    res.json(record || null);
  });

  app.post("/api/half-yearly-returns", requireAuth, async (req, res) => {
    const record = await storage.saveHalfYearlyReturn(req.body);
    res.json(record);
  });

  app.delete("/api/half-yearly-returns/:id", requireAdmin, async (req, res) => {
    await storage.deleteHalfYearlyReturn(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/bonus-returns/lookup", requireAuth, async (req, res) => {
    const { clientName, fyStartYear } = req.query;
    if (!clientName || !fyStartYear) return res.status(400).json({ message: "clientName and fyStartYear required" });
    const record = await storage.getBonusReturn(clientName as string, Number(fyStartYear));
    res.json(record || null);
  });

  app.post("/api/bonus-returns", requireAuth, async (req, res) => {
    const record = await storage.saveBonusReturn(req.body);
    res.json(record);
  });

  app.delete("/api/bonus-returns/:id", requireAdmin, async (req, res) => {
    await storage.deleteBonusReturn(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/letters", requireAuth, async (req, res) => {
    const allLetters = await storage.getLetters();
    res.json(allLetters);
  });

  app.get("/api/letters/next-serial", requireAuth, async (req, res) => {
    const nextSerial = await storage.getNextLetterSerialNumber();
    res.json({ nextSerial });
  });

  app.get("/api/letters/:id", requireAuth, async (req, res) => {
    const letter = await storage.getLetter(Number(req.params.id));
    if (!letter) return res.status(404).json({ message: "Letter not found" });
    res.json(letter);
  });

  app.post("/api/letters", requireAuth, async (req, res) => {
    const { refNumber, letterDate, toName, toAddress, toGstin, subject, body, regards, clientName } = req.body;
    if (!refNumber || !letterDate) return res.status(400).json({ message: "refNumber and letterDate are required" });
    const letter = await storage.createLetter({ refNumber, letterDate, toName, toAddress, toGstin, subject, body, regards, clientName, createdBy: req.session.displayName || req.session.username || '' });
    res.status(201).json(letter);
  });

  app.put("/api/letters/:id", requireAuth, async (req, res) => {
    const existing = await storage.getLetter(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Letter not found" });
    const { refNumber, letterDate, toName, toAddress, toGstin, subject, body, regards, clientName } = req.body;
    const letter = await storage.updateLetter(Number(req.params.id), { refNumber, letterDate, toName, toAddress, toGstin, subject, body, regards, clientName });
    res.json(letter);
  });

  app.delete("/api/letters/:id", requireAdmin, async (req, res) => {
    await storage.deleteLetter(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const pos = await storage.getPurchaseOrders();
      res.json(pos);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    const po = await storage.getPurchaseOrder(Number(req.params.id));
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    res.json(po);
  });

  app.get("/api/purchase-orders/:id/balance", requireAuth, async (req, res) => {
    try {
      const po = await storage.getPurchaseOrder(Number(req.params.id));
      if (!po) return res.status(404).json({ message: "Purchase order not found" });
      const allInvoices = await storage.getSalesInvoices();
      const linkedInvoices = allInvoices.filter(inv => inv.poId === po.id);
      const usedAmount = linkedInvoices.reduce((sum, inv) => sum + Number(inv.billAmount), 0);
      const balance = Math.round((Number(po.poAmount) - usedAmount) * 100) / 100;
      res.json({ poId: po.id, poAmount: Number(po.poAmount), usedAmount, balance, invoiceCount: linkedInvoices.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const { poNumber, poDate, poAmount, clientName } = req.body;
      if (!poNumber || !poDate || !clientName) {
        return res.status(400).json({ message: "PO Number, PO Date, and Client Name are required" });
      }
      const allPOs = await storage.getPurchaseOrders();
      const duplicate = allPOs.find(p => p.poNumber.trim().toLowerCase() === poNumber.trim().toLowerCase());
      if (duplicate) {
        return res.status(400).json({ message: `PO Number "${poNumber.trim()}" already exists (Client: ${duplicate.clientName})` });
      }
      const po = await storage.createPurchaseOrder({
        poNumber, poDate, poAmount: String(poAmount || 0), clientName,
        createdBy: req.session.displayName || req.session.username || '',
      });
      res.status(201).json(po);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getPurchaseOrder(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Purchase order not found" });
      const { poNumber, poDate, poAmount, clientName } = req.body;
      if (poNumber !== undefined) {
        const allPOs = await storage.getPurchaseOrders();
        const duplicate = allPOs.find(p => p.poNumber.trim().toLowerCase() === poNumber.trim().toLowerCase() && p.id !== existing.id);
        if (duplicate) {
          return res.status(400).json({ message: `PO Number "${poNumber.trim()}" already exists (Client: ${duplicate.clientName})` });
        }
      }
      const po = await storage.updatePurchaseOrder(Number(req.params.id), {
        ...(poNumber !== undefined && { poNumber }),
        ...(poDate !== undefined && { poDate }),
        ...(poAmount !== undefined && { poAmount: String(poAmount) }),
        ...(clientName !== undefined && { clientName }),
      });
      res.json(po);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/purchase-orders/:id", requireAdmin, async (req, res) => {
    try {
      const allInvoices = await storage.getSalesInvoices();
      const linked = allInvoices.filter(inv => inv.poId === Number(req.params.id));
      if (linked.length > 0) {
        return res.status(400).json({ message: `Cannot delete PO — ${linked.length} invoice(s) are linked to it` });
      }
      await storage.deletePurchaseOrder(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sales-invoices/next-bill-number", requirePermission("salesinvoice"), async (req, res) => {
    try {
      const { stateCode, year } = req.query;
      if (!stateCode || !year) return res.status(400).json({ message: "stateCode and year are required" });
      const yy = String(year).slice(-2);
      const prefix = `DJ-${stateCode}-${yy}-`;
      const allInvoices = await storage.getSalesInvoices();
      const matching = allInvoices.filter(inv => inv.billNumber && inv.billNumber.startsWith(prefix));
      let maxSerial = 0;
      matching.forEach(inv => {
        const parts = inv.billNumber.split('-');
        const serial = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(serial) && serial > maxSerial) maxSerial = serial;
      });
      const nextSerial = String(maxSerial + 1).padStart(3, '0');
      res.json({ billNumber: `${prefix}${nextSerial}`, nextSerial: maxSerial + 1 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sales-invoices", requirePermission("salesinvoice"), async (req, res) => {
    try {
      const invoices = await storage.getSalesInvoices();
      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sales-invoices/:id", requirePermission("salesinvoice"), async (req, res) => {
    const invoice = await storage.getSalesInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Sales invoice not found" });
    res.json(invoice);
  });

  app.post("/api/sales-invoices", requirePermission("salesinvoice"), async (req, res) => {
    try {
      const { clientName, billDate, billNumber, billAmount, gstPercent, gstAmount, totalBillAmount, tdsPercent, tdsAmount, paymentReceivedDate, paymentReceivedAmount, utrNo, poId, bypassPO } = req.body;
      if (!clientName || !billDate || !billNumber) {
        return res.status(400).json({ message: "Client name, bill date, and bill number are required" });
      }
      const allInvoices = await storage.getSalesInvoices();
      const duplicateBill = allInvoices.find(inv => inv.billNumber === billNumber.trim());
      if (duplicateBill) {
        return res.status(400).json({ message: `Bill Number "${billNumber.trim()}" already exists (Sl# ${duplicateBill.slNo}, Client: ${duplicateBill.clientName})` });
      }
      if (poId) {
        const po = await storage.getPurchaseOrder(Number(poId));
        if (!po) return res.status(400).json({ message: "Selected PO not found" });
        if (po.clientName !== clientName) {
          return res.status(400).json({ message: "PO does not belong to the selected client" });
        }
        if (!bypassPO) {
          const usedAmount = allInvoices.filter(inv => inv.poId === po.id).reduce((sum, inv) => sum + Number(inv.billAmount), 0);
          const balance = Math.round((Number(po.poAmount) - usedAmount) * 100) / 100;
          if (Number(billAmount) > balance) {
            return res.status(400).json({ message: `Bill Amount (₹${Number(billAmount).toFixed(2)}) exceeds PO remaining balance (₹${balance.toFixed(2)})` });
          }
        }
      }
      const invoice = await storage.createSalesInvoice({
        clientName, billDate, billNumber,
        billAmount: String(billAmount || 0),
        gstPercent: String(gstPercent || 0),
        gstAmount: String(gstAmount || 0),
        totalBillAmount: String(totalBillAmount || 0),
        tdsPercent: String(tdsPercent || 0),
        tdsAmount: String(tdsAmount || 0),
        paymentReceivedDate: paymentReceivedDate || null,
        paymentReceivedAmount: String(paymentReceivedAmount || 0),
        utrNo: utrNo?.trim() || null,
        poId: poId ? Number(poId) : null,
        createdBy: req.session.displayName || req.session.username || '',
      });
      res.status(201).json(invoice);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/sales-invoices/:id", requirePermission("salesinvoice"), async (req, res) => {
    try {
      const existing = await storage.getSalesInvoice(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Sales invoice not found" });
      const { clientName, billDate, billNumber, billAmount, gstPercent, gstAmount, totalBillAmount, tdsPercent, tdsAmount, paymentReceivedDate, paymentReceivedAmount, utrNo, poId, bypassPO } = req.body;
      if (billNumber !== undefined) {
        const allInvForDup = await storage.getSalesInvoices();
        const duplicateBill = allInvForDup.find(inv => inv.billNumber === billNumber.trim() && inv.id !== existing.id);
        if (duplicateBill) {
          return res.status(400).json({ message: `Bill Number "${billNumber.trim()}" already exists (Sl# ${duplicateBill.slNo}, Client: ${duplicateBill.clientName})` });
        }
      }
      const targetPoId = poId !== undefined ? (poId ? Number(poId) : null) : existing.poId;
      const effectiveBillAmount = billAmount !== undefined ? Number(billAmount) : Number(existing.billAmount);
      const effectiveClientName = clientName !== undefined ? clientName : existing.clientName;
      if (targetPoId) {
        const po = await storage.getPurchaseOrder(targetPoId);
        if (!po) return res.status(400).json({ message: "Selected PO not found" });
        if (po.clientName !== effectiveClientName) {
          return res.status(400).json({ message: "PO does not belong to the selected client" });
        }
        if (!bypassPO) {
          const allInvoices = await storage.getSalesInvoices();
          const usedAmount = allInvoices.filter(inv => inv.poId === po.id && inv.id !== existing.id).reduce((sum, inv) => sum + Number(inv.billAmount), 0);
          const balance = Math.round((Number(po.poAmount) - usedAmount) * 100) / 100;
          if (effectiveBillAmount > balance) {
            return res.status(400).json({ message: `Bill Amount (₹${effectiveBillAmount.toFixed(2)}) exceeds PO remaining balance (₹${balance.toFixed(2)})` });
          }
        }
      }
      const invoice = await storage.updateSalesInvoice(Number(req.params.id), {
        ...(clientName !== undefined && { clientName }),
        ...(billDate !== undefined && { billDate }),
        ...(billNumber !== undefined && { billNumber }),
        ...(billAmount !== undefined && { billAmount: String(billAmount) }),
        ...(gstPercent !== undefined && { gstPercent: String(gstPercent) }),
        ...(gstAmount !== undefined && { gstAmount: String(gstAmount) }),
        ...(totalBillAmount !== undefined && { totalBillAmount: String(totalBillAmount) }),
        ...(tdsPercent !== undefined && { tdsPercent: String(tdsPercent) }),
        ...(tdsAmount !== undefined && { tdsAmount: String(tdsAmount) }),
        ...(paymentReceivedDate !== undefined && { paymentReceivedDate: paymentReceivedDate || null }),
        ...(paymentReceivedAmount !== undefined && { paymentReceivedAmount: String(paymentReceivedAmount) }),
        ...(utrNo !== undefined && { utrNo: utrNo?.trim() || null }),
        ...(poId !== undefined && { poId: poId ? Number(poId) : null }),
      });
      res.json(invoice);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/sales-invoices/:id", requireAdmin, async (req, res) => {
    await storage.deleteSalesInvoice(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/pankaj-reports", requireAdmin, async (req, res) => {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || !year) return res.status(400).json({ error: "month and year required" });
    const reports = await storage.getPankajReports(month, year);
    res.json(reports);
  });

  app.post("/api/pankaj-reports", requireAdmin, async (req, res) => {
    try {
      const validated = insertPankajReportSchema.parse(req.body);
      const report = await storage.savePankajReport(validated);
      res.status(201).json(report);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/pankaj-reports/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertPankajReportSchema.partial().parse(req.body);
      const report = await storage.updatePankajReport(Number(req.params.id), validated);
      res.json(report);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/pankaj-reports/:id", requireAdmin, async (req, res) => {
    await storage.deletePankajReport(Number(req.params.id));
    res.status(204).send();
  });

  // === UBL LUNCH ENTRY ROUTES (Format 2) ===
  app.get('/api/ubl-lunch-entries', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const entries = await storage.getUblLunchEntries(month, year);
    res.json(entries);
  });
  app.post('/api/ubl-lunch-entries', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const entry = await storage.createUblLunchEntry(req.body);
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/ubl-lunch-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const entry = await storage.updateUblLunchEntry(Number(req.params.id), req.body);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/ubl-lunch-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteUblLunchEntry(Number(req.params.id));
    res.status(204).send();
  });

  // === UBL DATE ENTRY ROUTES ===
  app.get('/api/ubl-date-entries', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const entries = await storage.getUblDateEntries(month, year);
    res.json(entries);
  });
  app.post('/api/ubl-date-entries', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const entry = await storage.createUblDateEntry(req.body);
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/ubl-date-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const entry = await storage.updateUblDateEntry(Number(req.params.id), req.body);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/ubl-date-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteUblDateEntry(Number(req.params.id));
    res.status(204).send();
  });

  // === CIPLA DATE ENTRY ROUTES ===
  app.get('/api/cipla-date-entries', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const entries = await storage.getCiplaDateEntries(month, year);
    res.json(entries);
  });
  app.post('/api/cipla-date-entries', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const entry = await storage.createCiplaDateEntry(req.body);
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/cipla-date-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const entry = await storage.updateCiplaDateEntry(Number(req.params.id), req.body);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/cipla-date-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteCiplaDateEntry(Number(req.params.id));
    res.status(204).send();
  });

  // Cipla Machine Summary (billing-period totals)
  app.get('/api/cipla-machine-summary', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const data = await storage.getCiplaaMachineSummary(month, year);
    res.json(data || { bfMachine: 0, luMachine: 0, diMachine: 0 });
  });

  app.put('/api/cipla-machine-summary', requirePermission('salesinvoice'), async (req, res) => {
    try {
      const { month, year, bfMachine, luMachine, diMachine } = req.body;
      const data = await storage.upsertCiplaaMachineSummary(Number(month), Number(year), {
        bfMachine: Number(bfMachine) || 0,
        luMachine: Number(luMachine) || 0,
        diMachine: Number(diMachine) || 0,
      });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === UNICHEM SNACK ENTRIES (Form 1) ===
  app.get('/api/unichem-snack-entries', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const location = String(req.query.location || 'Main Plant');
    const entries = await storage.getUnichEmSnackEntries(month, year, location);
    res.json(entries);
  });
  app.post('/api/unichem-snack-entries', requirePermission('salesinvoice'), async (req, res) => {
    try { const entry = await storage.createUnichEmSnackEntry(req.body); res.status(201).json(entry); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/unichem-snack-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    try { const entry = await storage.updateUnichEmSnackEntry(Number(req.params.id), req.body); res.json(entry); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/unichem-snack-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteUnichEmSnackEntry(Number(req.params.id)); res.status(204).send();
  });

  // === UNICHEM LUNCH ENTRIES (Form 2) ===
  app.get('/api/unichem-lunch-entries', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const location = String(req.query.location || 'Main Plant');
    const mealType = req.query.mealType ? String(req.query.mealType) : undefined;
    const entries = await storage.getUnichEmLunchEntries(month, year, location, mealType);
    res.json(entries);
  });
  app.post('/api/unichem-lunch-entries', requirePermission('salesinvoice'), async (req, res) => {
    try { const entry = await storage.createUnichEmLunchEntry(req.body); res.status(201).json(entry); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/unichem-lunch-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    try { const entry = await storage.updateUnichEmLunchEntry(Number(req.params.id), req.body); res.json(entry); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/unichem-lunch-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteUnichEmLunchEntry(Number(req.params.id)); res.status(204).send();
  });

  // === HUL DATE ENTRIES (Hindustan Unilever Limited — KPF / TEC) ===
  app.get('/api/ubl-date-entries/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getUblDateYearlySummary(year));
  });
  app.get('/api/ubl-lunch-entries/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getUblLunchYearlySummary(year));
  });
  app.get('/api/cipla-date-entries/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getCiplaYearlySummary(year));
  });
  app.get('/api/unichem-snack-entries/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getUnichEmSnackYearlySummary(year));
  });
  app.get('/api/unichem-lunch-entries/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getUnichEmLunchYearlySummary(year));
  });
  app.get('/api/hul-date-entries/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const location = String(req.query.location || 'KPF');
    res.json(await storage.getHulYearlySummary(year, location));
  });
  app.get('/api/hul-kpf-exec-snacks/yearly-summary', requirePermission('salesinvoice'), async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getHulExecYearlySummary(year));
  });
  app.get('/api/hul-date-entries', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const location = String(req.query.location || 'KPF');
    const entries = await storage.getHulDateEntries(month, year, location);
    res.json(entries);
  });
  app.post('/api/hul-date-entries', requirePermission('salesinvoice'), async (req, res) => {
    try { const entry = await storage.createHulDateEntry(req.body); res.status(201).json(entry); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/hul-date-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    try { const entry = await storage.updateHulDateEntry(Number(req.params.id), req.body); res.json(entry); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/hul-date-entries/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteHulDateEntry(Number(req.params.id)); res.status(204).send();
  });

  // === HUL KPF EXECUTIVE/MANAGER SNACKS ===
  app.get('/api/hul-kpf-exec-snacks', requirePermission('salesinvoice'), async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(await storage.getHulKpfExecSnacks(month, year));
  });
  app.post('/api/hul-kpf-exec-snacks', requirePermission('salesinvoice'), async (req, res) => {
    try { res.status(201).json(await storage.createHulKpfExecSnack(req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.put('/api/hul-kpf-exec-snacks/:id', requirePermission('salesinvoice'), async (req, res) => {
    try { res.json(await storage.updateHulKpfExecSnack(Number(req.params.id), req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete('/api/hul-kpf-exec-snacks/:id', requirePermission('salesinvoice'), async (req, res) => {
    await storage.deleteHulKpfExecSnack(Number(req.params.id)); res.status(204).send();
  });

  return httpServer;
}

// Helper to seed some initial data
async function seedDatabase() {
  try {
    const { dbReady } = await import("./db");
    await dbReady;
    await storage.seedAdminUser();

    const vegetableNames = [
      "Potato", "Onion", "Tomato", "Green Chilli", "Ginger", "Garlic", 
      "Cabbage", "Cauliflower", "Spinach", "Carrot", "Beans", "Lady Finger",
      "Brinjal", "Capsicum", "Bottle Gourd", "Bitter Gourd"
    ];
    await storage.seedVegetableItems(vegetableNames);

    const defaultClients = [
      "Unichem Laboratories Ltd",
      "Hindustan Unilever Limited",
      "United Breweries Limited",
    ];
    await storage.seedClientNames(defaultClients);
  } catch (err: any) {
    console.error("seedDatabase failed (DB may be temporarily unavailable):", err.message);
  }
}

// Run seeder
setTimeout(seedDatabase, 1000);

