import { strict as assert } from "node:assert";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import { employeeColumns, type EmployeeSpreadsheetRow } from "@shared/employee-spreadsheet";
import { registerEmployeeImportRoutes } from "./employee-import-routes";

test("import requires admin, rejects duplicates and unknown clients, and only inserts new batches", async () => {
  const saved = new Set(["existing"]);
  const makeRow = (code: string) => ({
    ...Object.fromEntries(employeeColumns.map(([field]) => [field, ""])),
    employeeCode: code, name: "Employee", clientName: "Client", isActive: "Active",
  }) as EmployeeSpreadsheetRow;
  const storage = {
    async getClientNames() { return [{ id: 1, name: "Client", address: "", gstNo: "", branches: null, stateName: "", stateCode: "", clientCode: "", agreementValidTill: null, attendanceLat: null, attendanceLng: null, attendanceRadius: 200 }]; },
    async importEmployees(rows: EmployeeSpreadsheetRow[]) {
      if (rows.some(row => saved.has(row.employeeCode.toLowerCase()))) throw new Error("Employee code already exists: existing");
      for (const row of rows) saved.add(row.employeeCode.toLowerCase());
    },
  };
  const admin: RequestHandler = (req, res, next) => req.headers["x-role"] === "admin" ? next() : res.sendStatus(403);
  const app = express();
  app.use(express.json());
  registerEmployeeImportRoutes(app, storage, admin);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not start");
  const request = (rows: object[], role = "admin") => fetch(`http://127.0.0.1:${address.port}/api/employees/import`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-role": role }, body: JSON.stringify({ employees: rows }),
  });
  try {
    assert.equal((await request([makeRow("a")], "user")).status, 403);
    assert.equal((await request([makeRow("a"), makeRow(" A ")])).status, 400);
    assert.equal((await request([makeRow("a"), { ...makeRow("b"), clientName: "Unknown" }])).status, 400);
    assert.equal((await request([makeRow("a"), makeRow("existing")])).status, 409);
    assert.equal(saved.has("a"), false);
    const success = await request([makeRow("a"), makeRow("b")]);
    assert.equal(success.status, 201);
    assert.deepEqual(await success.json(), { imported: 2 });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
