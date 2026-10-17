import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CANTEEN_MEALS, isMealActive, mealWiseTotals, runningSlotTotal } from "@shared/canteen-meals";
import { Download, Loader2, Printer, Ticket } from "lucide-react";

type Coupon = { id: number; clientName: string; mealCategory: string; variant: string; date: string; time: string };

const MEALS = CANTEEN_MEALS;

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dmy = (v: string) => v.split("-").reverse().join("-");

export default function CanteenCouponsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"issue" | "reports">("issue");
  const [clientName, setClientName] = useState("");
  const [fDate, setFDate] = useState(localDate(new Date()));
  const [fMonth, setFMonth] = useState("");
  const [fYear, setFYear] = useState("");
  const [fClient, setFClient] = useState("");
  const [now, setNow] = useState(new Date());

  useState(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  });

  const { data: clients = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => (await apiRequest("GET", "/api/clients")).json(),
  });

  const reportParams = new URLSearchParams();
  if (fDate) reportParams.set("date", fDate);
  else if (fMonth) reportParams.set("month", fMonth);
  else if (fYear) reportParams.set("year", fYear);
  if (fClient) reportParams.set("client", fClient);
  const reportUrl = `/api/canteen-coupons?${reportParams.toString()}`;

  const { data: report = [], isLoading: reportLoading, isError: reportError } = useQuery<Coupon[]>({
    queryKey: [reportUrl],
    queryFn: async () => (await apiRequest("GET", reportUrl)).json(),
    enabled: tab === "reports",
  });

  const todayDate = localDate(now);
  const todayUrl = `/api/canteen-coupons?date=${todayDate}`;
  const { data: today = [] } = useQuery<Coupon[]>({
    queryKey: [todayUrl],
    queryFn: async () => (await apiRequest("GET", todayUrl)).json(),
  });
  // Per-meal totals for today (each meal counted independently) + running total of the active slot only
  const mealTotals = useMemo(() => MEALS.map((m) => ({ ...m, count: today.filter((c) => c.mealCategory === m.name).length })), [today]);
  const running = useMemo(() => runningSlotTotal(today, todayDate, now), [today, todayDate, now]);
  const reportSummary = useMemo(() => mealWiseTotals(report), [report]);

  const issue = useMutation({
    mutationFn: async (v: { mealCategory: string; variant: string }) => {
      const d = new Date();
      return apiRequest("POST", "/api/canteen-coupons", {
        clientName: clientName.trim(),
        mealCategory: v.mealCategory,
        variant: v.variant,
        date: localDate(d),
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      });
    },
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/canteen-coupons") });
      toast({ title: "Coupon issued", description: `${v.mealCategory} (${v.variant}) - ${clientName}` });
    },
    onError: (e: Error) => toast({ title: "Could not issue coupon", description: e.message, variant: "destructive" }),
  });

  const handleIssue = (mealCategory: string, variant: string) => {
    if (!clientName.trim()) {
      toast({ title: "Select a client first", variant: "destructive" });
      return;
    }
    issue.mutate({ mealCategory, variant });
  };

  const periodLabel = fDate ? `Date: ${dmy(fDate)}` : fMonth ? `Month: ${fMonth}` : fYear ? `Year: ${fYear}` : "Complete Report (All Time)";

  const exportExcel = () => {
    if (report.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(report.map((c) => ({
      Date: dmy(c.date), Time: c.time, "Client Name": c.clientName, "Meal Category": c.mealCategory, "Type (Veg/Non-Veg)": c.variant,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coupons");
    XLSX.writeFile(wb, `Canteen_Report_${fDate || fMonth || fYear || "All"}${fClient ? `_${fClient}` : ""}.xlsx`);
  };

  const tabBtn = (id: "issue" | "reports", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`py-3 px-1 text-sm font-medium border-b-2 ${tab === id ? "border-blue-500 text-blue-600" : "border-transparent text-muted-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="no-print">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ticket className="w-6 h-6 text-blue-500" /> Canteen Coupons</h1>
          <p className="text-sm text-muted-foreground">Issue meal coupons client-wise and view reports.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 no-print">
          <Card className="border-l-4 border-l-blue-500"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">{running.meal ? `Current: ${running.meal}` : "No active meal"}</p><p className="text-3xl font-bold" data-testid="text-running-total">{running.total}</p></CardContent></Card>
          {mealTotals.map((m) => (
            <Card key={m.name} className="border-l-4 border-l-green-500"><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Today's {m.name}</p><p className="text-3xl font-bold">{m.count}</p></CardContent></Card>
          ))}
        </div>

        <nav className="flex gap-8 border-b no-print">
          {tabBtn("issue", "Issue Coupon")}
          {tabBtn("reports", "Reports")}
        </nav>

        {tab === "issue" && (
          <Card>
            <CardHeader><CardTitle>Issue New Meal Coupon</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-md space-y-2">
                <Label>Client Name *</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  data-testid="select-coupon-client"
                >
                  <option value="">Select client</option>
                  {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {MEALS.filter((m) => isMealActive(m, now)).length === 0 && (
                <div className="text-center py-10 text-muted-foreground border rounded-xl bg-muted/30">No meal service currently active.</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {MEALS.filter((m) => isMealActive(m, now)).map((m) => (
                  <div key={m.name} className="border rounded-xl p-5 relative">
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">Active Now</span>
                    <h3 className="font-bold text-lg">{m.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{m.time}</p>
                    <div className="flex gap-2">
                      {m.variants.map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          className={`flex-1 text-white ${v === "Veg" ? "bg-green-600 hover:bg-green-700" : v === "Non-Veg" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                          disabled={issue.isPending}
                          onClick={() => handleIssue(m.name, v)}
                        >
                          {issue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : v === "N/A" ? "Issue" : `Issue ${v}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "reports" && (
          <Card>
            <CardHeader className="no-print">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Coupon Reports</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportExcel}><Download className="w-4 h-4 mr-2" /> Export Excel</Button>
                  <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={fDate} onChange={(e) => { setFDate(e.target.value); if (e.target.value) { setFMonth(""); setFYear(""); } }} /></div>
                <div className="space-y-1"><Label>Month</Label><Input type="month" value={fMonth} onChange={(e) => { setFMonth(e.target.value); if (e.target.value) { setFDate(""); setFYear(""); } }} /></div>
                <div className="space-y-1"><Label>Year</Label><Input type="number" min={2020} max={2100} placeholder="YYYY" value={fYear} onChange={(e) => { setFYear(e.target.value); if (e.target.value) { setFDate(""); setFMonth(""); } }} /></div>
                <div className="space-y-1">
                  <Label>Client Name</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={fClient} onChange={(e) => setFClient(e.target.value)}>
                    <option value="">All clients</option>
                    {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <Button variant="link" className="px-0 no-print" onClick={() => { setFDate(""); setFMonth(""); setFYear(""); setFClient(""); }}>Clear Filters</Button>

              <div id="coupon-print-area">
                <div className="hidden print:block text-center mb-4">
                  <h2 className="text-2xl font-bold">Canteen Coupon Report</h2>
                  <p className="text-sm">{periodLabel}{fClient ? ` | Client: ${fClient}` : ""}</p>
                </div>
                {reportError && <p className="text-red-600 text-sm">Could not load report.</p>}
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left">Date & Time</th>
                        <th className="px-4 py-2 text-left">Client Name</th>
                        <th className="px-4 py-2 text-left">Meal Category</th>
                        <th className="px-4 py-2 text-left">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLoading && <tr><td colSpan={4} className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>}
                      {!reportLoading && report.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No coupons found matching criteria.</td></tr>}
                      {report.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="px-4 py-2 whitespace-nowrap">{dmy(c.date)} <span className="text-muted-foreground">{c.time}</span></td>
                          <td className="px-4 py-2 font-medium">{c.clientName}</td>
                          <td className="px-4 py-2">{c.mealCategory}</td>
                          <td className="px-4 py-2">{c.variant}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportSummary.length > 0 && (
                  <div className="mt-4 overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/50"><tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Meal</th><th className="px-4 py-2 text-left">Veg</th><th className="px-4 py-2 text-left">Non-Veg</th><th className="px-4 py-2 text-left">Total</th></tr></thead>
                      <tbody>
                        {reportSummary.map((r) => (
                          <tr key={`${r.date}|${r.meal}`} className="border-t"><td className="px-4 py-2">{dmy(r.date)}</td><td className="px-4 py-2">{r.meal}</td><td className="px-4 py-2">{r.veg}</td><td className="px-4 py-2">{r.nonVeg}</td><td className="px-4 py-2 font-bold">{r.total}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-sm font-medium">Total Filtered Records: <span className="font-bold text-blue-600">{report.length}</span></p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
