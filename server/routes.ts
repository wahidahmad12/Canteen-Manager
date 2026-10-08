import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { pool, db } from "./db";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { 
  insertPankajReportSchema, 
  insertTaxInvoiceSchema, 
  insertTaxInvoiceItemSchema,
  employeeNominations, 
  nominationNominees, 
  employees,
  canteenSales,
  dailyReports 
} from "@shared/schema";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { eq, desc } from "drizzle-orm";

const webauthnRegChallenges = new Map<number, string>();
const webauthnAuthChallenges = new Map<number, string>();

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

function isPastMonth(month: number, year: number): boolean {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  return year < curY || (year === curY && month < curM);
}

function isCurrentMonth(month: number, year: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function monthYearFromEntryDate(entryDate: unknown): { month: number; year: number } {
  const parts = String(entryDate ?? "").split("-");
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

function pecPastMonthBlocked(req: Request, month: number, year: number): boolean {
  if (req.session.role === "admin") return false;
  if (!Number.isFinite(month) || !Number.isFinite(year)) return false;
  return isPastMonth(month, year);
}

function effectiveClientName(req: Request, supplied: string | undefined): string | undefined | false {
  if (req.session.role === "admin") return supplied;
  const sessionClient = req.session.clientName;
  if (!sessionClient) return false;
  return sessionClient;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- CANTEEN POS APIs ---
  app.post('/api/save-sales', async (req: any, res: any) => {
      try {
          const data = req.body;
          const today = new Date().toISOString().split('T')[0]; 
          
          await db.insert(canteenSales).values({
              recordDate: today,
              bfCount: data.bfCount, bfAmt: data.bfAmt,
              luVeg: data.luVeg, luNonVeg: data.luNonVeg, luAmt: data.luAmt,
              evVeg: data.evVeg, evNonVeg: data.evNonVeg, evAmt: data.evAmt,
              niCount: data.niCount, niAmt: data.niAmt,
              grandTotal: data.grandTotal, totalRevenue: data.totalRevenue
          }).onDuplicateKeyUpdate({ set: {
              bfCount: data.bfCount, bfAmt: data.bfAmt,
              luVeg: data.luVeg, luNonVeg: data.luNonVeg, luAmt: data.luAmt,
              evVeg: data.evVeg, evNonVeg: data.evNonVeg, evAmt: data.evAmt,
              niCount: data.niCount, niAmt: data.niAmt,
              grandTotal: data.grandTotal, totalRevenue: data.totalRevenue
          }});
          
          res.status(200).json({ success: true, message: "Data Saved to Database!" });
      } catch (error: any) {
          res.status(500).json({ success: false, error: error.message });
      }
  });

  app.get('/api/get-report', async (req: any, res: any) => {
      try {
          const queryDate = req.query.date; 
          const record = await db.select().from(canteenSales).where(eq(canteenSales.recordDate, queryDate));
          if (record.length > 0) {
              res.status(200).json(record[0]);
          } else {
              res.status(404).json({ message: "Data not found for this date." });
          }
      } catch (error: any) {
          res.status(500).json({ success: false, error: error.message });
      }
  });

  // --- AUTH APIs ---
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });
      if (!user.isActive) return res.status(401).json({ message: "Account is disabled" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid username or password" });
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.clientName = user.clientName;
      req.session.displayName = user.displayName;
      req.session.permissions = user.permissions;
      req.session.employeeId = user.employeeId;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, clientName: user.clientName, permissions: user.permissions, employeeId: user.employeeId });
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
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
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
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

  // --- WEBAUTHN (Fingerprint) APIs ---
  const bufToStr = (v: any): string => Buffer.isBuffer(v) ? v.toString('utf8') : String(v);

  app.post("/api/auth/webauthn/login/challenge", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ message: "Username is required" });
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) return res.status(400).json({ message: "User not found or disabled" });
      if (!user.employeeId) return res.status(400).json({ message: "No fingerprint linked to this account" });
      const creds = await storage.getEmployeeWebAuthnCredentials(Number(user.employeeId));
      if (!creds.length) return res.status(400).json({ message: "No fingerprint registered. Ask admin to enrol your fingerprint first." });
      
      const rpID = req.hostname;
      const options = await generateAuthenticationOptions({
        rpID,
        timeout: 60000,
        allowCredentials: creds.map((c: any) => ({
          id: bufToStr(c.credential_id),
          type: "public-key" as const,
          transports: JSON.parse(bufToStr(c.transports || "[]")),
        })),
        userVerification: "required",
      });
      webauthnAuthChallenges.set(Number(user.employeeId), options.challenge);
      res.json(options);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/auth/webauthn/login/verify", async (req, res) => {
    try {
      const { username, authenticationResponse } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || !user.employeeId) return res.status(400).json({ message: "User not found" });
      const challenge = webauthnAuthChallenges.get(Number(user.employeeId));
      if (!challenge) return res.status(400).json({ message: "No challenge found. Please try again." });

      const rpID = req.hostname;
      const origin = (req.headers.origin as string) || `https://${rpID}`;
      const creds = await storage.getEmployeeWebAuthnCredentials(Number(user.employeeId));
      const cred = creds.find((c: any) => bufToStr(c.credential_id) === authenticationResponse.id);
      if (!cred) return res.status(400).json({ message: "Credential not found for this device" });

      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: bufToStr(cred.credential_id),
          publicKey: isoBase64URL.toBuffer(bufToStr(cred.public_key)),
          counter: Number(cred.counter),
          transports: JSON.parse(bufToStr(cred.transports || "[]")),
        },
      });

      if (!verification.verified) return res.status(400).json({ message: "Fingerprint verification failed" });
      await storage.updateWebAuthnCounter(bufToStr(cred.credential_id), verification.authenticationInfo.newCounter);
      webauthnAuthChallenges.delete(Number(user.employeeId));

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.clientName = user.clientName;
      req.session.displayName = user.displayName;
      req.session.permissions = user.permissions;
      req.session.employeeId = user.employeeId;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session save failed" });
        res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, clientName: user.clientName });
      });
    } catch (err: any) { res.status(400).json({ message: err.message || "Authentication failed" }); }
  });

  // --- USERS ADMIN APIs ---
  app.get(api.users.list.path, requireAdmin, async (req, res) => {
    res.json(await storage.getUsers());
  });

  app.post(api.users.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      res.status(201).json(await storage.createUser(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
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
      res.json(await storage.updateUser(id, input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.users.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    res.status(204).send();
  });

  // ==========================================
  // EMPLOYEE MASTER APIs (THE FIX IS HERE)
  // ==========================================

  // 1. GET ALL EMPLOYEES (Fixed to show data correctly)
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const clientName = req.query.clientName as string | undefined;
      // Fetch employees logic via storage
      const employeesData = await storage.getEmployees(clientName);
      res.json(employeesData);
    } catch (err: any) {
      console.error("GET /api/employees Error:", err);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // 2. GET SINGLE EMPLOYEE
  app.get("/api/employees/:id", requireAdmin, async (req, res) => {
    const emp = await storage.getEmployee(Number(req.params.id));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    res.json(emp);
  });

  // 3. CREATE EMPLOYEE
  app.post("/api/employees", requireAdmin, async (req, res) => {
    try {
      const emp = await storage.createEmployee(req.body);
      res.status(201).json(emp);
    } catch (err: any) {
      if (err.code === '23505') return res.status(400).json({ message: "Employee code already exists" });
      throw err;
    }
  });

  // 4. UPDATE EMPLOYEE
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

  // 5. DELETE EMPLOYEE
  app.delete("/api/employees/:id", requireAdmin, async (req, res) => {
    await storage.deleteEmployee(Number(req.params.id));
    res.status(204).send();
  });


  // ==========================================
  // NOMINATIONS FORMS APIs
  // ==========================================
  app.get("/api/nominations", requireAuth, async (req, res) => {
    try {
      const { formType, employeeId } = req.query;
      const results = await db.select().from(employeeNominations);
      
      let filtered = results;
      if (formType) filtered = filtered.filter(r => r.formType === formType);
      if (employeeId) filtered = filtered.filter(r => r.employeeId === Number(employeeId));
      
      const mappedResults = filtered.map(nom => ({
          nomination: nom,
          employee: null 
      }));

      res.json(mappedResults);
    } catch (error) {
      res.status(500).json({ message: "Error fetching nominations" });
    }
  });

  app.get("/api/nominations/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const results = await db.select().from(employeeNominations).where(eq(employeeNominations.id, id));
      
      if (!results || results.length === 0) return res.status(404).json({ message: "Nomination nahi mila" });
      
      const nomination = results[0];
      const nominees = await db.select().from(nominationNominees).where(eq(nominationNominees.nominationId, id));

      res.json({ nomination, employee: null, nominees });
    } catch (error) {
      res.status(500).json({ message: "Error fetching nomination details" });
    }
  });

  app.post("/api/nominations", requireAuth, async (req, res) => {
    try {
      const { nomination, nominees } = req.body;
      if (!nomination || !nomination.employeeId) return res.status(400).json({ message: "Missing required data" });

      const [insertedNomination] = await db.insert(employeeNominations).values(nomination);
      const nominationId = insertedNomination.insertId;

      if (nominees && Array.isArray(nominees) && nominees.length > 0) {
        const nomineesData = nominees.map((n: any) => ({
          ...n,
          nominationId: nominationId,
          sharePercentage: String(n.sharePercentage) 
        }));
        await db.insert(nominationNominees).values(nomineesData);
      }
      res.status(201).json({ id: nominationId, message: "Nomination successfully saved" });
    } catch (error) {
      res.status(500).json({ message: "Nomination create error" });
    }
  });

  app.delete("/api/nominations/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(nominationNominees).where(eq(nominationNominees.nominationId, id));
      await db.delete(employeeNominations).where(eq(employeeNominations.id, id));
      res.json({ message: "Successfully deleted" });
    } catch (error) {
      res.status(500).json({ message: "Delete error" });
    }
  });

  // ==========================================
  // CLIENTS APIs
  // ==========================================
  app.get(api.clients.list.path, requireAuth, async (req, res) => {
    res.json(await storage.getClientNames());
  });

  app.post(api.clients.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      res.status(201).json(await storage.createClientName(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.clients.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.clients.update.input.parse(req.body);
      res.json(await storage.updateClientName(Number(req.params.id), input));
    } catch (err: any) {
      if (err.message === "Client not found") return res.status(404).json({ message: "Client not found" });
      throw err;
    }
  });

  app.delete(api.clients.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteClientName(Number(req.params.id));
    res.status(204).send();
  });

  // ==========================================
  // REPORTS APIs
  // ==========================================
  app.get(api.reports.list.path, requireAuth, async (req, res) => {
    res.json(await storage.getReports());
  });

  app.get(api.reports.get.path, requireAuth, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  });

  app.post(api.reports.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.reports.create.input.parse(req.body);
      res.status(201).json(await storage.createReport(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.reports.update.path, requireAuth, async (req, res) => {
    try {
      const input = api.reports.update.input.parse(req.body);
      res.json(await storage.updateReport(Number(req.params.id), input));
    } catch (err: any) {
      if (err.message === "Report not found") return res.status(404).json({ message: "Report not found" });
      throw err;
    }
  });

  app.delete(api.reports.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteReport(Number(req.params.id));
    res.status(204).send();
  });

  // ==========================================
  // OTHER GENERAL APIs (Vegetables, Cash Seals, Inventory)
  // ==========================================
  app.get(api.vegetables.list.path, requireAuth, async (req, res) => {
    res.json(await storage.getVegetableItems());
  });

  app.post(api.vegetables.create.path, requireAdmin, async (req, res) => {
    const input = api.vegetables.create.input.parse(req.body);
    res.status(201).json(await storage.createVegetableItem(input));
  });

  app.delete(api.vegetables.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteVegetableItem(Number(req.params.id));
    res.status(204).send();
  });

  app.get(api.cashSeals.list.path, requireAuth, async (req, res) => {
    res.json(await storage.getCashSeals());
  });

  app.get(api.inventory.list.path, requireAuth, async (req, res) => {
    res.json(await storage.getInventories());
  });

  app.post(api.inventory.create.path, requireAuth, async (req, res) => {
    const input = api.inventory.create.input.parse(req.body);
    res.status(201).json(await storage.createInventory(input));
  });

  app.delete(api.inventory.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteInventory(Number(req.params.id));
    res.status(204).send();
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
