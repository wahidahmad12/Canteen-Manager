import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, FileText, Users, IndianRupee, TrendingDown, Wallet, ArrowRight, Download } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n: number) => "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface SalaryRecord {
  id: number;
  employeeId: number;
  clientName: string;
  month: number;
  year: number;
  daysWorked: string;
  basicWage: string;
  da: string;
  hra: string;
  otherAllowance: string;
  grossWage: string;
  pfDeduction: string;
  esicDeduction: string;
  professionalTax: string;
  advanceDeduction: string;
  fineDeduction: string;
  otherDeduction: string;
  totalDeduction: string;
  netPay: string;
  overtimeHours: string;
  overtimeRate: string;
  overtimeAmount: string;
  paymentMode: string;
  paidOn: string | null;
}

interface Employee {
  id: number;
  name: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
}

export default function SalaryRegister() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: clients } = useClientNames();
  const isAdmin = user?.role === "admin";

  const now = new Date();
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [loaded, setLoaded] = useState(false);

  const queryKey = ["/api/salary", clientName, month, year];

  const { data: salaries, isLoading } = useQuery<SalaryRecord[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/salary?clientName=${encodeURIComponent(clientName)}&month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary records");
      return res.json();
    },
    enabled: loaded && !!clientName,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: !!clientName,
  });

  const employeeMap = useMemo(() => {
    const map = new Map<number, Employee>();
    employees?.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/salary/generate", { clientName, month: Number(month), year: Number(year) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Salary Generated", description: "Salary records have been generated from attendance data." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totals = useMemo(() => {
    if (!salaries || salaries.length === 0) return { basic: 0, gross: 0, deductions: 0, netPay: 0, count: 0 };
    let basic = 0, gross = 0, deductions = 0, netPay = 0;
    salaries.forEach((s) => {
      basic += Number(s.basicWage) || 0;
      gross += Number(s.grossWage) || 0;
      deductions += Number(s.totalDeduction) || 0;
      netPay += Number(s.netPay) || 0;
    });
    return { basic, gross, deductions, netPay, count: salaries.length };
  }, [salaries]);

  const handleLoad = () => {
    if (!clientName) {
      toast({ title: "Select Client", description: "Please select a client name first.", variant: "destructive" });
      return;
    }
    setLoaded(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  const clientOptions = clients?.map((c: any) => (typeof c === "string" ? c : c.name)) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-salary-title">Salary Register (Form XVII)</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Monthly salary register for all employees</p>
          </div>
          {loaded && salaries && salaries.length > 0 && (
            <Button variant="outline" onClick={() => window.print()} data-testid="button-print-salary">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          )}
        </div>

        <Card data-testid="card-salary-filters">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Select value={clientName} onValueChange={(v) => { setClientName(v); setLoaded(false); }}>
                  <SelectTrigger data-testid="select-client-name">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientOptions.map((name: string) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={month} onValueChange={(v) => { setMonth(v); setLoaded(false); }}>
                  <SelectTrigger data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={(v) => { setYear(v); setLoaded(false); }}>
                  <SelectTrigger data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoad} data-testid="button-load-salary">
                <Download className="w-4 h-4 mr-2" />
                Load
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => generateMutation.mutate()}
                  disabled={!clientName || generateMutation.isPending}
                  data-testid="button-generate-salary"
                >
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Salary
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading && loaded && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {loaded && salaries && salaries.length > 0 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 print:hidden">
              <Card data-testid="card-total-employees">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Employees</p>
                      <p className="text-lg font-bold" data-testid="text-total-employees">{totals.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-basic">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <IndianRupee className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Basic</p>
                      <p className="text-lg font-bold" data-testid="text-total-basic">{fmt(totals.basic)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-gross">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Gross</p>
                      <p className="text-lg font-bold" data-testid="text-total-gross">{fmt(totals.gross)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-deductions">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Deductions</p>
                      <p className="text-lg font-bold" data-testid="text-total-deductions">{fmt(totals.deductions)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-net-pay">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <IndianRupee className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Net Pay</p>
                      <p className="text-lg font-bold" data-testid="text-total-net-pay">{fmt(totals.netPay)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="hidden md:block print:block">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Salary Register - {clientName} - {MONTHS[Number(month) - 1]} {year}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-salary-register">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold">S.No</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold">Employee Name</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Days</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Basic</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">DA</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">HRA</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Gross</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">PF</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">ESIC</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">PT</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Other Ded</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Total Ded</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold">Net Pay</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold print:hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaries.map((s, idx) => {
                          const emp = employeeMap.get(s.employeeId);
                          const otherDed = (Number(s.advanceDeduction) || 0) + (Number(s.fineDeduction) || 0) + (Number(s.otherDeduction) || 0);
                          return (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-salary-${s.id}`}>
                              <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-medium">{emp?.name || `Employee #${s.employeeId}`}</td>
                              <td className="px-3 py-2.5 text-right">{Number(s.daysWorked) || 0}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.basicWage) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.da) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.hra) || 0)}</td>
                              <td className="px-3 py-2.5 text-right font-medium">{fmt(Number(s.grossWage) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.pfDeduction) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.esicDeduction) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(Number(s.professionalTax) || 0)}</td>
                              <td className="px-3 py-2.5 text-right">{fmt(otherDed)}</td>
                              <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400">{fmt(Number(s.totalDeduction) || 0)}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(Number(s.netPay) || 0)}</td>
                              <td className="px-3 py-2.5 text-center print:hidden">
                                <Link href={`/salary/${s.id}/slip`}>
                                  <Button variant="ghost" size="icon" data-testid={`button-view-slip-${s.id}`}>
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-bold border-t-2">
                          <td className="px-3 py-2.5" colSpan={2}>Total</td>
                          <td className="px-3 py-2.5 text-right">{salaries.reduce((sum, s) => sum + (Number(s.daysWorked) || 0), 0)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(totals.basic)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.da) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.hra) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(totals.gross)}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.pfDeduction) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.esicDeduction) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.professionalTax) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(salaries.reduce((sum, s) => sum + (Number(s.advanceDeduction) || 0) + (Number(s.fineDeduction) || 0) + (Number(s.otherDeduction) || 0), 0))}</td>
                          <td className="px-3 py-2.5 text-right text-red-600 dark:text-red-400">{fmt(totals.deductions)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{fmt(totals.netPay)}</td>
                          <td className="px-3 py-2.5 print:hidden"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:hidden print:hidden space-y-3">
              {salaries.map((s, idx) => {
                const emp = employeeMap.get(s.employeeId);
                return (
                  <Link key={s.id} href={`/salary/${s.id}/slip`}>
                    <Card className="hover-elevate" data-testid={`card-salary-mobile-${s.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{idx + 1}</Badge>
                            <span className="font-medium text-sm">{emp?.name || `Employee #${s.employeeId}`}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Days</p>
                            <p className="font-medium">{Number(s.daysWorked) || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gross</p>
                            <p className="font-medium">{fmt(Number(s.grossWage) || 0)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Pay</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(Number(s.netPay) || 0)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {loaded && !isLoading && salaries && salaries.length === 0 && (
          <Card>
            <CardContent className="text-center py-16">
              <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Salary Records</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No salary records found for {MONTHS[Number(month) - 1]} {year}.
              </p>
              {isAdmin && (
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-empty">
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Salary
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
