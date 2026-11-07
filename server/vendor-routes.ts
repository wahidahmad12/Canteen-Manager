import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import type { IStorage } from "./storage";

type VendorStorage = Pick<IStorage, "getVendors" | "getVendorPayment" | "createVendor" | "updateVendor" | "deleteVendor">;

export function registerVendorRoutes(app: Express, storage: VendorStorage, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  app.get(api.vendors.list.path, requireAuth, async (_req, res) => {
    res.json(await storage.getVendors());
  });

  app.get(api.vendors.payment.path, requireAdmin, async (req, res) => {
    const payment = await storage.getVendorPayment(Number(req.params.id));
    if (!payment) return res.status(404).json({ message: "Vendor not found" });
    res.set("Cache-Control", "no-store");
    res.json(payment);
  });

  app.post(api.vendors.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.vendors.create.input.parse(req.body);
      const vendor = await storage.createVendor(input);
      res.status(201).json(vendor);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof Error && "code" in err && err.code === "23505") {
        return res.status(400).json({ message: "This vendor already exists." });
      }
      throw err;
    }
  });

  app.put(api.vendors.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.vendors.update.input.parse(req.body);
      res.json(await storage.updateVendor(Number(req.params.id), input));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
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
}
