import type { Express, RequestHandler } from "express";
import type { Pool, PoolConnection } from "mysql2/promise";
import { z } from "zod";
import {
  addLunch20,
  addLunchDue,
  createCalculatedEntry,
  evaluateEntry,
  MEAL_TYPES,
  normalizeDinerCode,
  settleEntry,
  TP_MEAL_CATALOG,
  type MealEntry,
  type MealType,
  type TpMealCode,
} from "../shared/meal-register";

const legacyUidSchema = z.union([
  z.number().int().safe().nonnegative(),
  z.string().regex(/^\d{1,19}$/).refine((value) =>
    value.length < 19 || value <= "9223372036854775807"),
]).optional();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date");
const codeSchema = z.string().trim().transform(normalizeDinerCode).pipe(z.string().regex(/^[A-Z0-9_-]{1,30}$/));
const mealTypeSchema = z.enum(MEAL_TYPES);
const cashSchema = z.number().finite().min(0).max(100000);
const dinerFields = {
  dinerCode: codeSchema,
  name: z.string().max(255).default(""),
  companyName: z.string().max(255).default(""),
  department: z.string().max(255).default(""),
  designation: z.string().max(255).default(""),
  mobile: z.string().max(20).default(""),
  dinerType: z.string().max(30).default("regular"),
  notes: z.string().max(500).default(""),
  isActive: z.boolean().default(true),
};
const dinerSchema = z.object(dinerFields);
const dinerPatchSchema = z.object({
  dinerCode: codeSchema.optional(),
  name: z.string().max(255).optional(),
  companyName: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  designation: z.string().max(255).optional(),
  mobile: z.string().max(20).optional(),
  dinerType: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);
const entrySchema = z.object({
  date: dateSchema,
  dinerCode: codeSchema,
  mealType: mealTypeSchema,
  cash: cashSchema,
});
const actionSchema = z.object({ action: z.enum(["settle", "add_lunch_20", "add_lunch_due"]) });
const tpEntrySchema = z.object({
  date: dateSchema,
  mealCode: z.enum(Object.keys(TP_MEAL_CATALOG) as [TpMealCode, ...TpMealCode[]]),
  qty: z.number().int().min(1).max(1000),
});

type LegacyEntry = {
  uid?: string | number;
  empId: string;
  empName?: string;
  mealType: MealType;
  morningCash: number;
  lunchCash: number;
  dueSettled?: boolean;
  returnSettled?: boolean;
};
type LegacyTpEntry = { uid?: string | number; code: TpMealCode; qty: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function legacyEntrySchema(value: unknown): LegacyEntry | null {
  if (!isRecord(value)) return null;
  const parsed = z.object({
    uid: legacyUidSchema,
    empId: codeSchema,
    empName: z.string().max(255).optional().default(""),
    mealType: mealTypeSchema,
    morningCash: cashSchema,
    lunchCash: cashSchema,
    dueSettled: z.boolean().optional().default(false),
    returnSettled: z.boolean().optional().default(false),
  }).safeParse(value);
  return parsed.success ? parsed.data as LegacyEntry : null;
}

function legacyTpEntrySchema(value: unknown): LegacyTpEntry | null {
  if (!isRecord(value)) return null;
  const parsed = z.object({
    uid: legacyUidSchema,
    code: z.enum(Object.keys(TP_MEAL_CATALOG) as [TpMealCode, ...TpMealCode[]]),
    qty: z.number().int().min(1).max(1000),
  }).safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mysqlDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function asMealEntry(row: any): MealEntry {
  return {
    dinerCode: row.dinerCode,
    dinerName: row.dinerName,
    mealType: row.mealType as MealType,
    morningCash: Number(row.morningCash),
    lunchCash: Number(row.lunchCash),
    originalDue: Number(row.originalDue),
    originalReturn: Number(row.originalReturn),
    dueSettled: Number(row.dueSettled) === 1,
    returnSettled: Number(row.returnSettled) === 1,
  };
}

function serializeMealEntry(row: any) {
  return {
    ...row,
    morningCash: Number(row.morningCash),
    lunchCash: Number(row.lunchCash),
    originalDue: Number(row.originalDue),
    originalReturn: Number(row.originalReturn),
    dueSettled: Number(row.dueSettled) === 1,
    returnSettled: Number(row.returnSettled) === 1,
  };
}

export function registerMealRegisterRoutes(
  app: Express,
  pool: Pool,
  requirePermission: (permission: string) => RequestHandler,
  requireAdmin: RequestHandler,
) {
  const permission = requirePermission("meal_register");
  const clientScope: RequestHandler = async (req, res, next) => {
    const requestedClient = req.session.role === "admin"
      ? req.query.clientName ?? req.body?.clientName
      : req.session.clientName;
    const clientName = typeof requestedClient === "string" ? requestedClient.trim() : "";
    if (!clientName) {
      return res.status(req.session.role === "admin" ? 400 : 403).json({
        message: req.session.role === "admin"
          ? "Select a client"
          : "Your account has no assigned client. Ask an administrator to assign one.",
      });
    }
    try {
      const [clients]: any = await pool.query(
        "SELECT id FROM client_names WHERE name = ? LIMIT 1",
        [clientName],
      );
      if (!clients.length) return res.status(400).json({ message: "Invalid client" });
      res.locals.mealRegisterClientName = clientName;
      next();
    } catch (error) {
      console.error("Canteen register client scope validation failed", error);
      res.status(500).json({ message: "Could not validate selected client" });
    }
  };

  app.get("/api/meal-diners", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const query = z.object({
      search: z.string().max(255).optional(),
      active: z.enum(["true", "false", "all"]).optional(),
    }).safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Invalid search or active filter" });
    try {
      const where = ["client_name = ?"];
      const params: unknown[] = [clientName];
      if (query.data.active !== "all") {
        where.push("is_active = ?");
        params.push(query.data.active === "false" ? 0 : 1);
      }
      if (query.data.search?.trim()) {
        where.push("(diner_code LIKE ? OR name LIKE ? OR company_name LIKE ? OR department LIKE ?)");
        const search = `%${query.data.search.trim()}%`;
        params.push(search, search, search, search);
      }
      const [rows]: any = await pool.query(
        `SELECT id, diner_code AS dinerCode, name, company_name AS companyName, department,
          designation, mobile, diner_type AS dinerType, notes, is_active AS isActive
         FROM meal_diners WHERE ${where.join(" AND ")} ORDER BY name, diner_code`,
        params,
      );
      res.json(rows);
    } catch (error) {
      console.error("GET /api/meal-diners failed", error);
      res.status(500).json({ message: "Could not load canteen diners" });
    }
  });

  app.post("/api/meal-diners", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const parsed = dinerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid diner details" });
    const diner = parsed.data;
    try {
      const [result]: any = await pool.query(
        `INSERT INTO meal_diners
          (client_name, diner_code, name, company_name, department, designation, mobile, diner_type, notes, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientName, diner.dinerCode, diner.name.trim(), diner.companyName.trim(), diner.department.trim(),
          diner.designation.trim(), diner.mobile.trim(), diner.dinerType.trim(), diner.notes.trim(),
          diner.isActive ? 1 : 0, req.session.userId ?? null],
      );
      res.status(201).json({ id: result.insertId });
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Diner code already exists" });
      console.error("POST /api/meal-diners failed", error);
      res.status(500).json({ message: "Could not save diner" });
    }
  });

  app.patch("/api/meal-diners/:id", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid diner ID" });
    const parsed = dinerPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid diner details" });
    const columns: Record<string, string> = {
      dinerCode: "diner_code", name: "name", companyName: "company_name", department: "department",
      designation: "designation", mobile: "mobile", dinerType: "diner_type", notes: "notes", isActive: "is_active",
    };
    const updates = Object.entries(parsed.data).map(([key, value]) => `${columns[key]} = ?`);
    const values = Object.entries(parsed.data).map(([key, value]) =>
      key === "isActive" ? (value ? 1 : 0) : typeof value === "string" ? value.trim() : value);
    try {
      const [result]: any = await pool.query(
        `UPDATE meal_diners SET ${updates.join(", ")} WHERE id = ? AND client_name = ?`,
        [...values, id, clientName],
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Diner not found" });
      res.json({ ok: true });
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Diner code already exists" });
      console.error("PATCH /api/meal-diners failed", error);
      res.status(500).json({ message: "Could not update diner" });
    }
  });

  app.delete("/api/meal-diners/:id", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid diner ID" });
    try {
      const [diners]: any = await pool.query(
        "SELECT diner_code AS dinerCode FROM meal_diners WHERE id = ? AND client_name = ?",
        [id, clientName],
      );
      if (!diners.length) return res.status(404).json({ message: "Diner not found" });
      const [entries]: any = await pool.query(
        "SELECT id FROM meal_register_entries WHERE client_name = ? AND diner_code = ? LIMIT 1",
        [clientName, diners[0].dinerCode],
      );
      if (entries.length) {
        await pool.query("UPDATE meal_diners SET is_active = 0 WHERE id = ? AND client_name = ?", [id, clientName]);
      } else {
        await pool.query("DELETE FROM meal_diners WHERE id = ? AND client_name = ?", [id, clientName]);
      }
      res.json({ ok: true, deactivated: entries.length > 0 });
    } catch (error) {
      console.error("DELETE /api/meal-diners failed", error);
      res.status(500).json({ message: "Could not delete diner" });
    }
  });

  app.post("/api/meal-diners/bulk", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const input = z.object({ lines: z.string().max(1_000_000) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid bulk diner list" });
    const counts = { created: 0, updated: 0, skipped: 0 };
    let connection: PoolConnection | undefined;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      for (const line of input.data.lines.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const [rawCode, name = "", companyName = "", department = "", mobile = ""] = line.split(",");
        const code = codeSchema.safeParse(rawCode);
        const fields = [name, companyName, department, mobile];
        if (!code.success || fields.some((value, index) => value.length > [255, 255, 255, 20][index])) {
          counts.skipped++;
          continue;
        }
        const [existing]: any = await connection.query(
          "SELECT id FROM meal_diners WHERE client_name = ? AND diner_code = ? LIMIT 1",
          [clientName, code.data],
        );
        if (existing.length) {
          await connection.query(
            `UPDATE meal_diners SET name = ?, company_name = ?, department = ?, mobile = ?
             WHERE id = ? AND client_name = ?`,
            [name.trim(), companyName.trim(), department.trim(), mobile.trim(), existing[0].id, clientName],
          );
          counts.updated++;
        } else {
          await connection.query(
            `INSERT INTO meal_diners (client_name, diner_code, name, company_name, department, mobile, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [clientName, code.data, name.trim(), companyName.trim(), department.trim(), mobile.trim(), req.session.userId ?? null],
          );
          counts.created++;
        }
      }
      await connection.commit();
      res.json(counts);
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("POST /api/meal-diners/bulk failed", error);
      res.status(500).json({ message: "Could not import diners" });
    } finally {
      connection?.release();
    }
  });

  app.get("/api/meal-register", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const parsedDate = dateSchema.safeParse(req.query.date);
    if (!parsedDate.success) return res.status(400).json({ message: "A valid date is required" });
    try {
      const [entries]: any = await pool.query(
        `SELECT id, DATE_FORMAT(entry_date, '%Y-%m-%d') AS date, diner_code AS dinerCode,
          diner_name AS dinerName, meal_type AS mealType, morning_cash AS morningCash,
          lunch_cash AS lunchCash, original_due AS originalDue, original_return AS originalReturn,
          due_settled AS dueSettled, return_settled AS returnSettled
         FROM meal_register_entries WHERE client_name = ? AND entry_date = ? ORDER BY id DESC`,
        [clientName, parsedDate.data],
      );
      const [tpEntries]: any = await pool.query(
        `SELECT id, DATE_FORMAT(entry_date, '%Y-%m-%d') AS date, meal_code AS mealCode,
          qty, unit_price AS unitPrice, total_amount AS totalAmount
         FROM meal_register_tp_entries WHERE client_name = ? AND entry_date = ? ORDER BY id DESC`,
        [clientName, parsedDate.data],
      );
      res.json({
        entries: entries.map(serializeMealEntry),
        tpEntries: tpEntries.map((entry: any) => ({
          ...entry,
          qty: Number(entry.qty),
          unitPrice: Number(entry.unitPrice),
          totalAmount: Number(entry.totalAmount),
        })),
      });
    } catch (error) {
      console.error("GET /api/meal-register failed", error);
      res.status(500).json({ message: "Could not load meal register" });
    }
  });

  app.post("/api/meal-register/entries", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid meal entry" });
    const input = parsed.data;
    try {
      const [diners]: any = await pool.query(
        "SELECT name FROM meal_diners WHERE client_name = ? AND diner_code = ? AND is_active = 1 LIMIT 1",
        [clientName, input.dinerCode],
      );
      if (!diners.length) return res.status(404).json({ message: "Active diner not found" });
      const [existing]: any = await pool.query(
        `SELECT id, DATE_FORMAT(entry_date, '%Y-%m-%d') AS date, diner_code AS dinerCode,
          diner_name AS dinerName, meal_type AS mealType, morning_cash AS morningCash,
          lunch_cash AS lunchCash, original_due AS originalDue, original_return AS originalReturn,
          due_settled AS dueSettled, return_settled AS returnSettled
         FROM meal_register_entries WHERE client_name = ? AND entry_date = ? AND diner_code = ? LIMIT 1`,
        [clientName, input.date, input.dinerCode],
      );
      if (existing.length) return res.status(409).json({ message: "Diner already added for this date", entry: serializeMealEntry(existing[0]) });
      const entry = createCalculatedEntry(input.dinerCode, diners[0].name, input.mealType, input.cash);
      const [result]: any = await pool.query(
        `INSERT INTO meal_register_entries
          (client_name, entry_date, diner_code, diner_name, meal_type, morning_cash, lunch_cash,
           original_due, original_return, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientName, input.date, entry.dinerCode, entry.dinerName, entry.mealType, entry.morningCash,
          entry.lunchCash, entry.originalDue, entry.originalReturn, req.session.userId ?? null],
      );
      res.status(201).json({ id: result.insertId, date: input.date, ...entry });
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        const [existing]: any = await pool.query(
          `SELECT id, DATE_FORMAT(entry_date, '%Y-%m-%d') AS date, diner_code AS dinerCode,
            diner_name AS dinerName, meal_type AS mealType, morning_cash AS morningCash,
            lunch_cash AS lunchCash, original_due AS originalDue, original_return AS originalReturn,
            due_settled AS dueSettled, return_settled AS returnSettled
           FROM meal_register_entries WHERE client_name = ? AND entry_date = ? AND diner_code = ? LIMIT 1`,
          [clientName, input.date, input.dinerCode],
        );
        if (existing.length) return res.status(409).json({ message: "Diner already added for this date", entry: serializeMealEntry(existing[0]) });
      }
      console.error("POST /api/meal-register/entries failed", error);
      res.status(500).json({ message: "Could not save meal entry" });
    }
  });

  app.patch("/api/meal-register/entries/:id/action", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid entry ID" });
    const input = actionSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid entry action" });
    try {
      const [rows]: any = await pool.query(
        `SELECT id, diner_code AS dinerCode, diner_name AS dinerName, meal_type AS mealType,
          morning_cash AS morningCash, lunch_cash AS lunchCash, original_due AS originalDue,
          original_return AS originalReturn, due_settled AS dueSettled, return_settled AS returnSettled
         FROM meal_register_entries WHERE id = ? AND client_name = ? LIMIT 1`,
        [id, clientName],
      );
      if (!rows.length) return res.status(404).json({ message: "Meal entry not found" });
      const current = asMealEntry(rows[0]);
      const updated = input.data.action === "settle" ? settleEntry(current)
        : input.data.action === "add_lunch_20" ? addLunch20(current)
          : addLunchDue(current);
      await pool.query(
        `UPDATE meal_register_entries SET meal_type = ?, morning_cash = ?, lunch_cash = ?,
          original_due = ?, original_return = ?, due_settled = ?, return_settled = ?
         WHERE id = ? AND client_name = ?`,
        [updated.mealType, updated.morningCash, updated.lunchCash, updated.originalDue,
          updated.originalReturn, updated.dueSettled ? 1 : 0, updated.returnSettled ? 1 : 0, id, clientName],
      );
      res.json({ id, ...updated, evaluation: evaluateEntry(updated) });
    } catch (error) {
      console.error("PATCH /api/meal-register/entries action failed", error);
      res.status(500).json({ message: "Could not update meal entry" });
    }
  });

  app.delete("/api/meal-register/entries/:id", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid entry ID" });
    try {
      const [result]: any = await pool.query(
        "DELETE FROM meal_register_entries WHERE id = ? AND client_name = ?",
        [id, clientName],
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Meal entry not found" });
      res.status(204).send();
    } catch (error) {
      console.error("DELETE /api/meal-register/entries failed", error);
      res.status(500).json({ message: "Could not delete meal entry" });
    }
  });

  app.post("/api/meal-register/tp-entries", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const parsed = tpEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid third-party meal entry" });
    const input = parsed.data;
    const meal = TP_MEAL_CATALOG[input.mealCode];
    const weekday = new Date(`${input.date}T00:00:00.000Z`).getUTCDay();
    if (!(meal.days as readonly number[]).includes(weekday)) return res.status(400).json({ message: "This meal is not available on the selected weekday" });
    const total = meal.price * input.qty;
    try {
      const [result]: any = await pool.query(
        `INSERT INTO meal_register_tp_entries
          (client_name, entry_date, meal_code, qty, unit_price, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [clientName, input.date, meal.code, input.qty, meal.price, total, req.session.userId ?? null],
      );
      res.status(201).json({ id: result.insertId, date: input.date, mealCode: meal.code, qty: input.qty, unitPrice: meal.price, totalAmount: total });
    } catch (error) {
      console.error("POST /api/meal-register/tp-entries failed", error);
      res.status(500).json({ message: "Could not save third-party meal" });
    }
  });

  app.delete("/api/meal-register/tp-entries", permission, requireAdmin, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const parsedDate = dateSchema.safeParse(req.query.date);
    if (!parsedDate.success) return res.status(400).json({ message: "A valid date is required" });
    try {
      await pool.query(
        "DELETE FROM meal_register_tp_entries WHERE client_name = ? AND entry_date = ?",
        [clientName, parsedDate.data],
      );
      res.status(204).send();
    } catch (error) {
      console.error("DELETE /api/meal-register/tp-entries failed", error);
      res.status(500).json({ message: "Could not clear third-party entries" });
    }
  });

  app.delete("/api/meal-register/tp-entries/:id", permission, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid entry ID" });
    try {
      const [result]: any = await pool.query(
        "DELETE FROM meal_register_tp_entries WHERE id = ? AND client_name = ?",
        [id, clientName],
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Third-party entry not found" });
      res.status(204).send();
    } catch (error) {
      console.error("DELETE /api/meal-register/tp-entries/:id failed", error);
      res.status(500).json({ message: "Could not delete third-party entry" });
    }
  });

  app.post("/api/meal-register/import-legacy", permission, requireAdmin, clientScope, async (req, res) => {
    const clientName = res.locals.mealRegisterClientName as string;
    const payload = req.body;
    if (!isRecord(payload) || payload.app !== "CanteenSmartRegister" ||
      !isRecord(payload.employeeDb) || !isRecord(payload.permDailyMap) || !isRecord(payload.tpDailyMap)) {
      return res.status(400).json({ message: "Invalid old register backup" });
    }
    const diners: Array<{ code: string; name: string }> = [];
    for (const [rawCode, value] of Object.entries(payload.employeeDb)) {
      const code = codeSchema.safeParse(rawCode);
      const name = typeof value === "string" ? value : isRecord(value) ? value.name : "";
      if (!code.success || typeof name !== "string" || name.length > 255) {
        return res.status(400).json({ message: "Invalid old register backup" });
      }
      diners.push({ code: code.data, name });
    }
    const permDays: Array<{ date: string; entries: LegacyEntry[] }> = [];
    const tpDays: Array<{ date: string; entries: LegacyTpEntry[] }> = [];
    let totalRows = diners.length;
    for (const [date, items] of Object.entries(payload.permDailyMap)) {
      if (!dateSchema.safeParse(date).success || !Array.isArray(items)) return res.status(400).json({ message: "Invalid old register backup" });
      const entries = items.map(legacyEntrySchema);
      if (entries.some((entry) => entry === null)) return res.status(400).json({ message: "Invalid old register backup" });
      permDays.push({ date, entries: entries as LegacyEntry[] });
      totalRows += entries.length;
    }
    for (const [date, items] of Object.entries(payload.tpDailyMap)) {
      if (!dateSchema.safeParse(date).success || !Array.isArray(items)) return res.status(400).json({ message: "Invalid old register backup" });
      const entries = items.map(legacyTpEntrySchema);
      if (entries.some((entry) => entry === null)) return res.status(400).json({ message: "Invalid old register backup" });
      tpDays.push({ date, entries: entries as LegacyTpEntry[] });
      totalRows += entries.length;
    }
    if (totalRows > 20000) return res.status(400).json({ message: "Backup contains too many records" });

    const counts = {
      diners: { created: 0, updated: 0, skipped: 0 },
      entries: { imported: 0, skipped: 0 },
      tpEntries: { imported: 0, skipped: 0 },
    };
    let connection: PoolConnection | undefined;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      for (const diner of diners) {
        const [existing]: any = await connection.query(
          "SELECT id FROM meal_diners WHERE client_name = ? AND diner_code = ? LIMIT 1",
          [clientName, diner.code],
        );
        if (existing.length) {
          if (diner.name.trim()) {
            await connection.query(
              "UPDATE meal_diners SET name = ? WHERE id = ? AND client_name = ?",
              [diner.name.trim(), existing[0].id, clientName],
            );
            counts.diners.updated++;
          } else counts.diners.skipped++;
        } else {
          await connection.query(
            "INSERT INTO meal_diners (client_name, diner_code, name, created_by) VALUES (?, ?, ?, ?)",
            [clientName, diner.code, diner.name.trim(), req.session.userId ?? null],
          );
          counts.diners.created++;
        }
      }
      for (const day of permDays) {
        for (const legacy of day.entries) {
          const [existing]: any = await connection.query(
            "SELECT id FROM meal_register_entries WHERE client_name = ? AND entry_date = ? AND diner_code = ? LIMIT 1",
            [clientName, day.date, legacy.empId],
          );
          if (existing.length) {
            counts.entries.skipped++;
            continue;
          }
          const entry = createCalculatedEntry(
            legacy.empId, legacy.empName || "", legacy.mealType,
            Number(legacy.morningCash) + Number(legacy.lunchCash),
          );
          await connection.query(
            `INSERT INTO meal_register_entries
              (client_name, entry_date, diner_code, diner_name, meal_type, morning_cash, lunch_cash,
               original_due, original_return, due_settled, return_settled, legacy_uid, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientName, day.date, entry.dinerCode, entry.dinerName, entry.mealType,
              legacy.morningCash, legacy.lunchCash, entry.originalDue, entry.originalReturn,
              legacy.dueSettled ? 1 : 0, legacy.returnSettled ? 1 : 0,
              legacy.uid === undefined ? null : String(legacy.uid), req.session.userId ?? null],
          );
          counts.entries.imported++;
        }
      }
      for (const day of tpDays) {
        for (const legacy of day.entries) {
          const meal = TP_MEAL_CATALOG[legacy.code];
          const total = meal.price * legacy.qty;
          if (legacy.uid !== undefined) {
            const [existing]: any = await connection.query(
              "SELECT id FROM meal_register_tp_entries WHERE client_name = ? AND entry_date = ? AND legacy_uid = ? LIMIT 1",
              [clientName, day.date, String(legacy.uid)],
            );
            if (existing.length) {
              counts.tpEntries.skipped++;
              continue;
            }
          }
          await connection.query(
            `INSERT INTO meal_register_tp_entries
              (client_name, entry_date, meal_code, qty, unit_price, total_amount, legacy_uid, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientName, day.date, legacy.code, legacy.qty, meal.price, total,
              legacy.uid === undefined ? null : String(legacy.uid), req.session.userId ?? null],
          );
          counts.tpEntries.imported++;
        }
      }
      await connection.commit();
      res.json(counts);
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("POST /api/meal-register/import-legacy failed", error);
      res.status(500).json({ message: "Could not import old register backup" });
    } finally {
      connection?.release();
    }
  });
}
