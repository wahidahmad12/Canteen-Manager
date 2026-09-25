import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { TrendingUp, TrendingDown, Award, CalendarDays, Utensils, Coffee } from "lucide-react";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const COLORS = {
  breakfast: "#f59e0b",
  contractorBreakfast: "#d97706", // Added new color for Contractor Breakfast
  lunch: "#10b981",
  dinner: "#6366f1",
  tea: "#f97316",
  mutton: "#ef4444",
  tiffin: "#8b5cf6",
  boiledEgg: "#ec4899",
  eveningSnacks: "#14b8a6",
  nightSnacks: "#64748b",
  sundayExtra: "#a78bfa",
  perment: "#2563eb",
  casual: "#7c3aed",
  contractual: "#db2777",
  canteen: "#059669",
  snacks: "#f59e0b",
  biscuit: "#10b981",
  chips: "#f97316",
  coldDrinkWater: "#3b82f6",
  kpfTotal: "#16a34a",
  tecTotal: "#1d4ed8",
};

const CLIENT_COLORS: Record<string, string> = {
  UBL: "#f59e0b",
  Cipla: "#6366f1",
  Unichem: "#14b8a6",
  HUL: "#16a34a",
  PEC: "#db2777",
};

function buildMonthChart(data: { month: number }[], fields: string[]): any[] {
  return MONTHS_SHORT.map((name, i) => {
    const row = (data as any[]).find((r: any) => r.month === i + 1) || {};
    const entry: Record<string, any> = { name };
    fields.forEach(f => { entry[f] = row[f] || 0; });
    return entry;
  });
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-0.5 bg-white dark:bg-gray-900 shadow-sm" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-xl font-bold" style={{ color }}>{value.toLocaleString()}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle, color }: { title: string; subtitle?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8">
      <div className="w-1.5 rounded-full h-10" style={{ background: color }} />
      <div>
        <div className="text-lg font-bold" style={{ color }}>{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</div>
      {children}
    </div>
  );
}

