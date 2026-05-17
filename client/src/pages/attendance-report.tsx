import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { apiRequest } from "@/lib/queryClient";
import { CalendarDays, ClipboardList, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function AttendanceReportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: clients } = useClientNames();
  const [clientName, setClientName] = useState("");
  const [monthViewDate, setMonthViewDate] = useState(() => {
    const n = new Date(); return { month: String(n.getMonth()+1), year: String(n.getFullYear()) };
  });

  const { data: monthLogs, refetch: refetchMonth } = useQuery({
    queryKey: ["/api/daily-attendance/month", clientName, monthViewDate.month, monthViewDate.year],
    queryFn: async () => {
      if (!clientName) return [];
      const res = await fetch(`/api/daily-attendance/month?clientName=${encodeURIComponent(clientName)}&month=${monthViewDate.month}&year=${monthViewDate.year}`, { credentials:"include" });
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/daily-attendance/${id}`),
    onSuccess: () => { refetchMonth(); qc.invalidateQueries({ queryKey: ["/api/daily-attendance"] }); },
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/daily-attendance/push-to-muster-roll", {
        clientName, month: Number(monthViewDate.month), year: Number(monthViewDate.year),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Pushed!", description: `${data.pushed} employee(s) pushed to Muster Roll.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="space-y-4 max-w-3xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-violet-600" /> Attendance Report
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly attendance logs & muster roll export</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label className="text-xs">Client</Label>
              <Select value={clientName} onValueChange={setClientName}>
                <SelectTrigger data-testid="select-client-report">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {(clients||[]).map((c:any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Select value={monthViewDate.month} onValueChange={v => setMonthViewDate(p => ({...p, month: v}))}>
                <SelectTrigger className="w-36" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input type="number" value={monthViewDate.year} onChange={e => setMonthViewDate(p => ({...p, year: e.target.value}))} className="w-24" data-testid="input-year" />
            </div>
            <Button onClick={() => refetchMonth()} variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
            <Button onClick={() => pushMutation.mutate()} disabled={pushMutation.isPending || !clientName} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 ml-auto" data-testid="button-push-muster">
              {pushMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Push to Muster Roll
            </Button>
          </CardContent>
        </Card>

        {/* Table */}
        {!clientName ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select a client to view attendance records
            </CardContent>
          </Card>
        ) : !monthLogs || monthLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No attendance records for this month
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Records
                <span className="ml-auto text-xs font-normal text-muted-foreground">{monthLogs.length} entries</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Employee</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Time</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Marked By</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthLogs.map((log: any) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-monthly-${log.id}`}>
                        <td className="px-3 py-2 text-xs">{log.attendance_date}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-xs">{log.employee_name}</div>
                          <div className="text-xs text-muted-foreground">{log.employee_code}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge className={`text-xs ${log.status==="P" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {log.scanned_at ? new Date(log.scanned_at).toLocaleTimeString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{log.scanned_by || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(log.id)} data-testid={`button-delete-log-${log.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
