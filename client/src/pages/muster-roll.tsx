import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Download, Printer, Save, ClipboardList, Calendar, Users } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_CODES = ["P", "A", "H", "WO", "PH", "CL", "SL", "EL", ""] as const;
type StatusCode = (typeof STATUS_CODES)[number];

const STATUS_COLORS: Record<string, string> = {
  P: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  A: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  H: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  WO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PH: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  CL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  SL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  EL: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function cycleStatus(current: StatusCode): StatusCode {
  const idx = STATUS_CODES.indexOf(current);
  return STATUS_CODES[(idx + 1) % STATUS_CODES.length];
}

type AttendanceMap = Record<number, Record<string, StatusCode>>;

export default function MusterRoll() {
  const { toast } = useToast();
  const { data: clients, isLoading: clientsLoading } = useClientNames();

  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loaded, setLoaded] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceMap>({});

  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  const daysInMonth = getDaysInMonth(monthNum, yearNum);

  const { data: employees, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json() as Promise<{ id: number; name: string; employeeId?: string; designation?: string }[]>;
    },
    enabled: false,
  });

  const { data: attendanceRecords, isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ["/api/attendance", clientName, month, year],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?clientName=${encodeURIComponent(clientName)}&month=${monthNum}&year=${yearNum}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json() as Promise<any[]>;
    },
    enabled: false,
  });

  const handleLoad = useCallback(async () => {
    if (!clientName) {
      toast({ title: "Select a client", description: "Please select a client name first.", variant: "destructive" });
      return;
    }
    const [empResult, attResult] = await Promise.all([refetchEmployees(), refetchAttendance()]);
    const emps = empResult.data || [];
    const records = attResult.data || [];

    const map: AttendanceMap = {};
    emps.forEach((emp: any) => {
      map[emp.id] = {};
      for (let d = 1; d <= 31; d++) {
        map[emp.id][`day${d}`] = "" as StatusCode;
      }
    });

    records.forEach((rec: any) => {
      if (map[rec.employeeId]) {
        for (let d = 1; d <= 31; d++) {
          const val = rec[`day${d}`] || "";
          map[rec.employeeId][`day${d}`] = val as StatusCode;
        }
      }
    });

    setAttendanceData(map);
    setLoaded(true);
  }, [clientName, refetchEmployees, refetchAttendance, toast]);

  const handleCellClick = useCallback((employeeId: number, dayKey: string) => {
    setAttendanceData(prev => {
      const empData = { ...prev[employeeId] };
      empData[dayKey] = cycleStatus((empData[dayKey] || "") as StatusCode);
      return { ...prev, [employeeId]: empData };
    });
  }, []);

  const calcTotals = useCallback((empData: Record<string, StatusCode>) => {
    let present = 0;
    let absent = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const val = empData[`day${d}`];
      if (val === "P") present += 1;
      if (val === "H") present += 0.5;
      if (val === "A") absent += 1;
    }
    return { totalPresent: present, totalAbsent: absent };
  }, [daysInMonth]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emps = employees || [];
      const promises = emps.map((emp) => {
        const empData = attendanceData[emp.id] || {};
        const { totalPresent, totalAbsent } = calcTotals(empData);
        const payload: any = {
          employeeId: emp.id,
          clientName,
          month: monthNum,
          year: yearNum,
          totalPresent,
          totalAbsent,
          overtimeHours: 0,
          remarks: "",
        };
        for (let d = 1; d <= 31; d++) {
          payload[`day${d}`] = empData[`day${d}`] || "";
        }
        return apiRequest("POST", "/api/attendance", payload);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Attendance records saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", clientName, month, year] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePrint = () => window.print();

  const isLoadingData = employeesLoading || attendanceLoading;

  return (
    <Layout>
      <style>{`
        @media print {
          nav, aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .print-table { font-size: 9px !important; }
          .print-table th, .print-table td { padding: 2px 3px !important; }
        }
      `}</style>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-muster-roll-title">
              Muster Roll (Form XVI)
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Monthly Attendance Register</p>
          </div>
          {loaded && (
            <div className="flex gap-2 no-print flex-wrap">
              <Button variant="outline" onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-all">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save All
              </Button>
            </div>
          )}
        </div>

        <Card className="no-print">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Select Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="client-select">Client Name</Label>
                <Select value={clientName} onValueChange={setClientName} data-testid="select-client">
                  <SelectTrigger id="client-select" data-testid="select-trigger-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsLoading ? (
                      <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                    ) : (
                      (clients || []).map((c: any) => (
                        <SelectItem key={c.id || c.name || c} value={typeof c === "string" ? c : c.name} data-testid={`select-item-client-${typeof c === "string" ? c : c.name}`}>
                          {typeof c === "string" ? c : c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="month-select">Month</Label>
                <Select value={month} onValueChange={setMonth} data-testid="select-month">
                  <SelectTrigger id="month-select" data-testid="select-trigger-month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)} data-testid={`select-item-month-${i + 1}`}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-input">Year</Label>
                <Input
                  id="year-input"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  min={2020}
                  max={2099}
                  data-testid="input-year"
                />
              </div>
              <Button onClick={handleLoad} disabled={isLoadingData} data-testid="button-load">
                {isLoadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Load
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoadingData && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {loaded && !isLoadingData && employees && (
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendance - {MONTHS[monthNum - 1]} {yearNum}
                <Badge variant="secondary" className="ml-auto">{employees.length} Employees</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {employees.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-1">No employees found</h3>
                  <p className="text-muted-foreground text-sm">No employees are registered for this client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs print-table" data-testid="table-attendance">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-3 py-2 text-left font-semibold min-w-[140px]">
                          Employee
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={i} className="px-1 py-2 text-center font-semibold min-w-[36px]">
                            {i + 1}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-emerald-50 dark:bg-emerald-950/20">
                          Present
                        </th>
                        <th className="px-2 py-2 text-center font-semibold min-w-[50px] bg-red-50 dark:bg-red-950/20">
                          Absent
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, empIdx) => {
                        const empData = attendanceData[emp.id] || {};
                        const { totalPresent, totalAbsent } = calcTotals(empData);
                        return (
                          <tr key={emp.id} className={`border-b last:border-0 ${empIdx % 2 === 0 ? "" : "bg-muted/20"}`} data-testid={`row-employee-${emp.id}`}>
                            <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap border-r">
                              <div className="flex flex-col">
                                <span className="truncate max-w-[130px]">{emp.name}</span>
                                {emp.designation && <span className="text-[10px] text-muted-foreground">{emp.designation}</span>}
                              </div>
                            </td>
                            {Array.from({ length: daysInMonth }, (_, i) => {
                              const dayKey = `day${i + 1}`;
                              const status = (empData[dayKey] || "") as StatusCode;
                              const colorClass = status ? STATUS_COLORS[status] || "" : "";
                              return (
                                <td key={i} className="px-0.5 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleCellClick(emp.id, dayKey)}
                                    className={`w-8 h-7 rounded text-[10px] font-bold cursor-pointer transition-colors ${colorClass || "bg-muted/30 text-muted-foreground"}`}
                                    data-testid={`cell-${emp.id}-day${i + 1}`}
                                    title={`Day ${i + 1}: ${status || "Not set"} - Click to change`}
                                  >
                                    {status || "-"}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-center font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" data-testid={`total-present-${emp.id}`}>
                              {totalPresent}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" data-testid={`total-absent-${emp.id}`}>
                              {totalAbsent}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loaded && !isLoadingData && employees && employees.length > 0 && (
          <div className="flex justify-between items-center gap-4 no-print flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_COLORS).map(([code, cls]) => (
                <div key={code} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${cls}`}>
                  {code}
                </div>
              ))}
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-bottom">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save All
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