// Mini insight strip shown under each client section header
function InsightStrip({ monthlyTotals, color }: { monthlyTotals: number[]; color: string }) {
  const activeMonths = monthlyTotals.filter(v => v > 0).length;
  const total = monthlyTotals.reduce((s, v) => s + v, 0);
  const avg = activeMonths > 0 ? Math.round(total / activeMonths) : 0;
  let bestIdx = -1, bestVal = 0;
  monthlyTotals.forEach((v, i) => { if (v > bestVal) { bestVal = v; bestIdx = i; } });
  // trend: compare last two active months
  const activeIdx = monthlyTotals.map((v, i) => ({ v, i })).filter(x => x.v > 0);
  let trend: "up" | "down" | null = null;
  let trendPct = 0;
  if (activeIdx.length >= 2) {
    const prev = activeIdx[activeIdx.length - 2].v;
    const last = activeIdx[activeIdx.length - 1].v;
    if (prev > 0) {
      trendPct = Math.round(((last - prev) / prev) * 100);
      trend = trendPct >= 0 ? "up" : "down";
    }
  }
  return (
    <div className="flex flex-wrap gap-2 mb-4 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 bg-white dark:bg-gray-900 shadow-sm">
        <CalendarDays className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-muted-foreground">Active Months:</span>
        <b>{activeMonths}</b>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 bg-white dark:bg-gray-900 shadow-sm">
        <Utensils className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-muted-foreground">Monthly Average:</span>
        <b>{avg.toLocaleString()}</b>
      </span>
      {bestIdx >= 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 bg-white dark:bg-gray-900 shadow-sm">
          <Award className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-muted-foreground">Best Month:</span>
          <b>{MONTHS_SHORT[bestIdx]} ({bestVal.toLocaleString()})</b>
        </span>
      )}
      {trend && (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm ${trend === "up" ? "bg-green-50 dark:bg-green-950/30 border-green-200 text-green-700" : "bg-red-50 dark:bg-red-950/30 border-red-200 text-red-700"}`}>
          {trend === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>Last month {trend === "up" ? "+" : ""}{trendPct}%</span>
        </span>
      )}
    </div>
  );
}

const CHART_H = 220;

export function DateEntryDashboard({ year }: { year: number }) {
  // UBL
  const { data: ublDate = [] } = useQuery<any[]>({
    queryKey: ['/api/ubl-date-entries/yearly-summary', year],
    queryFn: () => fetch(`/api/ubl-date-entries/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: ublLunch = [] } = useQuery<any[]>({
    queryKey: ['/api/ubl-lunch-entries/yearly-summary', year],
    queryFn: () => fetch(`/api/ubl-lunch-entries/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });

  // Cipla
  const { data: ciplaData = [] } = useQuery<any[]>({
    queryKey: ['/api/cipla-date-entries/yearly-summary', year],
    queryFn: () => fetch(`/api/cipla-date-entries/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });

  // Unichem
  const { data: unichEmSnacks = [] } = useQuery<any[]>({
    queryKey: ['/api/unichem-snack-entries/yearly-summary', year],
    queryFn: () => fetch(`/api/unichem-snack-entries/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: unichEmLunch = [] } = useQuery<any[]>({
    queryKey: ['/api/unichem-lunch-entries/yearly-summary', year],
    queryFn: () => fetch(`/api/unichem-lunch-entries/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });

  // HUL
  const { data: hulKpf = [] } = useQuery<any[]>({
    queryKey: ['/api/hul-date-entries/yearly-summary', year, 'KPF'],
    queryFn: () => fetch(`/api/hul-date-entries/yearly-summary?year=${year}&location=KPF`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: hulTec = [] } = useQuery<any[]>({
    queryKey: ['/api/hul-date-entries/yearly-summary', year, 'TEC'],
    queryFn: () => fetch(`/api/hul-date-entries/yearly-summary?year=${year}&location=TEC`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: hulExec = [] } = useQuery<any[]>({
    queryKey: ['/api/hul-kpf-exec-snacks/yearly-summary', year],
    queryFn: () => fetch(`/api/hul-kpf-exec-snacks/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });

  // PEC Ventures
  const { data: pecCanteen = [] } = useQuery<any[]>({
    queryKey: ['/api/pec-ventures-entries/yearly-summary', year],
    queryFn: () => fetch(`/api/pec-ventures-entries/yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pecLunch = [] } = useQuery<any[]>({
    queryKey: ['/api/pec-ventures-entries/lunch-yearly-summary', year],
    queryFn: () => fetch(`/api/pec-ventures-entries/lunch-yearly-summary?year=${year}`, { credentials: 'include' }).then(r => r.json()),
  });

  // Previous year (for comparison)
  const prevYear = year - 1;
  const { data: pUblDate = [] } = useQuery<any[]>({
    queryKey: ['/api/ubl-date-entries/yearly-summary', prevYear],
    queryFn: () => fetch(`/api/ubl-date-entries/yearly-summary?year=${prevYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pCiplaData = [] } = useQuery<any[]>({
    queryKey: ['/api/cipla-date-entries/yearly-summary', prevYear],
    queryFn: () => fetch(`/api/cipla-date-entries/yearly-summary?year=${prevYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pUnichSnacks = [] } = useQuery<any[]>({
    queryKey: ['/api/unichem-snack-entries/yearly-summary', prevYear],
    queryFn: () => fetch(`/api/unichem-snack-entries/yearly-summary?year=${prevYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pUnichLunch = [] } = useQuery<any[]>({
    queryKey: ['/api/unichem-lunch-entries/yearly-summary', prevYear],
    queryFn: () => fetch(`/api/unichem-lunch-entries/yearly-summary?year=${prevYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pHulKpf = [] } = useQuery<any[]>({
    queryKey: ['/api/hul-date-entries/yearly-summary', prevYear, 'KPF'],
    queryFn: () => fetch(`/api/hul-date-entries/yearly-summary?year=${prevYear}&location=KPF`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pHulTec = [] } = useQuery<any[]>({
    queryKey: ['/api/hul-date-entries/yearly-summary', prevYear, 'TEC'],
    queryFn: () => fetch(`/api/hul-date-entries/yearly-summary?year=${prevYear}&location=TEC`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: pPecLunch = [] } = useQuery<any[]>({
    queryKey: ['/api/pec-ventures-entries/lunch-yearly-summary', prevYear],
    queryFn: () => fetch(`/api/pec-ventures-entries/lunch-yearly-summary?year=${prevYear}`, { credentials: 'include' }).then(r => r.json()),
  });

  // Helpers
  const sum = (arr: any[], f: string) => arr.reduce((s, r) => s + (r[f] || 0), 0);
  const monthVal = (arr: any[], m: number, fields: string[]) => {
    const row = (arr as any[]).find((r: any) => r.month === m) || {};
    return fields.reduce((s, f) => s + (row[f] || 0), 0);
  };

  // UBL totals
  const ublBreakfast = sum(ublDate, 'breakfast');
  const ublContractorBreakfast = sum(ublDate, 'contractorBreakfast'); // Added Calculation
  const ublLunchT = sum(ublDate, 'lunch');
  const ublDinner = sum(ublDate, 'dinner');
  const ublTea = sum(ublDate, 'tea');
  const ublMutton = sum(ublDate, 'mutton');
  const ublPerm = sum(ublLunch, 'perment');
  const ublCasual = sum(ublLunch, 'casual');
  const ublContractual = sum(ublLunch, 'contractual');

  // Cipla totals
  const ciplaBreakfast = sum(ciplaData, 'breakfast');
  const ciplaLunch = sum(ciplaData, 'lunch');
  const ciplaDinner = sum(ciplaData, 'dinner');

  // Unichem totals
  const unichBreakfast = sum(unichEmSnacks, 'breakfast');
  const unichEvening = sum(unichEmSnacks, 'eveningSnacks');
  const unichNight = sum(unichEmSnacks, 'nightSnacks');
  const unichLunch = sum(unichEmLunch, 'lunch');
  const unichDinner = sum(unichEmLunch, 'dinner');

  // HUL totals
  const hulKpfBreakfast = sum(hulKpf, 'breakfast');
  const hulKpfLunch = sum(hulKpf, 'lunch');
  const hulKpfEvng = sum(hulKpf, 'eveningSnacks');
  const hulKpfNight = sum(hulKpf, 'nightSnacks');
  const hulTecBreakfast = sum(hulTec, 'breakfast');
  const hulTecLunch = sum(hulTec, 'lunch');
  const hulTecEvng = sum(hulTec, 'eveningSnacks');
  const hulTecNight = sum(hulTec, 'nightSnacks');
  const hulExecSnacks = sum(hulExec, 'snacks');
  const hulExecBiscuit = sum(hulExec, 'biscuit');
  const hulExecSOB = sum(hulExec, 'shiftOfficerBreakfast');

  // PEC totals
  const pecLunchBill = sum(pecLunch, 'lunchBill');
  const pecDinnerBill = sum(pecLunch, 'dinnerBill');
  const pecTea = sum(pecCanteen, 'redLabel') + sum(pecCanteen, 'tataTea') + sum(pecCanteen, 'greenTea');
  const pecCoffee = sum(pecCanteen, 'coffee');
  const pecBiscuit = sum(pecCanteen, 'biscuit');
  const pecMilk = sum(pecCanteen, 'milkMorning') + sum(pecCanteen, 'milkEvening');

  // Chart data
  const ublDateChart = buildMonthChart(ublDate, ['breakfast', 'contractorBreakfast', 'lunch', 'dinner', 'tea']); // Added field
  const ublLunchChart = buildMonthChart(ublLunch, ['perment','casual','contractual','canteen']);
  const ciplaChart = buildMonthChart(ciplaData, ['breakfast','lunch','dinner']);
  const unichSnackChart = buildMonthChart(unichEmSnacks, ['breakfast','eveningSnacks','nightSnacks']);
  const unichLunchChart = buildMonthChart(unichEmLunch, ['lunch','dinner']);
  const hulKpfChart = buildMonthChart(hulKpf, ['breakfast','lunch','eveningSnacks','nightSnacks']);
  const hulTecChart = buildMonthChart(hulTec, ['breakfast','lunch','eveningSnacks','nightSnacks']);
  const hulExecChart = buildMonthChart(hulExec, ['snacks','biscuit','chips','coldDrinkWater','shiftOfficerBreakfast']);

  // Combined HUL monthly (KPF+TEC combined)
  const hulCombinedChart = MONTHS_SHORT.map((name, i) => {
    const kpf = (hulKpf as any[]).find(r => r.month === i + 1) || {};
    const tec = (hulTec as any[]).find(r => r.month === i + 1) || {};
    return {
      name,
      'KPF Total': (kpf.breakfast||0)+(kpf.lunch||0)+(kpf.eveningSnacks||0)+(kpf.nightSnacks||0),
      'TEC Total': (tec.breakfast||0)+(tec.lunch||0)+(tec.eveningSnacks||0)+(tec.nightSnacks||0),
    };
  });

  const grandUbl = ublBreakfast + ublContractorBreakfast + ublLunchT + ublDinner; // Updated grand total
  const grandCipla = ciplaBreakfast + ciplaLunch + ciplaDinner;
  const grandUnichem = unichBreakfast + unichEvening + unichNight + unichLunch + unichDinner;
  const grandHul = hulKpfBreakfast + hulKpfLunch + hulKpfEvng + hulKpfNight + hulTecBreakfast + hulTecLunch + hulTecEvng + hulTecNight;
  const grandPec = pecLunchBill + pecDinnerBill;
  const grandAll = grandUbl + grandCipla + grandUnichem + grandHul + grandPec;

  // Per-client monthly totals (for insights + comparison charts)
  const ublMonthly = MONTHS_SHORT.map((_, i) => monthVal(ublDate, i + 1, ['breakfast', 'contractorBreakfast', 'lunch', 'dinner'])); // Added field
  const ciplaMonthly = MONTHS_SHORT.map((_, i) => monthVal(ciplaData, i + 1, ['breakfast','lunch','dinner']));
  const unichMonthly = MONTHS_SHORT.map((_, i) =>
    monthVal(unichEmSnacks, i + 1, ['breakfast','eveningSnacks','nightSnacks']) + monthVal(unichEmLunch, i + 1, ['lunch','dinner']));
  const hulMonthly = MONTHS_SHORT.map((_, i) =>
    monthVal(hulKpf, i + 1, ['breakfast','lunch','eveningSnacks','nightSnacks']) + monthVal(hulTec, i + 1, ['breakfast','lunch','eveningSnacks','nightSnacks']));
  const pecMonthly = MONTHS_SHORT.map((_, i) => monthVal(pecLunch, i + 1, ['lunchBill','dinnerBill']));
  const allMonthly = MONTHS_SHORT.map((_, i) => ublMonthly[i] + ciplaMonthly[i] + unichMonthly[i] + hulMonthly[i] + pecMonthly[i]);

  // Previous year monthly totals
  const pUblMonthly = MONTHS_SHORT.map((_, i) => monthVal(pUblDate, i + 1, ['breakfast', 'contractorBreakfast', 'lunch', 'dinner'])); // Added field
  const pCiplaMonthly = MONTHS_SHORT.map((_, i) => monthVal(pCiplaData, i + 1, ['breakfast','lunch','dinner']));
  const pUnichMonthly = MONTHS_SHORT.map((_, i) =>
    monthVal(pUnichSnacks, i + 1, ['breakfast','eveningSnacks','nightSnacks']) + monthVal(pUnichLunch, i + 1, ['lunch','dinner']));
  const pHulMonthly = MONTHS_SHORT.map((_, i) =>
    monthVal(pHulKpf, i + 1, ['breakfast','lunch','eveningSnacks','nightSnacks']) + monthVal(pHulTec, i + 1, ['breakfast','lunch','eveningSnacks','nightSnacks']));
  const pPecMonthly = MONTHS_SHORT.map((_, i) => monthVal(pPecLunch, i + 1, ['lunchBill','dinnerBill']));
  const pAllMonthly = MONTHS_SHORT.map((_, i) => pUblMonthly[i] + pCiplaMonthly[i] + pUnichMonthly[i] + pHulMonthly[i] + pPecMonthly[i]);
  const pGrandUbl = pUblMonthly.reduce((a, b) => a + b, 0);
  const pGrandCipla = pCiplaMonthly.reduce((a, b) => a + b, 0);
  const pGrandUnichem = pUnichMonthly.reduce((a, b) => a + b, 0);
  const pGrandHul = pHulMonthly.reduce((a, b) => a + b, 0);
  const pGrandPec = pPecMonthly.reduce((a, b) => a + b, 0);
  const pGrandAll = pAllMonthly.reduce((a, b) => a + b, 0);
  const yoyPct = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const yoyAll = yoyPct(grandAll, pGrandAll);

  // Client share pie
  const shareData = [
    { name: "UBL", value: grandUbl },
    { name: "Cipla", value: grandCipla },
    { name: "Unichem", value: grandUnichem },
    { name: "HUL", value: grandHul },
    { name: "PEC", value: grandPec },
  ].filter(d => d.value > 0);

  // Meal type mix pie (all clients)
  const mealMix = [
    { name: "Breakfast", value: ublBreakfast + ciplaBreakfast + unichBreakfast + hulKpfBreakfast + hulTecBreakfast, color: COLORS.breakfast },
    { name: "Cont. Breakfast", value: ublContractorBreakfast, color: COLORS.contractorBreakfast }, // Added to pie
    { name: "Lunch", value: ublLunchT + ciplaLunch + unichLunch + hulKpfLunch + hulTecLunch + pecLunchBill, color: COLORS.lunch },
    { name: "Dinner", value: ublDinner + ciplaDinner + unichDinner + pecDinnerBill, color: COLORS.dinner },
    { name: "Evening Snacks", value: unichEvening + hulKpfEvng + hulTecEvng, color: COLORS.eveningSnacks },
    { name: "Night Snacks", value: unichNight + hulKpfNight + hulTecNight, color: COLORS.nightSnacks },
  ].filter(d => d.value > 0);

  // Cumulative area chart
  let running = 0;
  const cumulativeChart = MONTHS_SHORT.map((name, i) => {
    running += allMonthly[i];
    return { name, Cumulative: running, Monthly: allMonthly[i] };
  });

  // Overall best month & monthly avg
  const activeAll = allMonthly.filter(v => v > 0);
  const avgAll = activeAll.length > 0 ? Math.round(grandAll / activeAll.length) : 0;
  let bestAllIdx = -1, bestAllVal = 0;
  allMonthly.forEach((v, i) => { if (v > bestAllVal) { bestAllVal = v; bestAllIdx = i; } });

  const pct = (v: number) => grandAll > 0 ? Math.round((v / grandAll) * 100) : 0;

  return (
    <div className="space-y-2">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white p-5 mb-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Coffee className="w-4 h-4" /> All Clients — Data Entry Dashboard
            </div>
            <div className="text-3xl font-extrabold">{grandAll.toLocaleString()} <span className="text-base font-medium text-slate-300">total meals & snacks in {year}</span></div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="rounded-xl bg-white/10 px-4 py-2 text-center backdrop-blur">
              <div className="text-[10px] text-slate-300 uppercase tracking-wide">Monthly Avg</div>
              <div className="text-lg font-bold">{avgAll.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-center backdrop-blur">
              <div className="text-[10px] text-slate-300 uppercase tracking-wide">Best Month</div>
              <div className="text-lg font-bold">{bestAllIdx >= 0 ? `${MONTHS_SHORT[bestAllIdx]} ★` : "—"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-center backdrop-blur">
              <div className="text-[10px] text-slate-300 uppercase tracking-wide">Active Months</div>
              <div className="text-lg font-bold">{activeAll.length} / 12</div>
            </div>
            {yoyAll !== null && (
              <div className={`rounded-xl px-4 py-2 text-center backdrop-blur ${yoyAll >= 0 ? "bg-green-500/25" : "bg-red-500/25"}`}>
                <div className="text-[10px] text-slate-300 uppercase tracking-wide">vs {prevYear}</div>
                <div className="text-lg font-bold">{yoyAll >= 0 ? "+" : ""}{yoyAll}%</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col gap-1 shadow-sm">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">UBL — Yearly Meals</div>
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">{grandUbl.toLocaleString()}</div>
          <div className="text-xs text-amber-600">Breakfast + Lunch + Dinner • {pct(grandUbl)}% of total</div>
        </div>
        <div className="rounded-xl border bg-indigo-50 dark:bg-indigo-900/20 p-4 flex flex-col gap-1 shadow-sm">
          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Cipla — Yearly Meals</div>
          <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">{grandCipla.toLocaleString()}</div>
          <div className="text-xs text-indigo-600">Breakfast + Lunch + Dinner • {pct(grandCipla)}% of total</div>
        </div>
        <div className="rounded-xl border bg-teal-50 dark:bg-teal-900/20 p-4 flex flex-col gap-1 shadow-sm">
          <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">Unichem — Yearly Items</div>
          <div className="text-2xl font-bold text-teal-800 dark:text-teal-200">{grandUnichem.toLocaleString()}</div>
          <div className="text-xs text-teal-600">Snacks + Lunch + Dinner • {pct(grandUnichem)}% of total</div>
        </div>
        <div className="rounded-xl border bg-green-50 dark:bg-green-900/20 p-4 flex flex-col gap-1 shadow-sm">
          <div className="text-xs font-semibold text-green-700 dark:text-green-300">HUL — Yearly Meals</div>
          <div className="text-2xl font-bold text-green-800 dark:text-green-200">{grandHul.toLocaleString()}</div>
          <div className="text-xs text-green-600">KPF + TEC (all meals) • {pct(grandHul)}% of total</div>
        </div>
        <div className="rounded-xl border bg-pink-50 dark:bg-pink-900/20 p-4 flex flex-col gap-1 shadow-sm">
          <div className="text-xs font-semibold text-pink-700 dark:text-pink-300">PEC Ventures — Yearly Meals</div>
          <div className="text-2xl font-bold text-pink-800 dark:text-pink-200">{grandPec.toLocaleString()}</div>
          <div className="text-xs text-pink-600">Lunch + Dinner (Bill Qty) • {pct(grandPec)}% of total</div>
        </div>
      </div>

      {/* Overview charts: share pie, meal mix pie, cumulative area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-2">
        <ChartCard title="Client Share — Who Serves the Most?">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <PieChart>
              <Pie data={shareData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}
                label={(p: any) => `${p.name} ${grandAll > 0 ? Math.round((p.value / grandAll) * 100) : 0}%`} labelLine={false} fontSize={11}>
                {shareData.map(d => <Cell key={d.name} fill={CLIENT_COLORS[d.name]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Meal Type Mix — All Clients Combined">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <PieChart>
              <Pie data={mealMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={(p: any) => `${p.name}`} labelLine fontSize={10}>
                {mealMix.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={`Running Total Through ${year}`}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <AreaChart data={cumulativeChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
              <Area type="monotone" dataKey="Cumulative" stroke="#6366f1" strokeWidth={2} fill="url(#cumGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Stacked monthly volume by client */}
      <ChartCard title="Monthly Volume by Client (Stacked)">
        <ResponsiveContainer width="100%" height={CHART_H + 20}>
          <BarChart data={MONTHS_SHORT.map((name, i) => ({ name, UBL: ublMonthly[i], Cipla: ciplaMonthly[i], Unichem: unichMonthly[i], HUL: hulMonthly[i], PEC: pecMonthly[i] }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="UBL" stackId="a" fill={CLIENT_COLORS.UBL} />
            <Bar dataKey="Cipla" stackId="a" fill={CLIENT_COLORS.Cipla} />
            <Bar dataKey="Unichem" stackId="a" fill={CLIENT_COLORS.Unichem} />
            <Bar dataKey="HUL" stackId="a" fill={CLIENT_COLORS.HUL} />
            <Bar dataKey="PEC" stackId="a" fill={CLIENT_COLORS.PEC} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ========== UBL SECTION ========== */}
      <SectionHeader title="United Breweries Ltd (UBL)" subtitle="Meal & Snack Data — Bill Data Sheet + Lunch Per Day" color="#f59e0b" />
      <InsightStrip monthlyTotals={ublMonthly} color="#f59e0b" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        <StatCard label="Breakfast" value={ublBreakfast} color={COLORS.breakfast} />
        <StatCard label="Cont. Brkft" value={ublContractorBreakfast} color={COLORS.contractorBreakfast} />
        <StatCard label="Lunch" value={ublLunchT} color={COLORS.lunch} />
        <StatCard label="Dinner" value={ublDinner} color={COLORS.dinner} />
        <StatCard label="Total Tea" value={ublTea} color={COLORS.tea} />
        <StatCard label="Mutton" value={ublMutton} color={COLORS.mutton} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
        <ChartCard title="UBL — Monthly Meals (Breakfast / Cont. / Lunch / Dinner / Tea)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={ublDateChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="breakfast" name="Breakfast" fill={COLORS.breakfast} radius={[2,2,0,0]} />
              <Bar dataKey="contractorBreakfast" name="Cont. Brkft" fill={COLORS.contractorBreakfast} radius={[2,2,0,0]} />
              <Bar dataKey="lunch" name="Lunch" fill={COLORS.lunch} radius={[2,2,0,0]} />
              <Bar dataKey="dinner" name="Dinner" fill={COLORS.dinner} radius={[2,2,0,0]} />
              <Bar dataKey="tea" name="Tea (All)" fill={COLORS.tea} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="UBL — Monthly Lunch Per Day (Permanent / Casual / Contractual)">
          <div className="flex gap-3 mb-2">
            <StatCard label="Permanent" value={ublPerm} color={COLORS.perment} />
            <StatCard label="Casual" value={ublCasual} color={COLORS.casual} />
            <StatCard label="Contractual" value={ublContractual} color={COLORS.contractual} />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ublLunchChart} margin={{ top: 0, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="perment" name="Permanent" fill={COLORS.perment} radius={[2,2,0,0]} />
              <Bar dataKey="casual" name="Casual" fill={COLORS.casual} radius={[2,2,0,0]} />
              <Bar dataKey="contractual" name="Contractual" fill={COLORS.contractual} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ========== CIPLA SECTION ========== */}
      <SectionHeader title="Cipla Limited" subtitle="Daily Breakfast / Lunch / Dinner (Coupon + Coin + Sign + Machine)" color="#6366f1" />
      <InsightStrip monthlyTotals={ciplaMonthly} color="#6366f1" />
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Breakfast (Total)" value={ciplaBreakfast} color={COLORS.breakfast} />
        <StatCard label="Lunch (Total)" value={ciplaLunch} color={COLORS.lunch} />
        <StatCard label="Dinner (Total)" value={ciplaDinner} color={COLORS.dinner} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
        <ChartCard title="Cipla — Monthly Meals (Breakfast / Lunch / Dinner — All Methods Combined)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={ciplaChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="breakfast" name="Breakfast" fill={COLORS.breakfast} radius={[2,2,0,0]} />
              <Bar dataKey="lunch" name="Lunch" fill={COLORS.lunch} radius={[2,2,0,0]} />
              <Bar dataKey="dinner" name="Dinner" fill={COLORS.dinner} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cipla — Monthly Total Trend">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <AreaChart data={MONTHS_SHORT.map((name, i) => ({ name, Total: ciplaMonthly[i] }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="ciplaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
              <Area type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} fill="url(#ciplaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ========== UNICHEM SECTION ========== */}
      <SectionHeader title="Unichem Laboratories Ltd" subtitle="Form 1 (Snacks) + Form 2 (Lunch & Dinner) — All Locations Combined" color="#14b8a6" />
      <InsightStrip monthlyTotals={unichMonthly} color="#14b8a6" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <StatCard label="Breakfast" value={unichBreakfast} color={COLORS.breakfast} />
        <StatCard label="Evening Snacks" value={unichEvening} color={COLORS.eveningSnacks} />
        <StatCard label="Night Snacks" value={unichNight} color={COLORS.nightSnacks} />
        <StatCard label="Lunch" value={unichLunch} color={COLORS.lunch} />
        <StatCard label="Dinner" value={unichDinner} color={COLORS.dinner} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
        <ChartCard title="Unichem — Monthly Snacks (Breakfast / Evening / Night Snacks)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={unichSnackChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="breakfast" name="Breakfast" fill={COLORS.breakfast} radius={[2,2,0,0]} />
              <Bar dataKey="eveningSnacks" name="Evening Snacks" fill={COLORS.eveningSnacks} radius={[2,2,0,0]} />
              <Bar dataKey="nightSnacks" name="Night Snacks" fill={COLORS.nightSnacks} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Unichem — Monthly Lunch & Dinner (Bill Qty)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={unichLunchChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="lunch" name="Lunch" fill={COLORS.lunch} radius={[2,2,0,0]} />
              <Bar dataKey="dinner" name="Dinner" fill={COLORS.dinner} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ========== HUL SECTION ========== */}
      <SectionHeader title="Hindustan Unilever Limited (HUL)" subtitle="KPF Location + TEC Location + KPF Exec Snacks" color="#16a34a" />
      <InsightStrip monthlyTotals={hulMonthly} color="#16a34a" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20 shadow-sm">
          <div className="text-xs font-semibold text-green-700 mb-1">KPF — Total Meals</div>
          <div className="text-lg font-bold text-green-800">{(hulKpfBreakfast+hulKpfLunch+hulKpfEvng+hulKpfNight).toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-0.5">BF:{hulKpfBreakfast} L:{hulKpfLunch} E:{hulKpfEvng} N:{hulKpfNight}</div>
        </div>
        <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20 shadow-sm">
          <div className="text-xs font-semibold text-blue-700 mb-1">TEC — Total Meals</div>
          <div className="text-lg font-bold text-blue-800">{(hulTecBreakfast+hulTecLunch+hulTecEvng+hulTecNight).toLocaleString()}</div>
          <div className="text-xs text-blue-600 mt-0.5">BF:{hulTecBreakfast} L:{hulTecLunch} E:{hulTecEvng} N:{hulTecNight}</div>
        </div>
        <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 shadow-sm">
          <div className="text-xs font-semibold text-amber-700 mb-1">Exec Snacks</div>
          <div className="text-lg font-bold text-amber-800">{hulExecSnacks.toLocaleString()}</div>
          <div className="text-xs text-amber-600 mt-0.5">Snacks</div>
        </div>
        <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 shadow-sm">
          <div className="text-xs font-semibold text-amber-700 mb-1">Exec Biscuits</div>
          <div className="text-lg font-bold text-amber-800">{hulExecBiscuit.toLocaleString()}</div>
          <div className="text-xs text-amber-600 mt-0.5">Biscuit packs</div>
        </div>
        <div className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-900/20 shadow-sm">
          <div className="text-xs font-semibold text-orange-700 mb-1">SO Breakfast</div>
          <div className="text-lg font-bold text-orange-800">{hulExecSOB.toLocaleString()}</div>
          <div className="text-xs text-orange-600 mt-0.5">Shift Officer Bfast</div>
        </div>
      </div>

      {/* HUL Combined Overview */}
      <ChartCard title="HUL — KPF vs TEC Monthly Totals (Combined Meals)">
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={hulCombinedChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="KPF Total" fill={COLORS.kpfTotal} radius={[2,2,0,0]} />
            <Bar dataKey="TEC Total" fill={COLORS.tecTotal} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <ChartCard title="HUL KPF — Monthly Breakdown (Breakfast / Lunch / Evng / Night)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={hulKpfChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="breakfast" name="Breakfast" fill={COLORS.breakfast} radius={[2,2,0,0]} />
              <Bar dataKey="lunch" name="Lunch" fill={COLORS.lunch} radius={[2,2,0,0]} />
              <Bar dataKey="eveningSnacks" name="Evng Snacks" fill={COLORS.eveningSnacks} radius={[2,2,0,0]} />
              <Bar dataKey="nightSnacks" name="Night Snacks" fill={COLORS.nightSnacks} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="HUL TEC — Monthly Breakdown (Breakfast / Lunch / Evng / Night)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={hulTecChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="breakfast" name="Breakfast" fill={COLORS.breakfast} radius={[2,2,0,0]} />
              <Bar dataKey="lunch" name="Lunch" fill={COLORS.lunch} radius={[2,2,0,0]} />
              <Bar dataKey="eveningSnacks" name="Evng Snacks" fill={COLORS.eveningSnacks} radius={[2,2,0,0]} />
              <Bar dataKey="nightSnacks" name="Night Snacks" fill={COLORS.nightSnacks} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="HUL KPF Exec Snacks — Monthly (Snacks / Biscuit / Chips / Cold Drink & Water / SO Breakfast)">
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={hulExecChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="snacks" name="Snacks" fill={COLORS.snacks} radius={[2,2,0,0]} />
            <Bar dataKey="biscuit" name="Biscuit" fill={COLORS.biscuit} radius={[2,2,0,0]} />
            <Bar dataKey="chips" name="Chips" fill={COLORS.chips} radius={[2,2,0,0]} />
            <Bar dataKey="coldDrinkWater" name="Cold Drink & Water" fill={COLORS.coldDrinkWater} radius={[2,2,0,0]} />
            <Bar dataKey="shiftOfficerBreakfast" name="SO Breakfast" fill="#ea580c" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ========== PEC VENTURES SECTION ========== */}
      <SectionHeader title="PEC Ventures Private Limited" subtitle="Lunch & Dinner (Bill Qty) + Canteen Expense Items" color="#db2777" />
      <InsightStrip monthlyTotals={pecMonthly} color="#db2777" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        <StatCard label="Lunch (Bill)" value={pecLunchBill} color={COLORS.lunch} />
        <StatCard label="Dinner (Bill)" value={pecDinnerBill} color={COLORS.dinner} />
        <StatCard label="Tea (All Types)" value={pecTea} color={COLORS.tea} />
        <StatCard label="Coffee" value={pecCoffee} color="#92400e" />
        <StatCard label="Biscuit" value={pecBiscuit} color={COLORS.biscuit} />
        <StatCard label="Milk (Mor+Evn)" value={pecMilk} color="#3b82f6" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
        <ChartCard title="PEC Ventures — Monthly Lunch & Dinner (Bill Qty)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={buildMonthChart(pecLunch, ['lunchBill','dinnerBill'])} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="lunchBill" name="Lunch" fill={COLORS.lunch} radius={[2,2,0,0]} />
              <Bar dataKey="dinnerBill" name="Dinner" fill={COLORS.dinner} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="PEC Ventures — Monthly Canteen Items (Tea / Coffee / Sugar / Biscuit / Milk)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={MONTHS_SHORT.map((name, i) => {
              const row = (pecCanteen as any[]).find((r: any) => r.month === i + 1) || {};
              return {
                name,
                Tea: (row.redLabel||0)+(row.tataTea||0)+(row.greenTea||0),
                Coffee: row.coffee||0,
                Sugar: row.sugar||0,
                Biscuit: row.biscuit||0,
                Milk: (row.milkMorning||0)+(row.milkEvening||0),
              };
            })} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Tea" fill={COLORS.tea} radius={[2,2,0,0]} />
              <Bar dataKey="Coffee" fill="#92400e" radius={[2,2,0,0]} />
              <Bar dataKey="Sugar" fill="#94a3b8" radius={[2,2,0,0]} />
              <Bar dataKey="Biscuit" fill={COLORS.biscuit} radius={[2,2,0,0]} />
              <Bar dataKey="Milk" fill="#3b82f6" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ========== YEAR VS YEAR ========== */}
      <SectionHeader title={`${year} vs ${prevYear} — Year Comparison`} subtitle="This year compared with last year" color="#0ea5e9" />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        {[
          { name: "All Clients", cur: grandAll, prev: pGrandAll, color: "#0ea5e9" },
          { name: "UBL", cur: grandUbl, prev: pGrandUbl, color: CLIENT_COLORS.UBL },
          { name: "Cipla", cur: grandCipla, prev: pGrandCipla, color: CLIENT_COLORS.Cipla },
          { name: "Unichem", cur: grandUnichem, prev: pGrandUnichem, color: CLIENT_COLORS.Unichem },
          { name: "HUL", cur: grandHul, prev: pGrandHul, color: CLIENT_COLORS.HUL },
          { name: "PEC", cur: grandPec, prev: pGrandPec, color: CLIENT_COLORS.PEC },
        ].map(c => {
          const chg = yoyPct(c.cur, c.prev);
          return (
            <div key={c.name} className="rounded-xl border p-3 bg-white dark:bg-gray-900 shadow-sm" style={{ borderTopWidth: 3, borderTopColor: c.color }}>
              <div className="text-xs font-semibold" style={{ color: c.color }}>{c.name}</div>
              <div className="text-lg font-bold">{c.cur.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground">Last year: {c.prev.toLocaleString()}</div>
              {chg !== null ? (
                <div className={`text-xs font-bold mt-0.5 inline-flex items-center gap-1 ${chg >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {chg >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {chg >= 0 ? "+" : ""}{chg}% vs {prevYear}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-0.5">No data for {prevYear}</div>
              )}
            </div>
          );
        })}
      </div>
      <ChartCard title={`Monthly Totals — ${year} vs ${prevYear} (All Clients Combined)`}>
        <ResponsiveContainer width="100%" height={CHART_H + 20}>
          <BarChart data={MONTHS_SHORT.map((name, i) => ({ name, [String(year)]: allMonthly[i], [String(prevYear)]: pAllMonthly[i] }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={String(prevYear)} fill="#94a3b8" radius={[2,2,0,0]} />
            <Bar dataKey={String(year)} fill="#0ea5e9" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {[
          { name: "UBL", cur: ublMonthly, prev: pUblMonthly, color: CLIENT_COLORS.UBL },
          { name: "Cipla", cur: ciplaMonthly, prev: pCiplaMonthly, color: CLIENT_COLORS.Cipla },
          { name: "Unichem", cur: unichMonthly, prev: pUnichMonthly, color: CLIENT_COLORS.Unichem },
          { name: "HUL", cur: hulMonthly, prev: pHulMonthly, color: CLIENT_COLORS.HUL },
          { name: "PEC Ventures", cur: pecMonthly, prev: pPecMonthly, color: CLIENT_COLORS.PEC },
        ].map(c => (
          <ChartCard key={c.name} title={`${c.name} — ${year} vs ${prevYear} Monthly Totals`}>
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={MONTHS_SHORT.map((name, i) => ({ name, [String(year)]: c.cur[i], [String(prevYear)]: c.prev[i] }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey={String(prevYear)} fill="#94a3b8" radius={[2,2,0,0]} />
                <Bar dataKey={String(year)} fill={c.color} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </div>

      {/* All Clients Comparison */}
      <SectionHeader title="All Clients — Monthly Comparison" subtitle="Total meal/snack count per month across all clients" color="#374151" />
      <ChartCard title="Combined Monthly Volume — UBL vs Cipla vs Unichem vs HUL">
        <ResponsiveContainer width="100%" height={CHART_H + 30}>
          <LineChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            data={MONTHS_SHORT.map((name, i) => ({ name, UBL: ublMonthly[i], Cipla: ciplaMonthly[i], Unichem: unichMonthly[i], HUL: hulMonthly[i], PEC: pecMonthly[i] }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="UBL" stroke={CLIENT_COLORS.UBL} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Cipla" stroke={CLIENT_COLORS.Cipla} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Unichem" stroke={CLIENT_COLORS.Unichem} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="HUL" stroke={CLIENT_COLORS.HUL} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="PEC" stroke={CLIENT_COLORS.PEC} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Month-by-month summary table */}
      <ChartCard title="Month-by-Month Summary Table (All Clients)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-semibold">Month</th>
                <th className="text-right p-2 font-semibold" style={{ color: CLIENT_COLORS.UBL }}>UBL</th>
                <th className="text-right p-2 font-semibold" style={{ color: CLIENT_COLORS.Cipla }}>Cipla</th>
                <th className="text-right p-2 font-semibold" style={{ color: CLIENT_COLORS.Unichem }}>Unichem</th>
                <th className="text-right p-2 font-semibold" style={{ color: CLIENT_COLORS.HUL }}>HUL</th>
                <th className="text-right p-2 font-semibold" style={{ color: CLIENT_COLORS.PEC }}>PEC</th>
                <th className="text-right p-2 font-semibold">Total</th>
                <th className="text-right p-2 font-semibold">% of Year</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS_SHORT.map((name, i) => (
                <tr key={name} className={`border-b hover:bg-muted/30 ${i === bestAllIdx && allMonthly[i] > 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}`}>
                  <td className="p-2 font-medium">{name}{i === bestAllIdx && allMonthly[i] > 0 ? " ★" : ""}</td>
                  <td className="p-2 text-right font-mono">{ublMonthly[i].toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">{ciplaMonthly[i].toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">{unichMonthly[i].toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">{hulMonthly[i].toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">{pecMonthly[i].toLocaleString()}</td>
                  <td className="p-2 text-right font-mono font-bold">{allMonthly[i].toLocaleString()}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{grandAll > 0 ? Math.round((allMonthly[i] / grandAll) * 100) : 0}%</td>
                </tr>
              ))}
              <tr className="font-bold bg-muted/50">
                <td className="p-2">Total</td>
                <td className="p-2 text-right font-mono">{grandUbl.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{grandCipla.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{grandUnichem.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{grandHul.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{grandPec.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{grandAll.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
