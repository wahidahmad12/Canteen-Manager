import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const COLORS = {
  breakfast: "#f59e0b",
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

function buildMonthChart(data: { month: number }[], fields: string[]): any[] {
  return MONTHS_SHORT.map((name, i) => {
    const row = (data as any[]).find((r: any) => r.month === i + 1) || {};
    const entry: Record<string, any> = { name };
    fields.forEach(f => { entry[f] = row[f] || 0; });
    return entry;
  });
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: any }) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-0.5`} style={{ borderLeftWidth: 4, borderLeftColor: color }}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-xl font-bold" style={{ color }}>{value.toLocaleString()}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle, color }: { title: string; subtitle?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-6">
      <div className="w-1 rounded-full h-8" style={{ background: color }} />
      <div>
        <div className="text-base font-bold" style={{ color }}>{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 bg-white dark:bg-gray-900">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</div>
      {children}
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

  // Helpers
  const sum = (arr: any[], f: string) => arr.reduce((s, r) => s + (r[f] || 0), 0);

  // UBL totals
  const ublBreakfast = sum(ublDate, 'breakfast');
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

  // Chart data
  const ublDateChart = buildMonthChart(ublDate, ['breakfast','lunch','dinner','tea']);
  const ublLunchChart = buildMonthChart(ublLunch, ['perment','casual','contractual','canteen']);
  const ciplaChart = buildMonthChart(ciplaData, ['breakfast','lunch','dinner']);
  const unichSnackChart = buildMonthChart(unichEmSnacks, ['breakfast','eveningSnacks','nightSnacks']);
  const unichLunchChart = buildMonthChart(unichEmLunch, ['lunch','dinner']);
  const hulKpfChart = buildMonthChart(hulKpf, ['breakfast','lunch','eveningSnacks','nightSnacks']);
  const hulTecChart = buildMonthChart(hulTec, ['breakfast','lunch','eveningSnacks','nightSnacks']);
  const hulExecChart = buildMonthChart(hulExec, ['snacks','biscuit','chips','coldDrinkWater']);

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

  const grandUbl = ublBreakfast + ublLunchT + ublDinner;
  const grandCipla = ciplaBreakfast + ciplaLunch + ciplaDinner;
  const grandUnichem = unichBreakfast + unichEvening + unichNight + unichLunch + unichDinner;
  const grandHul = hulKpfBreakfast + hulKpfLunch + hulKpfEvng + hulKpfNight + hulTecBreakfast + hulTecLunch + hulTecEvng + hulTecNight;

  return (
    <div className="space-y-2">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-900/20 p-4 flex flex-col gap-1">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">UBL — Yearly Meals</div>
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">{grandUbl.toLocaleString()}</div>
          <div className="text-xs text-amber-600">Breakfast + Lunch + Dinner</div>
        </div>
        <div className="rounded-xl border bg-indigo-50 dark:bg-indigo-900/20 p-4 flex flex-col gap-1">
          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Cipla — Yearly Meals</div>
          <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">{grandCipla.toLocaleString()}</div>
          <div className="text-xs text-indigo-600">Breakfast + Lunch + Dinner</div>
        </div>
        <div className="rounded-xl border bg-teal-50 dark:bg-teal-900/20 p-4 flex flex-col gap-1">
          <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">Unichem — Yearly Items</div>
          <div className="text-2xl font-bold text-teal-800 dark:text-teal-200">{grandUnichem.toLocaleString()}</div>
          <div className="text-xs text-teal-600">Snacks + Lunch + Dinner</div>
        </div>
        <div className="rounded-xl border bg-green-50 dark:bg-green-900/20 p-4 flex flex-col gap-1">
          <div className="text-xs font-semibold text-green-700 dark:text-green-300">HUL — Yearly Meals</div>
          <div className="text-2xl font-bold text-green-800 dark:text-green-200">{grandHul.toLocaleString()}</div>
          <div className="text-xs text-green-600">KPF + TEC (all meals)</div>
        </div>
      </div>

      {/* ========== UBL SECTION ========== */}
      <SectionHeader title="United Breweries Ltd (UBL)" subtitle="Meal & Snack Data — Bill Data Sheet + Lunch Per Day" color="#f59e0b" />
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        <StatCard label="Breakfast" value={ublBreakfast} color={COLORS.breakfast} />
        <StatCard label="Lunch" value={ublLunchT} color={COLORS.lunch} />
        <StatCard label="Dinner" value={ublDinner} color={COLORS.dinner} />
        <StatCard label="Total Tea" value={ublTea} color={COLORS.tea} />
        <StatCard label="Mutton" value={ublMutton} color={COLORS.mutton} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
        <ChartCard title="UBL — Monthly Meals (Breakfast / Lunch / Dinner / Tea)">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={ublDateChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="breakfast" name="Breakfast" fill={COLORS.breakfast} radius={[2,2,0,0]} />
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
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Breakfast (Total)" value={ciplaBreakfast} color={COLORS.breakfast} />
        <StatCard label="Lunch (Total)" value={ciplaLunch} color={COLORS.lunch} />
        <StatCard label="Dinner (Total)" value={ciplaDinner} color={COLORS.dinner} />
      </div>
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

      {/* ========== UNICHEM SECTION ========== */}
      <SectionHeader title="Unichem Laboratories Ltd" subtitle="Form 1 (Snacks) + Form 2 (Lunch & Dinner) — All Locations Combined" color="#14b8a6" />
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
          <div className="text-xs font-semibold text-green-700 mb-1">KPF — Total Meals</div>
          <div className="text-lg font-bold text-green-800">{(hulKpfBreakfast+hulKpfLunch+hulKpfEvng+hulKpfNight).toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-0.5">BF:{hulKpfBreakfast} L:{hulKpfLunch} E:{hulKpfEvng} N:{hulKpfNight}</div>
        </div>
        <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
          <div className="text-xs font-semibold text-blue-700 mb-1">TEC — Total Meals</div>
          <div className="text-lg font-bold text-blue-800">{(hulTecBreakfast+hulTecLunch+hulTecEvng+hulTecNight).toLocaleString()}</div>
          <div className="text-xs text-blue-600 mt-0.5">BF:{hulTecBreakfast} L:{hulTecLunch} E:{hulTecEvng} N:{hulTecNight}</div>
        </div>
        <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
          <div className="text-xs font-semibold text-amber-700 mb-1">Exec Snacks</div>
          <div className="text-lg font-bold text-amber-800">{hulExecSnacks.toLocaleString()}</div>
          <div className="text-xs text-amber-600 mt-0.5">Snacks</div>
        </div>
        <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
          <div className="text-xs font-semibold text-amber-700 mb-1">Exec Biscuits</div>
          <div className="text-lg font-bold text-amber-800">{hulExecBiscuit.toLocaleString()}</div>
          <div className="text-xs text-amber-600 mt-0.5">Biscuit packs</div>
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

      <ChartCard title="HUL KPF Exec Snacks — Monthly (Snacks / Biscuit / Chips / Cold Drink & Water)">
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
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* All Clients Comparison Line Chart */}
      <SectionHeader title="All Clients — Monthly Comparison" subtitle="Total meal/snack count per month across all clients" color="#374151" />
      <ChartCard title="Combined Monthly Volume — UBL vs Cipla vs Unichem vs HUL">
        <ResponsiveContainer width="100%" height={CHART_H + 30}>
          <LineChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            data={MONTHS_SHORT.map((name, i) => {
              const ud = (ublDate as any[]).find(r => r.month === i+1) || {};
              const cd = (ciplaData as any[]).find(r => r.month === i+1) || {};
              const us = (unichEmSnacks as any[]).find(r => r.month === i+1) || {};
              const ul = (unichEmLunch as any[]).find(r => r.month === i+1) || {};
              const kpf = (hulKpf as any[]).find(r => r.month === i+1) || {};
              const tec = (hulTec as any[]).find(r => r.month === i+1) || {};
              return {
                name,
                UBL: (ud.breakfast||0)+(ud.lunch||0)+(ud.dinner||0),
                Cipla: (cd.breakfast||0)+(cd.lunch||0)+(cd.dinner||0),
                Unichem: (us.breakfast||0)+(us.eveningSnacks||0)+(us.nightSnacks||0)+(ul.lunch||0)+(ul.dinner||0),
                HUL: (kpf.breakfast||0)+(kpf.lunch||0)+(kpf.eveningSnacks||0)+(kpf.nightSnacks||0)+(tec.breakfast||0)+(tec.lunch||0)+(tec.eveningSnacks||0)+(tec.nightSnacks||0),
              };
            })}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="UBL" stroke={COLORS.tea} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Cipla" stroke={COLORS.dinner} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Unichem" stroke={COLORS.eveningSnacks} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="HUL" stroke={COLORS.kpfTotal} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
