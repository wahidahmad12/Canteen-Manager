
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";

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
      res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, clientName: user.clientName, permissions: user.permissions });
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
    });
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
      res.status(201).json(seal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
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
    if (monthsParam) {
      const monthsList = (monthsParam as string).split(',').map(Number);
      const allRecords = [];
      for (const m of monthsList) {
        const records = await storage.getSalaryRecords(clientName as string, m, Number(year));
        allRecords.push(...records);
      }
      return res.json(allRecords);
    }
    if (!month) return res.status(400).json({ message: "month required" });
    const records = await storage.getSalaryRecords(clientName as string, Number(month), Number(year));
    res.json(records);
  });

  app.get("/api/salary/:id", requireAuth, async (req, res) => {
    const record = await storage.getSalaryRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ message: "Salary record not found" });
    res.json(record);
  });

  app.post("/api/salary/generate", requireAdmin, async (req, res) => {
    const { clientName, month, year } = req.body;
    if (!clientName || !month || !year) return res.status(400).json({ message: "clientName, month, year required" });
    const records = await storage.generateSalary(clientName, Number(month), Number(year));
    res.json(records);
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

  app.delete("/api/overtime/:id", requireAdmin, async (req, res) => {
    await storage.deleteOvertimeRecord(Number(req.params.id));
    res.status(204).send();
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

  app.delete("/api/damage-deductions/:id", requireAdmin, async (req, res) => {
    await storage.deleteDamageDeduction(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}

// Helper to seed some initial data
async function seedDatabase() {
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
}

// Run seeder
setTimeout(seedDatabase, 1000);

