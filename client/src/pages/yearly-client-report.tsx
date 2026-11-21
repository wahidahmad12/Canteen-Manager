import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientNames } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2, Printer } from "lucide-react";
import { clientKind, loadMealTables } from "@/lib/yearly-meals";
import { buildYearlyWorkbook } from "@/lib/yearly-report-excel";
import { MONTHS, salaryTable, type Period, type ReportEmployee, type ReportTable, type SalaryRecord } from "@/lib/yearly-report";

type Report = { tables: ReportTable[]; note: string };
const currentYear = new Date().getFullYear();
const key = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Could not load ${url.split("?")[0]} (${response.status}).`);
  return response.json();
}

function isSalaryLocationAvailable(clientName: string, location: string): boolean {
  if (location === "all") return true;
  const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(clientName);
}

function locationInName(clientName: string): string {
  const kind = clientKind(clientName);
  const locations = kind === "hul" ? ["KPF", "TEC"] : kind === "unichem" ? ["Main Plant", "Unit-2", "COE"] : [];
  return locations.find(location => isSalaryLocationAvailable(clientName, location)) || "all";
}

function display(value: string | number): string {
  return typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : value;
}

export default function YearlyClientReport() {
  const { data: clients = [], isLoading: clientsLoading, isError: clientsError } = useClientNames();
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("all");
  const [years, setYears] = useState([currentYear - 1, currentYear]);
  const [newYear, setNewYear] = useState(String(currentYear - 2));
  const [mealMonths, setMealMonths] = useState<Set<string>>(() => new Set([currentYear - 1, currentYear].flatMap(year => MONTHS.map((_, i) => key(year, i + 1)))));
  const [salaryMonths, setSalaryMonths] = useState<Set<string>>(() => new Set([currentYear - 1, currentYear].flatMap(year => MONTHS.map((_, i) => key(year, i + 1)))));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const client = clients.find(item => String(item.id) === clientId);
  const kind = client ? clientKind(client.name) : null;
  const locations = kind === "hul" ? ["KPF", "TEC"] : kind === "unichem" ? ["Main Plant", "Unit-2", "COE"] : [];

  function toggleMonth(setter: React.Dispatch<React.SetStateAction<Set<string>>>, period: string) {
    setter(previous => {
      const next = new Set(previous);
      if (next.has(period)) next.delete(period); else next.add(period);
      return next;
    });
    setReport(null);
  }

  function addYear() {
    const year = Number(newYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2100 || years.includes(year) || years.length >= 5) {
      toast({ title: "Invalid year", description: "Choose a new year between 1900 and 2100 (maximum 5 years).", variant: "destructive" });
      return;
    }
    setYears(previous => [...previous, year].sort((a, b) => a - b));
    const months = MONTHS.map((_, i) => key(year, i + 1));
    setMealMonths(previous => new Set([...Array.from(previous), ...months]));
    setSalaryMonths(previous => new Set([...Array.from(previous), ...months]));
    setReport(null);
  }

  function removeYear(year: number) {
    setYears(previous => previous.filter(value => value !== year));
    setMealMonths(previous => new Set(Array.from(previous).filter(value => !value.startsWith(`${year}-`))));
    setSalaryMonths(previous => new Set(Array.from(previous).filter(value => !value.startsWith(`${year}-`))));
    setReport(null);
  }

  async function loadReport() {
    if (!client) return;
    const toPeriods = (months: Set<string>): Period[] => Array.from(months).sort().map(value => {
      const [year, month] = value.split("-").map(Number);
      return { year, month };
    });
    const mealPeriods = toPeriods(mealMonths);
    const salaryPeriods = toPeriods(salaryMonths);
    if (!mealPeriods.length && !salaryPeriods.length) {
      toast({ title: "Select months", description: "Select at least one meal or salary month.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const salaryAvailable = isSalaryLocationAvailable(client.name, location);
      const mealPromise = loadMealTables(client.name, client.id, mealPeriods, location);
      const salaryPromise = salaryAvailable && salaryPeriods.length
        ? (async () => {
            const employees = await fetchJson<ReportEmployee[]>(`/api/employees?clientName=${encodeURIComponent(client.name)}`);
            const salaryYears = Array.from(new Set(salaryPeriods.map(period => period.year)));
            return Promise.all(salaryYears.map(async year => {
              const months = salaryPeriods.filter(period => period.year === year).map(period => period.month);
              const url = `/api/salary?clientName=${encodeURIComponent(client.name)}&year=${year}&months=${months.join(",")}`;
              const records = await fetchJson<SalaryRecord[]>(url);
              return salaryTable(client.name, year, months, records, employees);
            }));
          })()
        : Promise.resolve([]);
      const [mealTables, salaryTables] = await Promise.all([mealPromise, salaryPromise]);
      const note = salaryPeriods.length && !salaryAvailable ? "Location-wise salary data is not available for this client." : "";
      setReport({ tables: [...mealTables, ...salaryTables], note });
    } catch (error) {
      toast({ title: "Report could not be loaded", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    if (!report || !client) return;
    setExporting(true);
    try {
      const workbook = await buildYearlyWorkbook(report.tables, report.note);
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Yearly_Summary_${client.name.replace(/[^a-z0-9]+/gi, "_")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Excel export failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  function printReport() {
    const content = document.getElementById("yearly-client-report-content");
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to print the report.", variant: "destructive" });
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4 landscape; margin: 6mm; }
      body { font-family: Arial, sans-serif; font-size: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      section { break-after: page; } section:last-child { break-after: auto; }
      h2 { font-size: 12px; text-align: center; margin: 0; padding: 6px; color: white; }
      p { text-align: center; } table { width: 100%; border-collapse: collapse; table-layout: auto; }
      th, td { border: 1px solid #444; padding: 3px; text-align: right; overflow-wrap: anywhere; }
      th { color: white; } td:first-child { text-align: left; } tfoot { font-weight: bold; background: #fff2cc; }
    </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.document.title = "Yearly Client Summary";
    win.print();
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div><h1 className="text-xl font-bold">Client Yearly Summary Report</h1><p className="text-sm text-muted-foreground">Meal summaries and annual salary in one report</p></div>
        <Card><CardContent className="pt-4 space-y-4">
          <fieldset disabled={loading} className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 min-w-[240px]"><Label>Client</Label>
                <Select value={clientId} disabled={loading} onValueChange={value => { setClientId(value); setLocation(locationInName(clients.find(item => String(item.id) === value)?.name || "")); setReport(null); }}>
                  <SelectTrigger data-testid="select-yearly-client"><SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select client"} /></SelectTrigger>
                  <SelectContent>{clients.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {locations.length > 0 && <div className="space-y-1 min-w-[180px]"><Label>Location</Label>
                <Select value={location} disabled={loading || (!!client && locationInName(client.name) !== "all")} onValueChange={value => { setLocation(value); setReport(null); }}>
                  <SelectTrigger data-testid="select-yearly-location" disabled={!!client && locationInName(client.name) !== "all"}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>}
              <div className="space-y-1"><Label htmlFor="add-report-year">Add year</Label><div className="flex gap-2">
                <Input id="add-report-year" type="number" min={1900} max={2100} value={newYear} onChange={event => setNewYear(event.target.value)} className="w-24" />
                <Button type="button" variant="outline" onClick={addYear}>Add</Button>
              </div></div>
            </div>
            {clientsError && <p className="text-destructive text-sm">Could not load clients. Please reload the page.</p>}
            {years.map(year => <div key={year} className="border rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center"><strong>{year}</strong><Button size="sm" variant="ghost" onClick={() => removeYear(year)}>Remove year</Button></div>
              {([["Meal", mealMonths, setMealMonths], ["Salary", salaryMonths, setSalaryMonths]] as const).map(([label, selected, setter]) =>
                <div key={label} className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-semibold w-14">{label}</span>
                  {MONTHS.map((month, i) => <label key={month} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
                    <input type="checkbox" checked={selected.has(key(year, i + 1))} onChange={() => toggleMonth(setter, key(year, i + 1))} />
                    {month.slice(0, 3)}
                  </label>)}
                </div>)}
            </div>)}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadReport} disabled={loading || !client}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Load Report</Button>
            <Button variant="outline" onClick={exportExcel} disabled={!report || loading || exporting}><FileDown className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={printReport} disabled={!report || loading}><Printer className="h-4 w-4 mr-2" />Print</Button>
          </div>
        </CardContent></Card>
        {report && <div id="yearly-client-report-content" className="space-y-5">
          {report.tables.map(table => <section key={table.name} className="border rounded overflow-hidden">
            <h2 style={{ backgroundColor: `#${table.color}`, color: "white" }} className="text-center font-bold py-2">{table.title}</h2>
            {table.subtitle && <p className="text-center text-xs py-1">{table.subtitle}</p>}
            <div className="overflow-x-auto"><table className="w-full border-collapse text-xs whitespace-nowrap">
              <thead><tr>{table.headers.map((header, i) => <th key={i} style={{ backgroundColor: `#${table.color}`, color: "white" }} className="border border-gray-400 p-2 text-center">{header}</th>)}</tr></thead>
              <tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border border-gray-300 p-1.5 text-right">{display(cell)}</td>)}</tr>)}</tbody>
              <tfoot><tr className="bg-amber-100 font-bold">{table.total.map((cell, i) => <td key={i} className="border border-gray-400 p-1.5 text-right">{display(cell)}</td>)}</tr></tfoot>
            </table></div>
          </section>)}
          {report.note && <section><p className="border rounded p-3 text-sm">{report.note}</p></section>}
          {!report.tables.length && !report.note && <section><p className="border rounded p-3 text-sm">No meal or salary data available for the selected months.</p></section>}
        </div>}
      </div>
    </Layout>
  );
}
