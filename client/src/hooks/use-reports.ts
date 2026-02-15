import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  type CreateReportRequest, 
  type UpdateReportRequest, 
  type ReportWithItems,
  type DailyReport,
  type VegetableItem
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
