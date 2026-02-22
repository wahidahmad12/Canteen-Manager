import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  type CreateReportRequest, 
  type UpdateReportRequest, 
  type ReportWithItems,
  type DailyReport,
  type VegetableItem,
  type InventoryWithItems,
  type CreateInventoryRequest,
  type SafeUser,
} from "@shared/schema";

// === AUTH HOOKS ===

export function useCurrentUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<{ id: number; username: string; displayName: string; role: string; clientName: string | null; permissions: string[] }>;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
    },
  });
}

// === USER MANAGEMENT HOOKS ===

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<SafeUser[]>;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string; displayName: string; role: string; clientName: string | null; permissions?: string[] }) => {
      const res = await fetch(api.users.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.users.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}

// GET /api/reports
export function useReports(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.reports.list.path],
    queryFn: async () => {
      const res = await fetch(api.reports.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return api.reports.list.responses[200].parse(await res.json());
    },
    enabled: options?.enabled !== false,
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

export function useInventories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.inventory.list.path],
    queryFn: async () => {
      const res = await fetch(api.inventory.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventories");
      return res.json() as Promise<InventoryWithItems[]>;
    },
    enabled: options?.enabled !== false,
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

export function useCashSeals(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.cashSeals.list.path],
    queryFn: async () => {
      const res = await fetch(api.cashSeals.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cash seals");
      return res.json();
    },
    enabled: options?.enabled !== false,
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

// === SAVED MENU HOOKS ===

export function useSavedMenus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.menus.list.path],
    queryFn: async () => {
      const res = await fetch(api.menus.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch menus");
      return res.json() as Promise<{ id: number; clientName: string; startDate: string; endDate: string; menuData: string; createdAt: string }[]>;
    },
    enabled: options?.enabled !== false,
  });
}

export function useSavedMenu(id: number) {
  return useQuery({
    queryKey: [api.menus.list.path, id],
    queryFn: async () => {
      const url = buildUrl(api.menus.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch menu");
      return res.json() as Promise<{ id: number; clientName: string; startDate: string; endDate: string; menuData: string; createdAt: string }>;
    },
    enabled: id > 0,
  });
}

export function useCreateSavedMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { clientName: string; startDate: string; endDate: string; menuData: string }) => {
      const res = await fetch(api.menus.create.path, {
        method: api.menus.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save menu");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.menus.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.savedItems.list.path] });
    },
  });
}

export function useDeleteSavedMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.menus.delete.path, { id });
      const res = await fetch(url, {
        method: api.menus.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete menu");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.menus.list.path] });
    },
  });
}

// === CLIENT HOOKS ===

export function useClientNames() {
  return useQuery({
    queryKey: [api.clients.list.path],
    queryFn: async () => {
      const res = await fetch(api.clients.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json() as Promise<{ id: number; name: string }[]>;
    },
  });
}

export function useCreateClientName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch(api.clients.create.path, {
        method: api.clients.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create client");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
    },
  });
}

export function useUpdateClientName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const url = buildUrl(api.clients.update.path, { id });
      const res = await fetch(url, {
        method: api.clients.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
    },
  });
}

export function useDeleteClientName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.clients.delete.path, { id });
      const res = await fetch(url, {
        method: api.clients.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete client");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
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

// === SAVED ITEM NAMES HOOKS ===

export function useSavedItemNames(source?: string) {
  const queryParams = source ? `?source=${source}` : '';
  return useQuery({
    queryKey: [api.savedItems.list.path, source],
    queryFn: async () => {
      const res = await fetch(`${api.savedItems.list.path}${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch saved items");
      return res.json() as Promise<{ id: number; name: string; source: string; categoryId: number | null }[]>;
    },
  });
}

// === PURCHASE REQUEST HOOKS ===

export function usePurchaseRequests(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.purchaseRequests.list.path],
    queryFn: async () => {
      const res = await fetch(api.purchaseRequests.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch purchase requests");
      return res.json() as Promise<any[]>;
    },
    enabled: options?.enabled !== false,
  });
}

export function usePurchaseRequest(id: number | null) {
  return useQuery({
    queryKey: [api.purchaseRequests.list.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.purchaseRequests.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch purchase request");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.purchaseRequests.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create purchase request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseRequests.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.savedItems.list.path] });
    },
  });
}

export function useUpdatePurchaseRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const url = buildUrl(api.purchaseRequests.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update purchase request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseRequests.list.path] });
    },
  });
}

export function useDeletePurchaseRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.purchaseRequests.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete purchase request");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseRequests.list.path] });
    },
  });
}

// === VENDOR HOOKS ===

export function useVendors() {
  return useQuery({
    queryKey: [api.vendors.list.path],
    queryFn: async () => {
      const res = await fetch(api.vendors.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json() as Promise<{ id: number; name: string; createdAt: string }[]>;
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch(api.vendors.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create vendor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vendors.list.path] });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.vendors.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete vendor");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vendors.list.path] });
    },
  });
}

// === PURCHASE INVOICE HOOKS ===

export function useLastPurchasePrices() {
  return useQuery({
    queryKey: [api.purchaseInvoices.lastPrices.path],
    queryFn: async () => {
      const res = await fetch(api.purchaseInvoices.lastPrices.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch last prices");
      return res.json() as Promise<{ itemName: string; unitPrice: number; gstRate: number }[]>;
    },
  });
}

export function usePurchaseInvoices(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.purchaseInvoices.list.path],
    queryFn: async () => {
      const res = await fetch(api.purchaseInvoices.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch purchase invoices");
      return res.json() as Promise<any[]>;
    },
    enabled: options?.enabled !== false,
  });
}

export function usePurchaseInvoice(id: number | null) {
  return useQuery({
    queryKey: [api.purchaseInvoices.list.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.purchaseInvoices.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch purchase invoice");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.purchaseInvoices.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseInvoices.list.path] });
    },
  });
}

export function useUpdatePurchaseInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const url = buildUrl(api.purchaseInvoices.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseInvoices.list.path] });
    },
  });
}

export function useDeletePurchaseInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.purchaseInvoices.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete invoice");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseInvoices.list.path] });
    },
  });
}
