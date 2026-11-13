import type { Express, RequestHandler } from "express";
import { employeeImportSchema } from "@shared/employee-spreadsheet";
import type { IStorage } from "./storage";

type ImportStorage = Pick<IStorage, "getClientNames" | "importEmployees">;

function isDuplicateDatabaseError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if ("code" in current && current.code === "ER_DUP_ENTRY") return true;
    current = current.cause;
  }
  return false;
}

export function registerEmployeeImportRoutes(app: Express, storage: ImportStorage, requireAdmin: RequestHandler) {
  app.post("/api/employees/import", requireAdmin, async (req, res) => {
    const parsed = employeeImportSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return res.status(400).json({ message: `Invalid import at ${first.path.join(".")}: ${first.message}` });
    }
    const rows = parsed.data.employees;
    const codes = new Set<string>();
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const code = row.employeeCode.trim().toLowerCase();
      if (codes.has(code)) return res.status(400).json({ message: `Duplicate employee code in spreadsheet at row ${index + 2}: ${row.employeeCode}` });
      codes.add(code);
    }
    const clients = await storage.getClientNames();
    const clientNames = new Set(clients.map(client => client.name));
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!clientNames.has(row.clientName.trim())) return res.status(400).json({ message: `Unknown client at row ${index + 2}: ${row.clientName}` });
    }
    try {
      await storage.importEmployees(rows);
      res.status(201).json({ imported: rows.length });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message.startsWith("Employee code already exists:") || isDuplicateDatabaseError(error))) {
        return res.status(409).json({ message: error.message.startsWith("Employee code already exists:") ? error.message : "An employee code already exists. No employees were imported." });
      }
      throw error;
    }
  });
}
