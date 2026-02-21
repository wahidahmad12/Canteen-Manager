import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  type CreateReportRequest, 
  type UpdateReportRequest, 
  type ReportWithItems,
  type DailyReport,
  type VegetableItem,
  type InventoryWithItems,
  type CreateInventoryRequest
} from "@shared/schema";

// GET /api/reports
export function useReports() {
  return useQuery({
    queryKey: [api.reports.list.path],
    queryFn: async () => {
      const res = await fetch(api.reports.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return api.reports.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/reports/:id
export function useReport(id: number | null) {
  return useQuery({
    queryKey: [api.reports.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.reports.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) throw new Error("Report not found");
      if (!res.ok) throw new Error("Failed to fetch report");
      return api.reports.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// POST /api/reports
export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateReportRequest) => {
      const res = await fetch(api.reports.create.path, {
        method: api.reports.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create report");
      }
      return api.reports.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
    },
  });
}

// PUT /api/reports/:id
export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateReportRequest & { id: number }) => {
      const url = buildUrl(api.reports.update.path, { id });
      const res = await fetch(url, {
        method: api.reports.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update report");
      }
      return api.reports.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.reports.get.path, data.id] });
    },
  });
}

// DELETE /api/reports/:id
export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.reports.delete.path, { id });
      const res = await fetch(url, {
        method: api.reports.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete report");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
    },
  });
}

// GET /api/vegetables
export function useVegetableItems() {
  return useQuery({
    queryKey: [api.vegetables.list.path],
    queryFn: async () => {
      const res = await fetch(api.vegetables.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vegetable items");
      return api.vegetables.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/vegetables
export function useCreateVegetableItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch(api.vegetables.create.path, {
        method: api.vegetables.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create vegetable item");
      return api.vegetables.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vegetables.list.path] });
    },
  });
}

// PUT /api/vegetables/:id
export function useUpdateVegetableItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const url = buildUrl(api.vegetables.update.path, { id });
      const res = await fetch(url, {
        method: api.vegetables.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update vegetable item");
      return api.vegetables.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vegetables.list.path] });
    },
  });
}

// DELETE /api/vegetables/:id
export function useDeleteVegetableItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.vegetables.delete.path, { id });
      const res = await fetch(url, {
        method: api.vegetables.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete vegetable item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vegetables.list.path] });
    },
  });
}

// === INVENTORY HOOKS ===

export function useInventories() {
  return useQuery({
    queryKey: [api.inventory.list.path],
    queryFn: async () => {
      const res = await fetch(api.inventory.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventories");
      return res.json() as Promise<InventoryWithItems[]>;
    },
  });
}

export function useInventory(id: number | null) {
  return useQuery({
    queryKey: [api.inventory.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.inventory.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json() as Promise<InventoryWithItems>;
    },
    enabled: !!id,
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInventoryRequest) => {
      const res = await fetch(api.inventory.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create inventory");
      }
      return res.json() as Promise<InventoryWithItems>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateInventoryRequest & { id: number }) => {
      const url = buildUrl(api.inventory.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update inventory");
      }
      return res.json() as Promise<InventoryWithItems>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] });
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.inventory.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete inventory");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] });
    },
  });
}

// === CASH SEAL HOOKS ===

export function useCashSeals() {
  return useQuery({
    queryKey: [api.cashSeals.list.path],
    queryFn: async () => {
      const res = await fetch(api.cashSeals.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cash seals");
      return res.json();
    },
  });
}

export function useCreateCashSeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.cashSeals.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save cash seal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cashSeals.list.path] });
    },
  });
}

// === ADMIN HOOKS ===

export function useVerifyAdminPin() {
  return useMutation({
    mutationFn: async (pin: string) => {
      const res = await fetch(api.admin.verifyPin.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });
      const data = await res.json();
      return data.valid as boolean;
    },
  });
}

export function useChangeAdminPin() {
  return useMutation({
    mutationFn: async ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
      const res = await fetch(api.admin.changePin.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to change PIN");
      }
      return res.json();
    },
  });
}
