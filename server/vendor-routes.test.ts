import { strict as assert } from "node:assert";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import { registerVendorRoutes } from "./vendor-routes";
import type { IStorage } from "./storage";
import { emptyVendorPayment, type VendorPayment } from "@shared/vendor-payment";

test("admin vendor payment save, reload, legacy edit, and QR removal", async () => {
  let vendor = { id: 1, name: "Vendor", phone: "", address: "", gstNo: "", linkedClients: null as string | null, createdAt: null };
  let payment: VendorPayment = { ...emptyVendorPayment };
  const storage: Pick<IStorage, "getVendors" | "getVendorPayment" | "createVendor" | "updateVendor" | "deleteVendor"> = {
    async getVendors() { return [vendor]; },
    async getVendorPayment(id) { return id === vendor.id ? { ...payment } : undefined; },
    async createVendor() { return vendor; },
    async updateVendor(id, data) {
      if (id !== vendor.id) throw new Error("Vendor not found");
      vendor = { ...vendor, name: data.name };
      if (data.payment) payment = { ...data.payment };
      return vendor;
    },
    async deleteVendor() {},
  };
  const auth: RequestHandler = (req, res, next) => req.headers["x-role"] ? next() : res.sendStatus(401);
  const admin: RequestHandler = (req, res, next) => !req.headers["x-role"] ? res.sendStatus(401) : req.headers["x-role"] === "admin" ? next() : res.sendStatus(403);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registerVendorRoutes(app, storage, auth, admin);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not start");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, role?: string, method = "GET", body?: object) => fetch(base + path, {
    method, headers: { ...(role ? { "x-role": role } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    assert.equal((await request("/api/vendors/1/payment")).status, 401);
    assert.equal((await request("/api/vendors/1/payment", "user")).status, 403);
    assert.equal((await request("/api/vendors/1", "user", "PUT", { name: "Denied" })).status, 403);
    assert.deepEqual(await (await request("/api/vendors/1/payment", "admin")).json(), emptyVendorPayment);
    const qr = "data:image/png;base64,iVBORw0KGgoAAAAA";
    const details = { bankName: "Bank", accountNo: "001234", ifscCode: "ABCD0123456", branch: "Main", upiId: "vendor@bank", qrImage: qr };
    assert.equal((await request("/api/vendors/1", "admin", "PUT", { name: "Vendor", payment: details })).status, 200);
    const reload = await request("/api/vendors/1/payment", "admin");
    assert.equal(reload.headers.get("cache-control"), "no-store");
    assert.deepEqual(await reload.json(), details);
    assert.equal((await request("/api/vendors/1", "admin", "PUT", { name: "Renamed" })).status, 200);
    assert.deepEqual(await (await request("/api/vendors/1/payment", "admin")).json(), details);
    assert.equal((await request("/api/vendors/1", "admin", "PUT", { name: "Renamed", payment: { ...details, qrImage: "bad" } })).status, 400);
    assert.equal((await request("/api/vendors/1", "admin", "PUT", { name: "Renamed", payment: { ...details, qrImage: "" } })).status, 200);
    assert.equal((await (await request("/api/vendors/1/payment", "admin")).json()).qrImage, "");
    const list = await (await request("/api/vendors", "user")).json();
    assert.equal(list[0].name, "Renamed");
    assert.equal("payment" in list[0], false);
    assert.equal((await request("/api/vendors/99/payment", "admin")).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
