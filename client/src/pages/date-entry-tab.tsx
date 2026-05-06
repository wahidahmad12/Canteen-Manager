import { useState, useRef, useEffect, useMemo } from "react";
import { DateEntryDashboard } from "./date-entry-dashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-reports";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2, Printer, Loader2, Save, AlertTriangle, CheckCircle2, FileDown, FileUp, RefreshCw } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function normDate(dateStr: string): string {
  if (!dateStr) return "";
  const s = dateStr.includes("T") ? dateStr.split("T")[0] : String(dateStr);
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) { const [d, m, y] = s.split('-'); return `${y}-${m}-${d}`; }
  return s;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeFormat(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const s = normDate(dateStr);
    const d = new Date(s + "T00:00:00");
    if (isNaN(d.getTime())) return s;
    return format(d, "dd-MM-yyyy");
  } catch { return dateStr; }
}

function getWeekDay(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(normDate(dateStr) + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return WEEKDAYS[d.getDay()] || "";
}
const isSunday = (dateStr: string) => { try { return new Date(normDate(dateStr)+"T00:00:00").getDay() === 0; } catch { return false; } };
const isWed = (dateStr: string) => { try { return new Date(normDate(dateStr)+"T00:00:00").getDay() === 3; } catch { return false; } };

// Billing period: 21st of selected month → 20th of next month
function getBillingRange(month: number, year: number): { startDate: string; endDate: string; label: string } {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const startDate = `${year}-${String(month).padStart(2,'0')}-21`;
  const endDate   = `${nextYear}-${String(nextMonth).padStart(2,'0')}-20`;
  const label = `21 ${MONTHS[month-1].slice(0,3)} ${year} – 20 ${MONTHS[nextMonth-1].slice(0,3)} ${nextYear}`;
  return { startDate, endDate, label };
}

// ============================================================
// UBL Format 1 — Bill Data Sheet (Food Items)
// ============================================================

type UblRow = {
  id?: number;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  tea1: number; biscuit1: number; breakfast: number; tea2: number;
  lunch: number; mutton: number;
  tea3: number; biscuit2: number; tiffin: number; boiledEgg: number;
  tea4: number; dinner: number; tea5: number; tea6: number;
  _dirty?: boolean;
};

const UBL_RATES = { breakfast: 20, lunch: 50, mutton: 149, tiffin: 25, dinner: 48, tea: 7, biscuit: 0.5, boiledEgg: 7 };

function ublRowDefaults(dateStr: string, month: number, year: number): UblRow {
  return {
    entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr),
    tea1:0,biscuit1:0,breakfast:0,tea2:0,lunch:0,mutton:0,tea3:0,biscuit2:0,tiffin:0,boiledEgg:0,tea4:0,dinner:0,tea5:0,tea6:0,
    _dirty: true,
  };
}

function UblDateEntryTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const importRef1 = useRef<HTMLInputElement>(null);
  const [localRows, setLocalRows] = useState<UblRow[]>([]);
  useEffect(() => { setLocalRows([]); }, [month, year]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<UblRow[]>({
    queryKey: ['/api/ubl-date-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/ubl-date-entries?month=${month}&year=${year}`, { credentials: "include" });
      const data = await res.json();
      return data.map((r: UblRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed) }; });
    },
  });

  const handleAutoFill = (freshRows?: UblRow[]) => {
    const source = freshRows ?? dbRows;
    const generated = generateBillingRows(month, year, ublRowDefaults);
    const existing = source.reduce((acc: Record<string, UblRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g));
  };

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => { handleAutoFill((result.data || []) as UblRow[]); });
    }
  }, [loadKey]);

  const rows: UblRow[] = localRows.length > 0 ? localRows : dbRows.map(r => ({ ...r }));

  const createMutation = useMutation({
    mutationFn: async (data: UblRow) => {
      const res = await fetch('/api/ubl-date-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/ubl-date-entries', month, year] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/ubl-date-entries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/ubl-date-entries', month, year] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/ubl-date-entries/${id}`, { method: 'DELETE', credentials: "include" }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/ubl-date-entries', month, year] }),
  });

  const syncRows = () => { if (localRows.length === 0) setLocalRows(dbRows.map(r => ({ ...r }))); };

  const handleCellChange = (idx: number, field: keyof UblRow, value: string) => {
    syncRows();
    setLocalRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      (row as any)[field] = (field === 'entryDate' || field === 'weekDay') ? value : (parseInt(value) || 0);
      if (field === 'entryDate') {
        row.weekDay = getWeekDay(value);
        if (value) { const d = new Date(value+"T00:00:00"); row.month = d.getMonth()+1; row.year = d.getFullYear(); }
      }
      if (field === 'tiffin') {
        row.boiledEgg = parseInt(value) || 0;
      }
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  const { endDate: billingEnd1 } = getBillingRange(month, year);

  const handleAddRow = () => {
    let nextDate: string;
    if (rows.length === 0) {
      nextDate = `${year}-${String(month).padStart(2,'0')}-21`;
    } else {
      const lastDate = normDate(rows[rows.length - 1].entryDate);
      const d = new Date(lastDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      nextDate = localDateStr(d);
    }
    if (nextDate > billingEnd1) {
      toast({ title: "Billing period complete", description: `All dates up to ${billingEnd1} already added.`, variant: "destructive" });
      return;
    }
    syncRows();
    setLocalRows(prev => [...prev, ublRowDefaults(nextDate, month, year)]);
  };

  const handleSaveRow = async (row: UblRow, idx: number) => {
    try {
      const { _dirty, id, ...data } = row;
      if (id) await updateMutation.mutateAsync({ id, data });
      else await createMutation.mutateAsync(row);
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r._dirty);
    if (!dirty.length) { toast({ title: "Nothing to save" }); return; }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]._dirty) await handleSaveRow(rows[i], i);
    }
  };

  const handleDeleteRow = async (row: UblRow, idx: number) => {
    if (row.id) await deleteMutation.mutateAsync(row.id);
    setLocalRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>UBL Bill Data Sheet</title><style>
      *{box-sizing:border-box;}
      body{font-family:"Times New Roman",Times,serif;margin:0;font-size:12pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3{text-align:center;margin:2px 0;font-size:13pt;font-weight:bold;}
      h4,p{text-align:center;margin:1px 0;font-size:11pt;}
      table{width:100%;border-collapse:collapse;margin-top:6px;table-layout:auto;}
      th,td{border:1px solid #333;padding:1px 3px;text-align:center;font-size:12pt;font-family:"Times New Roman",Times,serif;white-space:nowrap;}
      th{background:#1a3a5a!important;color:white!important;font-size:10pt;font-weight:bold;}
      .total-row{font-weight:bold;background:#e8f0fe!important;}
      .orange-row{background:#ffa500!important;}
      .green-row{background:#90EE90!important;}
      .summary-table{width:45%;margin-left:auto;margin-right:0;margin-top:6px;}
      @media print{@page{margin:5mm;size:A4 portrait;}body{margin:0;}table{page-break-inside:auto;}tr{page-break-inside:avoid;}}
    </style></head><body>${printContent}</body></html>`);
    win.document.close();
    win.print();
  };

  const UBL1_COLS = [
    { header:"Date", field:"entryDate" },
    { header:"Month", field:"month" },
    { header:"Day", field:"weekDay" },
    { header:"Tea (5:30AM)", field:"tea1" },
    { header:"Biscuit (5:30AM)", field:"biscuit1" },
    { header:"Breakfast", field:"breakfast" },
    { header:"Lunch", field:"lunch" },
    { header:"Mutton", field:"mutton" },
    { header:"Tea (3:30PM)", field:"tea3" },
    { header:"Biscuit (3:30PM)", field:"biscuit2" },
    { header:"Teffin", field:"tiffin" },
    { header:"Egg", field:"boiledEgg" },
    { header:"Dinner", field:"dinner" },
    { header:"Tea (12AM)", field:"tea5" },
    { header:"Tea (4AM)", field:"tea6" },
  ];

  const handleExportExcel1 = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("UBL Date Entry");
    const thin = { top:{style:"thin"as const}, bottom:{style:"thin"as const}, left:{style:"thin"as const}, right:{style:"thin"as const} };
    // Header
    const hdr = ws.addRow(UBL1_COLS.map(c=>c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:"FFFFFFFF"}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1A3A5A"}}; cell.border=thin; cell.alignment={horizontal:"center"}; });
    ws.columns = UBL1_COLS.map((c,i)=>({ width: i===0?14:12 }));
    // Data
    rows.forEach(r => {
      const calMonth = r.entryDate ? parseInt(r.entryDate.split('-')[1]) || r.month : r.month;
      const row = ws.addRow(UBL1_COLS.map(c => c.field==="entryDate" ? safeFormat((r as any).entryDate) : c.field==="month" ? calMonth : ((r as any)[c.field] ?? "")));
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:"center"}; });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`UBL_DateEntry_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleImportExcel1 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    const { startDate: bStart, endDate: bEnd, label: bLabel } = getBillingRange(month, year);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headers: string[] = [];
      ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? "")));
      const fieldMap: Record<string,string> = {};
      UBL1_COLS.forEach(c => { const i = headers.indexOf(c.header); if(i>=0) fieldMap[i]=c.field; });
      const imported: UblRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri === 1) return;
        const r: any = { month, year, weekDay:"", _dirty:true, tea2:0, tea4:0 };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci-1];
          if (!f) return;
          const v = cell.value;
          r[f] = (f==="entryDate"||f==="weekDay") ? String(v??"") : (parseInt(String(v||0))||0);
        });
        if (!r.entryDate) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as UblRow);
      });
      const mismatch = imported.filter(r => r.entryDate < bStart || r.entryDate > bEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside the loaded period (${bLabel}). Select the correct billing period and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
  };

  const handleReset1 = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateBillingRows(month, year, ublRowDefaults));
  };

  const totalTea = rows.reduce((s,r)=>s+(r.tea1||0)+(r.tea3||0)+(r.tea5||0)+(r.tea6||0),0);
  const totalBiscuit = rows.reduce((s,r)=>s+(r.biscuit1||0)+(r.biscuit2||0),0);
  const totalBreakfast = rows.reduce((s,r)=>s+(r.breakfast||0),0);
  const totalLunch = rows.reduce((s,r)=>s+(r.lunch||0),0);
  const totalMutton = rows.reduce((s,r)=>s+(r.mutton||0),0);
  const totalTiffin = rows.reduce((s,r)=>s+(r.tiffin||0),0);
  const totalBoiledEgg = rows.reduce((s,r)=>s+(r.boiledEgg||0),0);
  const totalDinner = rows.reduce((s,r)=>s+(r.dinner||0),0);

  const summary = [
    { label:"Breakfast", qty:totalBreakfast, rate:UBL_RATES.breakfast, total:totalBreakfast*UBL_RATES.breakfast },
    { label:"Lunch", qty:totalLunch, rate:UBL_RATES.lunch, total:totalLunch*UBL_RATES.lunch },
    { label:"Lunch Mutton", qty:totalMutton, rate:UBL_RATES.mutton, total:totalMutton*UBL_RATES.mutton },
    { label:"Teffin", qty:totalTiffin, rate:UBL_RATES.tiffin, total:totalTiffin*UBL_RATES.tiffin },
    { label:"Dinner", qty:totalDinner, rate:UBL_RATES.dinner, total:totalDinner*UBL_RATES.dinner },
    { label:"Tea", qty:totalTea, rate:UBL_RATES.tea, total:totalTea*UBL_RATES.tea },
    { label:"Biscuit", qty:totalBiscuit, rate:UBL_RATES.biscuit, total:totalBiscuit*UBL_RATES.biscuit },
    { label:"Boiled Egg", qty:totalBoiledEgg, rate:UBL_RATES.boiledEgg, total:totalBoiledEgg*UBL_RATES.boiledEgg },
  ];
  const grandTotal = summary.reduce((s,x)=>s+x.total,0);

  const numFld = (row: UblRow, idx: number, field: keyof UblRow, w=42) => (
    <input type="number" min={0} value={(row as any)[field]||""}
      onChange={e=>handleCellChange(idx,field,e.target.value)}
      data-field={String(field)} data-row={idx}
      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); const next=document.querySelector(`#ubl1-desk input[data-field="${String(field)}"][data-row="${idx+1}"]`) as HTMLInputElement; if(next) next.focus(); }}}
      style={{width:w,border:"none",background:"transparent",textAlign:"center",fontSize:12,padding:0,outline:"none"}}/>
  );

  const { startDate: billingStart, endDate: billingEnd, label: billingLabel } = getBillingRange(month, year);

  const printTable = (
    <div ref={printRef}>
      <h3>DJ Hospitality &amp; Facility Management Pvt Ltd</h3>
      <h4>United Breweries Ltd, Kalyani</h4>
      <p>Bill Data Sheet — {billingLabel}</p>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>Sl.</th>
            <th rowSpan={2}>Date</th>
            <th rowSpan={2}>Mth</th>
            <th rowSpan={2}>Day</th>
            <th colSpan={3} style={{background:"#4a5568",color:"white"}}>5:30–9 AM</th>
            <th colSpan={2} style={{background:"#2d6a4f",color:"white"}}>11:30 AM–1:30 PM</th>
            <th colSpan={4} style={{background:"#6b2d2d",color:"white"}}>3:30–7 PM</th>
            <th colSpan={1} style={{background:"#1a3a5a",color:"white"}}>10 PM</th>
            <th colSpan={1} style={{background:"#4a2040",color:"white"}}>12 AM</th>
            <th colSpan={1} style={{background:"#1a4060",color:"white"}}>4 AM</th>
          </tr>
          <tr>
            <th>Tea</th><th>Bis.</th><th>Brkft</th>
            <th>Lunch</th><th>Mutton</th>
            <th>Tea</th><th>Bis.</th><th>Tiffin</th><th>Egg</th>
            <th>Dinner</th><th>Tea</th><th>Tea</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>{
            const bg=isSunday(row.entryDate)?"#ffa500":isWed(row.entryDate)?"#90EE90":"transparent";
            return (
              <tr key={i} style={{background:bg}}>
                <td>{i+1}</td>
                <td>{safeFormat(row.entryDate)}</td>
                <td>{parseInt(row.entryDate.split('-')[1])||row.month}</td><td>{row.weekDay}</td>
                <td>{row.tea1||""}</td><td>{row.biscuit1||""}</td><td>{row.breakfast||""}</td>
                <td>{row.lunch||""}</td><td>{row.mutton||""}</td>
                <td>{row.tea3||""}</td><td>{row.biscuit2||""}</td><td>{row.tiffin||""}</td><td>{row.boiledEgg||""}</td>
                <td>{row.dinner||""}</td><td>{row.tea5||""}</td><td>{row.tea6||""}</td>
              </tr>
            );
          })}
          <tr style={{fontWeight:"bold",background:"#e8f0fe"}}>
            <td colSpan={4}>Total</td>
            <td>{rows.reduce((s,r)=>s+(r.tea1||0),0)}</td>
            <td>{rows.reduce((s,r)=>s+(r.biscuit1||0),0)}</td>
            <td>{totalBreakfast}</td>
            <td>{totalLunch}</td><td>{totalMutton}</td>
            <td>{rows.reduce((s,r)=>s+(r.tea3||0),0)}</td>
            <td>{rows.reduce((s,r)=>s+(r.biscuit2||0),0)}</td>
            <td>{totalTiffin}</td>
            <td>{totalBoiledEgg}</td>
            <td>{totalDinner}</td>
            <td>{rows.reduce((s,r)=>s+(r.tea5||0),0)}</td>
            <td>{rows.reduce((s,r)=>s+(r.tea6||0),0)}</td>
          </tr>
        </tbody>
      </table>
      <br/>
      <table style={{width:"40%",marginLeft:"auto",marginRight:0}}>
        <thead><tr><th>Particulars</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          {summary.map(s=>(
            <tr key={s.label}><td style={{textAlign:"left",paddingLeft:6}}>{s.label}</td><td>{s.qty}</td><td>{s.rate}</td><td style={{textAlign:"right",paddingRight:6}}>{s.total.toLocaleString("en-IN",{minimumFractionDigits:2})}</td></tr>
          ))}
          <tr style={{fontWeight:"bold"}}><td colSpan={3} style={{textAlign:"right"}}>Total</td><td style={{textAlign:"right",paddingRight:6}}>{grandTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}</td></tr>
        </tbody>
      </table>
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" onClick={handleAddRow} className="bg-blue-600 text-white h-10 px-4 text-sm"
          disabled={rows.length > 0 && rows[rows.length-1].entryDate >= billingEnd1}>
          <Plus className="w-4 h-4 mr-1.5"/>Add Row</Button>
        <Button size="sm" onClick={handleSaveAll} className="bg-green-600 text-white h-10 px-4 text-sm" disabled={createMutation.isPending||updateMutation.isPending}><Save className="w-4 h-4 mr-1.5"/>Save All</Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="h-10 px-4 text-sm"><Printer className="w-4 h-4 mr-1.5"/>Print</Button>
        <Button size="sm" variant="outline" onClick={handleExportExcel1} className="h-10 px-4 text-sm text-green-700 border-green-300 hover:bg-green-50" disabled={rows.length===0}><FileDown className="w-4 h-4 mr-1.5"/>Export Excel</Button>
        <Button size="sm" variant="outline" onClick={()=>importRef1.current?.click()} className="h-10 px-4 text-sm text-blue-700 border-blue-300 hover:bg-blue-50"><FileUp className="w-4 h-4 mr-1.5"/>Import Excel</Button>
        <input ref={importRef1} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel1}/>
        <Button size="sm" variant="outline" onClick={handleReset1} className="h-10 px-4 text-sm text-red-600 border-red-300 hover:bg-red-50"><RefreshCw className="w-4 h-4 mr-1.5"/>Reset</Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span className="inline-block w-3 h-3 rounded" style={{background:"#ffa500"}}></span>Sunday
          <span className="inline-block w-3 h-3 rounded" style={{background:"#90EE90"}}></span>Wednesday
        </div>
      </div>

      {/* ── Mobile Card View (hidden on md+) ── */}
      <div className="block md:hidden space-y-2">
        {rows.map((row, idx) => {
          const sunDay = isSunday(row.entryDate);
          const wedDay = isWed(row.entryDate);
          const cardBg = sunDay ? "bg-amber-50 border-amber-300 dark:bg-amber-900/20" : wedDay ? "bg-green-50 border-green-200 dark:bg-green-900/20" : "bg-white dark:bg-gray-900 border-gray-200";
          const mblFld = (f: keyof UblRow) => (
            <input type="number" min={0} value={(row as any)[f]||""} onChange={e=>handleCellChange(idx,f,e.target.value)}
              className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:38,padding:"4px 2px"}}/>
          );
          return (
            <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-bold text-gray-400 shrink-0">#{idx+1}</span>
                <input type="date" value={row.entryDate} onChange={e=>handleCellChange(idx,"entryDate",e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2 dark:bg-gray-800 dark:text-white" style={{minHeight:40,fontSize:14}}/>
                <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-2 py-1 shrink-0">{row.weekDay}</span>
                {row._dirty && <span className="text-orange-500 font-bold text-xs shrink-0">●</span>}
              </div>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-500 mb-1 bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5">☀ 5:30–9:00 AM</div>
                <div className="grid grid-cols-3 gap-1">
                  {([["tea1","Tea"],["biscuit1","Biscuit"],["breakfast","Breakfast"]] as [keyof UblRow, string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-500 mb-1 bg-green-50 dark:bg-green-900/20 rounded px-2 py-0.5">🍽 11:30AM–1:30PM</div>
                <div className="grid grid-cols-2 gap-1">
                  {([["lunch","Lunch"],["mutton","Mutton"]] as [keyof UblRow, string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-500 mb-1 bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-0.5">🌇 3:30–7:00 PM</div>
                <div className="grid grid-cols-4 gap-1">
                  {([["tea3","Tea"],["biscuit2","Biscuit"],["tiffin","Teffin"],["boiledEgg","Egg"]] as [keyof UblRow, string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-0.5 text-center leading-tight">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-500 mb-1 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-0.5">🌙 10PM / 12AM / 4AM</div>
                <div className="grid grid-cols-3 gap-1">
                  {([["dinner","Dinner"],["tea5","12AM"],["tea6","4AM"]] as [keyof UblRow, string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-0.5 text-center leading-tight">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>handleSaveRow(row,idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                  <Save className="w-4 h-4"/>Save
                </button>
                <button onClick={()=>handleDeleteRow(row,idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-700 text-white px-3 py-2 text-sm font-bold">Billing Summary</div>
            <div className="divide-y">
              {summary.map((s,i)=>(
                <div key={s.label} className="flex justify-between items-center px-3 py-2 text-sm" style={{background:i%2===0?"#fff":"#f9f9f9"}}>
                  <span className="text-gray-600">{s.label} <span className="text-gray-400">×{s.qty}</span></span>
                  <span className="font-semibold">₹{s.total.toLocaleString("en-IN",{minimumFractionDigits:0})}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-3 py-2.5 bg-blue-600 text-white font-bold text-sm">
                <span>Grand Total</span>
                <span>₹{grandTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop Table View (hidden on mobile) ── */}
      <div id="ubl1-desk" className="hidden md:block overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:"collapse",minWidth:1400,fontFamily:"Arial,sans-serif",fontSize:12}}>
          <thead>
            <tr style={{background:"#1a3a5a",color:"white"}}>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:32}}>Sl</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:100}}>Date</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:50}}>Month</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:44}}>Day</th>
              <th colSpan={3} style={{padding:"4px",border:"1px solid #334",background:"#4a5568"}}>5:30-9:00 AM</th>
              <th colSpan={2} style={{padding:"4px",border:"1px solid #334",background:"#2d6a4f"}}>11:30AM-1:30PM</th>
              <th colSpan={4} style={{padding:"4px",border:"1px solid #334",background:"#6b2d2d"}}>3:30PM-7PM</th>
              <th style={{padding:"4px",border:"1px solid #334",background:"#1a3a5a"}}>10PM</th>
              <th style={{padding:"4px",border:"1px solid #334",background:"#4a2040"}}>12AM</th>
              <th style={{padding:"4px",border:"1px solid #334",background:"#1a4060"}}>4AM</th>
              <th rowSpan={2} style={{padding:"4px",border:"1px solid #334",width:40}}>Act</th>
            </tr>
            <tr style={{background:"#2a4a6a",color:"white"}}>
              {["Tea","Biscuit","Breakfast","Lunch","Mutton","Tea","Biscuit","Teffin","Egg","Dinner","Tea","Tea"].map((c,i)=>(
                <th key={i} style={{padding:"4px 2px",border:"1px solid #334",fontSize:10}}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,idx)=>{
              const bg=isSunday(row.entryDate)?"#fff3cd":isWed(row.entryDate)?"#d4edda":idx%2===0?"#fff":"#f9f9f9";
              return (
                <tr key={idx} style={{background:bg}}>
                  <td style={{textAlign:"center",border:"1px solid #ccc",padding:"2px"}}>{idx+1}</td>
                  <td style={{border:"1px solid #ccc",padding:0}}>
                    <input type="date" value={row.entryDate} onChange={e=>handleCellChange(idx,"entryDate",e.target.value)}
                      style={{width:100,border:"none",background:"transparent",fontSize:11,padding:"3px 2px"}}/>
                  </td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{parseInt(row.entryDate.split('-')[1])||row.month}</td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.weekDay}</td>
                  {(["tea1","biscuit1","breakfast","lunch","mutton","tea3","biscuit2","tiffin","boiledEgg","dinner","tea5","tea6"] as (keyof UblRow)[]).map(f=>(
                    <td key={f} style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,f)}</td>
                  ))}
                  <td style={{border:"1px solid #ccc",padding:"2px",textAlign:"center"}}>
                    <button onClick={()=>handleSaveRow(row,idx)} title="Save" style={{color:"#2196f3",marginRight:4,background:"none",border:"none",cursor:"pointer"}}><Save style={{width:13,height:13}}/></button>
                    <button onClick={()=>handleDeleteRow(row,idx)} title="Delete" style={{color:"#e53e3e",background:"none",border:"none",cursor:"pointer"}}><Trash2 style={{width:13,height:13}}/></button>
                  </td>
                </tr>
              );
            })}
            <tr style={{background:"#e8f0fe",fontWeight:"bold"}}>
              <td colSpan={4} style={{textAlign:"center",border:"1px solid #ccc",padding:"4px"}}>Total</td>
              {(["tea1","biscuit1","breakfast","lunch","mutton","tea3","biscuit2","tiffin","boiledEgg","dinner","tea5","tea6"] as (keyof UblRow)[]).map(f=>(
                <td key={f} style={{border:"1px solid #ccc",textAlign:"center",padding:"4px",fontSize:12}}>
                  {rows.reduce((s,r)=>s+((r as any)[f]||0),0)}
                </td>
              ))}
              <td style={{border:"1px solid #ccc"}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 hidden md:flex justify-end">
        <div className="border rounded-xl overflow-hidden shadow-sm" style={{minWidth:320}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#1a3a5a",color:"white"}}>
                <th style={{padding:"6px 10px",textAlign:"left"}}>Particulars</th>
                <th style={{padding:"6px 8px",textAlign:"right"}}>Qty</th>
                <th style={{padding:"6px 8px",textAlign:"right"}}>Rate</th>
                <th style={{padding:"6px 8px",textAlign:"right"}}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s,i)=>(
                <tr key={s.label} style={{background:i%2===0?"#fff":"#f9f9f9"}}>
                  <td style={{padding:"4px 10px",borderBottom:"1px solid #eee"}}>{s.label}</td>
                  <td style={{padding:"4px 8px",textAlign:"right",borderBottom:"1px solid #eee"}}>{s.qty}</td>
                  <td style={{padding:"4px 8px",textAlign:"right",borderBottom:"1px solid #eee"}}>{s.rate}</td>
                  <td style={{padding:"4px 8px",textAlign:"right",borderBottom:"1px solid #eee"}}>₹{s.total.toLocaleString("en-IN",{minimumFractionDigits:2})}</td>
                </tr>
              ))}
              <tr style={{background:"#e8f0fe",fontWeight:"bold"}}>
                <td colSpan={3} style={{padding:"5px 8px",textAlign:"right"}}>Total</td>
                <td style={{padding:"5px 8px",textAlign:"right"}}>₹{grandTotal.toLocaleString("en-IN",{minimumFractionDigits:2})}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{display:"none"}}>{printTable}</div>
    </div>
  );
}

// ============================================================
// UBL Format 2 — Number of Lunch Per Day
// ============================================================

type UblLunchRow = {
  id?: number;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  perment: number;
  casual: number;
  contractual: number;
  canteen: number;
  _dirty?: boolean;
};

function lunchRowDefaults(dateStr: string, month: number, year: number): UblLunchRow {
  return { entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr), perment:0, casual:0, contractual:0, canteen:7, _dirty:true };
}

function UblLunchEntryTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const importRef2 = useRef<HTMLInputElement>(null);
  const [localRows, setLocalRows] = useState<UblLunchRow[]>([]);
  useEffect(() => { setLocalRows([]); }, [month, year]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<UblLunchRow[]>({
    queryKey: ['/api/ubl-lunch-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/ubl-lunch-entries?month=${month}&year=${year}`, { credentials:"include" });
      const data = await res.json();
      return data.map((r: UblLunchRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
    },
  });

  const handleAutoFill = (freshRows?: UblLunchRow[]) => {
    const source = freshRows ?? dbRows;
    const generated = generateBillingRows(month, year, lunchRowDefaults);
    const existing = source.reduce((acc: Record<string, UblLunchRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g));
  };

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => { handleAutoFill((result.data || []) as UblLunchRow[]); });
    }
  }, [loadKey]);

  // Also load Format 1 data for cross-validation
  const { data: f1Rows = [] } = useQuery<UblRow[]>({
    queryKey: ['/api/ubl-date-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/ubl-date-entries?month=${month}&year=${year}`, { credentials:"include" });
      const data = await res.json();
      return data.map((r: UblRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed) }; });
    },
  });
  // Build a lookup: date -> lunch+mutton from Format 1
  const f1LunchMap: Record<string, number> = {};
  f1Rows.forEach(r => { f1LunchMap[r.entryDate] = (r.lunch||0) + (r.mutton||0); });

  const rows: UblLunchRow[] = localRows.length > 0 ? localRows : dbRows.map(r => ({ ...r }));

  const createMutation = useMutation({
    mutationFn: async (data: UblLunchRow) => {
      const res = await fetch('/api/ubl-lunch-entries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), credentials:"include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['/api/ubl-lunch-entries', month, year] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/ubl-lunch-entries/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), credentials:"include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['/api/ubl-lunch-entries', month, year] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/ubl-lunch-entries/${id}`, { method:'DELETE', credentials:"include" }); },
    onSuccess: () => qc.invalidateQueries({ queryKey:['/api/ubl-lunch-entries', month, year] }),
  });

  const syncRows = () => { if (localRows.length === 0) setLocalRows(dbRows.map(r => ({ ...r }))); };

  const handleCellChange = (idx: number, field: keyof UblLunchRow, value: string) => {
    syncRows();
    setLocalRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      (row as any)[field] = (field === 'entryDate' || field === 'weekDay') ? value : (parseInt(value)||0);
      if (field === 'entryDate') {
        row.weekDay = getWeekDay(value);
        if (value) { const d = new Date(value+"T00:00:00"); row.month = d.getMonth()+1; row.year = d.getFullYear(); }
      }
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  const { endDate: billingEnd2 } = getBillingRange(month, year);

  const handleAddRow = () => {
    let nextDate: string;
    if (rows.length === 0) {
      nextDate = `${year}-${String(month).padStart(2,'0')}-21`;
    } else {
      const lastDate = normDate(rows[rows.length - 1].entryDate);
      const d = new Date(lastDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      nextDate = localDateStr(d);
    }
    if (nextDate > billingEnd2) {
      toast({ title: "Billing period complete", description: `All dates up to ${billingEnd2} already added.`, variant: "destructive" });
      return;
    }
    syncRows();
    setLocalRows(prev => [...prev, lunchRowDefaults(nextDate, month, year)]);
  };

  const handleSaveRow = async (row: UblLunchRow, idx: number) => {
    try {
      const { _dirty, id, ...data } = row;
      if (id) await updateMutation.mutateAsync({ id, data });
      else await createMutation.mutateAsync(row);
      toast({ title: "Saved" });
    } catch (e: any) { toast({ title:"Error", description:e.message, variant:"destructive" }); }
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r._dirty);
    if (!dirty.length) { toast({ title:"Nothing to save" }); return; }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]._dirty) await handleSaveRow(rows[i], i);
    }
  };

  const handleDeleteRow = async (row: UblLunchRow, idx: number) => {
    if (row.id) await deleteMutation.mutateAsync(row.id);
    setLocalRows(prev => prev.filter((_, i) => i !== idx));
  };

  const totPerment   = rows.reduce((s,r) => s+(r.perment||0), 0);
  const totCasual    = rows.reduce((s,r) => s+(r.casual||0), 0);
  const totContractual = rows.reduce((s,r) => s+(r.contractual||0), 0);
  const totCanteen   = rows.reduce((s,r) => s+(r.canteen||0), 0);
  const grandTotal   = totPerment + totCasual + totContractual + totCanteen;

  // Count validation mismatches
  const mismatches = rows.filter(r => {
    if (!r.entryDate) return false;
    const f1Total = f1LunchMap[r.entryDate];
    if (f1Total === undefined) return false;
    const f2Total = (r.perment||0)+(r.casual||0)+(r.contractual||0)+(r.canteen||0);
    return f1Total !== f2Total;
  });

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>UBL Lunch Per Day</title><style>
      body{font-family:Arial,sans-serif;margin:10px;font-size:11px;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th,td{border:1px solid #333;padding:4px 6px;text-align:center;font-size:11px;}
      th{background:#1a3a5a;color:white;}
      .orange{background:#ffa500;}
      .total-row{font-weight:bold;background:#e8f0fe;}
      @media print{@page{margin:8mm;size:A4 portrait;}}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const UBL2_COLS = [
    { header:"Date", field:"entryDate" },
    { header:"Month", field:"month" },
    { header:"Day", field:"weekDay" },
    { header:"Permanent", field:"perment" },
    { header:"Casual", field:"casual" },
    { header:"Contractual", field:"contractual" },
    { header:"Canteen", field:"canteen" },
  ];

  const handleExportExcel2 = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("UBL Lunch Entry");
    const thin = { top:{style:"thin"as const}, bottom:{style:"thin"as const}, left:{style:"thin"as const}, right:{style:"thin"as const} };
    const hdr = ws.addRow(UBL2_COLS.map(c=>c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:"FFFFFFFF"}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1A3A5A"}}; cell.border=thin; cell.alignment={horizontal:"center"}; });
    ws.columns = UBL2_COLS.map((_,i)=>({ width: i===0?14:14 }));
    rows.forEach(r => {
      const calMonth = r.entryDate ? parseInt(r.entryDate.split('-')[1]) || r.month : r.month;
      const row = ws.addRow(UBL2_COLS.map(c => c.field==="entryDate" ? safeFormat((r as any).entryDate) : c.field==="month" ? calMonth : ((r as any)[c.field] ?? "")));
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:"center"}; });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`UBL_Lunch_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleImportExcel2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    const { startDate: bStart, endDate: bEnd, label: bLabel } = getBillingRange(month, year);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headers: string[] = [];
      ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? "")));
      const fieldMap: Record<string,string> = {};
      UBL2_COLS.forEach(c => { const i = headers.indexOf(c.header); if(i>=0) fieldMap[i]=c.field; });
      const imported: UblLunchRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri === 1) return;
        const r: any = { month, year, weekDay:"", _dirty:true };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci-1]; if (!f) return;
          const v = cell.value;
          r[f] = (f==="entryDate"||f==="weekDay") ? String(v??"") : (parseInt(String(v||0))||0);
        });
        if (!r.entryDate) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as UblLunchRow);
      });
      const mismatch = imported.filter(r => r.entryDate < bStart || r.entryDate > bEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside the loaded period (${bLabel}). Select the correct billing period and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
  };

  const handleReset2 = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateBillingRows(month, year, lunchRowDefaults));
  };

  const numFld = (row: UblLunchRow, idx: number, field: keyof UblLunchRow, w=56) => (
    <input type="number" min={0} value={(row as any)[field]||""}
      onChange={e=>handleCellChange(idx,field,e.target.value)}
      data-field={String(field)} data-row={idx}
      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); const next=document.querySelector(`#ubl2-desk input[data-field="${String(field)}"][data-row="${idx+1}"]`) as HTMLInputElement; if(next) next.focus(); }}}
      style={{width:w,border:"none",background:"transparent",textAlign:"center",fontSize:12,padding:0,outline:"none"}}/>
  );

  const { label: lunchBillingLabel } = getBillingRange(month, year);

  const printTable = (
    <div ref={printRef}>
      <h3>DJ Hospitality &amp; Facility Management Pvt. Ltd.</h3>
      <h4><strong>Number of Lunch Per Day to United Breweries Limited</strong></h4>
      <p>{lunchBillingLabel}</p>
      <table>
        <thead>
          <tr>
            <th style={{width:90}}>Date</th>
            <th style={{width:55}}>Days</th>
            <th>Perment</th>
            <th>Casual</th>
            <th style={{background:"#4a6fa5",color:"white"}}>Contractual</th>
            <th style={{background:"#4a7c59",color:"white"}}>Canteen</th>
            <th style={{background:"#555",color:"white"}}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i) => {
            const total = (row.perment||0)+(row.casual||0)+(row.contractual||0)+(row.canteen||0);
            const isSun = isSunday(row.entryDate);
            const f1Total = f1LunchMap[row.entryDate];
            const mismatch = f1Total !== undefined && f1Total !== total;
            return (
              <tr key={i} className={isSun?"orange":""} style={{background:isSun?"#ffa500":mismatch?"#ffe5e5":"transparent"}}>
                <td>{safeFormat(row.entryDate)}</td>
                <td>{row.weekDay}</td>
                <td>{row.perment||""}</td>
                <td>{row.casual||""}</td>
                <td>{row.contractual||""}</td>
                <td>{row.canteen||""}</td>
                <td style={{fontWeight:"bold"}}>{total||""}</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td colSpan={2} style={{textAlign:"right",fontWeight:"bold"}}>Total</td>
            <td>{totPerment}</td>
            <td>{totCasual}</td>
            <td>{totContractual}</td>
            <td>{totCanteen}</td>
            <td style={{fontWeight:"bold"}}>{grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>;

  return (
    <div>
      {/* Validation Banner */}
      {mismatches.length > 0 ? (
        <div className="mb-3 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0"/>
          <div className="text-sm text-red-700 dark:text-red-400">
            <strong>Mismatch found on {mismatches.length} date(s):</strong>{" "}
            {mismatches.map(r => {
              const f2Total = (r.perment||0)+(r.casual||0)+(r.contractual||0)+(r.canteen||0);
              const f1Total = f1LunchMap[r.entryDate] ?? 0;
              return (
                <span key={r.entryDate} className="inline-block mr-2 bg-red-100 dark:bg-red-800 rounded px-1">
                  {safeFormat(r.entryDate)||"?"}: Format2={f2Total} vs Format1 Lunch+Mutton={f1Total}
                </span>
              );
            })}
          </div>
        </div>
      ) : rows.length > 0 && Object.keys(f1LunchMap).length > 0 ? (
        <div className="mb-3 p-2 rounded-lg border border-green-300 bg-green-50 dark:bg-green-900/20 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4 shrink-0"/>
          All dates match Format 1 (Lunch + Mutton) totals.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" onClick={handleAddRow} className="bg-blue-600 text-white h-10 px-4 text-sm"
          disabled={rows.length > 0 && rows[rows.length-1].entryDate >= billingEnd2}>
          <Plus className="w-4 h-4 mr-1.5"/>Add Row</Button>
        <Button size="sm" onClick={handleSaveAll} className="bg-green-600 text-white h-10 px-4 text-sm" disabled={createMutation.isPending||updateMutation.isPending}><Save className="w-4 h-4 mr-1.5"/>Save All</Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="h-10 px-4 text-sm"><Printer className="w-4 h-4 mr-1.5"/>Print</Button>
        <Button size="sm" variant="outline" onClick={handleExportExcel2} className="h-10 px-4 text-sm text-green-700 border-green-300 hover:bg-green-50" disabled={rows.length===0}><FileDown className="w-4 h-4 mr-1.5"/>Export Excel</Button>
        <Button size="sm" variant="outline" onClick={()=>importRef2.current?.click()} className="h-10 px-4 text-sm text-blue-700 border-blue-300 hover:bg-blue-50"><FileUp className="w-4 h-4 mr-1.5"/>Import Excel</Button>
        <input ref={importRef2} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel2}/>
        <Button size="sm" variant="outline" onClick={handleReset2} className="h-10 px-4 text-sm text-red-600 border-red-300 hover:bg-red-50"><RefreshCw className="w-4 h-4 mr-1.5"/>Reset</Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span className="inline-block w-3 h-3 rounded" style={{background:"#ffa500"}}></span>Sunday
          <span className="inline-block w-3 h-3 rounded bg-red-200"></span>Mismatch
        </div>
      </div>

      {/* ── Mobile Card View ── */}
      <div className="block md:hidden space-y-2">
        {rows.map((row, idx) => {
          const total = (row.perment||0)+(row.casual||0)+(row.contractual||0)+(row.canteen||0);
          const f1Total = f1LunchMap[row.entryDate];
          const mismatch = f1Total !== undefined && f1Total !== total;
          const isSun = isSunday(row.entryDate);
          const cardBg = isSun ? "bg-amber-50 border-amber-300 dark:bg-amber-900/20" : mismatch ? "bg-red-50 border-red-200 dark:bg-red-900/20" : "bg-white dark:bg-gray-900 border-gray-200";
          const mblFld = (f: keyof UblLunchRow) => (
            <input type="number" min={0} value={(row as any)[f]||""} onChange={e=>handleCellChange(idx,f,e.target.value)}
              className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:40,padding:"4px 2px"}}/>
          );
          return (
            <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-gray-400 shrink-0">#{idx+1}</span>
                <input type="date" value={row.entryDate} onChange={e=>handleCellChange(idx,"entryDate",e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2 dark:bg-gray-800 dark:text-white" style={{minHeight:40,fontSize:14}}/>
                <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-2 py-1 shrink-0">{row.weekDay}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {([["perment","Perment"],["casual","Casual"],["contractual","Contractual"],["canteen","Canteen"]] as [keyof UblLunchRow,string][]).map(([f,label])=>(
                  <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                    <span className="text-xs text-gray-500 mb-1">{label}</span>
                    {mblFld(f)}
                  </div>
                ))}
              </div>
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 mb-3 text-sm font-semibold ${mismatch ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"}`}>
                <span>Total: {total}</span>
                {f1Total !== undefined && <span className="text-xs">{mismatch ? `⚠ F1 Lunch+Mutton=${f1Total}` : `✓ F1=${f1Total}`}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>handleSaveRow(row,idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                  <Save className="w-4 h-4"/>Save
                </button>
                <button onClick={()=>handleDeleteRow(row,idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-700 text-white px-3 py-2 text-sm font-bold">Period Totals</div>
            <div className="grid grid-cols-2 gap-0 divide-y divide-x">
              {[["Perment",totPerment],["Casual",totCasual],["Contractual",totContractual],["Canteen",totCanteen]].map(([l,v],i)=>(
                <div key={l} className="flex justify-between px-3 py-2 text-sm" style={{background:i%2===0?"#fff":"#f9f9f9"}}>
                  <span className="text-gray-600">{l}</span><span className="font-bold">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-3 py-2.5 bg-blue-600 text-white font-bold text-sm">
              <span>Grand Total</span><span>{grandTotal}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop Table View ── */}
      <div id="ubl2-desk" className="hidden md:block overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:"collapse",minWidth:700,fontFamily:"Arial,sans-serif",fontSize:12}}>
          <thead>
            <tr style={{background:"#1a3a5a",color:"white"}}>
              <th style={{padding:"6px 4px",border:"1px solid #334",width:32}}>Sl</th>
              <th style={{padding:"6px 4px",border:"1px solid #334",width:105}}>Date</th>
              <th style={{padding:"6px 4px",border:"1px solid #334",width:55}}>Days</th>
              <th style={{padding:"6px 8px",border:"1px solid #334"}}>Perment</th>
              <th style={{padding:"6px 8px",border:"1px solid #334"}}>Casual</th>
              <th style={{padding:"6px 8px",border:"1px solid #334",background:"#4a6fa5"}}>Contractual</th>
              <th style={{padding:"6px 8px",border:"1px solid #334",background:"#4a7c59"}}>Canteen</th>
              <th style={{padding:"6px 8px",border:"1px solid #334",background:"#444"}}>Total</th>
              <th style={{padding:"6px 8px",border:"1px solid #334",background:"#2d6a4f",fontSize:10}}>F1 Lunch+Mutton</th>
              <th style={{padding:"6px 4px",border:"1px solid #334",width:50}}>Act</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row,idx) => {
              const isSun = isSunday(row.entryDate);
              const total = (row.perment||0)+(row.casual||0)+(row.contractual||0)+(row.canteen||0);
              const f1Total = f1LunchMap[row.entryDate];
              const mismatch = f1Total !== undefined && f1Total !== total;
              const bg = isSun ? "#fff3cd" : mismatch ? "#ffe5e5" : idx%2===0 ? "#fff" : "#f9f9f9";
              return (
                <tr key={idx} style={{background:bg}}>
                  <td style={{textAlign:"center",border:"1px solid #ccc",padding:"2px"}}>{idx+1}</td>
                  <td style={{border:"1px solid #ccc",padding:0}}>
                    <input type="date" value={row.entryDate} onChange={e=>handleCellChange(idx,"entryDate",e.target.value)}
                      style={{width:105,border:"none",background:"transparent",fontSize:11,padding:"3px 2px"}}/>
                  </td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.weekDay}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"perment")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"casual")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center",background:"#eef2ff"}}>{numFld(row,idx,"contractual")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center",background:"#efffef"}}>{numFld(row,idx,"canteen")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",fontSize:13,
                    background: mismatch ? "#fecaca" : "#e8f0fe",
                    color: mismatch ? "#b91c1c" : "#1a3a5a"
                  }}>
                    {total || ""}
                  </td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontSize:11,
                    background: mismatch ? "#fecaca" : f1Total !== undefined ? "#d1fae5" : "#f9fafb",
                    color: mismatch ? "#b91c1c" : "#166534"
                  }}>
                    {f1Total !== undefined ? (
                      <span title={mismatch ? `Mismatch! Format2 Total=${total}, Format1 Lunch+Mutton=${f1Total}` : "Match"}>
                        {f1Total}
                        {mismatch ? " ⚠" : " ✓"}
                      </span>
                    ) : <span style={{color:"#aaa"}}>—</span>}
                  </td>
                  <td style={{border:"1px solid #ccc",padding:"2px",textAlign:"center"}}>
                    <button onClick={()=>handleSaveRow(row,idx)} title="Save" style={{color:"#2196f3",marginRight:4,background:"none",border:"none",cursor:"pointer"}}><Save style={{width:13,height:13}}/></button>
                    <button onClick={()=>handleDeleteRow(row,idx)} title="Delete" style={{color:"#e53e3e",background:"none",border:"none",cursor:"pointer"}}><Trash2 style={{width:13,height:13}}/></button>
                  </td>
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr style={{background:"#e8f0fe",fontWeight:"bold"}}>
              <td colSpan={3} style={{textAlign:"center",border:"1px solid #ccc",padding:"4px"}}>Total</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",padding:"4px"}}>{totPerment}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",padding:"4px"}}>{totCasual}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",padding:"4px"}}>{totContractual}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",padding:"4px"}}>{totCanteen}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",padding:"4px",fontSize:13}}>{grandTotal}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",padding:"4px"}}>
                {Object.values(f1LunchMap).reduce((s,v)=>s+v,0)||"—"}
              </td>
              <td style={{border:"1px solid #ccc"}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{display:"none"}}>{printTable}</div>
    </div>
  );
}

// ============================================================
// UNICHEM Format 1 — Snacks (Breakfast, Evening, Night, Sunday Extra)
// ============================================================

const UNICHEM_LOCATIONS = ["Main Plant", "Unit-2", "COE"] as const;
type UnichEmLocation = typeof UNICHEM_LOCATIONS[number];

type SnackRow = {
  id?: number;
  location: string;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  breakfast: number;
  eveningSnacks: number;
  nightSnacks: number;
  sundayExtraSnacks: number;
  remarks: string;
  _dirty?: boolean;
};

function snackRowDefaults(dateStr: string, month: number, year: number, location: string): SnackRow {
  return { location, entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr), breakfast:0, eveningSnacks:0, nightSnacks:0, sundayExtraSnacks:0, remarks:"", _dirty: true };
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function generateMonthRows<T>(month: number, year: number, defaults: (d: string, m: number, y: number) => T): T[] {
  const days = getDaysInMonth(month, year);
  const rows: T[] = [];
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    rows.push(defaults(dateStr, month, year));
  }
  return rows;
}

function generateBillingRows<T>(month: number, year: number, defaults: (d: string, m: number, y: number) => T): T[] {
  const { startDate, endDate } = getBillingRange(month, year);
  const rows: T[] = [];
  let cur = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cur <= end) {
    const d = localDateStr(cur);
    rows.push(defaults(d, cur.getMonth() + 1, cur.getFullYear()));
    cur.setDate(cur.getDate() + 1);
  }
  return rows;
}

function UnichemSnackTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useState<UnichEmLocation>("Main Plant");
  const [localRows, setLocalRows] = useState<SnackRow[]>([]);
  const importRefSnack = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocalRows([]); }, [month, year, location]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<SnackRow[]>({
    queryKey: ['/api/unichem-snack-entries', month, year, location],
    queryFn: async () => {
      const res = await fetch(`/api/unichem-snack-entries?month=${month}&year=${year}&location=${encodeURIComponent(location)}`, { credentials: "include" });
      const data = await res.json();
      return data.map((r: SnackRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed) }; });
    },
  });

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => {
        const freshRows = (result.data || []) as SnackRow[];
        const generated = generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location));
        const existing = freshRows.reduce((acc: Record<string, SnackRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
        setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate] } : g));
      });
    }
  }, [loadKey]);

  // Fetch Form 2 Lunch data to auto-populate Sunday Extra Snacks from Bill Qty
  // NOTE: query key includes 'billqty_only' to avoid colliding with UnichemMealSubTab's full-row cache
  const { data: lunchRows = [] } = useQuery<{ entryDate: string; billQty: number }[]>({
    queryKey: ['/api/unichem-lunch-entries', month, year, location, 'lunch', 'billqty_only'],
    queryFn: async () => {
      const res = await fetch(`/api/unichem-lunch-entries?month=${month}&year=${year}&location=${encodeURIComponent(location)}&mealType=lunch`, { credentials: "include" });
      const data = await res.json();
      return data.map((r: any) => ({ entryDate: normDate(r.entryDate), billQty: r.billQty || 0 }));
    },
  });

  // Build date → billQty lookup from Form 2
  const lunchBillQtyMap = useMemo(() =>
    lunchRows.reduce((acc: Record<string, number>, r) => { acc[r.entryDate] = r.billQty; return acc; }, {}),
    [lunchRows]
  );

  // Always compute the full month grid merged with DB data (auto-load, no Auto-Fill click needed)
  const fullRows = useMemo(() => {
    const generated = generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location));
    const existing = dbRows.reduce((acc: Record<string, SnackRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
    return generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate] } : g);
  }, [dbRows, month, year, location]);

  const rows: SnackRow[] = localRows.length > 0 ? localRows : fullRows;

  const createMutation = useMutation({
    mutationFn: async (data: SnackRow) => {
      const res = await fetch('/api/unichem-snack-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/unichem-snack-entries', month, year, location] }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/unichem-snack-entries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/unichem-snack-entries', month, year, location] }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/unichem-snack-entries/${id}`, { method: 'DELETE', credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/unichem-snack-entries', month, year, location] }),
  });

  const handleSaveRow = async (idx: number) => {
    const row = rows[idx];
    try {
      const { _dirty, id, ...data } = row;
      // For Sunday rows, always latch sundayExtraSnacks from Form 2 Lunch Bill Qty
      if (isSunday(row.entryDate)) {
        data.sundayExtraSnacks = lunchBillQtyMap[row.entryDate] || 0;
      }
      if (id) await updateMutation.mutateAsync({ id, data });
      else await createMutation.mutateAsync({ ...row, sundayExtraSnacks: isSunday(row.entryDate) ? (lunchBillQtyMap[row.entryDate] || 0) : row.sundayExtraSnacks });
      const result = await refetch();
      const freshRows = ((result.data || []) as SnackRow[]).map(r => ({ ...r, entryDate: normDate(r.entryDate), _dirty: false }));
      const generated = generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location));
      const existingMap = freshRows.reduce((acc: Record<string, SnackRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
      setLocalRows(generated.map(g => existingMap[g.entryDate] ? existingMap[g.entryDate] : g));
      toast({ title: "Row saved" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleDeleteRow = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) {
      setLocalRows(prev => { const u = [...prev]; u[idx] = { ...u[idx], breakfast:0, eveningSnacks:0, nightSnacks:0, sundayExtraSnacks:0, remarks:"", _dirty:false }; return u; });
      return;
    }
    try {
      await deleteMutation.mutateAsync(row.id);
      const result = await refetch();
      const freshRows = ((result.data || []) as SnackRow[]).map(r => ({ ...r, entryDate: normDate(r.entryDate), _dirty: false }));
      const generated = generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location));
      const existingMap = freshRows.reduce((acc: Record<string, SnackRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
      setLocalRows(generated.map(g => existingMap[g.entryDate] ? existingMap[g.entryDate] : g));
      toast({ title: "Row deleted" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const syncRows = () => { if (localRows.length === 0) setLocalRows(fullRows); };

  const handleAutoFill = () => {
    const generated = generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location));
    const existing = dbRows.reduce((acc: Record<string, SnackRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
    const merged = generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate] } : g);
    setLocalRows(merged);
  };

  const SNACK_COLS = [
    { header: "Date", field: "entryDate" },
    { header: "Day", field: "weekDay" },
    { header: "Breakfast", field: "breakfast" },
    { header: "Evening Snacks", field: "eveningSnacks" },
    { header: "Night Snacks", field: "nightSnacks" },
    { header: "Sunday Extra Snacks", field: "sundayExtraSnacks" },
    { header: "Remarks", field: "remarks" },
  ];

  const handleExportExcelSnack = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Unichem Snacks");
    const thin = { top:{style:"thin"as const}, bottom:{style:"thin"as const}, left:{style:"thin"as const}, right:{style:"thin"as const} };
    const hdr = ws.addRow(SNACK_COLS.map(c => c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:"FFFFFFFF"}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1A3A5A"}}; cell.border=thin; cell.alignment={horizontal:"center"}; });
    ws.columns = SNACK_COLS.map((_, i) => ({ width: i === 0 ? 14 : i === 6 ? 22 : 16 }));
    rows.forEach(r => {
      const row = ws.addRow(SNACK_COLS.map(c => c.field==="entryDate" ? safeFormat((r as any).entryDate) : ((r as any)[c.field] ?? "")));
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:"center"}; });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`Unichem_Snack_${location.replace(/\s+/g,"_")}_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleImportExcelSnack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    const mStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const mEnd = `${year}-${String(month).padStart(2,'0')}-${String(getDaysInMonth(month, year)).padStart(2,'0')}`;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headers: string[] = [];
      ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? "")));
      const fieldMap: Record<string, string> = {};
      SNACK_COLS.forEach(c => { const i = headers.indexOf(c.header); if(i>=0) fieldMap[i]=c.field; });
      const imported: SnackRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri === 1) return;
        const r: any = { month, year, location, weekDay:"", _dirty:true, breakfast:0, eveningSnacks:0, nightSnacks:0, sundayExtraSnacks:0, remarks:"" };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci-1]; if (!f) return;
          const v = cell.value;
          r[f] = (f==="entryDate"||f==="weekDay"||f==="remarks") ? String(v??"") : (parseInt(String(v||0))||0);
        });
        if (!r.entryDate) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as SnackRow);
      });
      const mismatch = imported.filter(r => r.entryDate < mStart || r.entryDate > mEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside ${MONTHS[month-1]} ${year}. Select the correct month and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
  };

  const handleResetSnack = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location)));
  };

  const handleCellChange = (idx: number, field: keyof SnackRow, value: string) => {
    syncRows();
    setLocalRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      if (field === 'remarks') (row as any)[field] = value;
      else (row as any)[field] = parseInt(value) || 0;
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  // Enter → next row (same column); Tab → next column (browser default)
  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tbody = (e.target as HTMLElement).closest('tbody');
      if (!tbody) return;
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const currentTr = (e.target as HTMLElement).closest('tr');
      const rowIdx = allRows.indexOf(currentTr as HTMLTableRowElement);
      const nextTr = allRows[rowIdx + 1];
      if (nextTr) {
        const inputs = Array.from(nextTr.querySelectorAll('input:not([readonly])')) as HTMLInputElement[];
        if (inputs[colIdx]) inputs[colIdx].focus();
        else if (inputs[0]) inputs[0].focus();
      }
    }
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r._dirty);
    if (!dirty.length) { toast({ title: "Nothing to save" }); return; }
    let saved = 0;
    for (const row of rows) {
      if (!row._dirty) continue;
      try {
        const { _dirty, id, ...data } = row;
        // For Sunday rows, override sundayExtraSnacks with Form 2 Bill Qty
        if (isSunday(row.entryDate) && lunchBillQtyMap[row.entryDate] !== undefined) {
          data.sundayExtraSnacks = lunchBillQtyMap[row.entryDate];
        }
        if (id) await updateMutation.mutateAsync({ id, data });
        else await createMutation.mutateAsync({ ...row, sundayExtraSnacks: isSunday(row.entryDate) ? (lunchBillQtyMap[row.entryDate] || 0) : row.sundayExtraSnacks });
        saved++;
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    }
    toast({ title: `Saved ${saved} rows` });
    const result = await refetch();
    const freshRows = ((result.data || []) as SnackRow[]).map(r => ({ ...r, entryDate: normDate(r.entryDate), _dirty: false }));
    const generated = generateMonthRows(month, year, (d, m, y) => snackRowDefaults(d, m, y, location));
    const existingMap = freshRows.reduce((acc: Record<string, SnackRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existingMap[g.entryDate] ? existingMap[g.entryDate] : g));
  };

  const handlePrintAllLocations = async () => {
    const monthLabel = `${MONTHS[month-1]} - ${year}`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    try {
      // Fetch snack + lunch + dinner data for all locations in parallel
      const fetches = UNICHEM_LOCATIONS.flatMap(loc => [
        fetch(`/api/unichem-snack-entries?month=${month}&year=${year}&location=${encodeURIComponent(loc)}`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/unichem-lunch-entries?month=${month}&year=${year}&location=${encodeURIComponent(loc)}&mealType=lunch`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/unichem-lunch-entries?month=${month}&year=${year}&location=${encodeURIComponent(loc)}&mealType=dinner`, { credentials: "include" }).then(r => r.json()),
      ]);
      const results = await Promise.all(fetches);

      // results order: [main-snack, main-lunch, main-dinner, unit2-snack, unit2-lunch, unit2-dinner, coe-snack, coe-lunch, coe-dinner]
      const rows: { location: string; breakfast: number; eveningSnacks: number; nightSnacks: number; sundayExtra: number; billQtyLunch: number; billQtyDinner: number }[] = [];

      UNICHEM_LOCATIONS.forEach((loc, i) => {
        const snackData: any[] = results[i * 3] || [];
        const lunchData: any[] = results[i * 3 + 1] || [];
        const dinnerData: any[] = results[i * 3 + 2] || [];

        // Build lunch billQty map (date → billQty) to resolve Sunday Extra
        const lunchMap: Record<string, number> = {};
        lunchData.forEach((r: any) => { lunchMap[normDate(r.entryDate)] = r.billQty || 0; });

        let breakfast = 0, eveningSnacks = 0, nightSnacks = 0, sundayExtra = 0;
        snackData.forEach((r: any) => {
          const d = normDate(r.entryDate);
          breakfast += r.breakfast || 0;
          eveningSnacks += r.eveningSnacks || 0;
          nightSnacks += r.nightSnacks || 0;
          if (isSunday(d)) sundayExtra += lunchMap[d] || r.sundayExtraSnacks || 0;
        });
        const billQtyLunch = lunchData.reduce((s: number, r: any) => s + (r.billQty || 0), 0);
        const billQtyDinner = dinnerData.reduce((s: number, r: any) => s + (r.billQty || 0), 0);

        rows.push({ location: loc, breakfast, eveningSnacks, nightSnacks, sundayExtra, billQtyLunch, billQtyDinner });
      });

      const tableStyle = `border-collapse:collapse;width:100%;font-size:11pt;`;
      const thStyle = `border:1px solid #000;padding:6px 10px;text-align:center;font-weight:bold;background:#a8d8ea;`;
      const tdStyle = `border:1px solid #000;padding:5px 10px;text-align:center;`;
      const tdLocStyle = `border:1px solid #000;padding:5px 10px;text-align:left;font-weight:bold;`;
      const totalRow = {
        breakfast: rows.reduce((s, r) => s + r.breakfast, 0),
        eveningSnacks: rows.reduce((s, r) => s + r.eveningSnacks, 0),
        nightSnacks: rows.reduce((s, r) => s + r.nightSnacks, 0),
        sundayExtra: rows.reduce((s, r) => s + r.sundayExtra, 0),
        billQtyLunch: rows.reduce((s, r) => s + r.billQtyLunch, 0),
        billQtyDinner: rows.reduce((s, r) => s + r.billQtyDinner, 0),
      };

      // Rates per item
      const RATES = { breakfast: 15, eveningSnacks: 15, nightSnacks: 15, sundayExtra: 10, billQtyLunch: 58, billQtyDinner: 58 };
      const fmt = (n: number) => n ? `₹ ${n.toLocaleString('en-IN')}` : "";

      const amtRows = rows.map(r => {
        const bf = r.breakfast * RATES.breakfast;
        const ev = r.eveningSnacks * RATES.eveningSnacks;
        const ni = r.nightSnacks * RATES.nightSnacks;
        const su = r.sundayExtra * RATES.sundayExtra;
        const lu = r.billQtyLunch * RATES.billQtyLunch;
        const di = r.billQtyDinner * RATES.billQtyDinner;
        return { location: r.location, breakfast: bf, eveningSnacks: ev, nightSnacks: ni, sundayExtra: su, billQtyLunch: lu, billQtyDinner: di, rowTotal: bf + ev + ni + su + lu + di };
      });
      const amtTotal = {
        breakfast: amtRows.reduce((s, r) => s + r.breakfast, 0),
        eveningSnacks: amtRows.reduce((s, r) => s + r.eveningSnacks, 0),
        nightSnacks: amtRows.reduce((s, r) => s + r.nightSnacks, 0),
        sundayExtra: amtRows.reduce((s, r) => s + r.sundayExtra, 0),
        billQtyLunch: amtRows.reduce((s, r) => s + r.billQtyLunch, 0),
        billQtyDinner: amtRows.reduce((s, r) => s + r.billQtyDinner, 0),
        rowTotal: amtRows.reduce((s, r) => s + r.rowTotal, 0),
      };
      const grandTotalAmt = amtTotal.rowTotal;
      const gstAmt = Math.round(grandTotalAmt * 0.05);
      const grandTotalWithGst = grandTotalAmt + gstAmt;

      const colHdr = (label: string, bg?: string) => `<th style="${thStyle}${bg||''}">${label}</th>`;
      const tdAmt = (v: number) => `<td style="${tdStyle}">${fmt(v)}</td>`;

      const html = `<html><head><title>Unichem All Locations Summary - ${monthLabel}</title>
        <style>@media print{body{margin:10mm;} @page{size:A4 landscape;}}</style></head>
        <body style="font-family:Arial,sans-serif;padding:20px;">

          <!-- Table 1: Quantity Summary -->
          <table style="${tableStyle}margin-bottom:30px;">
            <thead>
              <tr><th colspan="7" style="border:1px solid #000;padding:8px;text-align:center;font-size:14pt;font-weight:bold;background:#fff;">DJ Hospitality &amp; Facility Management Pvt Ltd.</th></tr>
              <tr><th colspan="7" style="border:1px solid #000;padding:6px;text-align:center;font-size:11pt;background:#fff;">Monthly Quantity Summary – Unichem Laboratories Ltd – ${monthLabel}</th></tr>
              <tr>
                ${colHdr("Location","background:#fce4d6;")}
                ${colHdr("Breakfast")}${colHdr("Evening Snacks")}${colHdr("Night Snacks")}${colHdr("Sunday Extra Snacks")}
                ${colHdr("Bill Qty Lunch","background:#c6efce;")}${colHdr("Bill Qty Dinner","background:#c6efce;")}
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td style="${tdLocStyle}">${r.location}</td>
                <td style="${tdStyle}">${r.breakfast || ""}</td>
                <td style="${tdStyle}">${r.eveningSnacks || ""}</td>
                <td style="${tdStyle}">${r.nightSnacks || ""}</td>
                <td style="${tdStyle}">${r.sundayExtra || ""}</td>
                <td style="${tdStyle}">${r.billQtyLunch || ""}</td>
                <td style="${tdStyle}">${r.billQtyDinner || ""}</td>
              </tr>`).join('')}
              <tr style="font-weight:bold;background:#e0e0e0;">
                <td style="${tdLocStyle}">Total</td>
                <td style="${tdStyle}">${totalRow.breakfast || ""}</td>
                <td style="${tdStyle}">${totalRow.eveningSnacks || ""}</td>
                <td style="${tdStyle}">${totalRow.nightSnacks || ""}</td>
                <td style="${tdStyle}">${totalRow.sundayExtra || ""}</td>
                <td style="${tdStyle}">${totalRow.billQtyLunch || ""}</td>
                <td style="${tdStyle}">${totalRow.billQtyDinner || ""}</td>
              </tr>
            </tbody>
          </table>

          <!-- Table 2: Bill Amount Summary -->
          <table style="${tableStyle}">
            <thead>
              <tr><th colspan="8" style="border:1px solid #000;padding:6px;text-align:center;font-size:11pt;background:#fff;">Bill Amount Summary – Unichem Laboratories Ltd – ${monthLabel}</th></tr>
              <tr>
                ${colHdr("Location","background:#fce4d6;")}
                ${colHdr("Breakfast")}${colHdr("Evening Snacks")}${colHdr("Night Snacks")}${colHdr("Sunday Extra Snacks")}
                ${colHdr("Bill Qty Lunch","background:#c6efce;")}${colHdr("Bill Qty Dinner","background:#c6efce;")}
                ${colHdr("Total","background:#ffe0b2;")}
              </tr>
              <tr style="background:#fff9c4;">
                <td style="${tdLocStyle}">Rate</td>
                <td style="${tdStyle}">₹ ${RATES.breakfast}</td>
                <td style="${tdStyle}">₹ ${RATES.eveningSnacks}</td>
                <td style="${tdStyle}">₹ ${RATES.nightSnacks}</td>
                <td style="${tdStyle}">₹ ${RATES.sundayExtra}</td>
                <td style="${tdStyle}">₹ ${RATES.billQtyLunch}</td>
                <td style="${tdStyle}">₹ ${RATES.billQtyDinner}</td>
                <td style="${tdStyle}"></td>
              </tr>
            </thead>
            <tbody>
              ${amtRows.map(r => `<tr>
                <td style="${tdLocStyle}">${r.location}</td>
                ${tdAmt(r.breakfast)}${tdAmt(r.eveningSnacks)}${tdAmt(r.nightSnacks)}${tdAmt(r.sundayExtra)}${tdAmt(r.billQtyLunch)}${tdAmt(r.billQtyDinner)}
                <td style="${tdStyle}font-weight:bold;">${fmt(r.rowTotal)}</td>
              </tr>`).join('')}
              <tr style="font-weight:bold;background:#e0e0e0;">
                <td style="${tdLocStyle}">Total</td>
                ${tdAmt(amtTotal.breakfast)}${tdAmt(amtTotal.eveningSnacks)}${tdAmt(amtTotal.nightSnacks)}${tdAmt(amtTotal.sundayExtra)}${tdAmt(amtTotal.billQtyLunch)}${tdAmt(amtTotal.billQtyDinner)}
                <td style="${tdStyle}font-weight:bold;">${fmt(amtTotal.rowTotal)}</td>
              </tr>
              <tr style="font-weight:bold;background:#fff9c4;">
                <td style="${tdLocStyle}" colspan="7">GST @ 5%</td>
                <td style="${tdStyle}">${fmt(gstAmt)}</td>
              </tr>
              <tr style="font-weight:bold;background:#c6efce;">
                <td style="${tdLocStyle}" colspan="7">Grand Total</td>
                <td style="${tdStyle}">${fmt(grandTotalWithGst)}</td>
              </tr>
            </tbody>
          </table>

          <script>window.onload=function(){window.print();}<\/script>
        </body></html>`;

      win.document.write(html);
      win.document.close();
    } catch (err: any) {
      win.close();
      toast({ title: "Print Failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePrint = () => {
    const monthLabel = `${MONTHS[month-1]} - ${year}`;
    const locationLabel = location;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const tableStyle = `border-collapse:collapse;width:100%;font-size:11pt;`;
    const thStyle = `border:1px solid #000;padding:5px 8px;text-align:center;font-weight:bold;`;
    const tdStyle = `border:1px solid #000;padding:4px 8px;text-align:center;`;
    const hdrBg = `background:#a8d8ea;`;
    const altBg = `background:#fce4d6;`;

    const makeTable = (title: string, cols: string[], dataFn: (r: SnackRow) => (string|number)[]) => `
      <div style="margin-bottom:30px">
        <table style="${tableStyle}">
          <thead>
            <tr><th colspan="${cols.length+3}" style="${thStyle}background:#fff;font-size:13pt;">DJ Hospitality &amp; Facility Management Pvt Ltd.</th></tr>
            <tr><th colspan="${cols.length+3}" style="${thStyle}background:#fff;">Number of ${title} plate Per Day to Unichem Laboratories Ltd - ${locationLabel} - ${monthLabel}</th></tr>
            <tr>
              <th style="${thStyle}${altBg}">Date</th>
              <th style="${thStyle}${altBg}">Days</th>
              ${cols.map(c=>`<th style="${thStyle}${hdrBg}">${c}</th>`).join('')}
              <th style="${thStyle}${altBg}">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const vals = dataFn(r);
              const sunBg = isSunday(r.entryDate) ? 'background:#ffd6d6;' : '';
              return `<tr style="${sunBg}">
                <td style="${tdStyle}">${safeFormat(r.entryDate)}</td>
                <td style="${tdStyle}">${r.weekDay||getWeekDay(r.entryDate)}</td>
                ${vals.map(v=>`<td style="${tdStyle}">${v||""}</td>`).join('')}
                <td style="${tdStyle}">${r.remarks||""}</td>
              </tr>`;
            }).join('')}
            <tr style="font-weight:bold;background:#e0e0e0">
              <td style="${tdStyle}" colspan="2">Total</td>
              ${cols.map((_,ci) => {
                const sum = rows.reduce((s,r) => {
                  const vals = dataFn(r);
                  return s + (Number(vals[ci])||0);
                },0);
                return `<td style="${tdStyle}">${sum}</td>`;
              }).join('')}
              <td style="${tdStyle}"></td>
            </tr>
          </tbody>
        </table>
      </div>`;

    const totalBfEv = rows.reduce((s,r) => s + (r.breakfast||0) + (r.eveningSnacks||0), 0);
    const totalNightPrint = rows.reduce((s,r) => s + (r.nightSnacks||0), 0);
    const totalSundayPrint = rows.reduce((s,r) => s + (isSunday(r.entryDate) ? (lunchBillQtyMap[r.entryDate] || r.sundayExtraSnacks || 0) : 0), 0);

    const bfEvSection = totalBfEv > 0 ? makeTable("Breakfast &amp; Evening Snacks",
      ["Breakfast","Evening<br>Snacks"],
      r => [r.breakfast||0, r.eveningSnacks||0]) : "";

    const nightSection = totalNightPrint > 0 ? makeTable("Night Snacks",
      ["Night Snacks"],
      r => [r.nightSnacks||0]) : "";

    const sundaySection = totalSundayPrint > 0 ? makeTable("Sunday Extra Snacks",
      ["Sunday Extra<br>Snacks"],
      r => [isSunday(r.entryDate) ? (lunchBillQtyMap[r.entryDate] || r.sundayExtraSnacks || "") : ""]) : "";

    const allSections = bfEvSection + nightSection + sundaySection;
    if (!allSections) {
      win.close();
      toast({ title: "Nothing to Print", description: "No snack data found for this month and location.", variant: "destructive" });
      return;
    }

    win.document.write(`<html><head><title>Unichem Snacks - ${locationLabel} - ${monthLabel}</title>
      <style>@media print{body{margin:10mm;}}</style></head>
      <body style="font-family:Arial,sans-serif;padding:20px;">
        ${allSections}
        <script>window.onload=function(){window.print();}<\/script>
      </body></html>`);
    win.document.close();
  };

  const totalBreakfast = rows.reduce((s,r)=>s+(r.breakfast||0),0);
  const totalEvening = rows.reduce((s,r)=>s+(r.eveningSnacks||0),0);
  const totalNight = rows.reduce((s,r)=>s+(r.nightSnacks||0),0);
  const totalSunday = rows.reduce((s,r) => s + (isSunday(r.entryDate) ? (lunchBillQtyMap[r.entryDate] || r.sundayExtraSnacks || 0) : (r.sundayExtraSnacks||0)), 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Location:</label>
          <Select value={location} onValueChange={(v) => setLocation(v as UnichEmLocation)}>
            <SelectTrigger className="flex-1 sm:w-44 h-9" data-testid="select-unichem-location-snack">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNICHEM_LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleAutoFill} className="h-9 flex-1 sm:flex-none" data-testid="btn-unichem-autofill-snack">
            <Plus className="w-3.5 h-3.5 mr-1" /> Auto-Fill Month
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={createMutation.isPending || updateMutation.isPending} className="h-9 flex-1 sm:flex-none" data-testid="btn-unichem-save-snack">
            <Save className="w-3.5 h-3.5 mr-1" /> Save All
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-9 flex-1 sm:flex-none" data-testid="btn-unichem-print-snack">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintAllLocations} className="h-9 flex-1 sm:flex-none text-purple-700 border-purple-300 hover:bg-purple-50" data-testid="btn-unichem-print-all-locations">
            <Printer className="w-3.5 h-3.5 mr-1" /> All Locations Summary
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcelSnack} className="h-9 flex-1 sm:flex-none text-green-700 border-green-300 hover:bg-green-50" data-testid="btn-unichem-export-snack">
            <FileDown className="w-3.5 h-3.5 mr-1" /> Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => importRefSnack.current?.click()} className="h-9 flex-1 sm:flex-none text-blue-700 border-blue-300 hover:bg-blue-50" data-testid="btn-unichem-import-snack">
            <FileUp className="w-3.5 h-3.5 mr-1" /> Import Excel
          </Button>
          <input ref={importRefSnack} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcelSnack} />
          <Button size="sm" variant="outline" onClick={handleResetSnack} className="h-9 flex-1 sm:flex-none text-red-600 border-red-300 hover:bg-red-50" data-testid="btn-unichem-reset-snack">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2"/>Loading...</div> : (<>
        {/* ── Mobile Card View ── */}
        <div className="block md:hidden space-y-2">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No data loaded yet for {MONTHS[month-1]} {year}</div>
          ) : rows.map((row, idx) => {
            const isSun = isSunday(row.entryDate);
            const cardBg = isSun ? "bg-amber-50 border-amber-300 dark:bg-amber-900/20" : "bg-white dark:bg-gray-900 border-gray-200";
            const mblFld = (f: keyof UnichemSnackRow, label: string) => (
              <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                <span className="text-xs text-gray-400 mb-1">{label}</span>
                <input type="number" min={0} inputMode="numeric" value={(row as any)[f]||""}
                  onChange={e=>handleCellChange(idx,f,e.target.value)}
                  className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:38,padding:"4px 2px"}}/>
              </div>
            );
            return (
              <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg} ${row._dirty?"ring-2 ring-yellow-300":""}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold text-gray-400 shrink-0">#{idx+1}</span>
                  <span className="flex-1 text-sm font-semibold">{safeFormat(row.entryDate)}</span>
                  <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-2 py-1 shrink-0">{row.weekDay||getWeekDay(row.entryDate)}</span>
                  {row._dirty && <span className="text-orange-500 font-bold text-xs shrink-0">●</span>}
                </div>
                <div className="mb-2">
                  <div className="text-xs font-semibold text-gray-500 mb-1 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-0.5">🌅 Morning / Evening / Night</div>
                  <div className="grid grid-cols-3 gap-1">
                    {mblFld('breakfast','Breakfast')}
                    {mblFld('eveningSnacks','Evening')}
                    {mblFld('nightSnacks','Night')}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1 bg-red-50 dark:bg-red-900/20 rounded px-2 py-0.5">☀ Sunday Extra</div>
                  <div className="grid grid-cols-1 gap-1">
                    {isSun ? (
                      <div className="flex flex-col items-center bg-red-50 dark:bg-red-900/20 rounded-lg p-1.5">
                        <span className="text-xs text-red-400 mb-1">Auto (Form 2 Bill Qty)</span>
                        <div className="text-sm font-bold text-red-700 dark:text-red-300" style={{minHeight:38,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {lunchBillQtyMap[row.entryDate] || "—"}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                        <span className="text-xs text-gray-400 mb-1">Sun Extra</span>
                        <input type="number" min={0} inputMode="numeric" value={row.sundayExtraSnacks||""}
                          onChange={e=>handleCellChange(idx,'sundayExtraSnacks',e.target.value)}
                          className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:38,padding:"4px 2px"}}/>
                      </div>
                    )}
                    <div className="flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">Remarks</span>
                      <input type="text" value={row.remarks||""} onChange={e=>handleCellChange(idx,'remarks',e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-white px-2" style={{minHeight:38}}/>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>handleSaveRow(idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                    <Save className="w-4 h-4"/>Save
                  </button>
                  <button onClick={()=>handleDeleteRow(idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            );
          })}
          {rows.length > 0 && (
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-700 text-white px-3 py-2 text-sm font-bold">Totals</div>
              <div className="grid grid-cols-2 divide-x divide-y">
                {[["Breakfast",totalBreakfast],["Evening",totalEvening],["Night",totalNight],["Sun Extra",totalSunday]].map(([label,val])=>(
                  <div key={label as string} className="flex justify-between items-center px-3 py-2 text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* ── Desktop Table View ── */}
        <div className="hidden md:block overflow-x-auto rounded-lg border">
          <table className="text-xs border-collapse" style={{minWidth:'560px'}}>
            <thead>
              <tr className="bg-muted/50">
                <th className="border px-2 py-2 text-center font-semibold min-w-[82px] sticky left-0 z-10 bg-muted/80">Date</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[42px] sticky left-[82px] z-10 bg-muted/80">Day</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[72px] bg-blue-50 dark:bg-blue-950/20">Breakfast</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[78px] bg-blue-50 dark:bg-blue-950/20">Evening</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[72px] bg-blue-50 dark:bg-blue-950/20">Night</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[90px] bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">Sun Extra <span className="text-[9px] font-normal block">(auto F2)</span></th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[110px]">Remarks</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[70px]">Act</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="border py-6 text-center text-muted-foreground">No data loaded yet for {MONTHS[month-1]} {year}</td></tr>
              ) : rows.map((row, idx) => {
                const isSun = isSunday(row.entryDate);
                const rowBg = isSun ? "bg-red-100 dark:bg-red-950/30" : idx%2===0 ? "bg-white dark:bg-transparent" : "bg-muted/10";
                return (
                  <tr key={idx} className={`${rowBg} ${row._dirty?"ring-1 ring-inset ring-yellow-300":""}`}>
                    <td className={`border px-1 py-0.5 text-center font-medium text-[11px] sticky left-0 z-10 ${isSun?"bg-red-100 dark:bg-red-950/30":idx%2===0?"bg-white dark:bg-gray-900":"bg-gray-50 dark:bg-gray-800/50"}`}>{safeFormat(row.entryDate)}</td>
                    <td className={`border px-1 py-0.5 text-center text-[11px] sticky left-[82px] z-10 ${isSun?"bg-red-100 dark:bg-red-950/30":idx%2===0?"bg-white dark:bg-gray-900":"bg-gray-50 dark:bg-gray-800/50"}`}>{row.weekDay||getWeekDay(row.entryDate)}</td>
                    <td className="border p-0 bg-blue-50/50 dark:bg-blue-950/10">
                      <input type="number" inputMode="numeric" min="0" value={row.breakfast||""} onChange={e=>handleCellChange(idx,'breakfast',e.target.value)} onKeyDown={e=>handleEnterKey(e,0)}
                        className="w-full text-center bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded" style={{minHeight:'36px'}} data-testid={`snack-bf-${idx}`}/>
                    </td>
                    <td className="border p-0 bg-blue-50/50 dark:bg-blue-950/10">
                      <input type="number" inputMode="numeric" min="0" value={row.eveningSnacks||""} onChange={e=>handleCellChange(idx,'eveningSnacks',e.target.value)} onKeyDown={e=>handleEnterKey(e,1)}
                        className="w-full text-center bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded" style={{minHeight:'36px'}} data-testid={`snack-ev-${idx}`}/>
                    </td>
                    <td className="border p-0 bg-blue-50/50 dark:bg-blue-950/10">
                      <input type="number" inputMode="numeric" min="0" value={row.nightSnacks||""} onChange={e=>handleCellChange(idx,'nightSnacks',e.target.value)} onKeyDown={e=>handleEnterKey(e,2)}
                        className="w-full text-center bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded" style={{minHeight:'36px'}} data-testid={`snack-night-${idx}`}/>
                    </td>
                    <td className="border p-0 bg-red-50/80 dark:bg-red-950/20">
                      {isSun ? (
                        <div className="text-center text-xs py-2.5 sm:py-1.5 font-semibold text-red-700 dark:text-red-300 select-none" style={{minHeight:'36px'}} title="Auto from Form 2 Bill Qty" data-testid={`snack-sun-${idx}`}>
                          {lunchBillQtyMap[row.entryDate] || ""}
                        </div>
                      ) : (
                        <input type="number" inputMode="numeric" min="0" value={row.sundayExtraSnacks||""} onChange={e=>handleCellChange(idx,'sundayExtraSnacks',e.target.value)} onKeyDown={e=>handleEnterKey(e,3)}
                          className="w-full text-center bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded" style={{minHeight:'36px'}} data-testid={`snack-sun-${idx}`}/>
                      )}
                    </td>
                    <td className="border p-0">
                      <input type="text" value={row.remarks||""} onChange={e=>handleCellChange(idx,'remarks',e.target.value)} onKeyDown={e=>handleEnterKey(e,4)}
                        className="w-full bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded px-1" style={{minHeight:'36px'}} data-testid={`snack-remarks-${idx}`}/>
                    </td>
                    <td className="border px-1 py-0.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={()=>handleSaveRow(idx)} title="Save row" className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30" data-testid={`snack-save-${idx}`}>
                          <Save className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={()=>handleDeleteRow(idx)} title="Delete row" className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" data-testid={`snack-delete-${idx}`}>
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-muted font-semibold text-xs">
                  <td colSpan={2} className="border px-2 py-2 text-center sticky left-0 bg-muted z-10">Total</td>
                  <td className="border px-2 py-2 text-center text-blue-700 dark:text-blue-300">{totalBreakfast}</td>
                  <td className="border px-2 py-2 text-center text-blue-700 dark:text-blue-300">{totalEvening}</td>
                  <td className="border px-2 py-2 text-center text-blue-700 dark:text-blue-300">{totalNight}</td>
                  <td className="border px-2 py-2 text-center text-blue-700 dark:text-blue-300">{totalSunday}</td>
                  <td className="border px-2 py-2"></td>
                  <td className="border px-2 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}

// ============================================================
// UNICHEM Format 2 — Lunch & Dinner
// ============================================================

type LunchRow = {
  id?: number;
  location: string;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  mealType: string;
  orderQty: number;
  actual: number;
  total: number;
  billQty: number;
  _dirty?: boolean;
};

function unichEmLunchRowDefaults(dateStr: string, month: number, year: number, location: string, mealType: string): LunchRow {
  return { location, entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr), mealType, orderQty:0, actual:0, total:0, billQty:0, _dirty: true };
}

function UnichemMealSubTab({ month, year, location, mealType, loadKey = 0 }: { month: number; year: number; location: string; mealType: 'lunch'|'dinner'; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localRows, setLocalRows] = useState<LunchRow[]>([]);
  const importRefMeal = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocalRows([]); }, [month, year, location, mealType]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<LunchRow[]>({
    queryKey: ['/api/unichem-lunch-entries', month, year, location, mealType],
    queryFn: async () => {
      const res = await fetch(`/api/unichem-lunch-entries?month=${month}&year=${year}&location=${encodeURIComponent(location)}&mealType=${mealType}`, { credentials: "include" });
      const data = await res.json();
      return data.map((r: LunchRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed), mealType: r.mealType || mealType }; });
    },
  });

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => {
        const freshRows = (result.data || []) as LunchRow[];
        const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
        const existing = freshRows.reduce((acc: Record<string, LunchRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
        setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g));
      });
    }
  }, [loadKey]);

  // Always compute the full month grid merged with DB data (auto-load, no Auto-Fill click needed)
  const fullRows = useMemo(() => {
    const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
    const existing = dbRows.reduce((acc: Record<string, LunchRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
    return generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g);
  }, [dbRows, month, year, location, mealType]);

  const rows: LunchRow[] = localRows.length > 0 ? localRows : fullRows;

  const createMutation = useMutation({
    mutationFn: async (data: LunchRow) => {
      const res = await fetch('/api/unichem-lunch-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/unichem-lunch-entries', month, year, location, mealType] }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/unichem-lunch-entries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/unichem-lunch-entries', month, year, location, mealType] }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/unichem-lunch-entries/${id}`, { method: 'DELETE', credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/unichem-lunch-entries', month, year, location, mealType] }),
  });

  const handleSaveRow = async (idx: number) => {
    const row = rows[idx];
    try {
      const { _dirty, id, ...data } = row;
      if (id) await updateMutation.mutateAsync({ id, data });
      else await createMutation.mutateAsync({ ...row, mealType });
      const result = await refetch();
      const freshRows = ((result.data || []) as LunchRow[]).map(r => ({ ...r, entryDate: normDate(r.entryDate), _dirty: false }));
      const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
      const existingMap = freshRows.reduce((acc: Record<string, LunchRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
      setLocalRows(generated.map(g => existingMap[g.entryDate] ? existingMap[g.entryDate] : g));
      toast({ title: "Row saved" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleDeleteRow = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) {
      setLocalRows(prev => { const u = [...prev]; u[idx] = { ...u[idx], orderQty:0, actual:0, total:0, billQty:0, _dirty:false }; return u; });
      return;
    }
    try {
      await deleteMutation.mutateAsync(row.id);
      const result = await refetch();
      const freshRows = ((result.data || []) as LunchRow[]).map(r => ({ ...r, entryDate: normDate(r.entryDate), _dirty: false }));
      const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
      const existingMap = freshRows.reduce((acc: Record<string, LunchRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
      setLocalRows(generated.map(g => existingMap[g.entryDate] ? existingMap[g.entryDate] : g));
      toast({ title: "Row deleted" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleAutoFill = () => {
    const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
    const existing = dbRows.reduce((acc: Record<string, LunchRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
    const merged = generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g);
    setLocalRows(merged);
  };

  const handleCellChange = (idx: number, field: 'orderQty' | 'actual', value: string) => {
    const currentFullRows = fullRows;
    setLocalRows(prev => {
      const base_rows = prev.length > 0 ? prev : currentFullRows;
      const updated = [...base_rows];
      if (!updated[idx]) return prev;
      const base = { ...updated[idx], [field]: parseInt(value)||0, _dirty: true };
      const newOrder = field === 'orderQty' ? (parseInt(value)||0) : (base.orderQty||0);
      const newActual = field === 'actual' ? (parseInt(value)||0) : (base.actual||0);
      base.total = newActual;
      base.billQty = Math.max(newOrder, newActual);
      updated[idx] = base;
      return updated;
    });
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tbody = (e.target as HTMLElement).closest('tbody');
      if (!tbody) return;
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const currentTr = (e.target as HTMLElement).closest('tr');
      const rowIdx = allRows.indexOf(currentTr as HTMLTableRowElement);
      const nextTr = allRows[rowIdx + 1];
      if (nextTr) {
        const inputs = Array.from(nextTr.querySelectorAll('input:not([readonly])')) as HTMLInputElement[];
        if (inputs[colIdx]) inputs[colIdx].focus();
        else if (inputs[0]) inputs[0].focus();
      }
    }
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r._dirty);
    if (!dirty.length) { toast({ title: "Nothing to save" }); return; }
    let saved = 0;
    for (const row of rows) {
      if (!row._dirty) continue;
      try {
        const { _dirty, id, ...data } = row;
        if (id) await updateMutation.mutateAsync({ id, data });
        else await createMutation.mutateAsync({ ...row, mealType });
        saved++;
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    }
    toast({ title: `Saved ${saved} rows` });
    const result = await refetch();
    const freshRows = ((result.data || []) as LunchRow[]).map(r => ({ ...r, entryDate: normDate(r.entryDate), _dirty: false }));
    const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
    const existingMap = freshRows.reduce((acc: Record<string, LunchRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existingMap[g.entryDate] ? existingMap[g.entryDate] : g));
  };

  const mealLabel = mealType === 'lunch' ? 'Lunch' : 'Dinner';

  const MEAL_COLS = [
    { header: "Date", field: "entryDate" },
    { header: "Day", field: "weekDay" },
    { header: "Order Qty", field: "orderQty" },
    { header: "Actual", field: "actual" },
    { header: "Total", field: "total" },
    { header: "Bill Qty", field: "billQty" },
  ];

  const handleExportExcelMeal = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Unichem ${mealLabel}`);
    const thin = { top:{style:"thin"as const}, bottom:{style:"thin"as const}, left:{style:"thin"as const}, right:{style:"thin"as const} };
    const hdr = ws.addRow(MEAL_COLS.map(c => c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:"FFFFFFFF"}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1A3A5A"}}; cell.border=thin; cell.alignment={horizontal:"center"}; });
    ws.columns = MEAL_COLS.map((_, i) => ({ width: i === 0 ? 14 : 12 }));
    rows.forEach(r => {
      const row = ws.addRow(MEAL_COLS.map(c => c.field==="entryDate" ? safeFormat((r as any).entryDate) : ((r as any)[c.field] ?? "")));
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:"center"}; });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`Unichem_${mealLabel}_${location.replace(/\s+/g,"_")}_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleImportExcelMeal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    const mStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const mEnd = `${year}-${String(month).padStart(2,'0')}-${String(getDaysInMonth(month, year)).padStart(2,'0')}`;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headers: string[] = [];
      ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? "")));
      const importCols = [
        { header: "Date", field: "entryDate" },
        { header: "Day", field: "weekDay" },
        { header: "Order Qty", field: "orderQty" },
        { header: "Actual", field: "actual" },
        { header: "Total", field: "total" },
        { header: "Bill Qty", field: "billQty" },
      ];
      const fieldMap: Record<string, string> = {};
      importCols.forEach(c => { const i = headers.indexOf(c.header); if(i>=0) fieldMap[i]=c.field; });
      const imported: LunchRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri === 1) return;
        const r: any = { month, year, location, mealType, weekDay:"", _dirty:true, orderQty:0, actual:0, total:0, billQty:0 };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci-1]; if (!f) return;
          const v = cell.value;
          r[f] = (f==="entryDate"||f==="weekDay") ? String(v??"") : (parseInt(String(v||0))||0);
        });
        if (!r.entryDate) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as LunchRow);
      });
      const mismatch = imported.filter(r => r.entryDate < mStart || r.entryDate > mEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside ${MONTHS[month-1]} ${year}. Select the correct month and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
  };

  const handleResetMeal = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType)));
  };

  const handlePrint = () => {
    const monthLabel = `${MONTHS[month-1]} - ${year}`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const thS = `border:1px solid #000;padding:5px 8px;text-align:center;font-weight:bold;`;
    const tdS = `border:1px solid #000;padding:4px 8px;text-align:center;`;
    const altBg = `background:#fce4d6;`;
    win.document.write(`<html><head><title>Unichem ${mealLabel} - ${location} - ${monthLabel}</title>
      <style>@media print{body{margin:10mm;}}</style></head>
      <body style="font-family:Arial,sans-serif;padding:20px;">
        <table style="border-collapse:collapse;width:100%;font-size:11pt;">
          <thead>
            <tr><th colspan="6" style="${thS}background:#fff;font-size:13pt;">DJ Hospitality &amp; Facility Management Pvt. Ltd.</th></tr>
            <tr><th colspan="6" style="${thS}background:#fff;">Number of ${mealLabel} Plates Per Day — Unichem Laboratories Ltd — ${location}</th></tr>
            <tr>
              <th style="${thS}${altBg}">Date</th><th style="${thS}${altBg}">Days</th>
              <th style="${thS}${altBg}">Order</th><th style="${thS}background:#a8d8ea;">Actual</th>
              <th style="${thS}background:#c8f7c5;">Total</th><th style="${thS}background:#c8f7c5;">Bill Qty</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const sunBg = isSunday(r.entryDate) ? 'background:#ffd6d6;' : '';
              return `<tr style="${sunBg}">
                <td style="${tdS}">${safeFormat(r.entryDate)}</td>
                <td style="${tdS}">${r.weekDay||getWeekDay(r.entryDate)}</td>
                <td style="${tdS}">${r.orderQty||""}</td>
                <td style="${tdS}">${r.actual||""}</td>
                <td style="${tdS}">${r.total||""}</td>
                <td style="${tdS}">${r.billQty||""}</td>
              </tr>`;
            }).join('')}
            <tr style="font-weight:bold;background:#e0e0e0">
              <td style="${tdS}" colspan="2">Total</td>
              <td style="${tdS}">${rows.reduce((s,r)=>s+(r.orderQty||0),0)}</td>
              <td style="${tdS}">${rows.reduce((s,r)=>s+(r.actual||0),0)}</td>
              <td style="${tdS}">${rows.reduce((s,r)=>s+(r.total||0),0)}</td>
              <td style="${tdS}">${rows.reduce((s,r)=>s+(r.billQty||0),0)}</td>
            </tr>
          </tbody>
        </table>
        <script>window.onload=function(){window.print();}<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={handleAutoFill} className="h-9 flex-1 sm:flex-none" data-testid={`btn-unichem-autofill-${mealType}`}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Auto-Fill Month
        </Button>
        <Button size="sm" onClick={handleSaveAll} disabled={createMutation.isPending || updateMutation.isPending} className="h-9 flex-1 sm:flex-none" data-testid={`btn-unichem-save-${mealType}`}>
          <Save className="w-3.5 h-3.5 mr-1" /> Save All
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="h-9 flex-1 sm:flex-none" data-testid={`btn-unichem-print-${mealType}`}>
          <Printer className="w-3.5 h-3.5 mr-1" /> Print
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportExcelMeal} className="h-9 flex-1 sm:flex-none text-green-700 border-green-300 hover:bg-green-50" data-testid={`btn-unichem-export-${mealType}`}>
          <FileDown className="w-3.5 h-3.5 mr-1" /> Export Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => importRefMeal.current?.click()} className="h-9 flex-1 sm:flex-none text-blue-700 border-blue-300 hover:bg-blue-50" data-testid={`btn-unichem-import-${mealType}`}>
          <FileUp className="w-3.5 h-3.5 mr-1" /> Import Excel
        </Button>
        <input ref={importRefMeal} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcelMeal} />
        <Button size="sm" variant="outline" onClick={handleResetMeal} className="h-9 flex-1 sm:flex-none text-red-600 border-red-300 hover:bg-red-50" data-testid={`btn-unichem-reset-${mealType}`}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
        </Button>
      </div>
      {isLoading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2"/>Loading...</div> : (<>
        {/* ── Mobile Card View ── */}
        <div className="block md:hidden space-y-2">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No data loaded yet for {MONTHS[month-1]} {year}</div>
          ) : rows.map((row, idx) => {
            const isSun = isSunday(row.entryDate);
            const cardBg = isSun ? "bg-amber-50 border-amber-300 dark:bg-amber-900/20" : "bg-white dark:bg-gray-900 border-gray-200";
            return (
              <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg} ${row._dirty?"ring-2 ring-yellow-300":""}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold text-gray-400 shrink-0">#{idx+1}</span>
                  <span className="flex-1 text-sm font-semibold">{safeFormat(row.entryDate)}</span>
                  <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-2 py-1 shrink-0">{row.weekDay||getWeekDay(row.entryDate)}</span>
                  {row._dirty && <span className="text-orange-500 font-bold text-xs shrink-0">●</span>}
                </div>
                <div className="mb-2">
                  <div className="text-xs font-semibold text-gray-500 mb-1 bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-0.5">🍱 {mealType === 'lunch' ? 'Lunch' : 'Dinner'} Quantities</div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="flex flex-col items-center bg-orange-50/60 dark:bg-orange-900/20 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">Order Qty</span>
                      <input type="number" min={0} inputMode="numeric" value={row.orderQty||""}
                        onChange={e=>handleCellChange(idx,'orderQty',e.target.value)}
                        className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:38,padding:"4px 2px"}}/>
                    </div>
                    <div className="flex flex-col items-center bg-blue-50/60 dark:bg-blue-900/20 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">Actual</span>
                      <input type="number" min={0} inputMode="numeric" value={row.actual||""}
                        onChange={e=>handleCellChange(idx,'actual',e.target.value)}
                        className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:38,padding:"4px 2px"}}/>
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1 bg-green-50 dark:bg-green-900/20 rounded px-2 py-0.5">✅ Auto-Calculated</div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="flex flex-col items-center bg-green-50/60 dark:bg-green-900/20 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">Total</span>
                      <div className="text-sm font-bold text-green-700 dark:text-green-300" style={{minHeight:38,display:"flex",alignItems:"center",justifyContent:"center"}}>{row.actual||"—"}</div>
                    </div>
                    <div className="flex flex-col items-center bg-green-50/60 dark:bg-green-900/20 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">Bill Qty</span>
                      <div className="text-sm font-bold text-green-700 dark:text-green-300" style={{minHeight:38,display:"flex",alignItems:"center",justifyContent:"center"}}>{row.billQty||"—"}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>handleSaveRow(idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                    <Save className="w-4 h-4"/>Save
                  </button>
                  <button onClick={()=>handleDeleteRow(idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            );
          })}
          {rows.length > 0 && (
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-700 text-white px-3 py-2 text-sm font-bold">Totals</div>
              <div className="grid grid-cols-2 divide-x divide-y">
                {[["Order",rows.reduce((s,r)=>s+(r.orderQty||0),0)],["Actual",rows.reduce((s,r)=>s+(r.actual||0),0)],["Total",rows.reduce((s,r)=>s+(r.total||0),0)],["Bill Qty",rows.reduce((s,r)=>s+(r.billQty||0),0)]].map(([label,val])=>(
                  <div key={label as string} className="flex justify-between items-center px-3 py-2 text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* ── Desktop Table View ── */}
        <div className="hidden md:block overflow-x-auto rounded-lg border">
          <table className="text-xs border-collapse" style={{minWidth:'420px'}}>
            <thead>
              <tr className="bg-muted/50">
                <th className="border px-2 py-2 text-center font-semibold min-w-[82px] sticky left-0 z-10 bg-muted/80">Date</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[42px] sticky left-[82px] z-10 bg-muted/80">Day</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[68px] bg-orange-50 dark:bg-orange-950/20">Order</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[68px] bg-blue-50 dark:bg-blue-950/20">Actual</th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[68px] bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Total <span className="text-[9px] font-normal block">(auto)</span></th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[68px] bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Bill Qty <span className="text-[9px] font-normal block">(auto)</span></th>
                <th className="border px-2 py-2 text-center font-semibold min-w-[70px]">Act</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="border py-6 text-center text-muted-foreground">No data loaded yet for {MONTHS[month-1]} {year}</td></tr>
              ) : rows.map((row, idx) => {
                const isSun = isSunday(row.entryDate);
                const rowBg = isSun ? "bg-red-100 dark:bg-red-950/30" : idx%2===0 ? "bg-white dark:bg-transparent" : "bg-muted/10";
                return (
                  <tr key={idx} className={`${rowBg} ${row._dirty?"ring-1 ring-inset ring-yellow-300":""}`}>
                    <td className={`border px-1 py-0.5 text-center font-medium text-[11px] sticky left-0 z-10 ${isSun?"bg-red-100 dark:bg-red-950/30":idx%2===0?"bg-white dark:bg-gray-900":"bg-gray-50 dark:bg-gray-800/50"}`}>{safeFormat(row.entryDate)}</td>
                    <td className={`border px-1 py-0.5 text-center text-[11px] sticky left-[82px] z-10 ${isSun?"bg-red-100 dark:bg-red-950/30":idx%2===0?"bg-white dark:bg-gray-900":"bg-gray-50 dark:bg-gray-800/50"}`}>{row.weekDay||getWeekDay(row.entryDate)}</td>
                    <td className="border p-0 bg-orange-50/50 dark:bg-orange-950/10">
                      <input type="number" inputMode="numeric" min="0" value={row.orderQty||""}
                        onChange={e=>handleCellChange(idx,'orderQty',e.target.value)}
                        onKeyDown={e=>handleEnterKey(e,0)}
                        className="w-full text-center bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded" style={{minHeight:'36px'}} data-testid={`${mealType}-order-${idx}`}/>
                    </td>
                    <td className="border p-0 bg-blue-50/50 dark:bg-blue-950/10">
                      <input type="number" inputMode="numeric" min="0" value={row.actual||""}
                        onChange={e=>handleCellChange(idx,'actual',e.target.value)}
                        onKeyDown={e=>handleEnterKey(e,1)}
                        className="w-full text-center bg-transparent outline-none text-xs py-2.5 sm:py-1.5 focus:bg-white dark:focus:bg-gray-800 rounded" style={{minHeight:'36px'}} data-testid={`${mealType}-actual-${idx}`}/>
                    </td>
                    <td className="border px-1 text-center text-xs font-semibold bg-green-100/60 dark:bg-green-900/20 text-green-800 dark:text-green-300 select-none" style={{minHeight:'36px'}} data-testid={`${mealType}-total-${idx}`}>
                      {row.actual||""}
                    </td>
                    <td className="border px-1 text-center text-xs font-semibold bg-green-100/60 dark:bg-green-900/20 text-green-800 dark:text-green-300 select-none" style={{minHeight:'36px'}} data-testid={`${mealType}-billqty-${idx}`}>
                      {row.billQty||""}
                    </td>
                    <td className="border px-1 py-0.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={()=>handleSaveRow(idx)} title="Save row" className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30" data-testid={`${mealType}-save-row-${idx}`}>
                          <Save className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={()=>handleDeleteRow(idx)} title="Delete row" className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" data-testid={`${mealType}-delete-row-${idx}`}>
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-muted font-semibold text-xs">
                  <td colSpan={2} className="border px-2 py-2 text-center sticky left-0 bg-muted z-10">Total</td>
                  <td className="border px-2 py-2 text-center text-orange-700">{rows.reduce((s,r)=>s+(r.orderQty||0),0)}</td>
                  <td className="border px-2 py-2 text-center text-blue-700">{rows.reduce((s,r)=>s+(r.actual||0),0)}</td>
                  <td className="border px-2 py-2 text-center text-green-700">{rows.reduce((s,r)=>s+(r.total||0),0)}</td>
                  <td className="border px-2 py-2 text-center text-green-700">{rows.reduce((s,r)=>s+(r.billQty||0),0)}</td>
                  <td className="border px-2 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}

function UnichemLunchTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const [location, setLocation] = useState<UnichEmLocation>("Main Plant");
  const [activeMeal, setActiveMeal] = useState<'lunch'|'dinner'>('lunch');
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Location:</label>
          <Select value={location} onValueChange={(v) => setLocation(v as UnichEmLocation)}>
            <SelectTrigger className="flex-1 sm:w-44 h-9" data-testid="select-unichem-location-lunch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNICHEM_LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
          <button
            onClick={() => setActiveMeal('lunch')}
            className={`px-4 py-1.5 transition-colors ${activeMeal==='lunch' ? 'bg-orange-500 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            data-testid="tab-meal-lunch">
            🍱 Lunch
          </button>
          <button
            onClick={() => setActiveMeal('dinner')}
            className={`px-4 py-1.5 transition-colors border-l ${activeMeal==='dinner' ? 'bg-indigo-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            data-testid="tab-meal-dinner">
            🍽️ Dinner
          </button>
        </div>
      </div>
      <UnichemMealSubTab key={`${location}-${activeMeal}`} month={month} year={year} location={location} mealType={activeMeal} loadKey={loadKey} />
    </div>
  );
}

// ============================================================
// CIPLA Format
// ============================================================

type CiplaRow = {
  id?: number;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  breakfastCoopen: number; breakfastCoin: number; breakfastSign: number;
  lunchCoopen: number; lunchCoin: number; lunchSign: number;
  dinnerCoopen: number; dinnerCoin: number; dinnerSign: number;
  breakfastMachine: number; lunchMachine: number; dinnerMachine: number;
  _dirty?: boolean;
};

function ciplaRowDefaults(dateStr: string, month: number, year: number): CiplaRow {
  return {
    entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr),
    breakfastCoopen:0, breakfastCoin:0, breakfastSign:0,
    lunchCoopen:0, lunchCoin:0, lunchSign:0,
    dinnerCoopen:0, dinnerCoin:0, dinnerSign:0,
    breakfastMachine:0, lunchMachine:0, dinnerMachine:0,
    _dirty: true,
  };
}

function CiplaDateEntryTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const importRef3 = useRef<HTMLInputElement>(null);
  const [localRows, setLocalRows] = useState<CiplaRow[]>([]);
  const [machineEdit, setMachineEdit] = useState<{bf: string; lu: string; di: string} | null>(null);
  useEffect(() => { setLocalRows([]); }, [month, year]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<CiplaRow[]>({
    queryKey: ['/api/cipla-date-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/cipla-date-entries?month=${month}&year=${year}`, { credentials:"include" });
      const data = await res.json();
      return data.map((r: CiplaRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed) }; });
    },
  });

  const handleAutoFill = (freshRows?: CiplaRow[]) => {
    const source = freshRows ?? dbRows;
    const generated = generateBillingRows(month, year, ciplaRowDefaults);
    const existing = source.reduce((acc: Record<string, CiplaRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g));
  };

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => { handleAutoFill((result.data || []) as CiplaRow[]); });
    }
  }, [loadKey]);

  const { data: machineSummary } = useQuery<{bfMachine:number;luMachine:number;diMachine:number}>({
    queryKey: ['/api/cipla-machine-summary', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/cipla-machine-summary?month=${month}&year=${year}`, { credentials:"include" });
      return res.json();
    },
  });

  const machineSaveMutation = useMutation({
    mutationFn: async (data: {bfMachine:number;luMachine:number;diMachine:number}) => {
      const res = await fetch('/api/cipla-machine-summary', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({month,year,...data}), credentials:"include" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['/api/cipla-machine-summary', month, year] });
      setMachineEdit(null);
      toast({ title:"Machine data saved" });
    },
  });

  useEffect(() => { setMachineEdit(null); }, [month, year]);

  const rows: CiplaRow[] = localRows.length > 0 ? localRows : dbRows.map(r => ({ ...r }));

  const createMutation = useMutation({
    mutationFn: async (data: CiplaRow) => {
      const res = await fetch('/api/cipla-date-entries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), credentials:"include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['/api/cipla-date-entries', month, year] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/cipla-date-entries/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), credentials:"include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['/api/cipla-date-entries', month, year] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/cipla-date-entries/${id}`, { method:'DELETE', credentials:"include" }); },
    onSuccess: () => qc.invalidateQueries({ queryKey:['/api/cipla-date-entries', month, year] }),
  });

  const syncRows = () => { if (localRows.length === 0) setLocalRows(dbRows.map(r => ({ ...r }))); };

  const handleCellChange = (idx: number, field: keyof CiplaRow, value: string) => {
    syncRows();
    setLocalRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      (row as any)[field] = (field==='entryDate'||field==='weekDay') ? value : (parseInt(value)||0);
      if (field === 'entryDate') {
        row.weekDay = getWeekDay(value);
        if (value) { const d = new Date(value+"T00:00:00"); row.month = d.getMonth()+1; row.year = d.getFullYear(); }
      }
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  const { endDate: billingEnd3 } = getBillingRange(month, year);

  const handleAddRow = () => {
    let nextDate: string;
    if (rows.length === 0) {
      nextDate = `${year}-${String(month).padStart(2,'0')}-21`;
    } else {
      const lastDate = normDate(rows[rows.length - 1].entryDate);
      const d = new Date(lastDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      nextDate = localDateStr(d);
    }
    if (nextDate > billingEnd3) {
      toast({ title: "Billing period complete", description: `All dates up to ${billingEnd3} already added.`, variant: "destructive" });
      return;
    }
    syncRows();
    setLocalRows(prev => [...prev, ciplaRowDefaults(nextDate, month, year)]);
  };

  const handleSaveRow = async (row: CiplaRow, idx: number) => {
    try {
      const { _dirty, id, ...data } = row;
      if (id) await updateMutation.mutateAsync({ id, data });
      else await createMutation.mutateAsync(row);
      toast({ title:"Saved" });
    } catch (e: any) { toast({ title:"Error", description:e.message, variant:"destructive" }); }
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]._dirty) await handleSaveRow(rows[i], i);
    }
  };

  const handleDeleteRow = async (row: CiplaRow, idx: number) => {
    if (row.id) await deleteMutation.mutateAsync(row.id);
    setLocalRows(prev => prev.filter((_,i)=>i!==idx));
  };

  const totBfCoopen=rows.reduce((s,r)=>s+(r.breakfastCoopen||0),0);
  const totBfCoin=rows.reduce((s,r)=>s+(r.breakfastCoin||0),0);
  const totBfSign=rows.reduce((s,r)=>s+(r.breakfastSign||0),0);
  const totBfTotal=totBfCoopen+totBfCoin+totBfSign;
  const totLuCoopen=rows.reduce((s,r)=>s+(r.lunchCoopen||0),0);
  const totLuCoin=rows.reduce((s,r)=>s+(r.lunchCoin||0),0);
  const totLuSign=rows.reduce((s,r)=>s+(r.lunchSign||0),0);
  const totLuTotal=totLuCoopen+totLuCoin+totLuSign;
  const totDiCoopen=rows.reduce((s,r)=>s+(r.dinnerCoopen||0),0);
  const totDiCoin=rows.reduce((s,r)=>s+(r.dinnerCoin||0),0);
  const totDiSign=rows.reduce((s,r)=>s+(r.dinnerSign||0),0);
  const totDiTotal=totDiCoopen+totDiCoin+totDiSign;
  // Machine totals come from billing-period summary (not per-row)
  const mBf = machineSummary?.bfMachine || 0;
  const mLu = machineSummary?.luMachine || 0;
  const mDi = machineSummary?.diMachine || 0;
  const curMachineEdit = machineEdit ?? { bf: String(mBf), lu: String(mLu), di: String(mDi) };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('','_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Cipla Bill Data Sheet</title><style>
      *{box-sizing:border-box;}
      body{font-family:"Times New Roman",Times,serif;margin:0;font-size:12pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3{text-align:center;margin:2px 0;font-size:13pt;font-weight:bold;}
      h4,p{text-align:center;margin:1px 0;font-size:11pt;}
      table{width:100%;border-collapse:collapse;margin-top:6px;table-layout:auto;}
      th,td{border:1px solid #333;padding:1px 3px;text-align:center;font-size:12pt;font-family:"Times New Roman",Times,serif;white-space:nowrap;}
      th{background:#1a3a5a!important;color:white!important;font-size:10pt;font-weight:bold;}
      .total-row{font-weight:bold;background:#e8f0fe!important;}
      .orange-row{background:#ffa500!important;}
      @media print{@page{margin:5mm;size:A4 portrait;}body{margin:0;}table{page-break-inside:auto;}tr{page-break-inside:avoid;}}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const CIPLA_COLS = [
    { header:"Date", field:"entryDate" },
    { header:"Month", field:"month" },
    { header:"Day", field:"weekDay" },
    { header:"Breakfast Coopen", field:"breakfastCoopen" },
    { header:"Breakfast Coin", field:"breakfastCoin" },
    { header:"Breakfast Sign", field:"breakfastSign" },
    { header:"Lunch Coopen", field:"lunchCoopen" },
    { header:"Lunch Coin", field:"lunchCoin" },
    { header:"Lunch Sign", field:"lunchSign" },
    { header:"Dinner Coopen", field:"dinnerCoopen" },
    { header:"Dinner Coin", field:"dinnerCoin" },
    { header:"Dinner Sign", field:"dinnerSign" },
    { header:"Breakfast Machine", field:"breakfastMachine" },
    { header:"Lunch Machine", field:"lunchMachine" },
    { header:"Dinner Machine", field:"dinnerMachine" },
  ];

  const handleExportExcel3 = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cipla Date Entry");
    const thin = { top:{style:"thin"as const}, bottom:{style:"thin"as const}, left:{style:"thin"as const}, right:{style:"thin"as const} };
    const hdr = ws.addRow(CIPLA_COLS.map(c=>c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:"FFFFFFFF"}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1A3A5A"}}; cell.border=thin; cell.alignment={horizontal:"center"}; });
    ws.columns = CIPLA_COLS.map((_,i)=>({ width: i===0?14:16 }));
    rows.forEach(r => {
      const calMonth = r.entryDate ? parseInt(r.entryDate.split('-')[1]) || r.month : r.month;
      const row = ws.addRow(CIPLA_COLS.map(c => c.field==="entryDate" ? safeFormat((r as any).entryDate) : c.field==="month" ? calMonth : ((r as any)[c.field] ?? "")));
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:"center"}; });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`Cipla_DateEntry_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleImportExcel3 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    const { startDate: bStart, endDate: bEnd, label: bLabel } = getBillingRange(month, year);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const headers: string[] = [];
      ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? "")));
      const fieldMap: Record<string,string> = {};
      CIPLA_COLS.forEach(c => { const i = headers.indexOf(c.header); if(i>=0) fieldMap[i]=c.field; });
      const imported: CiplaRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri === 1) return;
        const r: any = { month, year, weekDay:"", _dirty:true };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci-1]; if (!f) return;
          const v = cell.value;
          r[f] = (f==="entryDate"||f==="weekDay") ? String(v??"") : (parseInt(String(v||0))||0);
        });
        if (!r.entryDate) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as CiplaRow);
      });
      const mismatch = imported.filter(r => r.entryDate < bStart || r.entryDate > bEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside the loaded period (${bLabel}). Select the correct billing period and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
  };

  const handleReset3 = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateBillingRows(month, year, ciplaRowDefaults));
  };

  const numFld = (row: CiplaRow, idx: number, field: keyof CiplaRow, w=50) => (
    <input type="number" min={0} value={(row as any)[field]||""}
      onChange={e=>handleCellChange(idx,field,e.target.value)}
      data-field={String(field)} data-row={idx}
      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); const next=document.querySelector(`#ubl3-desk input[data-field="${String(field)}"][data-row="${idx+1}"]`) as HTMLInputElement; if(next) next.focus(); }}}
      style={{width:w,border:"none",background:"transparent",textAlign:"center",fontSize:12,padding:0,outline:"none"}}/>
  );

  const { label: ciplaBillingLabel } = getBillingRange(month, year);

  const printTable = (
    <div ref={printRef}>
      <h3>DJ Hospitality &amp; Facility Management Pvt Ltd</h3>
      <h4>Cipla Limited Unit 1</h4>
      <p>Bill Data Sheet — {ciplaBillingLabel}</p>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>Sl.</th>
            <th rowSpan={2}>Date</th>
            <th rowSpan={2}>Mth</th>
            <th rowSpan={2}>Day</th>
            <th colSpan={4} style={{background:"#4a5568",color:"white"}}>Breakfast</th>
            <th colSpan={4} style={{background:"#2d6a4f",color:"white"}}>Lunch</th>
            <th colSpan={4} style={{background:"#1a3a5a",color:"white"}}>Dinner</th>
          </tr>
          <tr>
            <th>Coopen</th><th>Coin</th><th>Sign</th><th>Total</th>
            <th>Coopen</th><th>Coin</th><th>Sign</th><th>Total</th>
            <th>Coopen</th><th>Coin</th><th>Sign</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>{
            const bfTotal=(row.breakfastCoopen||0)+(row.breakfastCoin||0)+(row.breakfastSign||0);
            const luTotal=(row.lunchCoopen||0)+(row.lunchCoin||0)+(row.lunchSign||0);
            const diTotal=(row.dinnerCoopen||0)+(row.dinnerCoin||0)+(row.dinnerSign||0);
            return (
              <tr key={i} style={{background:isSunday(row.entryDate)?"#ffa500":"transparent"}}>
                <td>{i+1}</td>
                <td>{safeFormat(row.entryDate)}</td>
                <td>{parseInt(row.entryDate.split('-')[1])||row.month}</td><td>{row.weekDay}</td>
                <td>{row.breakfastCoopen||""}</td><td>{row.breakfastCoin||""}</td><td>{row.breakfastSign||""}</td><td>{bfTotal||""}</td>
                <td>{row.lunchCoopen||""}</td><td>{row.lunchCoin||""}</td><td>{row.lunchSign||""}</td><td>{luTotal||""}</td>
                <td>{row.dinnerCoopen||""}</td><td>{row.dinnerCoin||""}</td><td>{row.dinnerSign||""}</td><td>{diTotal||""}</td>
              </tr>
            );
          })}
          <tr style={{fontWeight:"bold",background:"#e8f0fe"}}>
            <td colSpan={4}>Total</td>
            <td>{totBfCoopen}</td><td>{totBfCoin}</td><td>{totBfSign}</td><td>{totBfTotal}</td>
            <td>{totLuCoopen}</td><td>{totLuCoin}</td><td>{totLuSign}</td><td>{totLuTotal}</td>
            <td>{totDiCoopen}</td><td>{totDiCoin}</td><td>{totDiSign}</td><td>{totDiTotal}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Footer Summary Table ── */}
      {(()=>{
        const bfManual=totBfCoopen+totBfCoin;
        const luManual=totLuCoopen+totLuCoin;
        const diManual=totDiCoopen+totDiCoin;
        const bfDiff=totBfCoopen-mBf;
        const luDiff=totLuCoopen-mLu;
        const diDiff=totDiCoopen-mDi;
        const totCoopen=totBfCoopen+totLuCoopen+totDiCoopen;
        const totCoin=totBfCoin+totLuCoin+totDiCoin;
        const totManual=totCoopen+totCoin;
        const totDiff=bfDiff+luDiff+diDiff;
        const th:React.CSSProperties={border:"1px solid #333",padding:"3px 6px",textAlign:"center",fontWeight:"bold",background:"#1a3a5a",color:"white"};
        const td:React.CSSProperties={border:"1px solid #333",padding:"3px 6px",textAlign:"center"};
        const tdBold:React.CSSProperties={...td,fontWeight:"bold",background:"#e8f0fe"};
        return (
          <table style={{width:"60%",borderCollapse:"collapse",marginTop:14,marginLeft:"auto",marginRight:0}}>
            <thead>
              <tr>
                <th style={th}>Particulars</th>
                <th colSpan={3} style={{...th,background:"#4a5568"}}>Manual Data</th>
                <th style={th}>Machine Data</th>
                <th style={th}>Difference</th>
              </tr>
              <tr>
                <th style={th}></th>
                <th style={{...th,background:"#4a5568"}}>Coopen</th>
                <th style={{...th,background:"#4a5568"}}>Coin</th>
                <th style={{...th,background:"#4a5568"}}>Total</th>
                <th style={th}></th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>Breakfast</td>
                <td style={td}>{totBfCoopen||""}</td>
                <td style={td}>{totBfCoin||""}</td>
                <td style={td}>{bfManual||""}</td>
                <td style={td}>{mBf||""}</td>
                <td style={{...td,fontWeight:"bold",color:bfDiff!==0?"#c00":"#060"}}>{totBfCoopen||mBf?bfDiff:""}</td>
              </tr>
              <tr>
                <td style={td}>Lunch</td>
                <td style={td}>{totLuCoopen||""}</td>
                <td style={td}>{totLuCoin||""}</td>
                <td style={td}>{luManual||""}</td>
                <td style={td}>{mLu||""}</td>
                <td style={{...td,fontWeight:"bold",color:luDiff!==0?"#c00":"#060"}}>{totLuCoopen||mLu?luDiff:""}</td>
              </tr>
              <tr>
                <td style={td}>Dinner</td>
                <td style={td}>{totDiCoopen||""}</td>
                <td style={td}>{totDiCoin||""}</td>
                <td style={td}>{diManual||""}</td>
                <td style={td}>{mDi||""}</td>
                <td style={{...td,fontWeight:"bold",color:diDiff!==0?"#c00":"#060"}}>{totDiCoopen||mDi?diDiff:""}</td>
              </tr>
              <tr>
                <td style={tdBold}>Total</td>
                <td style={tdBold}>{totCoopen||""}</td>
                <td style={tdBold}>{totCoin||""}</td>
                <td style={tdBold}>{totManual||""}</td>
                <td style={tdBold}></td>
                <td style={{...tdBold,color:totDiff!==0?"#c00":"#060"}}>{totDiff||""}</td>
              </tr>
            </tbody>
          </table>
        );
      })()}
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" onClick={handleAddRow} className="bg-blue-600 text-white h-10 px-4 text-sm"
          disabled={rows.length > 0 && rows[rows.length-1].entryDate >= billingEnd3}>
          <Plus className="w-4 h-4 mr-1.5"/>Add Row</Button>
        <Button size="sm" onClick={handleSaveAll} className="bg-green-600 text-white h-10 px-4 text-sm" disabled={createMutation.isPending||updateMutation.isPending}><Save className="w-4 h-4 mr-1.5"/>Save All</Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="h-10 px-4 text-sm"><Printer className="w-4 h-4 mr-1.5"/>Print</Button>
        <Button size="sm" variant="outline" onClick={handleExportExcel3} className="h-10 px-4 text-sm text-green-700 border-green-300 hover:bg-green-50" disabled={rows.length===0}><FileDown className="w-4 h-4 mr-1.5"/>Export Excel</Button>
        <Button size="sm" variant="outline" onClick={()=>importRef3.current?.click()} className="h-10 px-4 text-sm text-blue-700 border-blue-300 hover:bg-blue-50"><FileUp className="w-4 h-4 mr-1.5"/>Import Excel</Button>
        <input ref={importRef3} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel3}/>
        <Button size="sm" variant="outline" onClick={handleReset3} className="h-10 px-4 text-sm text-red-600 border-red-300 hover:bg-red-50"><RefreshCw className="w-4 h-4 mr-1.5"/>Reset</Button>
      </div>

      {/* ── Mobile Card View ── */}
      <div className="block md:hidden space-y-2">
        {rows.map((row, idx) => {
          const bfTotal=(row.breakfastCoopen||0)+(row.breakfastCoin||0)+(row.breakfastSign||0);
          const luTotal=(row.lunchCoopen||0)+(row.lunchCoin||0)+(row.lunchSign||0);
          const diTotal=(row.dinnerCoopen||0)+(row.dinnerCoin||0)+(row.dinnerSign||0);
          const isSun=isSunday(row.entryDate);
          const cardBg=isSun?"bg-amber-50 border-amber-300 dark:bg-amber-900/20":"bg-white dark:bg-gray-900 border-gray-200";
          const mblFld=(f:keyof CiplaRow)=>(
            <input type="number" min={0} value={(row as any)[f]||""} onChange={e=>handleCellChange(idx,f,e.target.value)}
              className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:40,padding:"4px 2px"}}/>
          );
          return (
            <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-bold text-gray-400 shrink-0">#{idx+1}</span>
                <input type="date" value={row.entryDate} onChange={e=>handleCellChange(idx,"entryDate",e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2 dark:bg-gray-800 dark:text-white" style={{minHeight:40,fontSize:14}}/>
                <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-2 py-1 shrink-0">{row.weekDay}</span>
              </div>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-600 mb-1 bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5 flex justify-between">
                  <span>🍳 Breakfast</span><span className="font-bold text-blue-700 dark:text-blue-300">= {bfTotal||0}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([["breakfastCoopen","Coopen"],["breakfastCoin","Coin"],["breakfastSign","Sign"]] as [keyof CiplaRow,string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-600 mb-1 bg-green-50 dark:bg-green-900/20 rounded px-2 py-0.5 flex justify-between">
                  <span>🍽 Lunch</span><span className="font-bold text-green-700 dark:text-green-300">= {luTotal||0}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([["lunchCoopen","Coopen"],["lunchCoin","Coin"],["lunchSign","Sign"]] as [keyof CiplaRow,string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-600 mb-1 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-0.5 flex justify-between">
                  <span>🌙 Dinner</span><span className="font-bold text-blue-700 dark:text-blue-300">= {diTotal||0}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([["dinnerCoopen","Coopen"],["dinnerCoin","Coin"],["dinnerSign","Sign"]] as [keyof CiplaRow,string][]).map(([f,label])=>(
                    <div key={f} className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
                      <span className="text-xs text-gray-400 mb-1">{label}</span>{mblFld(f)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>handleSaveRow(row,idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                  <Save className="w-4 h-4"/>Save
                </button>
                <button onClick={()=>handleDeleteRow(row,idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          );
        })}
        {/* Mobile Machine Data + Summary */}
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between bg-slate-700 text-white px-3 py-2">
            <span className="text-sm font-bold">Billing Summary</span>
            <button onClick={()=>machineSaveMutation.mutate({bfMachine:parseInt(curMachineEdit.bf)||0,luMachine:parseInt(curMachineEdit.lu)||0,diMachine:parseInt(curMachineEdit.di)||0})}
              disabled={machineSaveMutation.isPending}
              className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1 text-xs font-bold">
              {machineSaveMutation.isPending?"Saving...":"Save Machine"}
            </button>
          </div>
          {([
            {label:"🍳 Breakfast",coopen:totBfCoopen,coin:totBfCoin,total:totBfTotal,mKey:"bf" as const,diff:totBfCoopen-(parseInt(curMachineEdit.bf)||0)},
            {label:"🍽 Lunch",coopen:totLuCoopen,coin:totLuCoin,total:totLuTotal,mKey:"lu" as const,diff:totLuCoopen-(parseInt(curMachineEdit.lu)||0)},
            {label:"🌙 Dinner",coopen:totDiCoopen,coin:totDiCoin,total:totDiTotal,mKey:"di" as const,diff:totDiCoopen-(parseInt(curMachineEdit.di)||0)},
          ]).map((s,i)=>(
            <div key={s.label} className="border-b p-3" style={{background:i%2===0?"#fff":"#f9f9f9"}}>
              <div className="text-sm font-semibold text-gray-700 mb-2">{s.label}</div>
              <div className="grid grid-cols-4 gap-2 text-xs text-center mb-2">
                <div><div className="text-gray-400 mb-1">Coopen</div><div className="font-bold">{s.coopen||0}</div></div>
                <div><div className="text-gray-400 mb-1">Coin</div><div className="font-bold">{s.coin||0}</div></div>
                <div><div className="text-gray-400 mb-1">Total</div><div className="font-bold">{s.total||0}</div></div>
                <div><div className="text-gray-400 mb-1">Diff</div><div className={`font-bold ${s.diff!==0?"text-red-600":"text-green-600"}`}>{(parseInt(curMachineEdit[s.mKey])||0)>0||s.coopen>0?s.diff:""}</div></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 font-medium">Machine:</span>
                <input type="number" min={0} value={curMachineEdit[s.mKey]}
                  onChange={e=>setMachineEdit({...curMachineEdit,[s.mKey]:e.target.value})}
                  className="flex-1 border-2 border-amber-400 rounded-lg text-sm text-center font-medium" style={{minHeight:36,padding:"4px"}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop Table View ── */}
      <div id="ubl3-desk" className="hidden md:block overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:"collapse",minWidth:900,fontFamily:"Arial,sans-serif",fontSize:12}}>
          <thead>
            <tr style={{background:"#1a3a5a",color:"white"}}>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:32}}>Sl</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:100}}>Date</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:46}}>Month</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:44}}>Day</th>
              <th colSpan={4} style={{padding:"4px",border:"1px solid #334",background:"#4a5568"}}>Breakfast</th>
              <th colSpan={4} style={{padding:"4px",border:"1px solid #334",background:"#2d6a4f"}}>Lunch</th>
              <th colSpan={4} style={{padding:"4px",border:"1px solid #334",background:"#1a3a5a"}}>Dinner</th>
              <th rowSpan={2} style={{padding:"4px",border:"1px solid #334",width:40}}>Act</th>
            </tr>
            <tr style={{background:"#2a4a6a",color:"white"}}>
              {["Coopen","Coin","Sign","Total","Coopen","Coin","Sign","Total","Coopen","Coin","Sign","Total"].map((c,i)=>(
                <th key={i} style={{padding:"4px 2px",border:"1px solid #334",fontSize:10}}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,idx)=>{
              const isSun=isSunday(row.entryDate);
              const bg=isSun?"#fff3cd":idx%2===0?"#fff":"#f9f9f9";
              const bfTotal=(row.breakfastCoopen||0)+(row.breakfastCoin||0)+(row.breakfastSign||0);
              const luTotal=(row.lunchCoopen||0)+(row.lunchCoin||0)+(row.lunchSign||0);
              const diTotal=(row.dinnerCoopen||0)+(row.dinnerCoin||0)+(row.dinnerSign||0);
              return (
                <tr key={idx} style={{background:bg}}>
                  <td style={{textAlign:"center",border:"1px solid #ccc",padding:"2px"}}>{idx+1}</td>
                  <td style={{border:"1px solid #ccc",padding:0}}>
                    <input type="date" value={row.entryDate} onChange={e=>handleCellChange(idx,"entryDate",e.target.value)}
                      style={{width:100,border:"none",background:"transparent",fontSize:11,padding:"3px 2px"}}/>
                  </td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{parseInt(row.entryDate.split('-')[1])||row.month}</td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.weekDay}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"breakfastCoopen")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"breakfastCoin")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"breakfastSign")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",background:"#f0f4ff"}}>{bfTotal||""}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"lunchCoopen")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"lunchCoin")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"lunchSign")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",background:"#f0f4ff"}}>{luTotal||""}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"dinnerCoopen")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"dinnerCoin")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"dinnerSign")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",background:"#f0f4ff"}}>{diTotal||""}</td>
                  <td style={{border:"1px solid #ccc",padding:"2px",textAlign:"center"}}>
                    <button onClick={()=>handleSaveRow(row,idx)} title="Save" style={{color:"#2196f3",marginRight:4,background:"none",border:"none",cursor:"pointer"}}><Save style={{width:13,height:13}}/></button>
                    <button onClick={()=>handleDeleteRow(row,idx)} title="Delete" style={{color:"#e53e3e",background:"none",border:"none",cursor:"pointer"}}><Trash2 style={{width:13,height:13}}/></button>
                  </td>
                </tr>
              );
            })}
            <tr style={{background:"#e8f0fe",fontWeight:"bold"}}>
              <td colSpan={4} style={{textAlign:"center",border:"1px solid #ccc",padding:"4px"}}>Total</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totBfCoopen}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totBfCoin}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totBfSign}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",background:"#d0d8ff"}}>{totBfTotal}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totLuCoopen}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totLuCoin}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totLuSign}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",background:"#d0d8ff"}}>{totLuTotal}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totDiCoopen}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totDiCoin}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totDiSign}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",background:"#d0d8ff"}}>{totDiTotal}</td>
              <td style={{border:"1px solid #ccc"}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Summary — desktop only */}
      <div className="mt-4 hidden md:flex justify-end">
        <div className="border rounded-xl overflow-hidden shadow-sm" style={{minWidth:520}}>
          <div style={{background:"#1a3a5a",color:"white",padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:"bold",fontSize:13}}>Billing Summary</span>
            <button onClick={()=>machineSaveMutation.mutate({bfMachine:parseInt(curMachineEdit.bf)||0,luMachine:parseInt(curMachineEdit.lu)||0,diMachine:parseInt(curMachineEdit.di)||0})}
              disabled={machineSaveMutation.isPending}
              style={{background:"#22c55e",color:"white",border:"none",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>
              {machineSaveMutation.isPending?"Saving...":"Save Machine Data"}
            </button>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#2a4a6a",color:"white"}}>
                <th style={{padding:"6px 10px",textAlign:"left"}}>Particulars</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Coopen</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Coin</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Total</th>
                <th style={{padding:"6px 8px",textAlign:"center",background:"#b45309"}}>Machine Data</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {([
                { label:"Breakfast", coopen:totBfCoopen, coin:totBfCoin, total:totBfTotal, mKey:"bf" as const },
                { label:"Lunch",     coopen:totLuCoopen, coin:totLuCoin, total:totLuTotal, mKey:"lu" as const },
                { label:"Dinner",    coopen:totDiCoopen, coin:totDiCoin, total:totDiTotal, mKey:"di" as const },
              ]).map((s,i)=>{
                const machineVal = parseInt(curMachineEdit[s.mKey])||0;
                const diff = s.coopen - machineVal;
                return (
                  <tr key={s.label} style={{background:i%2===0?"#fff":"#f9f9f9"}}>
                    <td style={{padding:"6px 10px",borderBottom:"1px solid #eee",fontWeight:"bold"}}>{s.label}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",borderBottom:"1px solid #eee"}}>{s.coopen||""}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",borderBottom:"1px solid #eee"}}>{s.coin||""}</td>
                    <td style={{padding:"6px 8px",textAlign:"center",fontWeight:"bold",borderBottom:"1px solid #eee"}}>{s.total||""}</td>
                    <td style={{padding:"3px 6px",textAlign:"center",borderBottom:"1px solid #eee",background:"#fff7ed",border:"1px solid #c97316"}}>
                      <input type="number" min={0} value={curMachineEdit[s.mKey]}
                        onChange={e=>setMachineEdit({...curMachineEdit,[s.mKey]:e.target.value})}
                        style={{width:60,textAlign:"center",border:"1px solid #c97316",borderRadius:3,padding:"2px 4px",fontSize:12,background:"transparent"}}/>
                    </td>
                    <td style={{padding:"6px 8px",textAlign:"center",fontWeight:"bold",color:diff!==0?"#c00":"#060",borderBottom:"1px solid #eee"}}>
                      {machineVal>0||s.coopen>0?diff:""}
                    </td>
                  </tr>
                );
              })}
              <tr style={{background:"#e8f0fe",fontWeight:"bold"}}>
                <td style={{padding:"5px 10px"}}>Total</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfCoopen+totLuCoopen+totDiCoopen}</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfCoin+totLuCoin+totDiCoin}</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfTotal+totLuTotal+totDiTotal}</td>
                <td style={{padding:"5px 8px",textAlign:"center",background:"#ffedd5"}}>{(parseInt(curMachineEdit.bf)||0)+(parseInt(curMachineEdit.lu)||0)+(parseInt(curMachineEdit.di)||0)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{display:"none"}}>{printTable}</div>
    </div>
  );
}

// ============================================================
// HUL Date Entry Tab — Hindustan Unilever Limited (KPF / TEC)
// ============================================================

type HulRow = {
  id?: number;
  location: string;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  breakfast: number;
  lunch: number;
  eveningSnacks: number;
  nightSnacks: number;
  guestBreakfast: number;
  guestLunch: number;
  guestEveningSnacks: number;
  guestNightSnacks: number;
  _dirty?: boolean;
};

function hulRowDefaults(dateStr: string, month: number, year: number, location: string): HulRow {
  return { location, entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr), breakfast:0, lunch:0, eveningSnacks:0, nightSnacks:0, guestBreakfast:0, guestLunch:0, guestEveningSnacks:0, guestNightSnacks:0, _dirty:true };
}

// ============================================================
// HUL KPF Executive/Manager Snacks Tab
// "Number of Snacks Per Day For Executives & Managers"
// ============================================================

type ExecSnackRow = {
  id?: number;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  snacks: number;
  biscuit: number;
  chips: number;
  coldDrinkWater: number;
  shiftOfficerBreakfast: number;
  _dirty?: boolean;
};

function execSnackRowDefaults(dateStr: string, month: number, year: number): ExecSnackRow {
  return { entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr), snacks: 0, biscuit: 0, chips: 0, coldDrinkWater: 0, shiftOfficerBreakfast: 0, _dirty: true };
}

const EXEC_SNACK_FIELDS: (keyof ExecSnackRow)[] = ['snacks', 'biscuit', 'chips', 'coldDrinkWater', 'shiftOfficerBreakfast'];
const EXEC_SNACK_LABELS = ['Snacks', 'Biscuit', 'Chips', 'Cold Drink & Water', 'Shift Officer Breakfast'];

function HulKpfExecSnacksTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const importRefExec = useRef<HTMLInputElement>(null);
  const [localRows, setLocalRows] = useState<ExecSnackRow[]>([]);
  useEffect(() => { setLocalRows([]); }, [month, year]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<ExecSnackRow[]>({
    queryKey: ['/api/hul-kpf-exec-snacks', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/hul-kpf-exec-snacks?month=${month}&year=${year}`, { credentials: 'include' });
      const data = await res.json();
      return data.map((r: ExecSnackRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed) }; });
    },
  });

  const generateRows = (freshRows?: ExecSnackRow[]) => {
    const source = freshRows ?? dbRows;
    const daysInMonth = getDaysInMonth(month, year);
    const scaffold: ExecSnackRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      scaffold.push(execSnackRowDefaults(ds, month, year));
    }
    const existing: Record<string, ExecSnackRow> = {};
    source.forEach(r => { existing[normDate(r.entryDate)] = r; });
    return scaffold.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g);
  };

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => { setLocalRows(generateRows((result.data || []) as ExecSnackRow[])); });
    }
  }, [loadKey]);

  const rows: ExecSnackRow[] = localRows.length > 0 ? localRows : dbRows.map(r => ({ ...r }));

  const createMutation = useMutation({
    mutationFn: async (data: ExecSnackRow) => {
      const res = await fetch('/api/hul-kpf-exec-snacks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks', month, year] }); qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks/yearly-summary'] }); },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/hul-kpf-exec-snacks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks', month, year] }); qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks/yearly-summary'] }); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/hul-kpf-exec-snacks/${id}`, { method: 'DELETE', credentials: 'include' }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks', month, year] }); qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks/yearly-summary'] }); },
  });

  const syncRows = () => { if (localRows.length === 0) setLocalRows(dbRows.map(r => ({ ...r }))); };

  const handleCellChange = (idx: number, field: keyof ExecSnackRow, value: string) => {
    syncRows();
    setLocalRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      (row as any)[field] = parseInt(value) || 0;
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tbody = (e.target as HTMLElement).closest('tbody');
      if (!tbody) return;
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const currentTr = (e.target as HTMLElement).closest('tr');
      const rowIdx = allRows.indexOf(currentTr as HTMLTableRowElement);
      const nextTr = allRows[rowIdx + 1];
      if (nextTr) {
        const inputs = Array.from(nextTr.querySelectorAll('input:not([readonly])')) as HTMLInputElement[];
        if (inputs[colIdx]) inputs[colIdx].focus();
        else if (inputs[0]) inputs[0].focus();
      }
    }
  };

  const saveRow = async (row: ExecSnackRow) => {
    const { _dirty, id, ...data } = row;
    if (id) await updateMutation.mutateAsync({ id, data });
    else await createMutation.mutateAsync(row);
  };

  const handleSaveRow = async (idx: number) => {
    try {
      await saveRow(rows[idx]);
      const result = await refetch();
      setLocalRows(generateRows((result.data || []) as ExecSnackRow[]));
      toast({ title: 'Row saved' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteRow = async (idx: number) => {
    const row = rows[idx];
    try {
      if (row.id) await deleteMutation.mutateAsync(row.id);
      const result = await refetch();
      setLocalRows(generateRows((result.data || []) as ExecSnackRow[]));
      toast({ title: 'Row cleared' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r._dirty && (r.snacks || r.biscuit || r.chips || r.coldDrinkWater || r.shiftOfficerBreakfast));
    if (!dirty.length) { toast({ title: 'Nothing to save' }); return; }
    try {
      for (const row of dirty) await saveRow(row);
      const result = await refetch();
      setLocalRows(generateRows((result.data || []) as ExecSnackRow[]));
      toast({ title: `Saved ${dirty.length} rows` });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleAutoFill = () => { setLocalRows(generateRows()); };

  const handleImportExcelExec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    const mStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const mEnd = `${year}-${String(month).padStart(2,'0')}-${String(getDaysInMonth(month, year)).padStart(2,'0')}`;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const FIELD_MAP: Record<string, keyof ExecSnackRow> = {
        'Date': 'entryDate', 'Days': 'weekDay',
        'Snacks': 'snacks', 'Biscuit': 'biscuit', 'Chips': 'chips',
        'Cold Drink & Water': 'coldDrinkWater', 'Cold Drink and Water': 'coldDrinkWater',
        'Shift Officer Breakfast': 'shiftOfficerBreakfast',
      };
      // Find header row (first row with "Date")
      let headerRowIdx = 1;
      ws.eachRow((row, ri) => { if (String(row.getCell(2).value || '').includes('-') && ri > 1) return; if (String(row.getCell(1).value || '').toLowerCase().includes('date') || String(row.getCell(2).value || '').toLowerCase().includes('date')) headerRowIdx = ri; });
      const headers: string[] = [];
      ws.getRow(headerRowIdx).eachCell(cell => headers.push(String(cell.value ?? '').trim()));
      const fieldMap: Record<number, keyof ExecSnackRow> = {};
      headers.forEach((h, i) => { if (FIELD_MAP[h]) fieldMap[i] = FIELD_MAP[h]; });
      const imported: ExecSnackRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri <= headerRowIdx) return;
        const r: any = { month, year, weekDay: '', _dirty: true };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci - 1]; if (!f) return;
          const v = cell.value;
          r[f] = (f === 'entryDate' || f === 'weekDay') ? String(v ?? '').trim() : (parseInt(String(v || 0)) || 0);
        });
        if (!r.entryDate || r.entryDate.toLowerCase().includes('total')) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as ExecSnackRow);
      });
      if (!imported.length) { toast({ title: 'No data found in file', variant: 'destructive' }); return; }
      const mismatch = imported.filter(r => r.entryDate < mStart || r.entryDate > mEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside ${MONTHS[month-1]} ${year}. Select the correct month and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title: `Imported ${imported.length} rows`, description: 'Review and click Save All to persist.' });
    } catch (err: any) { toast({ title: 'Import Failed', description: err.message, variant: 'destructive' }); }
  };

  const handleResetExec = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateRows([]));
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>HUL KPF Exec Snacks</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",Times,serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:6px;}
      th,td{border:1px solid #333;padding:3px 5px;text-align:center;font-size:10pt;}
      th{background:#ffffff!important;color:#000!important;font-weight:bold;}
      .sun-row{background:#ffb380!important;}
      .total-row{font-weight:bold;background:#f0f0f0!important;}
      @media print{@page{margin:8mm;size:A4 portrait;}body{margin:0;}}
    </style></head><body>${printContent}</body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('HUL KPF Exec Snacks');
    const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
    ws.mergeCells('A1:H1');
    const t1 = ws.getCell('A1'); t1.value = 'DJ Hospitality & Facility Management Pvt. Ltd.'; t1.font={bold:true,size:13}; t1.alignment={horizontal:'center'}; t1.border=thin;
    ws.mergeCells('A2:H2');
    const t2 = ws.getCell('A2'); t2.value = `Number of Snacks Per Day For Executives & Managers - ${MONTHS[month-1]} - ${year}`; t2.font={bold:true,size:11}; t2.alignment={horizontal:'center'}; t2.border=thin;
    const hdr = ws.addRow(['Sl.No.','Date','Days','Snacks','Biscuit','Chips','Cold Drink & Water','Shift Officer Breakfast']);
    hdr.eachCell(cell => { cell.font={bold:true}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    ws.columns = [7,14,8,10,10,10,16,20].map(w=>({width:w}));
    rows.forEach((r,i) => {
      const row = ws.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.snacks||'', r.biscuit||'', r.chips||'', r.coldDrinkWater||'', r.shiftOfficerBreakfast||'']);
      if (isSunday(r.entryDate)) row.eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFB380'}}; });
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:'center'}; });
    });
    const tot = ws.addRow(['','Total','', rows.reduce((s,r)=>s+(r.snacks||0),0), rows.reduce((s,r)=>s+(r.biscuit||0),0), rows.reduce((s,r)=>s+(r.chips||0),0), rows.reduce((s,r)=>s+(r.coldDrinkWater||0),0), rows.reduce((s,r)=>s+(r.shiftOfficerBreakfast||0),0)]);
    tot.eachCell(cell => { cell.font={bold:true}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F0F0'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`HUL_KPF_Exec_Snacks_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const printTable = (
    <div ref={printRef}>
      <h3>DJ Hospitality &amp; Facility Management Pvt. Ltd.</h3>
      <p style={{fontWeight:'bold',textAlign:'center',margin:'3px 0'}}>Number of Snacks Per Day For Executives &amp; Managers - {MONTHS[month-1]} - {year}</p>
      <table>
        <thead>
          <tr>
            <th>Sl.No.</th><th>Date</th><th>Days</th><th>Snacks</th><th>Biscuit</th><th>Chips</th><th>Cold Drink &amp; Water</th><th>Shift Officer Breakfast</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} className={isSunday(row.entryDate)?"sun-row":""}>
              <td>{i+1}</td><td>{safeFormat(row.entryDate)}</td><td>{row.weekDay}</td>
              <td>{row.snacks||""}</td><td>{row.biscuit||""}</td><td>{row.chips||""}</td><td>{row.coldDrinkWater||""}</td><td>{row.shiftOfficerBreakfast||""}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3}>Total</td>
            <td>{rows.reduce((s,r)=>s+(r.snacks||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.biscuit||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.chips||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.coldDrinkWater||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.shiftOfficerBreakfast||0),0)||""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>;

  return (
    <div>
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-gray-600 mr-1">HUL KPF — Exec &amp; Managers Snacks</span>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={handleAutoFill} className="h-9" data-testid="btn-exec-autofill">
            <Plus className="w-3.5 h-3.5 mr-1"/>Auto-Fill Month
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={createMutation.isPending||updateMutation.isPending} className="h-9 bg-green-600 hover:bg-green-700 text-white" data-testid="btn-exec-save-all">
            <Save className="w-3.5 h-3.5 mr-1"/>Save All
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-9" data-testid="btn-exec-print">
            <Printer className="w-3.5 h-3.5 mr-1"/>Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel} className="h-9 text-green-700 border-green-300 hover:bg-green-50" data-testid="btn-exec-export">
            <FileDown className="w-3.5 h-3.5 mr-1"/>Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => importRefExec.current?.click()} className="h-9 text-blue-700 border-blue-300 hover:bg-blue-50" data-testid="btn-exec-import">
            <FileUp className="w-3.5 h-3.5 mr-1"/>Import Excel
          </Button>
          <input ref={importRefExec} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcelExec}/>
          <Button size="sm" variant="outline" onClick={handleResetExec} className="h-9 text-red-600 border-red-300 hover:bg-red-50" data-testid="btn-exec-reset">
            <RefreshCw className="w-3.5 h-3.5 mr-1"/>Reset
          </Button>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-2">
        {rows.map((row, idx) => {
          const isSun = isSunday(row.entryDate);
          const cardBg = isSun ? "bg-orange-50 border-orange-300" : "bg-white border-gray-200";
          return (
            <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg} ${row._dirty ? "ring-2 ring-yellow-300" : ""}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-bold text-gray-400">#{idx+1}</span>
                <span className="flex-1 text-sm font-semibold">{safeFormat(row.entryDate)}</span>
                <span className="text-xs font-semibold bg-green-100 text-green-700 rounded px-2 py-1">{row.weekDay}</span>
                {row._dirty && <span className="text-orange-500 font-bold text-xs">●</span>}
              </div>
              <div className="grid grid-cols-2 gap-1 mb-3">
                {EXEC_SNACK_FIELDS.map((f, fi) => (
                  <div key={f as string} className="flex flex-col items-center bg-gray-50 rounded-lg p-1.5">
                    <span className="text-xs text-gray-400 mb-1">{EXEC_SNACK_LABELS[fi]}</span>
                    <input type="number" min={0} inputMode="numeric" value={(row as any)[f]||""}
                      onChange={e => handleCellChange(idx, f, e.target.value)}
                      className="w-full text-center border border-gray-200 rounded-lg text-sm font-medium dark:bg-gray-900" style={{minHeight:38, padding:"4px 2px"}}/>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleSaveRow(idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                  <Save className="w-4 h-4"/>Save
                </button>
                <button onClick={() => handleDeleteRow(idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-800 text-white px-3 py-2 text-sm font-bold">Totals — KPF Exec Snacks</div>
            <div className="grid grid-cols-2 divide-x divide-y">
              {EXEC_SNACK_FIELDS.map((f, fi) => (
                <div key={f as string} className="flex justify-between items-center px-3 py-2 text-sm">
                  <span className="text-gray-600">{EXEC_SNACK_LABELS[fi]}</span>
                  <span className="font-semibold">{rows.reduce((s,r)=>s+((r as any)[f]||0),0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:'collapse', minWidth:620, fontFamily:'Arial,sans-serif', fontSize:12}}>
          <thead>
            <tr>
              <th colSpan={8} style={{padding:'8px', border:'1px solid #ccc', textAlign:'center', fontSize:13, fontWeight:'bold', background:'#fff'}}>
                DJ Hospitality &amp; Facility Management Pvt. Ltd.
              </th>
            </tr>
            <tr>
              <th colSpan={8} style={{padding:'5px', border:'1px solid #ccc', textAlign:'center', fontSize:11, background:'#fff'}}>
                Number of Snacks Per Day For Executives &amp; Managers - {MONTHS[month-1]} - {year}
              </th>
            </tr>
            <tr style={{background:'#f5f5f5'}}>
              <th style={{padding:'5px', border:'1px solid #ccc', width:36}}>Sl.</th>
              <th style={{padding:'5px', border:'1px solid #ccc', minWidth:100}}>Date</th>
              <th style={{padding:'5px', border:'1px solid #ccc', width:48}}>Days</th>
              <th style={{padding:'5px', border:'1px solid #ccc', minWidth:72}}>Snacks</th>
              <th style={{padding:'5px', border:'1px solid #ccc', minWidth:72}}>Biscuit</th>
              <th style={{padding:'5px', border:'1px solid #ccc', minWidth:72}}>Chips</th>
              <th style={{padding:'5px', border:'1px solid #ccc', minWidth:110}}>Cold Drink &amp; Water</th>
              <th style={{padding:'5px', border:'1px solid #ccc', minWidth:140, background:'#fffbeb'}}>Shift Officer Breakfast<br/><span style={{fontSize:10,fontWeight:'normal',color:'#92400e'}}>@₹40/head</span></th>
              <th style={{padding:'5px', border:'1px solid #ccc', width:50}}>Act</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSun = isSunday(row.entryDate);
              const bg = isSun ? '#ffb380' : idx%2===0 ? '#fff' : '#f9f9f9';
              const numFld = (f: keyof ExecSnackRow, colIdx: number) => (
                <input type="number" min={0} value={(row as any)[f]||''} onChange={e=>handleCellChange(idx,f,e.target.value)}
                  onKeyDown={e=>handleEnterKey(e,colIdx)}
                  style={{width:64, border:'none', background:'transparent', textAlign:'center', fontSize:12, padding:0, outline:'none'}}/>
              );
              return (
                <tr key={idx} style={{background: bg}}>
                  <td style={{textAlign:'center', border:'1px solid #ccc', padding:'2px'}}>{idx+1}</td>
                  <td style={{textAlign:'center', border:'1px solid #ccc', padding:'3px 4px', fontSize:11, fontWeight:500}}>{safeFormat(row.entryDate)}</td>
                  <td style={{textAlign:'center', border:'1px solid #ccc', fontSize:11}}>{row.weekDay}</td>
                  <td style={{border:'1px solid #ccc', padding:0, textAlign:'center'}}>{numFld('snacks',0)}</td>
                  <td style={{border:'1px solid #ccc', padding:0, textAlign:'center'}}>{numFld('biscuit',1)}</td>
                  <td style={{border:'1px solid #ccc', padding:0, textAlign:'center'}}>{numFld('chips',2)}</td>
                  <td style={{border:'1px solid #ccc', padding:0, textAlign:'center'}}>{numFld('coldDrinkWater',3)}</td>
                  <td style={{border:'1px solid #ccc', padding:0, textAlign:'center', background:'#fffbeb'}}>{numFld('shiftOfficerBreakfast',4)}</td>
                  <td style={{border:'1px solid #ccc', padding:'2px', textAlign:'center'}}>
                    <button onClick={()=>handleSaveRow(idx)} title="Save" style={{color:'#22c55e', marginRight:4, background:'none', border:'none', cursor:'pointer'}}><Save style={{width:13,height:13}}/></button>
                    <button onClick={()=>handleDeleteRow(idx)} title="Clear" style={{color:'#e53e3e', background:'none', border:'none', cursor:'pointer'}}><Trash2 style={{width:13,height:13}}/></button>
                  </td>
                </tr>
              );
            })}
            <tr style={{background:'#f0f0f0', fontWeight:'bold'}}>
              <td colSpan={3} style={{textAlign:'center', border:'1px solid #ccc', padding:'4px'}}>Total</td>
              {EXEC_SNACK_FIELDS.map(f=>(
                <td key={f as string} style={{border:'1px solid #ccc', textAlign:'center', padding:'4px'}}>
                  {rows.reduce((s,r)=>s+((r as any)[f]||0),0)||''}
                </td>
              ))}
              <td style={{border:'1px solid #ccc'}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{display:'none'}}>{printTable}</div>
    </div>
  );
}

// ─── HUL Special Order Tab ───────────────────────────────────────────────────
type SpecialOrderRow = {
  id?: number;
  month: number;
  year: number;
  slNo: number;
  dateOfSupply: string;
  particulars: string;
  qty: number;
  ratePerPlate: number;
  total: number;
  _dirty?: boolean;
};

function emptySpecialRow(slNo: number, month: number, year: number): SpecialOrderRow {
  return { month, year, slNo, dateOfSupply: '', particulars: '', qty: 0, ratePerPlate: 0, total: 0, _dirty: false };
}

function HulSpecialOrderTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState<SpecialOrderRow[]>([emptySpecialRow(1, month, year)]);
  const [saving, setSaving] = useState(false);

  const { data: dbRows = [], isLoading } = useQuery<SpecialOrderRow[]>({
    queryKey: ['/api/hul-special-orders', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/hul-special-orders?month=${month}&year=${year}`, { credentials: 'include' });
      return res.json();
    },
  });

  useEffect(() => {
    if (dbRows.length > 0) {
      setRows(dbRows.map(r => ({ ...r, dateOfSupply: r.dateOfSupply || '', qty: Number(r.qty), ratePerPlate: Number(r.ratePerPlate), total: Number(r.total), _dirty: false })));
    } else {
      setRows([emptySpecialRow(1, month, year)]);
    }
  }, [dbRows, month, year]);

  const updateRow = (idx: number, field: keyof SpecialOrderRow, value: string | number) => {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value, _dirty: true };
      if (field === 'qty' || field === 'ratePerPlate') {
        const q = field === 'qty' ? Number(value) : Number(next[idx].qty);
        const r = field === 'ratePerPlate' ? Number(value) : Number(next[idx].ratePerPlate);
        row.total = parseFloat((q * r).toFixed(2));
      }
      next[idx] = row;
      return next;
    });
  };

  const addRow = () => {
    setRows(prev => [...prev, emptySpecialRow(prev.length + 1, month, year)]);
  };

  const deleteRow = async (idx: number) => {
    const row = rows[idx];
    if (row.id) {
      await fetch(`/api/hul-special-orders/${row.id}`, { method: 'DELETE', credentials: 'include' });
      qc.invalidateQueries({ queryKey: ['/api/hul-special-orders', month, year] });
    }
    setRows(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, slNo: i + 1 })));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        if (!row._dirty) continue;
        const payload = { month, year, slNo: row.slNo, dateOfSupply: row.dateOfSupply || '', particulars: row.particulars, qty: row.qty, ratePerPlate: row.ratePerPlate, total: row.total };
        if (row.id) {
          await fetch(`/api/hul-special-orders/${row.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
        } else {
          await fetch('/api/hul-special-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
        }
      }
      await qc.invalidateQueries({ queryKey: ['/api/hul-special-orders', month, year] });
      toast({ title: 'Saved', description: 'Special orders saved successfully.' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('HUL Special Orders');
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });
      const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

      ws.mergeCells('A1:F1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `HUL Special Order — ${MONTHS[month-1]} ${year}`;
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = mkFill('FF1e3a5f');
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 24;

      const hdr = ws.addRow(['Sl. No.', 'Date of Supply', 'Particulars', 'Qty', 'Rate Per Plate', 'Total']);
      hdr.eachCell((c: any) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        c.fill = mkFill('FF3b82f6'); c.border = thin;
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      ws.getRow(2).height = 22;
      ws.columns = [{ width: 8 }, { width: 16 }, { width: 40 }, { width: 10 }, { width: 16 }, { width: 14 }];

      rows.forEach((row, idx) => {
        const dr = ws.addRow([row.slNo, safeFormat(row.dateOfSupply), row.particulars, row.qty || '', row.ratePerPlate || '', row.total || '']);
        dr.eachCell((c: any, ci: number) => {
          c.border = thin; c.alignment = { horizontal: ci === 3 ? 'left' : 'center', vertical: 'middle' };
          c.fill = mkFill(idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
          c.font = { size: 10 };
        });
      });

      // Grand Total row
      const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
      const totRow = ws.addRow(['', '', 'Grand Total', '', '', grandTotal]);
      totRow.eachCell((c: any, ci: number) => {
        c.border = thin; c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        c.fill = mkFill('FF1e3a5f'); c.alignment = { horizontal: ci === 3 ? 'left' : 'center', vertical: 'middle' };
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `HUL_SpecialOrder_${MONTHS[month-1]}_${year}.xlsx`; a.click();
    } catch (err: any) { toast({ title: 'Export failed', description: err.message, variant: 'destructive' }); }
  };

  const handlePrint = () => {
    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    const th = 'border:1px solid #94a3b8;padding:6px 10px;font-size:10px;text-align:center;background:#3b82f6;color:#fff;font-weight:bold;';
    const td = (i: number) => `border:1px solid #e2e8f0;padding:5px 8px;font-size:10px;background:${i%2===0?'#f8fafc':'#fff'};`;
    const bodyRows = rows.map((row, idx) => `
      <tr>
        <td style="${td(idx)}text-align:center;">${row.slNo}</td>
        <td style="${td(idx)}text-align:center;">${safeFormat(row.dateOfSupply)}</td>
        <td style="${td(idx)}text-align:left;">${row.particulars || ''}</td>
        <td style="${td(idx)}text-align:center;">${row.qty || ''}</td>
        <td style="${td(idx)}text-align:center;">${row.ratePerPlate || ''}</td>
        <td style="${td(idx)}text-align:center;font-weight:600;">${row.total || ''}</td>
      </tr>`).join('');
    const win = window.open('', '_blank');
    win?.document.write(`<html><head><title>HUL Special Order</title><style>body{font-family:Arial,sans-serif;margin:16px;}table{border-collapse:collapse;width:100%;}</style></head>
    <body>
      <h3 style="text-align:center;color:#1e3a5f;margin-bottom:4px;">Hindustan Unilever Limited</h3>
      <h4 style="text-align:center;color:#374151;margin-bottom:12px;">Special Order — ${MONTHS[month-1]} ${year}</h4>
      <table>
        <thead><tr>
          <th style="${th}width:60px;">Sl. No.</th>
          <th style="${th}width:100px;">Date of Supply</th>
          <th style="${th}text-align:left;">Particulars</th>
          <th style="${th}width:70px;">Qty</th>
          <th style="${th}width:120px;">Rate Per Plate</th>
          <th style="${th}width:100px;">Total</th>
        </tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot><tr>
          <td colspan="5" style="border:1px solid #94a3b8;padding:6px 10px;font-size:10px;font-weight:bold;text-align:right;background:#1e3a5f;color:#fff;">Grand Total</td>
          <td style="border:1px solid #94a3b8;padding:6px 10px;font-size:10px;font-weight:bold;text-align:center;background:#1e3a5f;color:#fff;">${grandTotal.toFixed(2)}</td>
        </tr></tfoot>
      </table>
    </body></html>`);
    win?.document.close(); win?.print();
  };

  const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h3 className="font-semibold text-base text-blue-900">HUL — Special Order</h3>
          <p className="text-xs text-muted-foreground">{MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs gap-1">
            🖨️ Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel} className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50">
            📊 Excel
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving} className="h-8 text-xs gap-1 bg-blue-700 hover:bg-blue-800">
            {saving ? '⏳ Saving…' : '💾 Save All'}
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr style={{ background: '#3b82f6' }}>
                <th className="border border-blue-400 px-3 py-2.5 text-white font-bold text-center w-14">Sl. No.</th>
                <th className="border border-blue-400 px-3 py-2.5 text-white font-bold text-center w-32">Date of Supply</th>
                <th className="border border-blue-400 px-4 py-2.5 text-white font-bold text-left">Particulars</th>
                <th className="border border-blue-400 px-3 py-2.5 text-white font-bold text-center w-20">Qty</th>
                <th className="border border-blue-400 px-3 py-2.5 text-white font-bold text-center w-28">Rate Per Plate</th>
                <th className="border border-blue-400 px-3 py-2.5 text-white font-bold text-center w-24">Total</th>
                <th className="border border-blue-400 px-2 py-2.5 text-white font-bold text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={row._dirty ? 'ring-1 ring-inset ring-yellow-400' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-500 font-mono text-xs">{row.slNo}</td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      type="date"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-sm text-center"
                      value={row.dateOfSupply || ''}
                      onChange={e => updateRow(idx, 'dateOfSupply', e.target.value)}
                      data-testid={`input-date-supply-${idx}`}
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      type="text"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-sm"
                      value={row.particulars}
                      placeholder="Enter item description…"
                      onChange={e => updateRow(idx, 'particulars', e.target.value)}
                      data-testid={`input-particulars-${idx}`}
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center text-sm"
                      value={row.qty || ''}
                      min={0}
                      onChange={e => updateRow(idx, 'qty', parseFloat(e.target.value) || 0)}
                      data-testid={`input-qty-${idx}`}
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center text-sm"
                      value={row.ratePerPlate || ''}
                      min={0}
                      step={0.01}
                      onChange={e => updateRow(idx, 'ratePerPlate', parseFloat(e.target.value) || 0)}
                      data-testid={`input-rate-${idx}`}
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-blue-900 bg-blue-50">
                    {row.total > 0 ? row.total.toFixed(2) : ''}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    <button
                      onClick={() => deleteRow(idx)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-0.5 transition-colors"
                      title="Delete row"
                      data-testid={`btn-delete-row-${idx}`}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e3a5f' }}>
                <td colSpan={5} className="border border-slate-600 px-4 py-2 text-right font-bold text-white text-sm">Grand Total</td>
                <td className="border border-slate-600 px-2 py-2 text-center font-bold text-white text-sm">
                  {grandTotal > 0 ? grandTotal.toFixed(2) : ''}
                </td>
                <td className="border border-slate-600" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Row button */}
      <Button size="sm" variant="outline" onClick={addRow} className="h-8 text-xs gap-1 border-dashed border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="btn-add-special-row">
        + Add Row
      </Button>
    </div>
  );
}

function HulLocationTab({ month, year, location, loadKey = 0 }: { month: number; year: number; location: string; loadKey?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const importRefHul = useRef<HTMLInputElement>(null);
  const [localRows, setLocalRows] = useState<HulRow[]>([]);
  useEffect(() => { setLocalRows([]); }, [month, year, location]);

  const { data: dbRows = [], isLoading, refetch } = useQuery<HulRow[]>({
    queryKey: ['/api/hul-date-entries', month, year, location],
    queryFn: async () => {
      const res = await fetch(`/api/hul-date-entries?month=${month}&year=${year}&location=${encodeURIComponent(location)}`, { credentials: 'include' });
      const data = await res.json();
      return data.map((r: HulRow) => { const ed=normDate(r.entryDate); return { ...r, entryDate: ed, weekDay: getWeekDay(ed) }; });
    },
  });

  const generateRows = (freshRows?: HulRow[]) => {
    const source = freshRows ?? dbRows;
    const daysInMonth = getDaysInMonth(month, year);
    const scaffold: HulRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      scaffold.push(hulRowDefaults(ds, month, year, location));
    }
    const existing: Record<string, HulRow> = {};
    source.forEach(r => { existing[normDate(r.entryDate)] = r; });
    return scaffold.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], weekDay: getWeekDay(g.entryDate), _dirty: false } : g);
  };

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => { setLocalRows(generateRows((result.data || []) as HulRow[])); });
    }
  }, [loadKey]);

  const rows: HulRow[] = localRows.length > 0 ? localRows : dbRows.map(r => ({ ...r }));

  const createMutation = useMutation({
    mutationFn: async (data: HulRow) => {
      const res = await fetch('/api/hul-date-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/hul-date-entries', month, year, location] }); qc.invalidateQueries({ queryKey: ['/api/hul-date-entries/yearly-summary'] }); },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/hul-date-entries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/hul-date-entries', month, year, location] }); qc.invalidateQueries({ queryKey: ['/api/hul-date-entries/yearly-summary'] }); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/hul-date-entries/${id}`, { method: 'DELETE', credentials: 'include' }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/hul-date-entries', month, year, location] }); qc.invalidateQueries({ queryKey: ['/api/hul-date-entries/yearly-summary'] }); },
  });

  const syncRows = () => { if (localRows.length === 0) setLocalRows(dbRows.map(r => ({ ...r }))); };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tbody = (e.target as HTMLElement).closest('tbody');
      if (!tbody) return;
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const currentTr = (e.target as HTMLElement).closest('tr');
      const rowIdx = allRows.indexOf(currentTr as HTMLTableRowElement);
      const nextTr = allRows[rowIdx + 1];
      if (nextTr) {
        const inputs = Array.from(nextTr.querySelectorAll('input:not([readonly])')) as HTMLInputElement[];
        if (inputs[colIdx]) inputs[colIdx].focus();
        else if (inputs[0]) inputs[0].focus();
      }
    }
  };

  const handleCellChange = (idx: number, field: keyof HulRow, value: string) => {
    syncRows();
    setLocalRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      (row as any)[field] = parseInt(value) || 0;
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  const saveRow = async (row: HulRow) => {
    const { _dirty, id, ...data } = row;
    if (id) await updateMutation.mutateAsync({ id, data });
    else await createMutation.mutateAsync(row);
  };

  const handleSaveRow = async (idx: number) => {
    try {
      await saveRow(rows[idx]);
      const result = await refetch();
      setLocalRows(generateRows((result.data || []) as HulRow[]));
      toast({ title: 'Row saved' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDeleteRow = async (idx: number) => {
    const row = rows[idx];
    try {
      if (row.id) await deleteMutation.mutateAsync(row.id);
      const result = await refetch();
      setLocalRows(generateRows((result.data || []) as HulRow[]));
      toast({ title: 'Row cleared' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleSaveAll = async () => {
    const dirty = rows.filter(r => r._dirty && (r.breakfast||r.lunch||r.eveningSnacks||r.nightSnacks||r.guestBreakfast||r.guestLunch||r.guestEveningSnacks||r.guestNightSnacks));
    if (!dirty.length) { toast({ title: 'Nothing to save' }); return; }
    try {
      for (const row of dirty) await saveRow(row);
      const result = await refetch();
      setLocalRows(generateRows((result.data || []) as HulRow[]));
      toast({ title: `Saved ${dirty.length} rows` });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleAutoFill = () => { setLocalRows(generateRows()); };

  const handleDownloadHulTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`HUL ${location} Template`);
    const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
    // Row 1: Title
    ws.mergeCells('A1:K1');
    const t = ws.getCell('A1');
    t.value = `HINDUSTAN UNILEVER LIMITED - ${location} — Import Template (${MONTHS[month-1]} ${year})`;
    t.font={bold:true,color:{argb:'FFFFFFFF'}}; t.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A6B2E'}}; t.alignment={horizontal:'center'}; t.border=thin;
    // Row 2: group labels
    ws.mergeCells('A2:C2'); const g0=ws.getCell('A2'); g0.value=''; g0.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A6B2E'}}; g0.border=thin;
    ws.mergeCells('D2:G2'); const g1=ws.getCell('D2'); g1.value=`Meal Charges - ${MONTHS[month-1]} - ${year}`; g1.font={bold:true,color:{argb:'FFFFFFFF'}}; g1.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A6B2E'}}; g1.alignment={horizontal:'center'}; g1.border=thin;
    ws.mergeCells('H2:K2'); const g2=ws.getCell('H2'); g2.value=`Guest Meal Charges - ${MONTHS[month-1]} - ${year}`; g2.font={bold:true,color:{argb:'FFFFFFFF'}}; g2.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A3A8A'}}; g2.alignment={horizontal:'center'}; g2.border=thin;
    // Row 3: Column headers
    const hdr = ws.addRow(['Sl.No.','Date','Days','Brakfast','Lunch','Evning Sancks','Night Snacks','Guest Brakfast','Guest Lunch','Guest Evning Sancks','Guest Night Snacks']);
    hdr.eachCell((cell,ci) => { cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ci<=3?'FF1A6B2E':ci<=7?'FF1A6B2E':'FF1A3A8A'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    ws.columns = [5,14,8,10,10,14,14,14,12,16,16].map(w=>({width:w}));
    // Add empty rows for each day of the month
    const days = getDaysInMonth(month, year);
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const row = ws.addRow([d, safeFormat(dateStr), getWeekDay(dateStr), '', '', '', '', '', '', '', '']);
      if (isSunday(dateStr)) row.eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFA500'}}; });
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:'center'}; });
    }
    // Total row
    const totRow = ws.addRow(['','Total','','','','','','','','','']);
    totRow.eachCell(cell => { cell.font={bold:true}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8F0FE'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`HUL_${location}_${MONTHS[month-1]}_${year}_Template.xlsx`; a.click();
  };

  const parseHulDate = (v: any): string => {
    if (!v) return "";
    // ExcelJS returns JS Date objects for date-formatted cells
    if (v instanceof Date) return localDateStr(v);
    const s = String(v).trim();
    // dd-MM-yyyy or dd/MM/yyyy (exported format)
    const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    // yyyy-MM-dd ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    // Try generic Date parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) return localDateStr(d);
    return s;
  };

  const handleImportExcelHul = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const FIELD_MAP: Record<string, keyof HulRow> = {
        'Date': 'entryDate', 'Days': 'weekDay',
        'Brakfast': 'breakfast', 'Breakfast': 'breakfast',
        'Lunch': 'lunch',
        'Evning Sancks': 'eveningSnacks', 'Evening Snacks': 'eveningSnacks',
        'Night Snacks': 'nightSnacks',
        'Guest Brakfast': 'guestBreakfast', 'Guest Breakfast': 'guestBreakfast',
        'Guest Lunch': 'guestLunch',
        'Guest Evning Sancks': 'guestEveningSnacks', 'Guest Evening Snacks': 'guestEveningSnacks',
        'Guest Night Snacks': 'guestNightSnacks',
      };
      // Find header row — scan until we find a row containing "Date" or "Breakfast"
      let headerRowIdx = 1;
      ws.eachRow((row, ri) => {
        let found = false;
        row.eachCell(cell => { const v = String(cell.value ?? '').trim(); if (v === 'Date' || v === 'Brakfast' || v === 'Breakfast') found = true; });
        if (found) headerRowIdx = ri;
      });
      const headers: string[] = [];
      ws.getRow(headerRowIdx).eachCell(cell => headers.push(String(cell.value ?? '').trim()));
      const fieldMap: Record<number, keyof HulRow> = {};
      headers.forEach((h, i) => { if (FIELD_MAP[h]) fieldMap[i] = FIELD_MAP[h]; });
      const imported: HulRow[] = [];
      ws.eachRow((row, ri) => {
        if (ri <= headerRowIdx) return;
        const r: any = { month, year, location, weekDay: '', _dirty: true, breakfast:0, lunch:0, eveningSnacks:0, nightSnacks:0, guestBreakfast:0, guestLunch:0, guestEveningSnacks:0, guestNightSnacks:0 };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci - 1]; if (!f) return;
          const v = cell.value;
          if (f === 'entryDate') r[f] = parseHulDate(v);
          else if (f === 'weekDay') r[f] = String(v ?? '').trim();
          else r[f] = parseInt(String(v || 0)) || 0;
        });
        if (!r.entryDate || String(r.entryDate).toLowerCase().includes('total')) return;
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as HulRow);
      });
      if (!imported.length) { toast({ title: 'No data found in file', variant: 'destructive' }); return; }
      const mStart = `${year}-${String(month).padStart(2,'0')}-01`;
      const mEnd = `${year}-${String(month).padStart(2,'0')}-${String(getDaysInMonth(month, year)).padStart(2,'0')}`;
      const mismatch = imported.filter(r => r.entryDate < mStart || r.entryDate > mEnd);
      if (mismatch.length > 0) {
        toast({ title:"Date Mismatch — Import Cancelled", description:`File has dates outside ${MONTHS[month-1]} ${year}. Please select the correct month and retry.`, variant:"destructive" });
        return;
      }
      setLocalRows(imported);
      toast({ title: `Imported ${imported.length} rows`, description: 'Review and click Save All to persist.' });
    } catch (err: any) { toast({ title: 'Import Failed', description: err.message, variant: 'destructive' }); }
  };

  const handleResetHul = () => {
    if (!window.confirm("Reset all entries to blank? Unsaved changes will be lost.")) return;
    setLocalRows(generateRows([]));
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>HUL ${location} Data Sheet</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",Times,serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:6px;}
      th,td{border:1px solid #333;padding:1px 3px;text-align:center;font-size:10pt;}
      th{background:#1a6b2e!important;color:white!important;font-weight:bold;}
      .blue-hd{background:#1a3a8a!important;color:white!important;}
      .sun-row{background:#ffa500!important;}
      .total-row{font-weight:bold;background:#e8f0fe!important;}
      @media print{@page{margin:5mm;size:A4 landscape;}body{margin:0;}}
    </style></head><body>${printContent}</body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`HUL ${location}`);
    const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
    // Row 1: Title
    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `HINDUSTAN UNILEVER LIMITED - ${location}`;
    titleCell.font = { bold:true, color:{argb:'FFFFFFFF'} }; titleCell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF1A6B2E'}}; titleCell.alignment={horizontal:'center'}; titleCell.border=thin;
    // Row 2: Sub-headers group labels
    ws.mergeCells('A2:C2'); const slDateDay = ws.getCell('A2'); slDateDay.value = ''; slDateDay.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A6B2E'}}; slDateDay.border=thin;
    ws.mergeCells('D2:G2'); const mealHd = ws.getCell('D2'); mealHd.value = `Meal Charges - ${MONTHS[month-1]} - ${year}`; mealHd.font={bold:true,color:{argb:'FFFFFFFF'}}; mealHd.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A6B2E'}}; mealHd.alignment={horizontal:'center'}; mealHd.border=thin;
    ws.mergeCells('H2:K2'); const guestHd = ws.getCell('H2'); guestHd.value = `Guest Meal Charges - ${MONTHS[month-1]} - ${year}`; guestHd.font={bold:true,color:{argb:'FFFFFFFF'}}; guestHd.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A3A8A'}}; guestHd.alignment={horizontal:'center'}; guestHd.border=thin;
    // Row 3: Column headers
    const hdr = ws.addRow(['Sl.No.','Date','Days','Brakfast','Lunch','Evning Sancks','Night Snacks','Guest Brakfast','Guest Lunch','Guest Evning Sancks','Guest Night Snacks']);
    hdr.eachCell((cell,ci) => { cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ci<=3?'FF1A6B2E':ci<=7?'FF1A6B2E':'FF1A3A8A'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    ws.columns = [5,14,8,10,10,14,14,14,12,16,16].map(w=>({width:w}));
    rows.forEach((r, i) => {
      const row = ws.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.breakfast||'', r.lunch||'', r.eveningSnacks||'', r.nightSnacks||'', r.guestBreakfast||'', r.guestLunch||'', r.guestEveningSnacks||'', r.guestNightSnacks||'']);
      if (isSunday(r.entryDate)) row.eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFA500'}}; });
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:'center'}; });
    });
    const totRow = ws.addRow(['','Total','', rows.reduce((s,r)=>s+(r.breakfast||0),0), rows.reduce((s,r)=>s+(r.lunch||0),0), rows.reduce((s,r)=>s+(r.eveningSnacks||0),0), rows.reduce((s,r)=>s+(r.nightSnacks||0),0), rows.reduce((s,r)=>s+(r.guestBreakfast||0),0), rows.reduce((s,r)=>s+(r.guestLunch||0),0), rows.reduce((s,r)=>s+(r.guestEveningSnacks||0),0), rows.reduce((s,r)=>s+(r.guestNightSnacks||0),0)]);
    totRow.eachCell(cell => { cell.font={bold:true}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8F0FE'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`HUL_${location}_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const HUL_FIELDS: (keyof HulRow)[] = ['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'];
  const mealFields: (keyof HulRow)[] = ['breakfast','lunch','eveningSnacks','nightSnacks'];
  const guestFields: (keyof HulRow)[] = ['guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'];

  const printTable = (
    <div ref={printRef}>
      <h3>DJ Hospitality &amp; Facility Management Pvt Ltd</h3>
      <h4>HINDUSTAN UNILEVER LIMITED — {location}</h4>
      <p>Meal Data Sheet — {MONTHS[month-1]} {year}</p>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>Sl.</th><th rowSpan={2}>Date</th><th rowSpan={2}>Days</th>
            <th colSpan={4} className="blue-hd">Meal Charges — {MONTHS[month-1]} {year}</th>
            <th colSpan={4} style={{background:"#1a3a8a",color:"white"}}>Guest Meal Charges — {MONTHS[month-1]} {year}</th>
          </tr>
          <tr>
            <th>Brakfast</th><th>Lunch</th><th>Evning Sancks</th><th>Night Snacks</th>
            <th style={{background:"#1a3a8a",color:"white"}}>Guest Brakfast</th><th style={{background:"#1a3a8a",color:"white"}}>Guest Lunch</th>
            <th style={{background:"#1a3a8a",color:"white"}}>Guest Evning Sancks</th><th style={{background:"#1a3a8a",color:"white"}}>Guest Night Snacks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} className={isSunday(row.entryDate)?"sun-row":""}>
              <td>{i+1}</td><td>{safeFormat(row.entryDate)}</td><td>{row.weekDay}</td>
              <td>{row.breakfast||""}</td><td>{row.lunch||""}</td><td>{row.eveningSnacks||""}</td><td>{row.nightSnacks||""}</td>
              <td>{row.guestBreakfast||""}</td><td>{row.guestLunch||""}</td><td>{row.guestEveningSnacks||""}</td><td>{row.guestNightSnacks||""}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3}>Total</td>
            {HUL_FIELDS.map(f=><td key={f as string}>{rows.reduce((s,r)=>s+((r as any)[f]||0),0)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>;

  return (
    <div>
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={handleAutoFill} className="h-9" data-testid="btn-hul-autofill">
            <Plus className="w-3.5 h-3.5 mr-1"/>Auto-Fill Month
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={createMutation.isPending || updateMutation.isPending} className="h-9 bg-green-600 hover:bg-green-700 text-white" data-testid="btn-hul-save-all">
            <Save className="w-3.5 h-3.5 mr-1"/>Save All
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-9" data-testid="btn-hul-print">
            <Printer className="w-3.5 h-3.5 mr-1"/>Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel} className="h-9 text-green-700 border-green-300 hover:bg-green-50" disabled={rows.length===0} data-testid="btn-hul-export">
            <FileDown className="w-3.5 h-3.5 mr-1"/>Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadHulTemplate} className="h-9 text-purple-700 border-purple-300 hover:bg-purple-50" data-testid="btn-hul-template">
            <FileDown className="w-3.5 h-3.5 mr-1"/>Template
          </Button>
          <Button size="sm" variant="outline" onClick={() => importRefHul.current?.click()} className="h-9 text-blue-700 border-blue-300 hover:bg-blue-50" data-testid="btn-hul-import">
            <FileUp className="w-3.5 h-3.5 mr-1"/>Import Excel
          </Button>
          <input ref={importRefHul} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcelHul}/>
          <Button size="sm" variant="outline" onClick={handleResetHul} className="h-9 text-red-600 border-red-300 hover:bg-red-50" data-testid="btn-hul-reset">
            <RefreshCw className="w-3.5 h-3.5 mr-1"/>Reset
          </Button>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-2">
        {rows.map((row, idx) => {
          const isSun = isSunday(row.entryDate);
          const cardBg = isSun ? "bg-amber-50 border-amber-300 dark:bg-amber-900/20" : "bg-white dark:bg-gray-900 border-gray-200";
          const mblFld = (f: keyof HulRow, label: string) => (
            <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5">
              <span className="text-xs text-gray-400 mb-1 text-center leading-tight">{label}</span>
              <input type="number" min={0} inputMode="numeric" value={(row as any)[f]||""}
                onChange={e => handleCellChange(idx, f, e.target.value)}
                className="w-full text-center border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-900 dark:text-white" style={{minHeight:38, padding:"4px 2px"}}/>
            </div>
          );
          return (
            <div key={idx} className={`border rounded-xl p-3 shadow-sm ${cardBg} ${row._dirty ? "ring-2 ring-yellow-300" : ""}`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-bold text-gray-400 shrink-0">#{idx+1}</span>
                <span className="flex-1 text-sm font-semibold">{safeFormat(row.entryDate)}</span>
                <span className="text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded px-2 py-1 shrink-0">{row.weekDay}</span>
                {row._dirty && <span className="text-orange-500 font-bold text-xs shrink-0">●</span>}
              </div>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-500 mb-1 bg-green-50 dark:bg-green-900/20 rounded px-2 py-0.5">🍽 Meal Charges</div>
                <div className="grid grid-cols-2 gap-1">
                  {mblFld('breakfast', 'Breakfast')}
                  {mblFld('lunch', 'Lunch')}
                  {mblFld('eveningSnacks', 'Evening Snacks')}
                  {mblFld('nightSnacks', 'Night Snacks')}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-500 mb-1 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-0.5">👥 Guest Meal Charges</div>
                <div className="grid grid-cols-2 gap-1">
                  {mblFld('guestBreakfast', 'Guest Breakfast')}
                  {mblFld('guestLunch', 'Guest Lunch')}
                  {mblFld('guestEveningSnacks', 'Guest Evening')}
                  {mblFld('guestNightSnacks', 'Guest Night')}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleSaveRow(idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5">
                  <Save className="w-4 h-4"/>Save
                </button>
                <button onClick={() => handleDeleteRow(idx)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-green-800 text-white px-3 py-2 text-sm font-bold">Totals — {location}</div>
            <div className="grid grid-cols-2 divide-x divide-y">
              {[['Breakfast', rows.reduce((s,r)=>s+(r.breakfast||0),0)], ['Lunch', rows.reduce((s,r)=>s+(r.lunch||0),0)],
                ['Evening Snacks', rows.reduce((s,r)=>s+(r.eveningSnacks||0),0)], ['Night Snacks', rows.reduce((s,r)=>s+(r.nightSnacks||0),0)],
                ['Guest Breakfast', rows.reduce((s,r)=>s+(r.guestBreakfast||0),0)], ['Guest Lunch', rows.reduce((s,r)=>s+(r.guestLunch||0),0)],
                ['Guest Evening', rows.reduce((s,r)=>s+(r.guestEveningSnacks||0),0)], ['Guest Night', rows.reduce((s,r)=>s+(r.guestNightSnacks||0),0)],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between items-center px-3 py-2 text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-semibold">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:'collapse', minWidth:900, fontFamily:'Arial,sans-serif', fontSize:12}}>
          <thead>
            <tr style={{background:'#1a6b2e', color:'white'}}>
              <th rowSpan={2} style={{padding:'6px 4px', border:'1px solid #ccc', width:36}}>Sl.</th>
              <th rowSpan={2} style={{padding:'6px 4px', border:'1px solid #ccc', minWidth:90}}>Date</th>
              <th rowSpan={2} style={{padding:'6px 4px', border:'1px solid #ccc', width:44}}>Days</th>
              <th colSpan={4} style={{padding:'5px', border:'1px solid #ccc', background:'#1a6b2e'}}>Meal Charges — {MONTHS[month-1]} — {year}</th>
              <th colSpan={4} style={{padding:'5px', border:'1px solid #ccc', background:'#1a3a8a'}}>Guest Meal Charges — {MONTHS[month-1]} — {year}</th>
              <th rowSpan={2} style={{padding:'4px', border:'1px solid #ccc', width:50}}>Act</th>
            </tr>
            <tr style={{background:'#2a7a3e', color:'white'}}>
              {['Brakfast','Lunch','Evning Sancks','Night Snacks'].map(c=>(
                <th key={c} style={{padding:'4px 3px', border:'1px solid #ccc', minWidth:78, fontSize:11}}>{c}</th>
              ))}
              {['Guest Brakfast','Guest Lunch','Guest Evning Sancks','Guest Night Snacks'].map(c=>(
                <th key={c} style={{padding:'4px 3px', border:'1px solid #ccc', minWidth:90, fontSize:11, background:'#2a4a9a'}}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSun = isSunday(row.entryDate);
              const bg = isSun ? '#fff3cd' : idx%2===0 ? '#fff' : '#f9f9f9';
              const numFld = (f: keyof HulRow, colIdx: number) => (
                <input type="number" min={0} value={(row as any)[f]||''} onChange={e=>handleCellChange(idx,f,e.target.value)}
                  onKeyDown={e=>handleEnterKey(e, colIdx)}
                  style={{width:70, border:'none', background:'transparent', textAlign:'center', fontSize:12, padding:0, outline:'none'}}/>
              );
              return (
                <tr key={idx} style={{background: bg}}>
                  <td style={{textAlign:'center', border:'1px solid #ccc', padding:'2px'}}>{idx+1}</td>
                  <td style={{textAlign:'center', border:'1px solid #ccc', padding:'3px 4px', fontSize:11, fontWeight:500}}>{safeFormat(row.entryDate)}</td>
                  <td style={{textAlign:'center', border:'1px solid #ccc', fontSize:11}}>{row.weekDay}</td>
                  {mealFields.map((f, ci)=>(
                    <td key={f as string} style={{border:'1px solid #ccc', padding:0, textAlign:'center'}}>{numFld(f, ci)}</td>
                  ))}
                  {guestFields.map((f, ci)=>(
                    <td key={f as string} style={{border:'1px solid #ccc', padding:0, textAlign:'center', background:'rgba(26,58,138,0.04)'}}>{numFld(f, mealFields.length + ci)}</td>
                  ))}
                  <td style={{border:'1px solid #ccc', padding:'2px', textAlign:'center'}}>
                    <button onClick={()=>handleSaveRow(idx)} title="Save" style={{color:'#22c55e', marginRight:4, background:'none', border:'none', cursor:'pointer'}}><Save style={{width:13,height:13}}/></button>
                    <button onClick={()=>handleDeleteRow(idx)} title="Clear" style={{color:'#e53e3e', background:'none', border:'none', cursor:'pointer'}}><Trash2 style={{width:13,height:13}}/></button>
                  </td>
                </tr>
              );
            })}
            <tr style={{background:'#e8f0fe', fontWeight:'bold'}}>
              <td colSpan={3} style={{textAlign:'center', border:'1px solid #ccc', padding:'4px'}}>Total</td>
              {HUL_FIELDS.map(f=>(
                <td key={f as string} style={{border:'1px solid #ccc', textAlign:'center', padding:'4px', fontSize:12}}>
                  {rows.reduce((s,r)=>s+((r as any)[f]||0),0)||''}
                </td>
              ))}
              <td style={{border:'1px solid #ccc'}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{display:'none'}}>{printTable}</div>
    </div>
  );
}

// ============================================================
// UBL SUMMARY TAB
// ============================================================
function UblSummaryTab({ month, year }: { month: number; year: number }) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [summaryYear, setSummaryYear] = useState(year);
  const { label: billingLabel } = getBillingRange(month, year);
  const monthLabel = billingLabel;
  const yearLabel = String(summaryYear);
  // Helper to get billing period label for a given month+year (for yearly view rows)
  const getBillingRowLabel = (m: number) => {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? summaryYear + 1 : summaryYear;
    return `21 ${MONTHS[m-1].slice(0,3)} – 20 ${MONTHS[nm-1].slice(0,3)} ${ny}`;
  };

  const { data: dateRows = [], isLoading: dateLoading } = useQuery<UblRow[]>({
    queryKey: ['/api/ubl-date-entries', month, year],
    enabled: viewMode === 'monthly',
    queryFn: async () => {
      const r = await fetch(`/api/ubl-date-entries?month=${month}&year=${year}`, { credentials: 'include' });
      const d = await r.json();
      return d.map((x: UblRow) => ({ ...x, entryDate: normDate(x.entryDate) }));
    },
  });
  const { data: lunchRows = [], isLoading: lunchLoading } = useQuery<UblLunchRow[]>({
    queryKey: ['/api/ubl-lunch-entries', month, year],
    enabled: viewMode === 'monthly',
    queryFn: async () => {
      const r = await fetch(`/api/ubl-lunch-entries?month=${month}&year=${year}`, { credentials: 'include' });
      const d = await r.json();
      return d.map((x: UblLunchRow) => ({ ...x, entryDate: normDate(x.entryDate) }));
    },
  });
  const { data: yrDate = [], isLoading: yrDateLoading } = useQuery<any[]>({
    queryKey: ['/api/ubl-date-entries/yearly-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: () => fetch(`/api/ubl-date-entries/yearly-summary?year=${summaryYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: yrLunch = [], isLoading: yrLunchLoading } = useQuery<any[]>({
    queryKey: ['/api/ubl-lunch-entries/yearly-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: () => fetch(`/api/ubl-lunch-entries/yearly-summary?year=${summaryYear}`, { credentials: 'include' }).then(r => r.json()),
  });

  const isLoading = viewMode === 'monthly' ? (dateLoading || lunchLoading) : (yrDateLoading || yrLunchLoading);
  const sumF = (arr: any[], f: string) => arr.reduce((s: number, r: any) => s + (r[f] || 0), 0);

  const thA: React.CSSProperties = { background:'#b45309', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const thC: React.CSSProperties = { background:'#1a3a8a', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const tdS = (sun?: boolean): React.CSSProperties => ({ background: sun ? '#ffb380' : undefined, border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 });
  const tdTot: React.CSSProperties = { background:'#e8f0fe', border:'1px solid #333', padding:'3px 6px', textAlign:'center', fontWeight:'bold', fontSize:10 };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>UBL Summary ${viewMode === 'yearly' ? yearLabel : monthLabel}</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",Times,serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:4px;margin-bottom:10px;}
      th,td{border:1px solid #333;padding:2px 4px;text-align:center;font-size:10pt;}
      @media print{@page{margin:5mm;size:A4 landscape;}body{margin:0;}}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });
      const wFont = { bold:true, color:{argb:'FFFFFFFF'} };
      const label = viewMode === 'yearly' ? yearLabel : monthLabel;

      if (viewMode === 'monthly') {
        // Format 1 Sheet
        const ws1 = wb.addWorksheet('Format 1 - Bill Data');
        ws1.mergeCells('A1:L1');
        const t1 = ws1.getCell('A1');
        t1.value = `UBL — Bill Data Sheet — ${label}`; t1.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t1.fill=mkFill('FFB45309'); t1.alignment={horizontal:'center'}; t1.border=thin;
        const h1 = ws1.addRow(['Sl.','Date','Day','Tea(All)','Biscuit(All)','Breakfast','Lunch','Mutton','Tiffin','Boiled Egg','Dinner','Row Total']);
        h1.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FFB45309'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws1.columns=[5,14,8,10,12,12,10,10,10,12,10,12].map((w: number)=>({width:w}));
        dateRows.forEach((r, i) => {
          const tea = (r.tea1||0)+(r.tea2||0)+(r.tea3||0)+(r.tea4||0)+(r.tea5||0)+(r.tea6||0);
          const biscuit = (r.biscuit1||0)+(r.biscuit2||0);
          const tot = tea + biscuit + (r.breakfast||0) + (r.lunch||0) + (r.mutton||0) + (r.tiffin||0) + (r.boiledEgg||0) + (r.dinner||0);
          const dr = ws1.addRow([i+1, safeFormat(r.entryDate), r.weekDay, tea||'', biscuit||'', r.breakfast||'', r.lunch||'', r.mutton||'', r.tiffin||'', r.boiledEgg||'', r.dinner||'', tot||'']);
          if (isSunday(r.entryDate)) dr.eachCell((c: any) => { c.fill=mkFill('FFFFA500'); });
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
        // Format 2 Sheet
        const ws2 = wb.addWorksheet('Format 2 - Lunch Per Day');
        ws2.mergeCells('A1:G1');
        const t2 = ws2.getCell('A1');
        t2.value = `UBL — Lunch Per Day — ${label}`; t2.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t2.fill=mkFill('FF1A3A8A'); t2.alignment={horizontal:'center'}; t2.border=thin;
        const h2 = ws2.addRow(['Sl.','Date','Day','Permanent','Casual','Contractual','Canteen']);
        h2.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FF1A3A8A'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws2.columns=[5,14,8,12,10,14,10].map((w: number)=>({width:w}));
        lunchRows.forEach((r, i) => {
          const dr = ws2.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.perment||'', r.casual||'', r.contractual||'', r.canteen||'']);
          if (isSunday(r.entryDate)) dr.eachCell((c: any) => { c.fill=mkFill('FFFFA500'); });
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
      } else {
        // Yearly Format 1
        const ws1 = wb.addWorksheet('Format 1 Yearly');
        ws1.mergeCells('A1:H1');
        const t1 = ws1.getCell('A1'); t1.value = `UBL — Bill Data Sheet — Yearly Summary ${yearLabel}`; t1.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t1.fill=mkFill('FFB45309'); t1.alignment={horizontal:'center'}; t1.border=thin;
        const h1 = ws1.addRow(['Billing Period','Breakfast','Lunch','Dinner','Tea (All)','Mutton','Tiffin','Boiled Egg']);
        h1.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FFB45309'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws1.columns=[22,12,12,12,12,12,12,12].map((w: number)=>({width:w}));
        MONTHS.forEach((_mName, mi) => {
          const row = yrDate.find((r: any) => r.month === mi + 1);
          const bpLabel = getBillingRowLabel(mi + 1);
          const dr = ws1.addRow([bpLabel, row?.breakfast||'', row?.lunch||'', row?.dinner||'', row?.tea||'', row?.mutton||'', row?.tiffin||'', row?.boiledEgg||'']);
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
        const totRow = ws1.addRow(['Grand Total', sumF(yrDate,'breakfast')||'', sumF(yrDate,'lunch')||'', sumF(yrDate,'dinner')||'', sumF(yrDate,'tea')||'', sumF(yrDate,'mutton')||'', sumF(yrDate,'tiffin')||'', sumF(yrDate,'boiledEgg')||'']);
        totRow.eachCell((c: any) => { c.font={bold:true}; c.fill=mkFill('FFE8F0FE'); c.border=thin; c.alignment={horizontal:'center'}; });
        // Yearly Format 2
        const ws2 = wb.addWorksheet('Format 2 Yearly');
        ws2.mergeCells('A1:F1');
        const t2 = ws2.getCell('A1'); t2.value = `UBL — Lunch Per Day — Yearly Summary ${yearLabel}`; t2.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t2.fill=mkFill('FF1A3A8A'); t2.alignment={horizontal:'center'}; t2.border=thin;
        const h2 = ws2.addRow(['Billing Period','Permanent','Casual','Contractual','Canteen','Total']);
        h2.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FF1A3A8A'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws2.columns=[22,12,12,14,12,12].map((w: number)=>({width:w}));
        MONTHS.forEach((_mName, mi) => {
          const row = yrLunch.find((r: any) => r.month === mi + 1);
          const tot = (row?.perment||0)+(row?.casual||0)+(row?.contractual||0)+(row?.canteen||0);
          const dr = ws2.addRow([getBillingRowLabel(mi + 1), row?.perment||'', row?.casual||'', row?.contractual||'', row?.canteen||'', tot||'']);
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
      }
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`UBL_Summary_${viewMode === 'yearly' ? yearLabel : `${MONTHS[month-1]}_${year}`}.xlsx`; a.click();
    } catch(err: any) { toast({ title:'Export Failed', description:err.message, variant:'destructive' }); }
  };

  const YearlyTable = ({ data, fields, headers, title, hStyle }: { data: any[]; fields: string[]; headers: string[]; title: string; hStyle: React.CSSProperties }) => {
    const totals = fields.reduce((acc, f) => ({ ...acc, [f]: data.reduce((s, r) => s + (r[f] || 0), 0) }), {} as Record<string,number>);
    return (
      <div className="mb-5">
        <div className="text-center font-bold text-sm py-1.5" style={{ background: hStyle.background as string, color:'#fff' }}>{title} — {yearLabel}</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize:11 }}>
            <thead><tr>
              <th style={{ ...hStyle, minWidth:160, textAlign:'left', paddingLeft:8 }}>Billing Period</th>
              {headers.map((h,i) => <th key={i} style={hStyle}>{h}</th>)}
              <th style={{ ...hStyle, background:'#374151' }}>Total</th>
            </tr></thead>
            <tbody>
              {MONTHS.map((_mName, mi) => {
                const row = data.find(r => r.month === mi + 1);
                const vals = fields.map(f => row ? (row[f] || 0) : 0);
                const rowTotal = vals.reduce((s, v) => s + v, 0);
                return (
                  <tr key={mi} style={{ background: mi % 2 === 0 ? '#f9fafb' : '#fff' }}>
                    <td style={{ border:'1px solid #ddd', padding:'2px 6px', fontWeight:500, textAlign:'left', fontSize:10 }}>{getBillingRowLabel(mi + 1)}</td>
                    {vals.map((v, fi) => <td key={fi} style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 }}>{v || '—'}</td>)}
                    <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10, fontWeight:'bold', background:'#f0fdf4' }}>{rowTotal || '—'}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={tdTot}>Grand Total</td>
                {fields.map((f,fi) => <td key={fi} style={tdTot}>{totals[f] || '—'}</td>)}
                <td style={{ ...tdTot, background:'#bbf7d0' }}>{Object.values(totals).reduce((s,v) => s + v, 0) || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-md overflow-hidden border border-gray-300 text-sm">
          <button onClick={() => setViewMode('monthly')} className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'monthly' ? 'bg-amber-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} data-testid="btn-ubl-summary-monthly">Monthly</button>
          <button onClick={() => setViewMode('yearly')} className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${viewMode === 'yearly' ? 'bg-amber-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} data-testid="btn-ubl-summary-yearly">Yearly</button>
        </div>
        {viewMode === 'yearly' && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500">Year:</span>
            <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-ubl-summary-year">
              {Array.from({ length: 6 }, (_, i) => year - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        <span className="text-sm font-semibold text-gray-600">UBL {viewMode === 'yearly' ? `Yearly Summary — ${yearLabel}` : `Monthly Summary — ${monthLabel}`}</span>
        <div className="flex gap-2 ml-auto">
          <button onClick={handlePrint} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-ubl-summary-print"><Printer className="w-3.5 h-3.5"/>Print</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 text-amber-700 border-amber-300 hover:bg-amber-50" data-testid="btn-ubl-summary-export"><FileDown className="w-3.5 h-3.5"/>Export Excel</button>
        </div>
      </div>
      {isLoading && <div className="flex items-center justify-center py-10 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Loading...</div>}

      <div ref={printRef}>
        {!isLoading && viewMode === 'monthly' && (
          <>
            <div className="text-center font-bold text-sm py-1.5 mb-1" style={{ background:'#b45309', color:'#fff' }}>UBL — Format 1: Bill Data Sheet — {monthLabel}</div>
            <div className="overflow-x-auto mb-5">
              <table className="w-full border-collapse" style={{ fontSize:10 }}>
                <thead>
                  <tr>
                    <th style={{ ...thA, width:30 }}>Sl.</th>
                    <th style={{ ...thA, width:80 }}>Date</th>
                    <th style={{ ...thA, width:34 }}>Day</th>
                    <th style={thA}>Tea(All)</th>
                    <th style={thA}>Biscuit</th>
                    <th style={thA}>Breakfast</th>
                    <th style={thA}>Lunch</th>
                    <th style={thA}>Mutton</th>
                    <th style={thA}>Tiffin</th>
                    <th style={thA}>Boiled Egg</th>
                    <th style={thA}>Dinner</th>
                    <th style={{ ...thA, background:'#374151' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dateRows.map((r, i) => {
                    const sun = isSunday(r.entryDate);
                    const tea = (r.tea1||0)+(r.tea2||0)+(r.tea3||0)+(r.tea4||0)+(r.tea5||0)+(r.tea6||0);
                    const biscuit = (r.biscuit1||0)+(r.biscuit2||0);
                    const rowTot = tea + biscuit + (r.breakfast||0) + (r.lunch||0) + (r.mutton||0) + (r.tiffin||0) + (r.boiledEgg||0) + (r.dinner||0);
                    return (
                      <tr key={i} style={{ background: sun ? '#ffb380' : undefined }}>
                        <td style={tdS(sun)}>{i+1}</td>
                        <td style={tdS(sun)}>{safeFormat(r.entryDate)}</td>
                        <td style={tdS(sun)}>{r.weekDay}</td>
                        <td style={tdS(sun)}>{tea || ''}</td>
                        <td style={tdS(sun)}>{biscuit || ''}</td>
                        <td style={tdS(sun)}>{r.breakfast || ''}</td>
                        <td style={tdS(sun)}>{r.lunch || ''}</td>
                        <td style={tdS(sun)}>{r.mutton || ''}</td>
                        <td style={tdS(sun)}>{r.tiffin || ''}</td>
                        <td style={tdS(sun)}>{r.boiledEgg || ''}</td>
                        <td style={tdS(sun)}>{r.dinner || ''}</td>
                        <td style={{ ...tdS(sun), fontWeight:'bold', background: sun ? '#ffa060' : '#f0fdf4' }}>{rowTot || ''}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} style={tdTot}>Total</td>
                    {(['tea','biscuit','breakfast','lunch','mutton','tiffin','boiledEgg','dinner'] as const).map(f => {
                      const v = f === 'tea' ? dateRows.reduce((s,r) => s+(r.tea1||0)+(r.tea2||0)+(r.tea3||0)+(r.tea4||0)+(r.tea5||0)+(r.tea6||0), 0) :
                               f === 'biscuit' ? dateRows.reduce((s,r) => s+(r.biscuit1||0)+(r.biscuit2||0), 0) : sumF(dateRows, f);
                      return <td key={f} style={tdTot}>{v || ''}</td>;
                    })}
                    <td style={{ ...tdTot, background:'#bbf7d0' }}>{dateRows.reduce((s,r) => {
                      return s + (r.tea1||0)+(r.tea2||0)+(r.tea3||0)+(r.tea4||0)+(r.tea5||0)+(r.tea6||0)+(r.biscuit1||0)+(r.biscuit2||0)+(r.breakfast||0)+(r.lunch||0)+(r.mutton||0)+(r.tiffin||0)+(r.boiledEgg||0)+(r.dinner||0);
                    }, 0) || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-center font-bold text-sm py-1.5 mb-1" style={{ background:'#1a3a8a', color:'#fff' }}>UBL — Format 2: Lunch Per Day — {monthLabel}</div>
            <div className="overflow-x-auto mb-5">
              <table className="w-full border-collapse" style={{ fontSize:10 }}>
                <thead>
                  <tr>
                    <th style={{ ...thC, width:30 }}>Sl.</th>
                    <th style={{ ...thC, width:80 }}>Date</th>
                    <th style={{ ...thC, width:34 }}>Day</th>
                    <th style={thC}>Permanent</th>
                    <th style={thC}>Casual</th>
                    <th style={thC}>Contractual</th>
                    <th style={thC}>Canteen</th>
                    <th style={{ ...thC, background:'#374151' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lunchRows.map((r, i) => {
                    const sun = isSunday(r.entryDate);
                    const rowTot = (r.perment||0)+(r.casual||0)+(r.contractual||0)+(r.canteen||0);
                    return (
                      <tr key={i} style={{ background: sun ? '#ffb380' : undefined }}>
                        <td style={tdS(sun)}>{i+1}</td>
                        <td style={tdS(sun)}>{safeFormat(r.entryDate)}</td>
                        <td style={tdS(sun)}>{r.weekDay}</td>
                        <td style={tdS(sun)}>{r.perment || ''}</td>
                        <td style={tdS(sun)}>{r.casual || ''}</td>
                        <td style={tdS(sun)}>{r.contractual || ''}</td>
                        <td style={tdS(sun)}>{r.canteen || ''}</td>
                        <td style={{ ...tdS(sun), fontWeight:'bold', background: sun ? '#ffa060' : '#f0fdf4' }}>{rowTot || ''}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} style={tdTot}>Total</td>
                    {(['perment','casual','contractual','canteen'] as (keyof UblLunchRow)[]).map(f => (
                      <td key={f as string} style={tdTot}>{sumF(lunchRows, f as string) || ''}</td>
                    ))}
                    <td style={{ ...tdTot, background:'#bbf7d0' }}>{sumF(lunchRows,'perment')+sumF(lunchRows,'casual')+sumF(lunchRows,'contractual')+sumF(lunchRows,'canteen') || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* UBL Monthly Rate Wise Summary */}
            {(() => {
              const ublMthRates = [
                { name:'Tea (All)',  rate:7,   qty: dateRows.reduce((s,r)=>s+(r.tea1||0)+(r.tea2||0)+(r.tea3||0)+(r.tea4||0)+(r.tea5||0)+(r.tea6||0),0) },
                { name:'Biscuit',   rate:0.5, qty: dateRows.reduce((s,r)=>s+(r.biscuit1||0)+(r.biscuit2||0),0) },
                { name:'Breakfast', rate:20,  qty: sumF(dateRows,'breakfast') },
                { name:'Lunch',     rate:50,  qty: sumF(dateRows,'lunch') },
                { name:'Mutton',    rate:149, qty: sumF(dateRows,'mutton') },
                { name:'Tiffin',    rate:25,  qty: sumF(dateRows,'tiffin') },
                { name:'Boiled Egg',rate:7,   qty: sumF(dateRows,'boiledEgg') },
                { name:'Dinner',    rate:48,  qty: sumF(dateRows,'dinner') },
              ];
              const mthGrand = ublMthRates.reduce((s,r)=>s+r.qty*r.rate, 0);
              const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';
              return (
                <div className="border rounded-lg overflow-hidden mb-4 mt-3">
                  <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#b45309' }}>
                    Rate Wise Summary — {monthLabel}
                  </div>
                  <table className="w-full border-collapse" style={{ fontSize:10 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thA, textAlign:'left', paddingLeft:8, width:130, fontSize:10 }}>Meal / Item</th>
                        <th style={{ ...thA, fontSize:10 }}>Qty</th>
                        <th style={{ ...thA, fontSize:10 }}>Rate (₹)</th>
                        <th style={{ ...thA, fontSize:10 }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ublMthRates.map((r, i) => (
                        <tr key={i} style={{ background: i%2===0 ? '#f9fafb' : '#fff' }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 8px', textAlign:'left', fontSize:10 }}>{r.name}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'center', fontSize:10 }}>{r.qty || ''}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'center', fontSize:10 }}>₹{r.rate}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'right', fontSize:10 }}>{r.qty ? fmt(r.qty*r.rate) : ''}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'#b45309' }}>
                        <td colSpan={3} style={{ border:'1px solid #333', padding:'3px 8px', fontWeight:'bold', textAlign:'right', fontSize:11, color:'#fff' }}>Grand Total</td>
                        <td style={{ border:'1px solid #333', padding:'3px 6px', textAlign:'right', fontWeight:'bold', fontSize:11, color:'#fff' }}>{fmt(mthGrand)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {!isLoading && viewMode === 'yearly' && (
          <>
            <YearlyTable data={yrDate} fields={['breakfast','lunch','dinner','tea','mutton','tiffin','boiledEgg']} headers={['Breakfast','Lunch','Dinner','Tea (All)','Mutton','Tiffin','Boiled Egg']} title="Format 1 — Bill Data Sheet" hStyle={thA} />
            <YearlyTable data={yrLunch} fields={['perment','casual','contractual','canteen']} headers={['Permanent','Casual','Contractual','Canteen']} title="Format 2 — Lunch Per Day" hStyle={thC} />
            {/* UBL Yearly Rate Wise Summary */}
            {(() => {
              const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';
              const ublYrRates = [
                { field:'tea',       name:'Tea (All)',   rate:7   },
                { field:'biscuit',   name:'Biscuit',     rate:0.5 },
                { field:'breakfast', name:'Breakfast',   rate:20  },
                { field:'lunch',     name:'Lunch',       rate:50  },
                { field:'mutton',    name:'Mutton',      rate:149 },
                { field:'tiffin',    name:'Tiffin',      rate:25  },
                { field:'boiledEgg', name:'Boiled Egg',  rate:7   },
                { field:'dinner',    name:'Dinner',      rate:48  },
              ];
              const totals = ublYrRates.map(r => ({ ...r, qty: sumF(yrDate, r.field) }));
              const grand = totals.reduce((s, r) => s + r.qty * r.rate, 0);
              return (
                <div className="border rounded-lg overflow-hidden mb-4 mt-3">
                  <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#b45309' }}>
                    Rate Wise Yearly Summary — {yearLabel}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize:10 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thA, textAlign:'left', paddingLeft:6, width:165, fontSize:10 }}>Billing Period</th>
                          {ublYrRates.map(r => (
                            <th key={r.field} colSpan={2} style={{ ...thA, fontSize:10 }}>{r.name} (×₹{r.rate})</th>
                          ))}
                          <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'3px 5px', textAlign:'center', fontWeight:'bold', fontSize:10 }}>Grand Total</th>
                        </tr>
                        <tr>
                          <th style={{ ...thA, fontSize:9, padding:'2px 4px' }}></th>
                          {ublYrRates.flatMap(r => [
                            <th key={r.field+'q'} style={{ ...thA, fontSize:9, padding:'2px 4px' }}>Qty</th>,
                            <th key={r.field+'a'} style={{ ...thA, fontSize:9, padding:'2px 4px' }}>Amt</th>,
                          ])}
                          <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', fontSize:9, padding:'2px 4px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {MONTHS.map((_mName, mi) => {
                          const row = yrDate.find((r: any) => r.month === mi + 1);
                          const vals = ublYrRates.map(r => Number((row as any)?.[r.field] || 0));
                          const rowGrand = ublYrRates.reduce((s, r, i) => s + vals[i] * r.rate, 0);
                          const bg = mi % 2 === 0 ? '#f9fafb' : '#fff';
                          return (
                            <tr key={mi} style={{ background: bg }}>
                              <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{getBillingRowLabel(mi + 1)}</td>
                              {ublYrRates.map((r, i) => [
                                <td key={r.field+'q'} style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{vals[i] || ''}</td>,
                                <td key={r.field+'a'} style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{vals[i] ? (vals[i] * r.rate).toLocaleString('en-IN') : ''}</td>,
                              ])}
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10, fontWeight:'bold', background:'#eff6ff' }}>{rowGrand ? fmt(rowGrand) : '—'}</td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const qtys = ublYrRates.map(r => sumF(yrDate, r.field));
                          const grandTot = ublYrRates.reduce((s, r, i) => s + qtys[i] * r.rate, 0);
                          return (
                            <tr>
                              <td style={tdTot}>Grand Total</td>
                              {ublYrRates.map((r, i) => [
                                <td key={r.field+'q'} style={tdTot}>{qtys[i] || '—'}</td>,
                                <td key={r.field+'a'} style={tdTot}>{qtys[i] ? `₹${(qtys[i] * r.rate).toLocaleString('en-IN')}` : '—'}</td>,
                              ])}
                              <td style={{ ...tdTot, background:'#bfdbfe' }}>{grandTot ? fmt(grandTot) : '—'}</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CIPLA SUMMARY TAB
// ============================================================
function CiplaSummaryTab({ month, year }: { month: number; year: number }) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [summaryYear, setSummaryYear] = useState(year);
  const { label: billingLabelC } = getBillingRange(month, year);
  const monthLabel = billingLabelC;
  const yearLabel = String(summaryYear);
  const getCiplaBillingRowLabel = (m: number) => {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? summaryYear + 1 : summaryYear;
    return `21 ${MONTHS[m-1].slice(0,3)} – 20 ${MONTHS[nm-1].slice(0,3)} ${ny}`;
  };

  const { data: ciplaRows = [], isLoading: ciplaLoading } = useQuery<CiplaRow[]>({
    queryKey: ['/api/cipla-date-entries', month, year],
    enabled: viewMode === 'monthly',
    queryFn: async () => {
      const r = await fetch(`/api/cipla-date-entries?month=${month}&year=${year}`, { credentials: 'include' });
      const d = await r.json();
      return d.map((x: CiplaRow) => ({ ...x, entryDate: normDate(x.entryDate) }));
    },
  });
  const { data: yrCipla = [], isLoading: yrLoading } = useQuery<any[]>({
    queryKey: ['/api/cipla-date-entries/yearly-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: () => fetch(`/api/cipla-date-entries/yearly-summary?year=${summaryYear}`, { credentials: 'include' }).then(r => r.json()),
  });

  const isLoading = viewMode === 'monthly' ? ciplaLoading : yrLoading;
  const sumF = (arr: any[], f: string) => arr.reduce((s: number, r: any) => s + (r[f] || 0), 0);
  const thI: React.CSSProperties = { background:'#4338ca', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const tdS = (sun?: boolean): React.CSSProperties => ({ background: sun ? '#ffb380' : undefined, border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 });
  const tdTot: React.CSSProperties = { background:'#e8f0fe', border:'1px solid #333', padding:'3px 6px', textAlign:'center', fontWeight:'bold', fontSize:10 };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Cipla Summary ${viewMode === 'yearly' ? yearLabel : monthLabel}</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",Times,serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;}th,td{border:1px solid #333;padding:2px 4px;text-align:center;font-size:10pt;}
      @media print{@page{margin:5mm;size:A4 landscape;}body{margin:0;}}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });
      const wFont = { bold:true, color:{argb:'FFFFFFFF'} };
      const label = viewMode === 'yearly' ? yearLabel : monthLabel;
      const ws = wb.addWorksheet(viewMode === 'yearly' ? 'Yearly Summary' : 'Monthly Summary');
      ws.mergeCells('A1:J1');
      const t = ws.getCell('A1'); t.value = `Cipla — Summary — ${label}`; t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill('FF4338CA'); t.alignment={horizontal:'center'}; t.border=thin;
      if (viewMode === 'monthly') {
        const h = ws.addRow(['Sl.','Date','Day','BF(Coopen)','BF(Coin)','BF(Sign)','BF(Machine)','BF Total','Lunch Total','Dinner Total']);
        h.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FF4338CA'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws.columns=[5,14,8,12,10,10,13,10,12,12].map((w: number)=>({width:w}));
        ciplaRows.forEach((r, i) => {
          const bfTotal = (r.breakfastCoopen||0)+(r.breakfastCoin||0)+(r.breakfastSign||0)+(r.breakfastMachine||0);
          const luTotal = (r.lunchCoopen||0)+(r.lunchCoin||0)+(r.lunchSign||0)+(r.lunchMachine||0);
          const diTotal = (r.dinnerCoopen||0)+(r.dinnerCoin||0)+(r.dinnerSign||0)+(r.dinnerMachine||0);
          const dr = ws.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.breakfastCoopen||'', r.breakfastCoin||'', r.breakfastSign||'', r.breakfastMachine||'', bfTotal||'', luTotal||'', diTotal||'']);
          if (isSunday(r.entryDate)) dr.eachCell((c: any) => { c.fill=mkFill('FFFFA500'); });
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
      } else {
        const h = ws.addRow(['Billing Period','Breakfast','Lunch','Dinner','Total']);
        h.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FF4338CA'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws.columns=[22,12,12,12,12].map((w: number)=>({width:w}));
        MONTHS.forEach((_mName, mi) => {
          const row = yrCipla.find((r: any) => r.month === mi + 1);
          const tot = (row?.breakfast||0)+(row?.lunch||0)+(row?.dinner||0);
          const dr = ws.addRow([getCiplaBillingRowLabel(mi + 1), row?.breakfast||'', row?.lunch||'', row?.dinner||'', tot||'']);
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
        const totRow = ws.addRow(['Grand Total', sumF(yrCipla,'breakfast')||'', sumF(yrCipla,'lunch')||'', sumF(yrCipla,'dinner')||'', sumF(yrCipla,'breakfast')+sumF(yrCipla,'lunch')+sumF(yrCipla,'dinner')||'']);
        totRow.eachCell((c: any) => { c.font={bold:true}; c.fill=mkFill('FFE8F0FE'); c.border=thin; c.alignment={horizontal:'center'}; });
      }
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Cipla_Summary_${viewMode === 'yearly' ? yearLabel : `${MONTHS[month-1]}_${year}`}.xlsx`; a.click();
    } catch(err: any) { toast({ title:'Export Failed', description:err.message, variant:'destructive' }); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-md overflow-hidden border border-gray-300 text-sm">
          <button onClick={() => setViewMode('monthly')} className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'monthly' ? 'bg-indigo-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} data-testid="btn-cipla-summary-monthly">Monthly</button>
          <button onClick={() => setViewMode('yearly')} className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${viewMode === 'yearly' ? 'bg-indigo-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} data-testid="btn-cipla-summary-yearly">Yearly</button>
        </div>
        {viewMode === 'yearly' && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500">Year:</span>
            <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-cipla-summary-year">
              {Array.from({ length: 6 }, (_, i) => year - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        <span className="text-sm font-semibold text-gray-600">Cipla {viewMode === 'yearly' ? `Yearly Summary — ${yearLabel}` : `Monthly Summary — ${monthLabel}`}</span>
        <div className="flex gap-2 ml-auto">
          <button onClick={handlePrint} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-cipla-summary-print"><Printer className="w-3.5 h-3.5"/>Print</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 text-indigo-700 border-indigo-300 hover:bg-indigo-50" data-testid="btn-cipla-summary-export"><FileDown className="w-3.5 h-3.5"/>Export Excel</button>
        </div>
      </div>
      {isLoading && <div className="flex items-center justify-center py-10 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Loading...</div>}

      <div ref={printRef}>
        {!isLoading && viewMode === 'monthly' && (
          <>
            <div className="text-center font-bold text-sm py-1.5 mb-1" style={{ background:'#4338ca', color:'#fff' }}>Cipla — Breakfast / Lunch / Dinner Summary — {monthLabel}</div>
            <div className="overflow-x-auto mb-5">
              <table className="w-full border-collapse" style={{ fontSize:10 }}>
                <thead>
                  <tr>
                    <th style={{ ...thI, width:30 }}>Sl.</th>
                    <th style={{ ...thI, width:80 }}>Date</th>
                    <th style={{ ...thI, width:34 }}>Day</th>
                    <th style={thI}>BF Coopen</th>
                    <th style={thI}>BF Coin</th>
                    <th style={thI}>BF Sign</th>
                    <th style={thI}>BF Machine</th>
                    <th style={{ ...thI, background:'#1a6b2e' }}>BF Total</th>
                    <th style={{ ...thI, background:'#1a3a8a' }}>Lunch Total</th>
                    <th style={{ ...thI, background:'#374151' }}>Dinner Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ciplaRows.map((r, i) => {
                    const sun = isSunday(r.entryDate);
                    const bfTotal = (r.breakfastCoopen||0)+(r.breakfastCoin||0)+(r.breakfastSign||0)+(r.breakfastMachine||0);
                    const luTotal = (r.lunchCoopen||0)+(r.lunchCoin||0)+(r.lunchSign||0)+(r.lunchMachine||0);
                    const diTotal = (r.dinnerCoopen||0)+(r.dinnerCoin||0)+(r.dinnerSign||0)+(r.dinnerMachine||0);
                    return (
                      <tr key={i} style={{ background: sun ? '#ffb380' : undefined }}>
                        <td style={tdS(sun)}>{i+1}</td>
                        <td style={tdS(sun)}>{safeFormat(r.entryDate)}</td>
                        <td style={tdS(sun)}>{r.weekDay}</td>
                        <td style={tdS(sun)}>{r.breakfastCoopen || ''}</td>
                        <td style={tdS(sun)}>{r.breakfastCoin || ''}</td>
                        <td style={tdS(sun)}>{r.breakfastSign || ''}</td>
                        <td style={tdS(sun)}>{r.breakfastMachine || ''}</td>
                        <td style={{ ...tdS(sun), fontWeight:'bold', background: sun ? '#ffa060' : '#f0fdf4' }}>{bfTotal || ''}</td>
                        <td style={{ ...tdS(sun), background: sun ? '#ffa060' : '#eff6ff' }}>{luTotal || ''}</td>
                        <td style={{ ...tdS(sun), background: sun ? '#ffa060' : '#f8fafc' }}>{diTotal || ''}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} style={tdTot}>Total</td>
                    {(['breakfastCoopen','breakfastCoin','breakfastSign','breakfastMachine'] as (keyof CiplaRow)[]).map(f => (
                      <td key={f as string} style={tdTot}>{sumF(ciplaRows, f as string) || ''}</td>
                    ))}
                    <td style={{ ...tdTot, background:'#d1fae5' }}>{sumF(ciplaRows,'breakfastCoopen')+sumF(ciplaRows,'breakfastCoin')+sumF(ciplaRows,'breakfastSign')+sumF(ciplaRows,'breakfastMachine') || ''}</td>
                    <td style={{ ...tdTot, background:'#dbeafe' }}>{sumF(ciplaRows,'lunchCoopen')+sumF(ciplaRows,'lunchCoin')+sumF(ciplaRows,'lunchSign')+sumF(ciplaRows,'lunchMachine') || ''}</td>
                    <td style={{ ...tdTot, background:'#f1f5f9' }}>{sumF(ciplaRows,'dinnerCoopen')+sumF(ciplaRows,'dinnerCoin')+sumF(ciplaRows,'dinnerSign')+sumF(ciplaRows,'dinnerMachine') || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Cipla Monthly Rate Wise Summary */}
            {(() => {
              const cipRates = [
                { key:'bf', name:'Breakfast', rate:23, qty: sumF(ciplaRows,'breakfastCoopen')+sumF(ciplaRows,'breakfastCoin')+sumF(ciplaRows,'breakfastSign')+sumF(ciplaRows,'breakfastMachine') },
                { key:'lu', name:'Lunch', rate:58, qty: sumF(ciplaRows,'lunchCoopen')+sumF(ciplaRows,'lunchCoin')+sumF(ciplaRows,'lunchSign')+sumF(ciplaRows,'lunchMachine') },
                { key:'di', name:'Dinner', rate:58, qty: sumF(ciplaRows,'dinnerCoopen')+sumF(ciplaRows,'dinnerCoin')+sumF(ciplaRows,'dinnerSign')+sumF(ciplaRows,'dinnerMachine') },
              ];
              const cipGrand = cipRates.reduce((s, r) => s + r.qty * r.rate, 0);
              const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';
              return (
                <div className="border rounded-lg overflow-hidden mb-4 mt-3">
                  <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#4338ca' }}>
                    Rate Wise Summary — {monthLabel}
                  </div>
                  <table className="w-full border-collapse" style={{ fontSize:10 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thI, textAlign:'left', paddingLeft:8, width:130, fontSize:10 }}>Meal Type</th>
                        <th style={{ ...thI, fontSize:10 }}>Qty</th>
                        <th style={{ ...thI, fontSize:10 }}>Rate (₹)</th>
                        <th style={{ ...thI, fontSize:10 }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cipRates.map((r, i) => (
                        <tr key={i} style={{ background: i%2===0 ? '#f9fafb' : '#fff' }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 8px', textAlign:'left', fontSize:10 }}>{r.name}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'center', fontSize:10 }}>{r.qty || ''}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'center', fontSize:10 }}>₹{r.rate}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'right', fontSize:10 }}>{r.qty ? fmt(r.qty * r.rate) : ''}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'#4338ca' }}>
                        <td colSpan={3} style={{ border:'1px solid #333', padding:'3px 8px', fontWeight:'bold', textAlign:'right', fontSize:11, color:'#fff' }}>Grand Total</td>
                        <td style={{ border:'1px solid #333', padding:'3px 6px', textAlign:'right', fontWeight:'bold', fontSize:11, color:'#fff' }}>{fmt(cipGrand)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}
        {!isLoading && viewMode === 'yearly' && (
          <div className="mb-5">
            <div className="text-center font-bold text-sm py-1.5" style={{ background:'#4338ca', color:'#fff' }}>Cipla — Yearly Summary — {yearLabel}</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ fontSize:11 }}>
                <thead><tr>
                  <th style={{ ...thI, minWidth:165, textAlign:'left', paddingLeft:8 }}>Billing Period</th>
                  <th style={thI}>Breakfast</th>
                  <th style={thI}>Lunch</th>
                  <th style={thI}>Dinner</th>
                  <th style={{ ...thI, background:'#374151' }}>Grand Total</th>
                </tr></thead>
                <tbody>
                  {MONTHS.map((_mName, mi) => {
                    const row = yrCipla.find(r => r.month === mi + 1);
                    const tot = (row?.breakfast||0)+(row?.lunch||0)+(row?.dinner||0);
                    return (
                      <tr key={mi} style={{ background: mi % 2 === 0 ? '#f9fafb' : '#fff' }}>
                        <td style={{ border:'1px solid #ddd', padding:'2px 6px', fontWeight:500, textAlign:'left', fontSize:10 }}>{getCiplaBillingRowLabel(mi + 1)}</td>
                        <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 }}>{row?.breakfast || '—'}</td>
                        <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 }}>{row?.lunch || '—'}</td>
                        <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 }}>{row?.dinner || '—'}</td>
                        <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10, fontWeight:'bold', background:'#f0fdf4' }}>{tot || '—'}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={tdTot}>Grand Total</td>
                    <td style={tdTot}>{sumF(yrCipla,'breakfast') || '—'}</td>
                    <td style={tdTot}>{sumF(yrCipla,'lunch') || '—'}</td>
                    <td style={tdTot}>{sumF(yrCipla,'dinner') || '—'}</td>
                    <td style={{ ...tdTot, background:'#bbf7d0' }}>{sumF(yrCipla,'breakfast')+sumF(yrCipla,'lunch')+sumF(yrCipla,'dinner') || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Cipla Yearly Rate Wise Summary */}
            {(() => {
              const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';
              const cipRates = [
                { field:'breakfast', name:'Breakfast', rate:23 },
                { field:'lunch', name:'Lunch', rate:58 },
                { field:'dinner', name:'Dinner', rate:58 },
              ];
              return (
                <div className="border rounded-lg overflow-hidden mb-4 mt-3">
                  <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#4338ca' }}>
                    Rate Wise Yearly Summary — {yearLabel}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize:10 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thI, textAlign:'left', paddingLeft:6, width:165, fontSize:10 }}>Billing Period</th>
                          <th colSpan={2} style={{ ...thI, fontSize:10 }}>Breakfast (×₹23)</th>
                          <th colSpan={2} style={{ ...thI, fontSize:10 }}>Lunch (×₹58)</th>
                          <th colSpan={2} style={{ ...thI, fontSize:10 }}>Dinner (×₹58)</th>
                          <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'3px 5px', textAlign:'center', fontWeight:'bold', fontSize:10 }}>Grand Total</th>
                        </tr>
                        <tr>
                          <th style={{ ...thI, fontSize:9, padding:'2px 4px' }}></th>
                          {['Qty','Amt','Qty','Amt','Qty','Amt'].map((h,i)=><th key={i} style={{ ...thI, fontSize:9, padding:'2px 4px' }}>{h}</th>)}
                          <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', fontSize:9, padding:'2px 4px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {MONTHS.map((_mName, mi) => {
                          const row = yrCipla.find(r => r.month === mi + 1);
                          const bf = row?.breakfast||0, lu = row?.lunch||0, di = row?.dinner||0;
                          const grand = bf*23+lu*58+di*58;
                          const bg = mi%2===0 ? '#f9fafb' : '#fff';
                          return (
                            <tr key={mi} style={{ background: bg }}>
                              <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{getCiplaBillingRowLabel(mi+1)}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{bf||''}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{bf ? (bf*23).toLocaleString('en-IN') : ''}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{lu||''}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{lu ? (lu*58).toLocaleString('en-IN') : ''}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{di||''}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{di ? (di*58).toLocaleString('en-IN') : ''}</td>
                              <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10, fontWeight:'bold', background:'#eff6ff' }}>{grand ? fmt(grand) : '—'}</td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const totBf = sumF(yrCipla,'breakfast'), totLu = sumF(yrCipla,'lunch'), totDi = sumF(yrCipla,'dinner');
                          const grand = totBf*23+totLu*58+totDi*58;
                          return (
                            <tr>
                              <td style={tdTot}>Grand Total</td>
                              <td style={tdTot}>{totBf||'—'}</td><td style={tdTot}>{totBf ? `₹${(totBf*23).toLocaleString('en-IN')}` : '—'}</td>
                              <td style={tdTot}>{totLu||'—'}</td><td style={tdTot}>{totLu ? `₹${(totLu*58).toLocaleString('en-IN')}` : '—'}</td>
                              <td style={tdTot}>{totDi||'—'}</td><td style={tdTot}>{totDi ? `₹${(totDi*58).toLocaleString('en-IN')}` : '—'}</td>
                              <td style={{ ...tdTot, background:'#bfdbfe' }}>{grand ? fmt(grand) : '—'}</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// UNICHEM SUMMARY TAB
// ============================================================
function UnichemSummaryTab({ month, year }: { month: number; year: number }) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [summaryYear, setSummaryYear] = useState(year);
  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const yearLabel = String(summaryYear);

  // Monthly: fetch all 3 locations explicitly (hooks cannot be in loops)
  const mkSnackFn = (loc: string) => async () => {
    const r = await fetch(`/api/unichem-snack-entries?month=${month}&year=${year}&location=${encodeURIComponent(loc)}`, { credentials: 'include' });
    const d = await r.json(); return d.map((x: SnackRow) => ({ ...x, entryDate: normDate(x.entryDate) }));
  };
  const mkLunchFn = (loc: string, mealType: string) => async () => {
    const r = await fetch(`/api/unichem-lunch-entries?month=${month}&year=${year}&location=${encodeURIComponent(loc)}&mealType=${mealType}`, { credentials: 'include' });
    const d = await r.json(); return d.map((x: LunchRow) => ({ ...x, entryDate: normDate(x.entryDate) }));
  };
  const { data: sMain = [], isLoading: sMainL } = useQuery<SnackRow[]>({ queryKey:['/api/unichem-snack-entries',month,year,'Main Plant'], enabled:viewMode==='monthly', queryFn:mkSnackFn('Main Plant') });
  const { data: sUnit2 = [], isLoading: sUnit2L } = useQuery<SnackRow[]>({ queryKey:['/api/unichem-snack-entries',month,year,'Unit-2'], enabled:viewMode==='monthly', queryFn:mkSnackFn('Unit-2') });
  const { data: sCoe = [], isLoading: sCoeL } = useQuery<SnackRow[]>({ queryKey:['/api/unichem-snack-entries',month,year,'COE'], enabled:viewMode==='monthly', queryFn:mkSnackFn('COE') });
  const { data: lMain = [], isLoading: lMainL } = useQuery<LunchRow[]>({ queryKey:['/api/unichem-lunch-entries',month,year,'Main Plant','lunch'], enabled:viewMode==='monthly', queryFn:mkLunchFn('Main Plant','lunch') });
  const { data: lUnit2 = [], isLoading: lUnit2L } = useQuery<LunchRow[]>({ queryKey:['/api/unichem-lunch-entries',month,year,'Unit-2','lunch'], enabled:viewMode==='monthly', queryFn:mkLunchFn('Unit-2','lunch') });
  const { data: lCoe = [], isLoading: lCoeL } = useQuery<LunchRow[]>({ queryKey:['/api/unichem-lunch-entries',month,year,'COE','lunch'], enabled:viewMode==='monthly', queryFn:mkLunchFn('COE','lunch') });
  const { data: dMain = [], isLoading: dMainL } = useQuery<LunchRow[]>({ queryKey:['/api/unichem-lunch-entries',month,year,'Main Plant','dinner'], enabled:viewMode==='monthly', queryFn:mkLunchFn('Main Plant','dinner') });
  const { data: dUnit2 = [], isLoading: dUnit2L } = useQuery<LunchRow[]>({ queryKey:['/api/unichem-lunch-entries',month,year,'Unit-2','dinner'], enabled:viewMode==='monthly', queryFn:mkLunchFn('Unit-2','dinner') });
  const { data: dCoe = [], isLoading: dCoeL } = useQuery<LunchRow[]>({ queryKey:['/api/unichem-lunch-entries',month,year,'COE','dinner'], enabled:viewMode==='monthly', queryFn:mkLunchFn('COE','dinner') });

  const { data: yrSnacks = [], isLoading: yrSnacksLoading } = useQuery<any[]>({
    queryKey: ['/api/unichem-snack-entries/yearly-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: () => fetch(`/api/unichem-snack-entries/yearly-summary?year=${summaryYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: yrLunchData = [], isLoading: yrLunchLoading } = useQuery<any[]>({
    queryKey: ['/api/unichem-lunch-entries/yearly-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: () => fetch(`/api/unichem-lunch-entries/yearly-summary?year=${summaryYear}`, { credentials: 'include' }).then(r => r.json()),
  });
  const { data: yrSundayLunch = [], isLoading: yrSundayLoading } = useQuery<{ month: number; sundayLunch: number }[]>({
    queryKey: ['/api/unichem-lunch-entries/yearly-sunday-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: () => fetch(`/api/unichem-lunch-entries/yearly-sunday-summary?year=${summaryYear}`, { credentials: 'include' }).then(r => r.json()),
  });

  const monthlyLoading = sMainL || sUnit2L || sCoeL || lMainL || lUnit2L || lCoeL || dMainL || dUnit2L || dCoeL;
  const isLoading = viewMode === 'monthly' ? monthlyLoading : (yrSnacksLoading || yrLunchLoading || yrSundayLoading);
  const sumF = (arr: any[], f: string) => arr.reduce((s: number, r: any) => s + (r[f] || 0), 0);

  // Build aggregated daily rows for snacks (all locations combined by date)
  const allSnackRows = [...sMain, ...sUnit2, ...sCoe];
  const allLunchRows = [...lMain, ...lUnit2, ...lCoe];
  const allDinnerRows = [...dMain, ...dUnit2, ...dCoe];

  // Get all unique dates
  const allDates = [...new Set([...allSnackRows, ...allLunchRows, ...allDinnerRows].map(r => r.entryDate))].sort();
  const aggSnackByDate = allDates.map(d => {
    const lunchQtyOnDay = allLunchRows.filter(r => r.entryDate === d).reduce((s, r) => s + (r.billQty || 0), 0);
    return {
      entryDate: d,
      weekDay: allSnackRows.find(r => r.entryDate === d)?.weekDay || allLunchRows.find(r => r.entryDate === d)?.weekDay || '',
      breakfast: allSnackRows.filter(r => r.entryDate === d).reduce((s, r) => s + (r.breakfast || 0), 0),
      eveningSnacks: allSnackRows.filter(r => r.entryDate === d).reduce((s, r) => s + (r.eveningSnacks || 0), 0),
      nightSnacks: allSnackRows.filter(r => r.entryDate === d).reduce((s, r) => s + (r.nightSnacks || 0), 0),
      // Sunday Extra auto-latched from Sunday Lunch Bill Qty (Form 2)
      sundayExtraSnacks: isSunday(d) ? lunchQtyOnDay : allSnackRows.filter(r => r.entryDate === d).reduce((s, r) => s + (r.sundayExtraSnacks || 0), 0),
      lunch: lunchQtyOnDay,
      dinner: allDinnerRows.filter(r => r.entryDate === d).reduce((s, r) => s + (r.billQty || 0), 0),
    };
  });

  const thT: React.CSSProperties = { background:'#0f766e', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const thB: React.CSSProperties = { background:'#1a3a8a', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const tdS = (sun?: boolean): React.CSSProperties => ({ background: sun ? '#ffb380' : undefined, border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 });
  const tdTot: React.CSSProperties = { background:'#e8f0fe', border:'1px solid #333', padding:'3px 6px', textAlign:'center', fontWeight:'bold', fontSize:10 };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Unichem Summary ${viewMode === 'yearly' ? yearLabel : monthLabel}</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",Times,serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;}th,td{border:1px solid #333;padding:2px 4px;text-align:center;font-size:10pt;}
      @media print{@page{margin:5mm;size:A4 landscape;}body{margin:0;}}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });
      const wFont = { bold:true, color:{argb:'FFFFFFFF'} };
      const label = viewMode === 'yearly' ? yearLabel : monthLabel;

      if (viewMode === 'monthly') {
        const ws = wb.addWorksheet('Monthly Combined');
        ws.mergeCells('A1:J1');
        const t = ws.getCell('A1'); t.value = `Unichem — Combined Summary (All Locations) — ${label}`; t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill('FF0F766E'); t.alignment={horizontal:'center'}; t.border=thin;
        const h = ws.addRow(['Sl.','Date','Day','Breakfast','Ev. Snacks','Night Snacks','Sun Extra','Lunch','Dinner','Row Total']);
        h.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FF0F766E'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws.columns=[5,14,8,12,12,13,12,12,12,12].map((w: number)=>({width:w}));
        aggSnackByDate.forEach((r, i) => {
          const tot = r.breakfast + r.eveningSnacks + r.nightSnacks + r.sundayExtraSnacks + r.lunch + r.dinner;
          const dr = ws.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.breakfast||'', r.eveningSnacks||'', r.nightSnacks||'', r.sundayExtraSnacks||'', r.lunch||'', r.dinner||'', tot||'']);
          if (isSunday(r.entryDate)) dr.eachCell((c: any) => { c.fill=mkFill('FFFFA500'); });
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
      } else {
        const ws = wb.addWorksheet('Yearly Summary');
        ws.mergeCells('A1:H1');
        const t = ws.getCell('A1'); t.value = `Unichem — Yearly Summary — ${yearLabel}`; t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill('FF0F766E'); t.alignment={horizontal:'center'}; t.border=thin;
        const h = ws.addRow(['Month','Breakfast','Ev. Snacks','Night Snacks','Sun Extra','Lunch','Dinner','Grand Total']);
        h.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FF0F766E'); c.border=thin; c.alignment={horizontal:'center'}; });
        ws.columns=[14,12,12,14,12,12,12,14].map((w: number)=>({width:w}));
        MONTHS.forEach((mName, mi) => {
          const s = yrSnacks.find((r: any) => r.month === mi + 1);
          const l = yrLunchData.find((r: any) => r.month === mi + 1);
          const sl = yrSundayLunch.find((r: any) => r.month === mi + 1);
          const se = sl?.sundayLunch || 0;
          const tot = (s?.breakfast||0)+(s?.eveningSnacks||0)+(s?.nightSnacks||0)+se+(l?.lunch||0)+(l?.dinner||0);
          const dr = ws.addRow([mName, s?.breakfast||'', s?.eveningSnacks||'', s?.nightSnacks||'', se||'', l?.lunch||'', l?.dinner||'', tot||'']);
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
        const totalSE = yrSundayLunch.reduce((s, r) => s + (r.sundayLunch||0), 0);
        const totRow = ws.addRow(['Grand Total', sumF(yrSnacks,'breakfast')||'', sumF(yrSnacks,'eveningSnacks')||'', sumF(yrSnacks,'nightSnacks')||'', totalSE||'', sumF(yrLunchData,'lunch')||'', sumF(yrLunchData,'dinner')||'',
          sumF(yrSnacks,'breakfast')+sumF(yrSnacks,'eveningSnacks')+sumF(yrSnacks,'nightSnacks')+totalSE+sumF(yrLunchData,'lunch')+sumF(yrLunchData,'dinner')||'']);
        totRow.eachCell((c: any) => { c.font={bold:true}; c.fill=mkFill('FFE8F0FE'); c.border=thin; c.alignment={horizontal:'center'}; });
      }
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Unichem_Summary_${viewMode === 'yearly' ? yearLabel : `${MONTHS[month-1]}_${year}`}.xlsx`; a.click();
    } catch(err: any) { toast({ title:'Export Failed', description:err.message, variant:'destructive' }); }
  };

  const YearlyTable = ({ snacksData, lunchData, sundayLunchData, title, hStyle }: { snacksData: any[]; lunchData: any[]; sundayLunchData: any[]; title: string; hStyle: React.CSSProperties }) => {
    const totalSundayLunch = sundayLunchData.reduce((s, r) => s + (r.sundayLunch||0), 0);
    return (
      <div className="mb-5">
        <div className="text-center font-bold text-sm py-1.5" style={{ background: hStyle.background as string, color:'#fff' }}>{title} — {yearLabel}</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize:11 }}>
            <thead><tr>
              <th style={{ ...hStyle, width:90, textAlign:'left', paddingLeft:8 }}>Month</th>
              <th style={hStyle}>Breakfast</th>
              <th style={hStyle}>Ev. Snacks</th>
              <th style={hStyle}>Night Snacks</th>
              <th style={hStyle}>Sunday Extra</th>
              <th style={thB}>Lunch</th>
              <th style={thB}>Dinner</th>
              <th style={{ ...hStyle, background:'#374151' }}>Total</th>
            </tr></thead>
            <tbody>
              {MONTHS.map((mName, mi) => {
                const s = snacksData.find(r => r.month === mi + 1);
                const l = lunchData.find(r => r.month === mi + 1);
                const sl = sundayLunchData.find(r => r.month === mi + 1);
                const se = sl?.sundayLunch || 0;
                const tot = (s?.breakfast||0)+(s?.eveningSnacks||0)+(s?.nightSnacks||0)+se+(l?.lunch||0)+(l?.dinner||0);
                return (
                  <tr key={mi} style={{ background: mi % 2 === 0 ? '#f9fafb' : '#fff' }}>
                    <td style={{ border:'1px solid #ddd', padding:'2px 6px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                    {[s?.breakfast,s?.eveningSnacks,s?.nightSnacks,se||undefined,l?.lunch,l?.dinner].map((v, fi) => (
                      <td key={fi} style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 }}>{v || '—'}</td>
                    ))}
                    <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10, fontWeight:'bold', background:'#f0fdf4' }}>{tot || '—'}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={tdTot}>Grand Total</td>
                {[sumF(yrSnacks,'breakfast'),sumF(yrSnacks,'eveningSnacks'),sumF(yrSnacks,'nightSnacks'),totalSundayLunch,sumF(yrLunchData,'lunch'),sumF(yrLunchData,'dinner')].map((v, fi) => (
                  <td key={fi} style={tdTot}>{v || '—'}</td>
                ))}
                <td style={{ ...tdTot, background:'#bbf7d0' }}>{sumF(yrSnacks,'breakfast')+sumF(yrSnacks,'eveningSnacks')+sumF(yrSnacks,'nightSnacks')+totalSundayLunch+sumF(yrLunchData,'lunch')+sumF(yrLunchData,'dinner') || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-md overflow-hidden border border-gray-300 text-sm">
          <button onClick={() => setViewMode('monthly')} className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'monthly' ? 'bg-teal-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} data-testid="btn-unichem-summary-monthly">Monthly</button>
          <button onClick={() => setViewMode('yearly')} className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${viewMode === 'yearly' ? 'bg-teal-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} data-testid="btn-unichem-summary-yearly">Yearly</button>
        </div>
        {viewMode === 'yearly' && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500">Year:</span>
            <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-unichem-summary-year">
              {Array.from({ length: 6 }, (_, i) => year - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        <span className="text-sm font-semibold text-gray-600">Unichem {viewMode === 'yearly' ? `Yearly Summary — ${yearLabel}` : `Monthly Summary — ${monthLabel}`}</span>
        <div className="flex gap-2 ml-auto">
          <button onClick={handlePrint} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-50" data-testid="btn-unichem-summary-print"><Printer className="w-3.5 h-3.5"/>Print</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 text-teal-700 border-teal-300 hover:bg-teal-50" data-testid="btn-unichem-summary-export"><FileDown className="w-3.5 h-3.5"/>Export Excel</button>
        </div>
      </div>
      {isLoading && <div className="flex items-center justify-center py-10 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Loading...</div>}

      <div ref={printRef}>
        {!isLoading && viewMode === 'monthly' && (
          <>
            <div className="text-center font-bold text-sm py-1.5 mb-1" style={{ background:'#0f766e', color:'#fff' }}>Unichem — All Locations Combined Summary — {monthLabel}</div>
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse" style={{ fontSize:10 }}>
                <thead>
                  <tr>
                    <th style={{ ...thT, width:30 }}>Sl.</th>
                    <th style={{ ...thT, width:80 }}>Date</th>
                    <th style={{ ...thT, width:34 }}>Day</th>
                    <th style={thT}>Breakfast</th>
                    <th style={thT}>Ev. Snacks</th>
                    <th style={thT}>Night Snacks</th>
                    <th style={thT}>Sun. Extra</th>
                    <th style={thB}>Lunch</th>
                    <th style={thB}>Dinner</th>
                    <th style={{ ...thT, background:'#374151' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {aggSnackByDate.map((r, i) => {
                    const sun = isSunday(r.entryDate);
                    const rowTot = r.breakfast + r.eveningSnacks + r.nightSnacks + r.sundayExtraSnacks + r.lunch + r.dinner;
                    return (
                      <tr key={i} style={{ background: sun ? '#ffb380' : undefined }}>
                        <td style={tdS(sun)}>{i+1}</td>
                        <td style={tdS(sun)}>{safeFormat(r.entryDate)}</td>
                        <td style={tdS(sun)}>{r.weekDay}</td>
                        <td style={tdS(sun)}>{r.breakfast || ''}</td>
                        <td style={tdS(sun)}>{r.eveningSnacks || ''}</td>
                        <td style={tdS(sun)}>{r.nightSnacks || ''}</td>
                        <td style={tdS(sun)}>{r.sundayExtraSnacks || ''}</td>
                        <td style={{ ...tdS(sun), background: sun ? '#ffa060' : '#eff6ff' }}>{r.lunch || ''}</td>
                        <td style={{ ...tdS(sun), background: sun ? '#ffa060' : '#f8fafc' }}>{r.dinner || ''}</td>
                        <td style={{ ...tdS(sun), fontWeight:'bold', background: sun ? '#ff9050' : '#f0fdf4' }}>{rowTot || ''}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} style={tdTot}>Total</td>
                    <td style={tdTot}>{aggSnackByDate.reduce((s, r) => s + r.breakfast, 0) || ''}</td>
                    <td style={tdTot}>{aggSnackByDate.reduce((s, r) => s + r.eveningSnacks, 0) || ''}</td>
                    <td style={tdTot}>{aggSnackByDate.reduce((s, r) => s + r.nightSnacks, 0) || ''}</td>
                    <td style={tdTot}>{aggSnackByDate.reduce((s, r) => s + r.sundayExtraSnacks, 0) || ''}</td>
                    <td style={{ ...tdTot, background:'#dbeafe' }}>{aggSnackByDate.reduce((s, r) => s + r.lunch, 0) || ''}</td>
                    <td style={{ ...tdTot, background:'#dbeafe' }}>{aggSnackByDate.reduce((s, r) => s + r.dinner, 0) || ''}</td>
                    <td style={{ ...tdTot, background:'#bbf7d0' }}>{aggSnackByDate.reduce((s, r) => s + r.breakfast + r.eveningSnacks + r.nightSnacks + r.sundayExtraSnacks + r.lunch + r.dinner, 0) || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Unichem Monthly Rate Wise Summary */}
            {(() => {
              const uniRates = [
                { name:'Breakfast', rate:15, qty: aggSnackByDate.reduce((s,r)=>s+r.breakfast,0) },
                { name:'Evening Snacks', rate:15, qty: aggSnackByDate.reduce((s,r)=>s+r.eveningSnacks,0) },
                { name:'Night Snacks', rate:15, qty: aggSnackByDate.reduce((s,r)=>s+r.nightSnacks,0) },
                { name:'Sunday Extra', rate:10, qty: aggSnackByDate.reduce((s,r)=>s+r.sundayExtraSnacks,0) },
                { name:'Lunch', rate:58, qty: aggSnackByDate.reduce((s,r)=>s+r.lunch,0) },
                { name:'Dinner', rate:58, qty: aggSnackByDate.reduce((s,r)=>s+r.dinner,0) },
              ];
              const uniGrand = uniRates.reduce((s, r) => s + r.qty * r.rate, 0);
              const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';
              return (
                <div className="border rounded-lg overflow-hidden mb-4 mt-3">
                  <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#0f766e' }}>
                    Rate Wise Summary — {monthLabel}
                  </div>
                  <table className="w-full border-collapse" style={{ fontSize:10 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thT, textAlign:'left', paddingLeft:8, width:150, fontSize:10 }}>Meal Type</th>
                        <th style={{ ...thT, fontSize:10 }}>Qty</th>
                        <th style={{ ...thT, fontSize:10 }}>Rate (₹)</th>
                        <th style={{ ...thT, fontSize:10 }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniRates.map((r, i) => (
                        <tr key={i} style={{ background: i%2===0 ? '#f9fafb' : '#fff' }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 8px', textAlign:'left', fontSize:10 }}>{r.name}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'center', fontSize:10 }}>{r.qty || ''}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'center', fontSize:10 }}>₹{r.rate}</td>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', textAlign:'right', fontSize:10 }}>{r.qty ? fmt(r.qty * r.rate) : ''}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'#0f766e' }}>
                        <td colSpan={3} style={{ border:'1px solid #333', padding:'3px 8px', fontWeight:'bold', textAlign:'right', fontSize:11, color:'#fff' }}>Grand Total</td>
                        <td style={{ border:'1px solid #333', padding:'3px 6px', textAlign:'right', fontWeight:'bold', fontSize:11, color:'#fff' }}>{fmt(uniGrand)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}
        {!isLoading && viewMode === 'yearly' && (<>
          <YearlyTable snacksData={yrSnacks} lunchData={yrLunchData} sundayLunchData={yrSundayLunch} title="Unichem — All Locations Combined Yearly Summary" hStyle={thT} />
          {/* Unichem Yearly Rate Wise Summary */}
          {(() => {
            const fmt = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';
            const sumS = (f: string) => yrSnacks.reduce((s: number, r: any) => s + (r[f]||0), 0);
            const sumL = (f: string) => yrLunchData.reduce((s: number, r: any) => s + (r[f]||0), 0);
            return (
              <div className="border rounded-lg overflow-hidden mb-4 mt-1">
                <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#0f766e' }}>
                  Rate Wise Yearly Summary — {yearLabel}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ fontSize:10 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thT, textAlign:'left', paddingLeft:6, width:90, fontSize:10 }}>Month</th>
                        <th colSpan={2} style={{ ...thT, fontSize:10 }}>Breakfast (×₹15)</th>
                        <th colSpan={2} style={{ ...thT, fontSize:10 }}>Ev. Snacks (×₹15)</th>
                        <th colSpan={2} style={{ ...thT, fontSize:10 }}>Night Snacks (×₹15)</th>
                        <th colSpan={2} style={{ ...thT, fontSize:10 }}>Sun. Extra (×₹10)</th>
                        <th colSpan={2} style={{ ...thB, fontSize:10 }}>Lunch (×₹58)</th>
                        <th colSpan={2} style={{ ...thB, fontSize:10 }}>Dinner (×₹58)</th>
                        <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'3px 5px', textAlign:'center', fontWeight:'bold', fontSize:10 }}>Grand Total</th>
                      </tr>
                      <tr>
                        <th style={{ ...thT, fontSize:9, padding:'2px 4px' }}></th>
                        {Array.from({length:12},(_,i)=><th key={i} style={{ ...(i<8?thT:thB), fontSize:9, padding:'2px 4px' }}>{i%2===0?'Qty':'Amt'}</th>)}
                        <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', fontSize:9, padding:'2px 4px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((mName, mi) => {
                        const s = yrSnacks.find((r: any) => r.month === mi+1);
                        const l = yrLunchData.find((r: any) => r.month === mi+1);
                        const sl = yrSundayLunch.find((r: any) => r.month === mi+1);
                        const bf=s?.breakfast||0, es=s?.eveningSnacks||0, ns=s?.nightSnacks||0;
                        // Sunday Extra: always from Sunday Lunch Bill Qty (Form 2)
                        const se = sl?.sundayLunch || 0;
                        const lu=l?.lunch||0, di=l?.dinner||0;
                        const grand = bf*15+es*15+ns*15+se*10+lu*58+di*58;
                        const bg = mi%2===0 ? '#f9fafb' : '#fff';
                        const c = (n:number) => n||'';
                        const a = (n:number,r:number) => n ? (n*r).toLocaleString('en-IN') : '';
                        return (
                          <tr key={mi} style={{ background: bg }}>
                            <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{c(bf)}</td><td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{a(bf,15)}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{c(es)}</td><td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{a(es,15)}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10 }}>{c(ns)}</td><td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10 }}>{a(ns,15)}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10, background:'#fef9c3' }}>{c(se)}</td><td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10, background:'#fef9c3' }}>{a(se,10)}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10, background:'#eff6ff' }}>{c(lu)}</td><td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10, background:'#eff6ff' }}>{a(lu,58)}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10, background:'#f8fafc' }}>{c(di)}</td><td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10, background:'#f8fafc' }}>{a(di,58)}</td>
                            <td style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'right', fontSize:10, fontWeight:'bold', background:'#f0fdf4' }}>{grand ? fmt(grand) : '—'}</td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const bf=sumS('breakfast'), es=sumS('eveningSnacks'), ns=sumS('nightSnacks');
                        const se = yrSundayLunch.reduce((s, r) => s + r.sundayLunch, 0);
                        const lu=sumL('lunch'), di=sumL('dinner');
                        const grand = bf*15+es*15+ns*15+se*10+lu*58+di*58;
                        return (
                          <tr>
                            <td style={tdTot}>Grand Total</td>
                            <td style={tdTot}>{bf||'—'}</td><td style={tdTot}>{bf?`₹${(bf*15).toLocaleString('en-IN')}`:'—'}</td>
                            <td style={tdTot}>{es||'—'}</td><td style={tdTot}>{es?`₹${(es*15).toLocaleString('en-IN')}`:'—'}</td>
                            <td style={tdTot}>{ns||'—'}</td><td style={tdTot}>{ns?`₹${(ns*15).toLocaleString('en-IN')}`:'—'}</td>
                            <td style={tdTot}>{se||'—'}</td><td style={tdTot}>{se?`₹${(se*10).toLocaleString('en-IN')}`:'—'}</td>
                            <td style={{ ...tdTot, background:'#bfdbfe' }}>{lu||'—'}</td><td style={{ ...tdTot, background:'#bfdbfe' }}>{lu?`₹${(lu*58).toLocaleString('en-IN')}`:'—'}</td>
                            <td style={{ ...tdTot, background:'#e2e8f0' }}>{di||'—'}</td><td style={{ ...tdTot, background:'#e2e8f0' }}>{di?`₹${(di*58).toLocaleString('en-IN')}`:'—'}</td>
                            <td style={{ ...tdTot, background:'#bbf7d0' }}>{grand ? fmt(grand) : '—'}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>)}
      </div>
    </div>
  );
}

// HUL Summary Tab
// ============================================================

type YearlyMealRow = { month: number; breakfast: number; lunch: number; eveningSnacks: number; nightSnacks: number; guestBreakfast: number; guestLunch: number; guestEveningSnacks: number; guestNightSnacks: number };
type YearlyExecRow = { month: number; snacks: number; biscuit: number; chips: number; coldDrinkWater: number; shiftOfficerBreakfast: number };

function HulSummaryTab({ month, year }: { month: number; year: number }) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [summaryYear, setSummaryYear] = useState(year);
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set(Array.from({length:12},(_,i)=>i+1)));
  const toggleMonth = (m: number) => setSelectedMonths(prev => { const s = new Set(prev); s.has(m) ? s.delete(m) : s.add(m); return s; });
  const allMonthsSelected = selectedMonths.size === 12;
  const monthLabel = `${MONTHS[month - 1]} - ${year}`;
  const yearLabel = String(summaryYear);

  // Monthly data
  const { data: kpfRows = [], isLoading: kpfLoading } = useQuery<HulRow[]>({
    queryKey: ['/api/hul-date-entries', month, year, 'KPF'],
    enabled: viewMode === 'monthly',
    queryFn: async () => {
      const res = await fetch(`/api/hul-date-entries?month=${month}&year=${year}&location=KPF`, { credentials: 'include' });
      const d = await res.json();
      return d.map((r: HulRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
    },
  });
  const { data: tecRows = [], isLoading: tecLoading } = useQuery<HulRow[]>({
    queryKey: ['/api/hul-date-entries', month, year, 'TEC'],
    enabled: viewMode === 'monthly',
    queryFn: async () => {
      const res = await fetch(`/api/hul-date-entries?month=${month}&year=${year}&location=TEC`, { credentials: 'include' });
      const d = await res.json();
      return d.map((r: HulRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
    },
  });
  const { data: execRows = [], isLoading: execLoading } = useQuery<ExecSnackRow[]>({
    queryKey: ['/api/hul-kpf-exec-snacks', month, year],
    enabled: viewMode === 'monthly',
    queryFn: async () => {
      const res = await fetch(`/api/hul-kpf-exec-snacks?month=${month}&year=${year}`, { credentials: 'include' });
      const d = await res.json();
      return d.map((r: ExecSnackRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
    },
  });

  // Yearly data
  const { data: yrKpf = [], isLoading: yrKpfLoading } = useQuery<YearlyMealRow[]>({
    queryKey: ['/api/hul-date-entries/yearly-summary', summaryYear, 'KPF'],
    enabled: viewMode === 'yearly',
    queryFn: async () => {
      const res = await fetch(`/api/hul-date-entries/yearly-summary?year=${summaryYear}&location=KPF`, { credentials: 'include' });
      return res.json();
    },
  });
  const { data: yrTec = [], isLoading: yrTecLoading } = useQuery<YearlyMealRow[]>({
    queryKey: ['/api/hul-date-entries/yearly-summary', summaryYear, 'TEC'],
    enabled: viewMode === 'yearly',
    queryFn: async () => {
      const res = await fetch(`/api/hul-date-entries/yearly-summary?year=${summaryYear}&location=TEC`, { credentials: 'include' });
      return res.json();
    },
  });
  const { data: yrExec = [], isLoading: yrExecLoading } = useQuery<YearlyExecRow[]>({
    queryKey: ['/api/hul-kpf-exec-snacks/yearly-summary', summaryYear],
    enabled: viewMode === 'yearly',
    queryFn: async () => {
      const res = await fetch(`/api/hul-kpf-exec-snacks/yearly-summary?year=${summaryYear}`, { credentials: 'include' });
      return res.json();
    },
  });

  const isLoading = viewMode === 'monthly'
    ? (kpfLoading || tecLoading || execLoading)
    : (yrKpfLoading || yrTecLoading || yrExecLoading);

  const sum = (arr: any[], field: string) => arr.reduce((s, r) => s + (r[field] || 0), 0);
  const kpfT = { breakfast: sum(kpfRows,'breakfast'), lunch: sum(kpfRows,'lunch'), eveningSnacks: sum(kpfRows,'eveningSnacks'), nightSnacks: sum(kpfRows,'nightSnacks'), guestBreakfast: sum(kpfRows,'guestBreakfast'), guestLunch: sum(kpfRows,'guestLunch'), guestEveningSnacks: sum(kpfRows,'guestEveningSnacks'), guestNightSnacks: sum(kpfRows,'guestNightSnacks') };
  const tecT = { breakfast: sum(tecRows,'breakfast'), lunch: sum(tecRows,'lunch'), eveningSnacks: sum(tecRows,'eveningSnacks'), nightSnacks: sum(tecRows,'nightSnacks'), guestBreakfast: sum(tecRows,'guestBreakfast'), guestLunch: sum(tecRows,'guestLunch'), guestEveningSnacks: sum(tecRows,'guestEveningSnacks'), guestNightSnacks: sum(tecRows,'guestNightSnacks') };
  const exT = { snacks: sum(execRows,'snacks'), biscuit: sum(execRows,'biscuit'), chips: sum(execRows,'chips'), coldDrinkWater: sum(execRows,'coldDrinkWater'), shiftOfficerBreakfast: sum(execRows,'shiftOfficerBreakfast') };

  const thG: React.CSSProperties = { background:'#1a6b2e', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const thB: React.CSSProperties = { background:'#1a3a8a', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const thBr: React.CSSProperties = { background:'#b45309', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const thPurple: React.CSSProperties = { background:'#6b21a8', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:11 };
  const td = (sun?: boolean): React.CSSProperties => ({ background: sun ? '#ffb380' : undefined, border:'1px solid #333', padding:'2px 5px', textAlign:'center', fontSize:10 });
  const tdTot: React.CSSProperties = { background:'#e8f0fe', border:'1px solid #333', padding:'3px 6px', textAlign:'center', fontWeight:'bold', fontSize:10 };

  const MEAL_RATES = [
    { key: 'breakfast', name: 'Breakfast', rate: 35 },
    { key: 'lunch', name: 'Lunch', rate: 50 },
    { key: 'eveningSnacks', name: 'Evening Snacks', rate: 30 },
    { key: 'nightSnacks', name: 'Night Snacks', rate: 17 },
  ];
  const GUEST_RATES = [
    { key: 'guestBreakfast', name: 'Breakfast', rate: 40 },
    { key: 'guestLunch', name: 'Lunch', rate: 70 },
    { key: 'guestEveningSnacks', name: 'Evening Snacks', rate: 40 },
    { key: 'guestNightSnacks', name: 'Night Snacks', rate: 27 },
  ];
  const EXEC_RATES = [
    { key: 'snacks', name: 'Snacks Per Day', rate: 25 },
    { key: 'biscuit', name: 'Biscuit', rate: 10 },
    { key: 'chips', name: 'Chips', rate: 10 },
    { key: 'coldDrinkWater', name: 'Cold Drink & Water', rate: 10 },
    { key: 'shiftOfficerBreakfast', name: 'Shift Officer Breakfast', rate: 40 },
  ];

  const fmtINR = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '—';

  const tdR: React.CSSProperties = { border:'1px solid #ddd', padding:'2px 6px', textAlign:'right', fontSize:10 };
  const tdC: React.CSSProperties = { border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 };
  const tdL: React.CSSProperties = { border:'1px solid #ddd', padding:'2px 8px', textAlign:'left', fontSize:10 };

  const MealTable = ({ rows, locName, hStyle }: { rows: HulRow[]; locName: string; hStyle: React.CSSProperties }) => (
    <div className="mb-5">
      <div className="text-center font-bold text-sm py-1.5" style={{ background: hStyle.background as string, color: '#fff' }}>
        {locName} — Meal Charges &amp; Guest Meal Charges — {monthLabel}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...hStyle, width: 28 }}>Sl.</th>
              <th rowSpan={2} style={{ ...hStyle, width: 80 }}>Date</th>
              <th rowSpan={2} style={{ ...hStyle, width: 34 }}>Days</th>
              <th colSpan={4} style={hStyle}>Meal Charges</th>
              <th colSpan={4} style={thB}>Guest Meal Charges</th>
            </tr>
            <tr>
              {['Breakfast','Lunch','Evng Snacks','Night Snacks'].map(h => <th key={h} style={hStyle}>{h}</th>)}
              {['G.Breakfast','G.Lunch','G.Evng','G.Night'].map(h => <th key={h} style={thB}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const sun = isSunday(row.entryDate);
              return (
                <tr key={i} style={{ background: sun ? '#ffb380' : undefined }}>
                  <td style={td(sun)}>{i+1}</td>
                  <td style={td(sun)}>{safeFormat(row.entryDate)}</td>
                  <td style={td(sun)}>{row.weekDay}</td>
                  {(['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'] as (keyof HulRow)[]).map(f => (
                    <td key={f as string} style={td(sun)}>{row[f] || ''}</td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td colSpan={3} style={tdTot}>Total</td>
              {(['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'] as (keyof HulRow)[]).map(f => (
                <td key={f as string} style={tdTot}>{rows.reduce((s,r) => s+(r[f]||0), 0) || ''}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="block md:hidden space-y-1 mt-1">
        {rows.map((row, i) => (
          <div key={i} className="border rounded p-2 text-xs" style={{ background: isSunday(row.entryDate) ? '#ffb380' : '#f9fafb' }}>
            <div className="font-semibold">{safeFormat(row.entryDate)} ({row.weekDay})</div>
            <div className="grid grid-cols-2 gap-x-3 mt-0.5">
              <span>Breakfast: <b>{row.breakfast||0}</b></span><span>Lunch: <b>{row.lunch||0}</b></span>
              <span>Evng: <b>{row.eveningSnacks||0}</b></span><span>Night: <b>{row.nightSnacks||0}</b></span>
              <span>G.Breakfast: <b>{row.guestBreakfast||0}</b></span><span>G.Lunch: <b>{row.guestLunch||0}</b></span>
              <span>G.Evng: <b>{row.guestEveningSnacks||0}</b></span><span>G.Night: <b>{row.guestNightSnacks||0}</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>HUL Summary ${monthLabel}</title><style>
      *{box-sizing:border-box;}body{font-family:"Times New Roman",Times,serif;margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:4px;margin-bottom:10px;}
      th,td{border:1px solid #333;padding:2px 4px;text-align:center;font-size:10pt;}
      @media print{@page{margin:5mm;size:A4 landscape;}body{margin:0;}}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
      const mkFill = (argb: string) => ({ type:'pattern' as const, pattern:'solid' as const, fgColor:{argb} });
      const wFont = { bold:true, color:{argb:'FFFFFFFF'} };

      // ===== YEARLY EXPORT =====
      if (viewMode === 'yearly') {
        const filtKpfEx = yrKpf.filter(r => selectedMonths.has(r.month));
        const filtTecEx = yrTec.filter(r => selectedMonths.has(r.month));
        const filtExecEx = yrExec.filter(r => selectedMonths.has(r.month));
        const visMths = Array.from({length:12},(_,i)=>i+1).filter(m => selectedMonths.has(m));

        const makeMealYrSheet = (ws: any, loc: string, filtData: YearlyMealRow[], hArgb: string) => {
          const cols = ['Month','Breakfast','Lunch','Evng Snacks','Night Snacks','Meal Sub (₹)','G.Breakfast','G.Lunch','G.Evng Snacks','G.Night Snacks','Guest Sub (₹)','Grand Total (₹)'];
          ws.mergeCells(1,1,1,cols.length);
          const t=ws.getCell('A1'); t.value=`HUL ${loc} — Rate Wise Yearly Summary — ${summaryYear}`; t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill(hArgb); t.alignment={horizontal:'center'}; t.border=thin;
          const hdr=ws.addRow(cols); hdr.eachCell((c:any)=>{c.font=wFont;c.fill=mkFill(hArgb);c.border=thin;c.alignment={horizontal:'center'};});
          ws.columns=cols.map((_:any,i:number)=>({width:i===0?14:14}));
          visMths.forEach(m=>{
            const r=filtData.find(x=>x.month===m);
            const bf=r?.breakfast||0,ln=r?.lunch||0,es=r?.eveningSnacks||0,ns=r?.nightSnacks||0;
            const gbf=r?.guestBreakfast||0,gln=r?.guestLunch||0,ges=r?.guestEveningSnacks||0,gns=r?.guestNightSnacks||0;
            const mSub=bf*35+ln*50+es*30+ns*17,gSub=gbf*40+gln*70+ges*40+gns*27;
            const dr=ws.addRow([MONTHS[m-1],bf||'',ln||'',es||'',ns||'',mSub||'',gbf||'',gln||'',ges||'',gns||'',gSub||'',(mSub+gSub)||'']);
            dr.eachCell((c:any)=>{c.border=thin;c.alignment={horizontal:'center'};});
          });
          const tbf=filtData.reduce((s,r)=>s+(r.breakfast||0),0),tln=filtData.reduce((s,r)=>s+(r.lunch||0),0);
          const tes=filtData.reduce((s,r)=>s+(r.eveningSnacks||0),0),tns=filtData.reduce((s,r)=>s+(r.nightSnacks||0),0);
          const tgbf=filtData.reduce((s,r)=>s+(r.guestBreakfast||0),0),tgln=filtData.reduce((s,r)=>s+(r.guestLunch||0),0);
          const tges=filtData.reduce((s,r)=>s+(r.guestEveningSnacks||0),0),tgns=filtData.reduce((s,r)=>s+(r.guestNightSnacks||0),0);
          const tmSub=tbf*35+tln*50+tes*30+tns*17,tgSub=tgbf*40+tgln*70+tges*40+tgns*27;
          const tot=ws.addRow(['GRAND TOTAL',tbf||'',tln||'',tes||'',tns||'',tmSub||'',tgbf||'',tgln||'',tges||'',tgns||'',tgSub||'',(tmSub+tgSub)||'']);
          tot.eachCell((c:any)=>{c.font={bold:true};c.fill=mkFill('FFFFF2CC');c.border=thin;c.alignment={horizontal:'center'};});
        };

        const makeExecYrSheet = (ws: any, filtData: YearlyExecRow[]) => {
          const cols = ['Month','Snacks Qty','Snacks Amt (₹)','Biscuit Qty','Biscuit Amt (₹)','Chips Qty','Chips Amt (₹)','Cold Drink & Water Qty','Cold Drink & Water Amt (₹)','Shift Officer Breakfast Qty','Shift Officer Breakfast Amt (₹)','Grand Total (₹)'];
          ws.mergeCells(1,1,1,cols.length);
          const t=ws.getCell('A1'); t.value=`HUL KPF Exec Snacks — Rate Wise Yearly Summary — ${summaryYear}`; t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill('FFB45309'); t.alignment={horizontal:'center'}; t.border=thin;
          const hdr=ws.addRow(cols); hdr.eachCell((c:any)=>{c.font=wFont;c.fill=mkFill('FFB45309');c.border=thin;c.alignment={horizontal:'center'};});
          ws.columns=cols.map((_:any,i:number)=>({width:i===0?14:16}));
          visMths.forEach(m=>{
            const r=filtData.find(x=>x.month===m);
            const sn=r?.snacks||0,bi=r?.biscuit||0,ch=r?.chips||0,cw=r?.coldDrinkWater||0,sob=r?.shiftOfficerBreakfast||0;
            const grand=sn*25+bi*10+ch*10+cw*10+sob*40;
            const dr=ws.addRow([MONTHS[m-1],sn||'',sn?sn*25:'',bi||'',bi?bi*10:'',ch||'',ch?ch*10:'',cw||'',cw?cw*10:'',sob||'',sob?sob*40:'',grand||'']);
            dr.eachCell((c:any)=>{c.border=thin;c.alignment={horizontal:'center'};});
          });
          const tsn=filtData.reduce((s,r)=>s+(r.snacks||0),0),tbi=filtData.reduce((s,r)=>s+(r.biscuit||0),0);
          const tch=filtData.reduce((s,r)=>s+(r.chips||0),0),tcw=filtData.reduce((s,r)=>s+(r.coldDrinkWater||0),0);
          const tsob=filtData.reduce((s,r)=>s+(r.shiftOfficerBreakfast||0),0);
          const tg=tsn*25+tbi*10+tch*10+tcw*10+tsob*40;
          const tot=ws.addRow(['GRAND TOTAL',tsn||'',tsn?tsn*25:'',tbi||'',tbi?tbi*10:'',tch||'',tch?tch*10:'',tcw||'',tcw?tcw*10:'',tsob||'',tsob?tsob*40:'',tg||'']);
          tot.eachCell((c:any)=>{c.font={bold:true};c.fill=mkFill('FFFFF2CC');c.border=thin;c.alignment={horizontal:'center'};});
        };

        makeMealYrSheet(wb.addWorksheet('KPF'), 'KPF', filtKpfEx, 'FF1A6B2E');
        makeMealYrSheet(wb.addWorksheet('TEC'), 'TEC', filtTecEx, 'FF1A3A8A');
        makeExecYrSheet(wb.addWorksheet('KPF Exec Snacks'), filtExecEx);

        // ---- Combined Summary Sheet ----
        const wsSumm = wb.addWorksheet('Combined Summary');
        const summCols = [
          'Month',
          'KPF Breakfast','KPF Lunch','KPF Evng Snacks','KPF Night Snacks','KPF Meal Sub (₹)',
          'KPF G.Bfast','KPF G.Lunch','KPF G.Evng','KPF G.Night','KPF Guest Sub (₹)','KPF Total (₹)',
          'TEC Breakfast','TEC Lunch','TEC Evng Snacks','TEC Night Snacks','TEC Meal Sub (₹)',
          'TEC G.Bfast','TEC G.Lunch','TEC G.Evng','TEC G.Night','TEC Guest Sub (₹)','TEC Total (₹)',
          'Exec Snacks','Exec Biscuit','Exec Chips','Exec Cold Drink & Water','Exec Shift Officer Breakfast','Exec Total (₹)',
          'Grand Total (₹)',
        ];
        wsSumm.mergeCells(1,1,1,summCols.length);
        const sTit = wsSumm.getCell('A1');
        sTit.value = `HUL Combined Yearly Summary — ${summaryYear}`;
        sTit.font={bold:true,size:13,color:{argb:'FFFFFFFF'}}; sTit.fill=mkFill('FF374151'); sTit.alignment={horizontal:'center'}; sTit.border=thin;
        // Sub-header groups
        wsSumm.mergeCells(2,1,2,1);
        [[2,12,'FF1A6B2E','KPF — Meal & Guest'],[13,23,'FF1A3A8A','TEC — Meal & Guest'],[24,29,'FFB45309','KPF Exec Snacks'],[30,30,'FF374151','']].forEach(([s,e,c,label])=>{
          if (label) { wsSumm.mergeCells(2,Number(s),2,Number(e)); const cell=wsSumm.getCell(2,Number(s)); cell.value=label; cell.font=wFont; cell.fill=mkFill(c as string); cell.alignment={horizontal:'center'}; cell.border=thin; }
          else { const cell=wsSumm.getCell(2,Number(s)); cell.fill=mkFill(c as string); cell.border=thin; }
        });
        const summHdr = wsSumm.addRow(summCols);
        summHdr.eachCell((c:any,ci:number)=>{
          const argb = ci<=12?'FF1A6B2E':ci<=23?'FF1A3A8A':ci<=29?'FFB45309':'FF374151';
          c.font=wFont; c.fill=mkFill(argb); c.border=thin; c.alignment={horizontal:'center',wrapText:true};
        });
        wsSumm.getRow(3).height=32;
        wsSumm.columns = summCols.map((_,i)=>({width:i===0?14:16}));

        // Grand totals accumulators
        let gKpfMeal=0,gKpfGuest=0,gTecMeal=0,gTecGuest=0,gExec=0;
        visMths.forEach(m=>{
          const kpf=filtKpfEx.find(r=>r.month===m);
          const tec=filtTecEx.find(r=>r.month===m);
          const exc=filtExecEx.find(r=>r.month===m);
          const kbf=kpf?.breakfast||0,kln=kpf?.lunch||0,kes=kpf?.eveningSnacks||0,kns=kpf?.nightSnacks||0;
          const kgbf=kpf?.guestBreakfast||0,kgln=kpf?.guestLunch||0,kges=kpf?.guestEveningSnacks||0,kgns=kpf?.guestNightSnacks||0;
          const kMeal=kbf*35+kln*50+kes*30+kns*17, kGuest=kgbf*40+kgln*70+kges*40+kgns*27;
          const tbf=tec?.breakfast||0,tln=tec?.lunch||0,tes=tec?.eveningSnacks||0,tns=tec?.nightSnacks||0;
          const tgbf=tec?.guestBreakfast||0,tgln=tec?.guestLunch||0,tges=tec?.guestEveningSnacks||0,tgns=tec?.guestNightSnacks||0;
          const tMeal=tbf*35+tln*50+tes*30+tns*17, tGuest=tgbf*40+tgln*70+tges*40+tgns*27;
          const esn=exc?.snacks||0,ebi=exc?.biscuit||0,ech=exc?.chips||0,ecw=exc?.coldDrinkWater||0,esob=exc?.shiftOfficerBreakfast||0;
          const eTotal=esn*25+ebi*10+ech*10+ecw*10+esob*40;
          const grand=kMeal+kGuest+tMeal+tGuest+eTotal;
          gKpfMeal+=kMeal; gKpfGuest+=kGuest; gTecMeal+=tMeal; gTecGuest+=tGuest; gExec+=eTotal;
          const dr=wsSumm.addRow([
            MONTHS[m-1],
            kbf||'',kln||'',kes||'',kns||'',kMeal||'',
            kgbf||'',kgln||'',kges||'',kgns||'',kGuest||'',kMeal+kGuest||'',
            tbf||'',tln||'',tes||'',tns||'',tMeal||'',
            tgbf||'',tgln||'',tges||'',tgns||'',tGuest||'',tMeal+tGuest||'',
            esn||'',ebi||'',ech||'',ecw||'',esob||'',eTotal||'',
            grand||'',
          ]);
          dr.eachCell((c:any)=>{c.border=thin;c.alignment={horizontal:'center'};});
        });
        const gKpf=gKpfMeal+gKpfGuest, gTec=gTecMeal+gTecGuest, gGrand=gKpf+gTec+gExec;
        const totR=wsSumm.addRow(['GRAND TOTAL','','','','',gKpfMeal||'','','','','',gKpfGuest||'',gKpf||'','','','','',gTecMeal||'','','','','',gTecGuest||'',gTec||'','','','','','',gExec||'',gGrand||'']);
        totR.eachCell((c:any)=>{c.font={bold:true};c.fill=mkFill('FFFFF2CC');c.border=thin;c.alignment={horizontal:'center'};});

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
        a.download=`HUL_Yearly_Summary_${summaryYear}.xlsx`; a.click();
        return;
      }

      // ===== MONTHLY EXPORT =====
      const makeMealSheet = (ws: any, loc: string, rows: HulRow[]) => {
        ws.mergeCells('A1:K1');
        const t = ws.getCell('A1');
        t.value = `HUL ${loc} — Meal Charges & Guest Meal Charges — ${monthLabel}`;
        t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill('FF1A6B2E'); t.alignment={horizontal:'center'}; t.border=thin;
        ws.mergeCells('A2:C2'); ws.getCell('A2').fill=mkFill('FF1A6B2E'); ws.getCell('A2').border=thin;
        ws.mergeCells('D2:G2'); const mc=ws.getCell('D2'); mc.value='Meal Charges'; mc.font=wFont; mc.fill=mkFill('FF1A6B2E'); mc.alignment={horizontal:'center'}; mc.border=thin;
        ws.mergeCells('H2:K2'); const gc=ws.getCell('H2'); gc.value='Guest Meal Charges'; gc.font=wFont; gc.fill=mkFill('FF1A3A8A'); gc.alignment={horizontal:'center'}; gc.border=thin;
        const hdr = ws.addRow(['Sl.','Date','Days','Breakfast','Lunch','Evng Snacks','Night Snacks','G.Breakfast','G.Lunch','G.Evng Snacks','G.Night Snacks']);
        hdr.eachCell((cell: any, ci: number) => { cell.font=wFont; cell.fill=mkFill(ci<=7?'FF1A6B2E':'FF1A3A8A'); cell.border=thin; cell.alignment={horizontal:'center'}; });
        ws.columns=[5,14,8,11,11,13,13,14,12,15,15].map((w: number)=>({width:w}));
        rows.forEach((r, i) => {
          const dr = ws.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.breakfast||'', r.lunch||'', r.eveningSnacks||'', r.nightSnacks||'', r.guestBreakfast||'', r.guestLunch||'', r.guestEveningSnacks||'', r.guestNightSnacks||'']);
          if (isSunday(r.entryDate)) dr.eachCell((c: any) => { c.fill=mkFill('FFFFA500'); });
          dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
        });
        const totRow = ws.addRow(['','Total','', sum(rows,'breakfast')||'', sum(rows,'lunch')||'', sum(rows,'eveningSnacks')||'', sum(rows,'nightSnacks')||'', sum(rows,'guestBreakfast')||'', sum(rows,'guestLunch')||'', sum(rows,'guestEveningSnacks')||'', sum(rows,'guestNightSnacks')||'']);
        totRow.eachCell((c: any) => { c.font={bold:true}; c.fill=mkFill('FFE8F0FE'); c.border=thin; c.alignment={horizontal:'center'}; });
      };

      makeMealSheet(wb.addWorksheet('KPF'), 'KPF', kpfRows);
      makeMealSheet(wb.addWorksheet('TEC'), 'TEC', tecRows);

      const wsExec = wb.addWorksheet('KPF Exec Snacks');
      wsExec.mergeCells('A1:G1');
      const et = wsExec.getCell('A1');
      et.value = `HUL KPF Exec Snacks — Number of Snacks Per Day For Executives & Managers — ${monthLabel}`;
      et.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; et.fill=mkFill('FFB45309'); et.alignment={horizontal:'center'}; et.border=thin;
      const eHdr = wsExec.addRow(['Sl.','Date','Days','Snacks','Biscuit','Chips','Cold Drink & Water']);
      eHdr.eachCell((c: any) => { c.font=wFont; c.fill=mkFill('FFB45309'); c.border=thin; c.alignment={horizontal:'center'}; });
      wsExec.columns=[5,14,8,10,10,10,16].map((w: number)=>({width:w}));
      execRows.forEach((r, i) => {
        const dr = wsExec.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.snacks||'', r.biscuit||'', r.chips||'', r.coldDrinkWater||'']);
        if (isSunday(r.entryDate)) dr.eachCell((c: any) => { c.fill=mkFill('FFFFA500'); });
        dr.eachCell((c: any) => { c.border=thin; c.alignment={horizontal:'center'}; });
      });
      const etot = wsExec.addRow(['','Total','', exT.snacks||'', exT.biscuit||'', exT.chips||'', exT.coldDrinkWater||'']);
      etot.eachCell((c: any) => { c.font={bold:true}; c.fill=mkFill('FFE8F0FE'); c.border=thin; c.alignment={horizontal:'center'}; });

      const wsSumm = wb.addWorksheet('Summary');
      wsSumm.mergeCells('A1:M1');
      const st = wsSumm.getCell('A1');
      st.value = `HUL Combined Summary Report — ${monthLabel}`;
      st.font={bold:true,size:13,color:{argb:'FFFFFFFF'}}; st.fill=mkFill('FF1A6B2E'); st.alignment={horizontal:'center'}; st.border=thin;
      const sHdr = wsSumm.addRow(['Section','Breakfast','Lunch','Evng Snacks','Night Snacks','G.Breakfast','G.Lunch','G.Evng Snacks','G.Night Snacks','Snacks','Biscuit','Chips','Cold Drink & Water']);
      sHdr.eachCell((c: any, ci: number) => { c.font=wFont; c.fill=mkFill(ci<=5?'FF1A6B2E':ci<=9?'FF1A3A8A':'FFB45309'); c.border=thin; c.alignment={horizontal:'center'}; });
      const sRows = [
        ['KPF',kpfT.breakfast||'',kpfT.lunch||'',kpfT.eveningSnacks||'',kpfT.nightSnacks||'',kpfT.guestBreakfast||'',kpfT.guestLunch||'',kpfT.guestEveningSnacks||'',kpfT.guestNightSnacks||'','—','—','—','—'],
        ['TEC',tecT.breakfast||'',tecT.lunch||'',tecT.eveningSnacks||'',tecT.nightSnacks||'',tecT.guestBreakfast||'',tecT.guestLunch||'',tecT.guestEveningSnacks||'',tecT.guestNightSnacks||'','—','—','—','—'],
        ['KPF Exec Snacks','—','—','—','—','—','—','—','—',exT.snacks||'',exT.biscuit||'',exT.chips||'',exT.coldDrinkWater||''],
      ];
      const sFills = ['FFD1FAE5','FFDBEAFE','FFFEF9C3'];
      sRows.forEach((r, i) => {
        const row = wsSumm.addRow(r);
        row.eachCell((c: any) => { c.fill=mkFill(sFills[i]); c.border=thin; c.alignment={horizontal:'center'}; });
        wsSumm.getCell(row.number,1).font={bold:true};
      });
      wsSumm.columns=[18,12,12,13,13,14,12,15,15,12,12,10,16].map((w: number)=>({width:w}));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`HUL_Summary_${MONTHS[month-1]}_${year}.xlsx`; a.click();
    } catch (err: any) { toast({ title:'Export Failed', description:err.message, variant:'destructive' }); }
  };

  return (
    <div>
      {/* View Toggle + Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-md overflow-hidden border border-gray-300 text-sm">
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'monthly' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            data-testid="btn-summary-monthly">
            Monthly
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${viewMode === 'yearly' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            data-testid="btn-summary-yearly">
            Yearly
          </button>
        </div>
        {viewMode === 'yearly' && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500">Year:</span>
            <select
              value={summaryYear}
              onChange={e => setSummaryYear(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              data-testid="select-summary-year">
              {Array.from({ length: 6 }, (_, i) => year - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
        {viewMode === 'monthly' && <span className="text-sm font-semibold text-gray-600">HUL Monthly Summary — {monthLabel}</span>}
        {viewMode === 'yearly' && <span className="text-sm font-semibold text-gray-600">HUL Yearly Summary — {yearLabel}</span>}
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-9" data-testid="btn-hul-summary-print">
            <Printer className="w-3.5 h-3.5 mr-1"/>Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel} className="h-9 text-green-700 border-green-300 hover:bg-green-50" data-testid="btn-hul-summary-export">
            <FileDown className="w-3.5 h-3.5 mr-1"/>Export Excel
          </Button>
        </div>
      </div>

      {/* Month filter — yearly mode only */}
      {viewMode === 'yearly' && (
        <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/40 border mb-4">
          <span className="text-xs font-semibold text-muted-foreground self-center mr-1">Filter Months:</span>
          <button onClick={()=>setSelectedMonths(allMonthsSelected?new Set():new Set(Array.from({length:12},(_,i)=>i+1)))}
            className={`px-2 py-0.5 rounded text-xs font-medium border ${allMonthsSelected?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            data-testid="btn-hul-month-all">All</button>
          {MONTHS.map((mn,i)=>(
            <button key={i} onClick={()=>toggleMonth(i+1)}
              className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${selectedMonths.has(i+1)?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              data-testid={`btn-hul-month-${i+1}`}>{mn.slice(0,3)}</button>
          ))}
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Loading...</div>}

      {/* ===================== YEARLY VIEW ===================== */}
      {!isLoading && viewMode === 'yearly' && (() => {
        const mealFields: (keyof YearlyMealRow)[] = ['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'];
        const mealHeaders = ['Breakfast','Lunch','Evng Snacks','Night Snacks','G.Breakfast','G.Lunch','G.Evng Snacks','G.Night Snacks'];
        const execFields: (keyof YearlyExecRow)[] = ['snacks','biscuit','chips','coldDrinkWater','shiftOfficerBreakfast'];
        const execHeaders = ['Snacks','Biscuit','Chips','Cold Drink & Water','Shift Officer Breakfast'];

        const YearlyTable = ({ data, fields, headers, locName, hStyle, guestStart }: {
          data: any[]; fields: string[]; headers: string[]; locName: string;
          hStyle: React.CSSProperties; guestStart?: number;
        }) => {
          const filteredData = data.filter(r => selectedMonths.has(r.month));
          const totals = fields.reduce((acc, f) => ({ ...acc, [f]: filteredData.reduce((s, r) => s + (r[f] || 0), 0) }), {} as Record<string,number>);
          const visibleMonths = Array.from({length:12},(_,i)=>i+1).filter(m => selectedMonths.has(m));
          return (
            <div className="mb-5">
              <div className="text-center font-bold text-sm py-1.5" style={{ background: hStyle.background as string, color:'#fff' }}>
                {locName} — {yearLabel}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...hStyle, width:90, textAlign:'left', paddingLeft:8 }}>Month</th>
                      {headers.map((h, i) => <th key={i} style={guestStart !== undefined && i >= guestStart ? thB : hStyle}>{h}</th>)}
                      <th style={{ ...hStyle, background:'#374151' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMonths.map((m, idx) => {
                      const mi = m - 1; const mName = MONTHS[mi];
                      const row = data.find(r => r.month === m);
                      const vals = fields.map(f => row ? (row[f] || 0) : 0);
                      const rowTotal = vals.reduce((s, v) => s + v, 0);
                      if (!row && rowTotal === 0) return (
                        <tr key={m} style={{ background: idx % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                          {fields.map((_, fi) => <td key={fi} style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10, color:'#ccc' }}>—</td>)}
                          <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10, color:'#ccc' }}>—</td>
                        </tr>
                      );
                      return (
                        <tr key={m} style={{ background: idx % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 6px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                          {vals.map((v, fi) => <td key={fi} style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10 }}>{v || ''}</td>)}
                          <td style={{ border:'1px solid #ddd', padding:'2px 5px', textAlign:'center', fontSize:10, fontWeight:'bold', background:'#f0fdf4' }}>{rowTotal || ''}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={tdTot}>Grand Total</td>
                      {fields.map((f, fi) => <td key={fi} style={tdTot}>{totals[f] || ''}</td>)}
                      <td style={{ ...tdTot, background:'#bbf7d0' }}>{Object.values(totals).reduce((s, v) => s + v, 0) || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        };

        const filtKpf = yrKpf.filter(r => selectedMonths.has(r.month));
        const filtTec = yrTec.filter(r => selectedMonths.has(r.month));
        const filtExec = yrExec.filter(r => selectedMonths.has(r.month));
        const yrKpfT = mealFields.reduce((a, f) => ({ ...a, [f]: filtKpf.reduce((s, r) => s + (r[f] || 0), 0) }), {} as Record<string,number>);
        const yrTecT = mealFields.reduce((a, f) => ({ ...a, [f]: filtTec.reduce((s, r) => s + (r[f] || 0), 0) }), {} as Record<string,number>);
        const yrExT = execFields.reduce((a, f) => ({ ...a, [f]: filtExec.reduce((s, r) => s + (r[f] || 0), 0) }), {} as Record<string,number>);
        const visibleMonthsList = Array.from({length:12},(_,i)=>i+1).filter(m => selectedMonths.has(m));

        return (
          <>
            <YearlyTable data={yrKpf} fields={mealFields as string[]} headers={mealHeaders} locName="KPF — Meal Charges & Guest Meal Charges" hStyle={thG} guestStart={4} />
            <YearlyTable data={yrTec} fields={mealFields as string[]} headers={mealHeaders} locName="TEC — Meal Charges & Guest Meal Charges" hStyle={thB} />
            <YearlyTable data={yrExec} fields={execFields as string[]} headers={execHeaders} locName="KPF Exec Snacks — Snacks Per Day For Executives & Managers" hStyle={thBr} />

            {/* Yearly Combined Totals */}
            <div className="border rounded-lg overflow-hidden mb-4">
              <div className="bg-gray-800 text-white px-3 py-2 text-sm font-bold text-center">Combined Yearly Totals — {yearLabel}</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thG, textAlign:'left', paddingLeft:8, minWidth:110 }}>Section</th>
                      {['Breakfast','Lunch','Evng Snacks','Night Snacks'].map(h=><th key={h} style={thG}>{h}</th>)}
                      {['G.Breakfast','G.Lunch','G.Evng','G.Night'].map(h=><th key={h} style={thB}>{h}</th>)}
                      {['Snacks','Biscuit','Chips','Cold Drink'].map(h=><th key={h} style={thBr}>{h}</th>)}
                      <th style={{ ...thG, background:'#374151' }}>Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background:'#d1fae5' }}>
                      <td style={{ ...tdTot, textAlign:'left', paddingLeft:8 }}>KPF</td>
                      {mealFields.map(f=><td key={f as string} style={tdTot}>{yrKpfT[f as string]||'—'}</td>)}
                      {execFields.map(f=><td key={f as string} style={tdTot}>—</td>)}
                      <td style={{ ...tdTot, fontWeight:'bold' }}>{Object.values(yrKpfT).reduce((s,v)=>s+v,0)||'—'}</td>
                    </tr>
                    <tr style={{ background:'#dbeafe' }}>
                      <td style={{ ...tdTot, textAlign:'left', paddingLeft:8 }}>TEC</td>
                      {mealFields.map(f=><td key={f as string} style={tdTot}>{yrTecT[f as string]||'—'}</td>)}
                      {execFields.map(f=><td key={f as string} style={tdTot}>—</td>)}
                      <td style={{ ...tdTot, fontWeight:'bold' }}>{Object.values(yrTecT).reduce((s,v)=>s+v,0)||'—'}</td>
                    </tr>
                    <tr style={{ background:'#fef9c3' }}>
                      <td style={{ ...tdTot, textAlign:'left', paddingLeft:8 }}>KPF Exec Snacks</td>
                      {mealFields.map(f=><td key={f as string} style={tdTot}>—</td>)}
                      {execFields.map(f=><td key={f as string} style={tdTot}>{yrExT[f as string]||'—'}</td>)}
                      <td style={{ ...tdTot, fontWeight:'bold' }}>{Object.values(yrExT).reduce((s,v)=>s+v,0)||'—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== YEARLY RATE WISE SUMMARY ===== */}
            {[
              { label:'KPF', data: yrKpf, hStyle: thG },
              { label:'TEC', data: yrTec, hStyle: thB },
            ].map(({ label, data, hStyle }) => {
              const thH = (extra?: object): React.CSSProperties => ({ ...hStyle, ...extra, fontSize:10, padding:'3px 5px' });
              const filtData = data.filter((r: any) => selectedMonths.has(r.month));
              const grandTotRow = (() => {
                const bf = filtData.reduce((s:number,r:any)=>s+(r.breakfast||0),0);
                const ln = filtData.reduce((s:number,r:any)=>s+(r.lunch||0),0);
                const es = filtData.reduce((s:number,r:any)=>s+(r.eveningSnacks||0),0);
                const ns = filtData.reduce((s:number,r:any)=>s+(r.nightSnacks||0),0);
                const gbf = filtData.reduce((s:number,r:any)=>s+(r.guestBreakfast||0),0);
                const gln = filtData.reduce((s:number,r:any)=>s+(r.guestLunch||0),0);
                const ges = filtData.reduce((s:number,r:any)=>s+(r.guestEveningSnacks||0),0);
                const gns = filtData.reduce((s:number,r:any)=>s+(r.guestNightSnacks||0),0);
                const mealSub = bf*35+ln*50+es*30+ns*17;
                const guestSub = gbf*40+gln*70+ges*40+gns*27;
                return { bf,ln,es,ns,gbf,gln,ges,gns,mealSub,guestSub };
              })();
              return (
                <div key={label} className="border rounded-lg overflow-hidden mb-4">
                  <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#6b21a8' }}>
                    {label} — Rate Wise Yearly Summary — {yearLabel}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize:10 }}>
                      <thead>
                        <tr>
                          <th style={{ ...hStyle, textAlign:'left', paddingLeft:6, width:80, fontSize:10, padding:'3px 5px' }}>Month</th>
                          <th colSpan={2} style={thH()}>Breakfast (×₹35)</th>
                          <th colSpan={2} style={thH()}>Lunch (×₹50)</th>
                          <th colSpan={2} style={thH()}>Eve.Snk (×₹30)</th>
                          <th colSpan={2} style={thH()}>Night.Snk (×₹17)</th>
                          <th style={thH({ background:'#14532d' })}>Meal Sub</th>
                          <th colSpan={2} style={{ ...thB, fontSize:10, padding:'3px 5px' }}>G.Brkfst (×₹40)</th>
                          <th colSpan={2} style={{ ...thB, fontSize:10, padding:'3px 5px' }}>G.Lunch (×₹70)</th>
                          <th colSpan={2} style={{ ...thB, fontSize:10, padding:'3px 5px' }}>G.Eve (×₹40)</th>
                          <th colSpan={2} style={{ ...thB, fontSize:10, padding:'3px 5px' }}>G.Night (×₹27)</th>
                          <th style={{ ...thB, background:'#1e3a8a', fontSize:10, padding:'3px 5px' }}>Guest Sub</th>
                          <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'3px 5px', textAlign:'center', fontWeight:'bold', fontSize:10 }}>Grand Total</th>
                        </tr>
                        <tr>
                          <th style={{ ...hStyle, textAlign:'left', paddingLeft:6, fontSize:9, padding:'2px 4px' }}></th>
                          {['Qty','Amt','Qty','Amt','Qty','Amt','Qty','Amt'].map((h,i)=><th key={i} style={thH({ fontSize:9, padding:'2px 4px' })}>{h}</th>)}
                          <th style={thH({ background:'#14532d', fontSize:9, padding:'2px 4px' })}></th>
                          {['Qty','Amt','Qty','Amt','Qty','Amt','Qty','Amt'].map((h,i)=><th key={i} style={{ ...thB, fontSize:9, padding:'2px 4px' }}>{h}</th>)}
                          <th style={{ ...thB, background:'#1e3a8a', fontSize:9, padding:'2px 4px' }}></th>
                          <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'2px 4px', fontSize:9 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMonthsList.map((m, idx) => {
                          const mi = m - 1; const mName = MONTHS[mi];
                          const row = data.find((r:any) => r.month === m);
                          const bf = row?.breakfast||0, ln = row?.lunch||0, es = row?.eveningSnacks||0, ns = row?.nightSnacks||0;
                          const gbf = row?.guestBreakfast||0, gln = row?.guestLunch||0, ges = row?.guestEveningSnacks||0, gns = row?.guestNightSnacks||0;
                          const mealSub = bf*35+ln*50+es*30+ns*17;
                          const guestSub = gbf*40+gln*70+ges*40+gns*27;
                          const bg = idx%2===0 ? '#f9fafb' : '#fff';
                          const fmt = (n: number) => n ? n.toLocaleString('en-IN') : '';
                          if (!row) return (
                            <tr key={m} style={{ background: bg }}>
                              <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                              {Array.from({length:19},(_,i)=><td key={i} style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10, color:'#ccc' }}>—</td>)}
                            </tr>
                          );
                          return (
                            <tr key={m} style={{ background: bg }}>
                              <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                              <td style={tdC}>{bf||''}</td><td style={tdR}>{fmt(bf*35)}</td>
                              <td style={tdC}>{ln||''}</td><td style={tdR}>{fmt(ln*50)}</td>
                              <td style={tdC}>{es||''}</td><td style={tdR}>{fmt(es*30)}</td>
                              <td style={tdC}>{ns||''}</td><td style={tdR}>{fmt(ns*17)}</td>
                              <td style={{ ...tdR, background:'#f0fdf4', fontWeight:'bold' }}>{fmt(mealSub)}</td>
                              <td style={tdC}>{gbf||''}</td><td style={tdR}>{fmt(gbf*40)}</td>
                              <td style={tdC}>{gln||''}</td><td style={tdR}>{fmt(gln*70)}</td>
                              <td style={tdC}>{ges||''}</td><td style={tdR}>{fmt(ges*40)}</td>
                              <td style={tdC}>{gns||''}</td><td style={tdR}>{fmt(gns*27)}</td>
                              <td style={{ ...tdR, background:'#eff6ff', fontWeight:'bold' }}>{fmt(guestSub)}</td>
                              <td style={{ ...tdR, background:'#f0fdf4', fontWeight:'bold' }}>{fmt(mealSub+guestSub)}</td>
                            </tr>
                          );
                        })}
                        <tr>
                          <td style={tdTot}>Grand Total</td>
                          <td style={tdTot}>{grandTotRow.bf||'—'}</td><td style={{ ...tdTot }}>{grandTotRow.bf ? grandTotRow.bf*35 > 0 ? grandTotRow.bf*35 : '' : '—'}</td>
                          <td style={tdTot}>{grandTotRow.ln||'—'}</td><td style={tdTot}>{grandTotRow.ln ? grandTotRow.ln*50 : '—'}</td>
                          <td style={tdTot}>{grandTotRow.es||'—'}</td><td style={tdTot}>{grandTotRow.es ? grandTotRow.es*30 : '—'}</td>
                          <td style={tdTot}>{grandTotRow.ns||'—'}</td><td style={tdTot}>{grandTotRow.ns ? grandTotRow.ns*17 : '—'}</td>
                          <td style={{ ...tdTot, background:'#bbf7d0' }}>{grandTotRow.mealSub ? `₹${grandTotRow.mealSub.toLocaleString('en-IN')}` : '—'}</td>
                          <td style={tdTot}>{grandTotRow.gbf||'—'}</td><td style={tdTot}>{grandTotRow.gbf ? grandTotRow.gbf*40 : '—'}</td>
                          <td style={tdTot}>{grandTotRow.gln||'—'}</td><td style={tdTot}>{grandTotRow.gln ? grandTotRow.gln*70 : '—'}</td>
                          <td style={tdTot}>{grandTotRow.ges||'—'}</td><td style={tdTot}>{grandTotRow.ges ? grandTotRow.ges*40 : '—'}</td>
                          <td style={tdTot}>{grandTotRow.gns||'—'}</td><td style={tdTot}>{grandTotRow.gns ? grandTotRow.gns*27 : '—'}</td>
                          <td style={{ ...tdTot, background:'#bfdbfe' }}>{grandTotRow.guestSub ? `₹${grandTotRow.guestSub.toLocaleString('en-IN')}` : '—'}</td>
                          <td style={{ ...tdTot, background:'#bbf7d0' }}>{(grandTotRow.mealSub+grandTotRow.guestSub) ? `₹${(grandTotRow.mealSub+grandTotRow.guestSub).toLocaleString('en-IN')}` : '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* KPF Exec Snacks Yearly Rate Summary */}
            <div className="border rounded-lg overflow-hidden mb-4">
              <div className="px-3 py-1.5 text-sm font-bold text-center text-white" style={{ background:'#b45309' }}>
                KPF Exec Snacks — Rate Wise Yearly Summary — {yearLabel}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize:10 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thBr, textAlign:'left', paddingLeft:6, width:80, fontSize:10, padding:'3px 5px' }}>Month</th>
                      <th colSpan={2} style={{ ...thBr, fontSize:10, padding:'3px 5px' }}>Snacks (×₹25)</th>
                      <th colSpan={2} style={{ ...thBr, fontSize:10, padding:'3px 5px' }}>Biscuit (×₹10)</th>
                      <th colSpan={2} style={{ ...thBr, fontSize:10, padding:'3px 5px' }}>Chips (×₹10)</th>
                      <th colSpan={2} style={{ ...thBr, fontSize:10, padding:'3px 5px' }}>Cold Drink & Water (×₹10)</th>
                      <th colSpan={2} style={{ ...thBr, fontSize:10, padding:'3px 5px', background:'#92400e', color:'#fff' }}>Shift Officer Bfast (×₹40)</th>
                      <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'3px 5px', textAlign:'center', fontWeight:'bold', fontSize:10 }}>Grand Total</th>
                    </tr>
                    <tr>
                      <th style={{ ...thBr, fontSize:9, padding:'2px 4px' }}></th>
                      {['Qty','Amt','Qty','Amt','Qty','Amt','Qty','Amt','Qty','Amt'].map((h,i)=><th key={i} style={{ ...thBr, fontSize:9, padding:'2px 4px' }}>{h}</th>)}
                      <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', fontSize:9, padding:'2px 4px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMonthsList.map((m, idx) => {
                      const mName = MONTHS[m-1];
                      const row = yrExec.find(r => r.month === m);
                      const sn = row?.snacks||0, bi = row?.biscuit||0, ch = row?.chips||0, cw = row?.coldDrinkWater||0, sob = row?.shiftOfficerBreakfast||0;
                      const grand = sn*25+bi*10+ch*10+cw*10+sob*40;
                      const bg = idx%2===0 ? '#f9fafb' : '#fff';
                      const fmt = (n: number) => n ? n.toLocaleString('en-IN') : '';
                      if (!row) return (
                        <tr key={m} style={{ background: bg }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                          {Array.from({length:11},(_,i)=><td key={i} style={{ border:'1px solid #ddd', padding:'2px 4px', textAlign:'center', fontSize:10, color:'#ccc' }}>—</td>)}
                        </tr>
                      );
                      return (
                        <tr key={m} style={{ background: bg }}>
                          <td style={{ border:'1px solid #ddd', padding:'2px 5px', fontWeight:500, textAlign:'left', fontSize:10 }}>{mName}</td>
                          <td style={tdC}>{sn||''}</td><td style={tdR}>{fmt(sn*25)}</td>
                          <td style={tdC}>{bi||''}</td><td style={tdR}>{fmt(bi*10)}</td>
                          <td style={tdC}>{ch||''}</td><td style={tdR}>{fmt(ch*10)}</td>
                          <td style={tdC}>{cw||''}</td><td style={tdR}>{fmt(cw*10)}</td>
                          <td style={tdC}>{sob||''}</td><td style={tdR}>{fmt(sob*40)}</td>
                          <td style={{ ...tdR, background:'#fff7ed', fontWeight:'bold' }}>{fmt(grand)}</td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const totSn = filtExec.reduce((s,r)=>s+(r.snacks||0),0);
                      const totBi = filtExec.reduce((s,r)=>s+(r.biscuit||0),0);
                      const totCh = filtExec.reduce((s,r)=>s+(r.chips||0),0);
                      const totCw = filtExec.reduce((s,r)=>s+(r.coldDrinkWater||0),0);
                      const totSob = filtExec.reduce((s,r)=>s+(r.shiftOfficerBreakfast||0),0);
                      const grand = totSn*25+totBi*10+totCh*10+totCw*10+totSob*40;
                      return (
                        <tr>
                          <td style={tdTot}>Grand Total</td>
                          <td style={tdTot}>{totSn||'—'}</td><td style={tdTot}>{totSn ? `₹${(totSn*25).toLocaleString('en-IN')}` : '—'}</td>
                          <td style={tdTot}>{totBi||'—'}</td><td style={tdTot}>{totBi ? `₹${(totBi*10).toLocaleString('en-IN')}` : '—'}</td>
                          <td style={tdTot}>{totCh||'—'}</td><td style={tdTot}>{totCh ? `₹${(totCh*10).toLocaleString('en-IN')}` : '—'}</td>
                          <td style={tdTot}>{totCw||'—'}</td><td style={tdTot}>{totCw ? `₹${(totCw*10).toLocaleString('en-IN')}` : '—'}</td>
                          <td style={tdTot}>{totSob||'—'}</td><td style={tdTot}>{totSob ? `₹${(totSob*40).toLocaleString('en-IN')}` : '—'}</td>
                          <td style={{ ...tdTot, background:'#fed7aa' }}>{grand ? `₹${grand.toLocaleString('en-IN')}` : '—'}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===================== MONTHLY VIEW ===================== */}
      {!isLoading && viewMode === 'monthly' && <>

      {/* KPF Table */}
      <MealTable rows={kpfRows} locName="KPF" hStyle={thG} />

      {/* TEC Table */}
      <MealTable rows={tecRows} locName="TEC" hStyle={thB} />

      {/* Exec Snacks Table */}
      <div className="mb-5">
        <div className="text-center font-bold text-sm py-1.5" style={{ background:'#b45309', color:'#fff' }}>
          KPF Exec Snacks — Number of Snacks Per Day For Executives &amp; Managers — {monthLabel}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize:11 }}>
            <thead>
              <tr>
                <th style={{ ...thBr, width:28 }}>Sl.</th>
                <th style={{ ...thBr, width:80 }}>Date</th>
                <th style={{ ...thBr, width:34 }}>Days</th>
                {['Snacks','Biscuit','Chips','Cold Drink & Water','Shift Officer Breakfast'].map(h => <th key={h} style={thBr}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {execRows.map((row, i) => {
                const sun = isSunday(row.entryDate);
                return (
                  <tr key={i} style={{ background: sun ? '#ffb380' : undefined }}>
                    <td style={td(sun)}>{i+1}</td>
                    <td style={td(sun)}>{safeFormat(row.entryDate)}</td>
                    <td style={td(sun)}>{row.weekDay}</td>
                    {(['snacks','biscuit','chips','coldDrinkWater','shiftOfficerBreakfast'] as (keyof ExecSnackRow)[]).map(f => (
                      <td key={f as string} style={td(sun)}>{row[f] || ''}</td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3} style={tdTot}>Total</td>
                {(['snacks','biscuit','chips','coldDrinkWater','shiftOfficerBreakfast'] as (keyof ExecSnackRow)[]).map(f => (
                  <td key={f as string} style={tdTot}>{execRows.reduce((s,r) => s+(r[f]||0), 0) || ''}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="block md:hidden space-y-1 mt-1">
          {execRows.map((row, i) => (
            <div key={i} className="border rounded p-2 text-xs" style={{ background: isSunday(row.entryDate) ? '#ffb380' : '#fffbeb' }}>
              <div className="font-semibold">{safeFormat(row.entryDate)} ({row.weekDay})</div>
              <div className="grid grid-cols-2 gap-x-3 mt-0.5">
                <span>Snacks: <b>{row.snacks||0}</b></span><span>Biscuit: <b>{row.biscuit||0}</b></span>
                <span>Chips: <b>{row.chips||0}</b></span><span>Cold Drink: <b>{row.coldDrinkWater||0}</b></span>
                <span>SO Breakfast: <b>{row.shiftOfficerBreakfast||0}</b></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Combined Totals */}
      <div className="border rounded-lg overflow-hidden mb-4">
        <div className="bg-gray-800 text-white px-3 py-2 text-sm font-bold text-center">
          Combined Monthly Totals — {monthLabel}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize:11 }}>
            <thead>
              <tr>
                <th style={{ ...thG, textAlign:'left', paddingLeft:8, minWidth:110 }}>Section</th>
                {['Breakfast','Lunch','Evng Snacks','Night Snacks'].map(h=><th key={h} style={thG}>{h}</th>)}
                {['G.Breakfast','G.Lunch','G.Evng','G.Night'].map(h=><th key={h} style={thB}>{h}</th>)}
                {['Snacks','Biscuit','Chips','Cold Drink'].map(h=><th key={h} style={thBr}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background:'#d1fae5' }}>
                <td style={{ ...tdTot, textAlign:'left', paddingLeft:8 }}>KPF</td>
                <td style={tdTot}>{kpfT.breakfast||'—'}</td><td style={tdTot}>{kpfT.lunch||'—'}</td>
                <td style={tdTot}>{kpfT.eveningSnacks||'—'}</td><td style={tdTot}>{kpfT.nightSnacks||'—'}</td>
                <td style={tdTot}>{kpfT.guestBreakfast||'—'}</td><td style={tdTot}>{kpfT.guestLunch||'—'}</td>
                <td style={tdTot}>{kpfT.guestEveningSnacks||'—'}</td><td style={tdTot}>{kpfT.guestNightSnacks||'—'}</td>
                <td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td>
              </tr>
              <tr style={{ background:'#dbeafe' }}>
                <td style={{ ...tdTot, textAlign:'left', paddingLeft:8 }}>TEC</td>
                <td style={tdTot}>{tecT.breakfast||'—'}</td><td style={tdTot}>{tecT.lunch||'—'}</td>
                <td style={tdTot}>{tecT.eveningSnacks||'—'}</td><td style={tdTot}>{tecT.nightSnacks||'—'}</td>
                <td style={tdTot}>{tecT.guestBreakfast||'—'}</td><td style={tdTot}>{tecT.guestLunch||'—'}</td>
                <td style={tdTot}>{tecT.guestEveningSnacks||'—'}</td><td style={tdTot}>{tecT.guestNightSnacks||'—'}</td>
                <td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td>
              </tr>
              <tr style={{ background:'#fef9c3' }}>
                <td style={{ ...tdTot, textAlign:'left', paddingLeft:8 }}>KPF Exec Snacks</td>
                <td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td>
                <td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td>
                <td style={tdTot}>{exT.snacks||'—'}</td><td style={tdTot}>{exT.biscuit||'—'}</td>
                <td style={tdTot}>{exT.chips||'—'}</td><td style={tdTot}>{exT.coldDrinkWater||'—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MONTHLY RATE WISE SUMMARY ===== */}
      <div className="border rounded-lg overflow-hidden mb-4">
        <div className="px-3 py-2 text-sm font-bold text-center text-white" style={{ background:'#6b21a8' }}>
          Rate Wise Summary — {monthLabel}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {([{ label:'KPF', totals:kpfT, hStyle:thG }, { label:'TEC', totals:tecT, hStyle:thB }] as const).map(({ label, totals, hStyle }) => {
            const mealSub = MEAL_RATES.reduce((s, r) => s + (totals as any)[r.key] * r.rate, 0);
            const guestSub = GUEST_RATES.reduce((s, r) => s + (totals as any)[r.key] * r.rate, 0);
            return (
              <div key={label} className="border-r last:border-r-0">
                <div className="px-3 py-1 font-bold text-white text-xs" style={{ background: hStyle.background as string }}>
                  {label} — HUL Meal Charges Rate Summary
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ fontSize:10 }}>
                    <thead>
                      <tr>
                        <th style={{ ...hStyle, textAlign:'left', paddingLeft:8, width:130, fontSize:10 }}>Meal Type</th>
                        <th style={{ ...hStyle, fontSize:10 }}>Qty</th>
                        <th style={{ ...hStyle, fontSize:10 }}>Rate (₹)</th>
                        <th style={{ ...hStyle, fontSize:10 }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={4} style={{ background:'#f0fdf4', border:'1px solid #ddd', padding:'2px 8px', fontWeight:'bold', fontSize:10, color:'#166534' }}>Meal Charges</td></tr>
                      {MEAL_RATES.map((r, i) => {
                        const qty = (totals as any)[r.key] || 0;
                        return (
                          <tr key={i} style={{ background: i%2===0 ? '#f9fafb' : '#fff' }}>
                            <td style={tdL}>{r.name}</td>
                            <td style={tdC}>{qty || ''}</td>
                            <td style={tdC}>₹{r.rate}</td>
                            <td style={tdR}>{qty ? fmtINR(qty * r.rate) : ''}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background:'#dcfce7' }}>
                        <td colSpan={3} style={{ border:'1px solid #ddd', padding:'2px 8px', fontWeight:'bold', textAlign:'right', fontSize:10 }}>Meal Charges Sub Total</td>
                        <td style={{ ...tdR, fontWeight:'bold' }}>{fmtINR(mealSub)}</td>
                      </tr>
                      <tr><td colSpan={4} style={{ background:'#eff6ff', border:'1px solid #ddd', padding:'2px 8px', fontWeight:'bold', fontSize:10, color:'#1e40af' }}>Guest Meal Charges</td></tr>
                      {GUEST_RATES.map((r, i) => {
                        const qty = (totals as any)[r.key] || 0;
                        return (
                          <tr key={i} style={{ background: i%2===0 ? '#f9fafb' : '#fff' }}>
                            <td style={tdL}>{r.name}</td>
                            <td style={tdC}>{qty || ''}</td>
                            <td style={tdC}>₹{r.rate}</td>
                            <td style={tdR}>{qty ? fmtINR(qty * r.rate) : ''}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background:'#dbeafe' }}>
                        <td colSpan={3} style={{ border:'1px solid #ddd', padding:'2px 8px', fontWeight:'bold', textAlign:'right', fontSize:10 }}>Guest Meal Charges Sub Total</td>
                        <td style={{ ...tdR, fontWeight:'bold' }}>{fmtINR(guestSub)}</td>
                      </tr>
                      <tr style={{ background: hStyle.background as string }}>
                        <td colSpan={3} style={{ border:'1px solid #333', padding:'3px 8px', fontWeight:'bold', textAlign:'right', fontSize:11, color:'#fff' }}>Grand Total</td>
                        <td style={{ border:'1px solid #333', padding:'3px 6px', textAlign:'right', fontWeight:'bold', fontSize:11, color:'#fff' }}>{fmtINR(mealSub + guestSub)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
        {/* KPF + TEC Combined Row */}
        {(() => {
          const combined = { ...kpfT };
          (Object.keys(combined) as (keyof typeof combined)[]).forEach(k => { (combined as any)[k] = (kpfT as any)[k] + (tecT as any)[k]; });
          const mealSub = MEAL_RATES.reduce((s, r) => s + (combined as any)[r.key] * r.rate, 0);
          const guestSub = GUEST_RATES.reduce((s, r) => s + (combined as any)[r.key] * r.rate, 0);
          return (
            <div className="overflow-x-auto border-t">
              <table className="w-full border-collapse" style={{ fontSize:10 }}>
                <thead>
                  <tr>
                    <th style={{ ...thPurple, textAlign:'left', paddingLeft:8, minWidth:180, fontSize:10 }}>KPF + TEC Combined</th>
                    {MEAL_RATES.map(r => <th key={r.key} style={{ ...thPurple, fontSize:10 }}>{r.name} (×₹{r.rate})</th>)}
                    <th style={{ ...thPurple, background:'#4c1d95', fontSize:10 }}>Meal Sub</th>
                    {GUEST_RATES.map(r => <th key={r.key} style={{ ...thB, fontSize:10 }}>G.{r.name} (×₹{r.rate})</th>)}
                    <th style={{ ...thB, background:'#1e3a8a', fontSize:10 }}>Guest Sub</th>
                    <th style={{ background:'#374151', color:'#fff', border:'1px solid #333', padding:'4px 6px', textAlign:'center', fontWeight:'bold', fontSize:10 }}>Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background:'#faf5ff' }}>
                    <td style={{ ...tdL, fontWeight:'bold' }}>Qty</td>
                    {MEAL_RATES.map(r => <td key={r.key} style={tdC}>{(combined as any)[r.key] || ''}</td>)}
                    <td style={{ ...tdC, background:'#ede9fe', fontWeight:'bold' }}>—</td>
                    {GUEST_RATES.map(r => <td key={r.key} style={tdC}>{(combined as any)[r.key] || ''}</td>)}
                    <td style={{ ...tdC, background:'#dbeafe', fontWeight:'bold' }}>—</td>
                    <td style={{ ...tdC, background:'#f0fdf4', fontWeight:'bold' }}>—</td>
                  </tr>
                  <tr style={{ background:'#f3e8ff' }}>
                    <td style={{ ...tdL, fontWeight:'bold' }}>Amount</td>
                    {MEAL_RATES.map(r => <td key={r.key} style={tdR}>{(combined as any)[r.key] ? fmtINR((combined as any)[r.key] * r.rate) : ''}</td>)}
                    <td style={{ ...tdR, background:'#ede9fe', fontWeight:'bold' }}>{fmtINR(mealSub)}</td>
                    {GUEST_RATES.map(r => <td key={r.key} style={tdR}>{(combined as any)[r.key] ? fmtINR((combined as any)[r.key] * r.rate) : ''}</td>)}
                    <td style={{ ...tdR, background:'#dbeafe', fontWeight:'bold' }}>{fmtINR(guestSub)}</td>
                    <td style={{ ...tdR, background:'#bbf7d0', fontWeight:'bold' }}>{fmtINR(mealSub + guestSub)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* KPF Exec Snacks Rate Summary */}
        <div className="overflow-x-auto border-t">
          <div className="px-3 py-1 font-bold text-white text-xs" style={{ background:'#b45309' }}>
            KPF Exec Snacks — Rate Summary — {monthLabel}
          </div>
          <table className="w-full border-collapse" style={{ fontSize:10 }}>
            <thead>
              <tr>
                <th style={{ ...thBr, textAlign:'left', paddingLeft:8, width:180, fontSize:10 }}>Item</th>
                <th style={{ ...thBr, fontSize:10 }}>Qty</th>
                <th style={{ ...thBr, fontSize:10 }}>Rate (₹)</th>
                <th style={{ ...thBr, fontSize:10 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {EXEC_RATES.map((r, i) => {
                const qty = (exT as any)[r.key] || 0;
                return (
                  <tr key={i} style={{ background: i%2===0 ? '#fff7ed' : '#fff' }}>
                    <td style={tdL}>{r.name}</td>
                    <td style={tdC}>{qty || ''}</td>
                    <td style={tdC}>₹{r.rate}</td>
                    <td style={tdR}>{qty ? fmtINR(qty * r.rate) : ''}</td>
                  </tr>
                );
              })}
              <tr style={{ background:'#b45309' }}>
                <td colSpan={3} style={{ border:'1px solid #333', padding:'3px 8px', fontWeight:'bold', textAlign:'right', fontSize:11, color:'#fff' }}>Grand Total</td>
                <td style={{ border:'1px solid #333', padding:'3px 6px', textAlign:'right', fontWeight:'bold', fontSize:11, color:'#fff' }}>
                  {fmtINR(EXEC_RATES.reduce((s, r) => s + ((exT as any)[r.key] || 0) * r.rate, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      </>}

      {/* Hidden print content */}
      <div className="hidden" ref={printRef}>
        <h3 style={{ textAlign:'center', margin:'4px 0', fontSize:14 }}>DJ Hospitality &amp; Facility Management Pvt. Ltd.</h3>
        <h4 style={{ textAlign:'center', margin:'2px 0', fontSize:13 }}>HUL Summary Report — {monthLabel}</h4>
        {/* KPF print table */}
        <p style={{ textAlign:'center', fontWeight:'bold', margin:'6px 0 2px' }}>KPF — Meal Charges &amp; Guest Meal Charges</p>
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={thG}>Sl.</th><th rowSpan={2} style={thG}>Date</th><th rowSpan={2} style={thG}>Days</th>
              <th colSpan={4} style={thG}>Meal Charges</th><th colSpan={4} style={thB}>Guest Meal Charges</th>
            </tr>
            <tr>
              {['Breakfast','Lunch','Evng Snacks','Night Snacks'].map(h=><th key={h} style={thG}>{h}</th>)}
              {['G.Breakfast','G.Lunch','G.Evng','G.Night'].map(h=><th key={h} style={thB}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {kpfRows.map((row, i) => {
              const sun = isSunday(row.entryDate);
              return (
                <tr key={i} style={{ background: sun ? '#ffa500' : undefined }}>
                  <td style={td(sun)}>{i+1}</td><td style={td(sun)}>{safeFormat(row.entryDate)}</td><td style={td(sun)}>{row.weekDay}</td>
                  {(['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'] as (keyof HulRow)[]).map(f=><td key={f as string} style={td(sun)}>{row[f]||''}</td>)}
                </tr>
              );
            })}
            <tr><td colSpan={3} style={tdTot}>Total</td>
              {(['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'] as (keyof HulRow)[]).map(f=><td key={f as string} style={tdTot}>{kpfRows.reduce((s,r)=>s+(r[f]||0),0)||''}</td>)}
            </tr>
          </tbody>
        </table>
        {/* TEC print table */}
        <p style={{ textAlign:'center', fontWeight:'bold', margin:'6px 0 2px' }}>TEC — Meal Charges &amp; Guest Meal Charges</p>
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={thB}>Sl.</th><th rowSpan={2} style={thB}>Date</th><th rowSpan={2} style={thB}>Days</th>
              <th colSpan={4} style={thB}>Meal Charges</th><th colSpan={4} style={thB}>Guest Meal Charges</th>
            </tr>
            <tr>
              {['Breakfast','Lunch','Evng Snacks','Night Snacks'].map(h=><th key={h} style={thB}>{h}</th>)}
              {['G.Breakfast','G.Lunch','G.Evng','G.Night'].map(h=><th key={h} style={thB}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tecRows.map((row, i) => {
              const sun = isSunday(row.entryDate);
              return (
                <tr key={i} style={{ background: sun ? '#ffa500' : undefined }}>
                  <td style={td(sun)}>{i+1}</td><td style={td(sun)}>{safeFormat(row.entryDate)}</td><td style={td(sun)}>{row.weekDay}</td>
                  {(['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'] as (keyof HulRow)[]).map(f=><td key={f as string} style={td(sun)}>{row[f]||''}</td>)}
                </tr>
              );
            })}
            <tr><td colSpan={3} style={tdTot}>Total</td>
              {(['breakfast','lunch','eveningSnacks','nightSnacks','guestBreakfast','guestLunch','guestEveningSnacks','guestNightSnacks'] as (keyof HulRow)[]).map(f=><td key={f as string} style={tdTot}>{tecRows.reduce((s,r)=>s+(r[f]||0),0)||''}</td>)}
            </tr>
          </tbody>
        </table>
        {/* Exec Snacks print table */}
        <p style={{ textAlign:'center', fontWeight:'bold', margin:'6px 0 2px' }}>KPF Exec Snacks — Number of Snacks Per Day For Executives &amp; Managers</p>
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10 }}>
          <thead>
            <tr><th style={thBr}>Sl.</th><th style={thBr}>Date</th><th style={thBr}>Days</th><th style={thBr}>Snacks</th><th style={thBr}>Biscuit</th><th style={thBr}>Chips</th><th style={thBr}>Cold Drink &amp; Water</th><th style={thBr}>Shift Officer Breakfast (@₹40)</th></tr>
          </thead>
          <tbody>
            {execRows.map((row, i) => {
              const sun = isSunday(row.entryDate);
              return (
                <tr key={i} style={{ background: sun ? '#ffa500' : undefined }}>
                  <td style={td(sun)}>{i+1}</td><td style={td(sun)}>{safeFormat(row.entryDate)}</td><td style={td(sun)}>{row.weekDay}</td>
                  <td style={td(sun)}>{row.snacks||''}</td><td style={td(sun)}>{row.biscuit||''}</td><td style={td(sun)}>{row.chips||''}</td><td style={td(sun)}>{row.coldDrinkWater||''}</td><td style={td(sun)}>{row.shiftOfficerBreakfast||''}</td>
                </tr>
              );
            })}
            <tr><td colSpan={3} style={tdTot}>Total</td><td style={tdTot}>{exT.snacks||''}</td><td style={tdTot}>{exT.biscuit||''}</td><td style={tdTot}>{exT.chips||''}</td><td style={tdTot}>{exT.coldDrinkWater||''}</td><td style={tdTot}>{exT.shiftOfficerBreakfast||''}</td></tr>
          </tbody>
        </table>
        {/* Combined totals print */}
        <p style={{ textAlign:'center', fontWeight:'bold', margin:'6px 0 2px', background:'#333', color:'#fff', padding:4 }}>Combined Monthly Totals</p>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thG, textAlign:'left' }}>Section</th>
              {['Breakfast','Lunch','Evng Snacks','Night Snacks'].map(h=><th key={h} style={thG}>{h}</th>)}
              {['G.Breakfast','G.Lunch','G.Evng','G.Night'].map(h=><th key={h} style={thB}>{h}</th>)}
              {['Snacks','Biscuit','Chips','Cold Drink','SO Bfast'].map(h=><th key={h} style={thBr}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ ...tdTot, textAlign:'left' }}>KPF</td><td style={tdTot}>{kpfT.breakfast||'—'}</td><td style={tdTot}>{kpfT.lunch||'—'}</td><td style={tdTot}>{kpfT.eveningSnacks||'—'}</td><td style={tdTot}>{kpfT.nightSnacks||'—'}</td><td style={tdTot}>{kpfT.guestBreakfast||'—'}</td><td style={tdTot}>{kpfT.guestLunch||'—'}</td><td style={tdTot}>{kpfT.guestEveningSnacks||'—'}</td><td style={tdTot}>{kpfT.guestNightSnacks||'—'}</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td></tr>
            <tr><td style={{ ...tdTot, textAlign:'left' }}>TEC</td><td style={tdTot}>{tecT.breakfast||'—'}</td><td style={tdTot}>{tecT.lunch||'—'}</td><td style={tdTot}>{tecT.eveningSnacks||'—'}</td><td style={tdTot}>{tecT.nightSnacks||'—'}</td><td style={tdTot}>{tecT.guestBreakfast||'—'}</td><td style={tdTot}>{tecT.guestLunch||'—'}</td><td style={tdTot}>{tecT.guestEveningSnacks||'—'}</td><td style={tdTot}>{tecT.guestNightSnacks||'—'}</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td></tr>
            <tr><td style={{ ...tdTot, textAlign:'left' }}>KPF Exec Snacks</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>—</td><td style={tdTot}>{exT.snacks||'—'}</td><td style={tdTot}>{exT.biscuit||'—'}</td><td style={tdTot}>{exT.chips||'—'}</td><td style={tdTot}>{exT.coldDrinkWater||'—'}</td><td style={tdTot}>{exT.shiftOfficerBreakfast||'—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// PEC VENTURES PRIVATE LIMITED — Canteen Expense Per Day
// ============================================================

const PEC_RATES = {
  redLabel:     620,
  tataTea:      310,
  coffee:       5.5,
  sugar:        48,
  ginger:       180,
  biscuit:      5,
  teaCup:       0.8,
  greenElaychi: 3.6,
  greenTea:     120,
  blackSalt:    115,
  milk:         28,
};

type PecRow = {
  id?: number;
  entryDate: string;
  month: number;
  year: number;
  weekDay: string;
  redLabelQty: number;
  tataTeaQty: number;
  coffeeQty: number;
  sugarQty: number;
  gingerQty: number;
  biscuitQty: number;
  teaCupQty: number;
  greenElaychiQty: number;
  greenTeaQty: number;
  blackSaltQty: number;
  milkMorningQty: number;
  milkEveningQty: number;
  _dirty?: boolean;
};

function pecRowDefaults(dateStr: string, month: number, year: number): PecRow {
  return {
    entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr),
    redLabelQty: 0, tataTeaQty: 0, coffeeQty: 0, sugarQty: 0, gingerQty: 0,
    biscuitQty: 0, teaCupQty: 0, greenElaychiQty: 0, greenTeaQty: 0,
    blackSaltQty: 0, milkMorningQty: 0, milkEveningQty: 0,
    _dirty: true,
  };
}

function generatePecMonthRows(month: number, year: number, saved: any[]): PecRow[] {
  const days = getDaysInMonth(month, year);
  const savedMap = new Map<string, any>();
  for (const row of saved) savedMap.set(normDate(row.entryDate), row);
  const rows: PecRow[] = [];
  for (let d = 1; d <= days; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const s = savedMap.get(ds);
    if (s) {
      rows.push({
        id: s.id, entryDate: ds, month, year, weekDay: s.weekDay || getWeekDay(ds),
        redLabelQty: Number(s.redLabelQty) || 0,
        tataTeaQty: Number(s.tataTeaQty) || 0,
        coffeeQty: Number(s.coffeeQty) || 0,
        sugarQty: Number(s.sugarQty) || 0,
        gingerQty: Number(s.gingerQty) || 0,
        biscuitQty: Number(s.biscuitQty) || 0,
        teaCupQty: Number(s.teaCupQty) || 0,
        greenElaychiQty: Number(s.greenElaychiQty) || 0,
        greenTeaQty: Number(s.greenTeaQty) || 0,
        blackSaltQty: Number(s.blackSaltQty) || 0,
        milkMorningQty: Number(s.milkMorningQty) || 0,
        milkEveningQty: Number(s.milkEveningQty) || 0,
      });
    } else {
      rows.push(pecRowDefaults(ds, month, year));
    }
  }
  return rows;
}

function PecVenturesTab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const n = (v: any) => typeof v === 'number' ? v : Number(v) || 0;

  const { data: savedRows = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/pec-ventures-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/pec-ventures-entries?month=${month}&year=${year}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const [rows, setRows] = useState<PecRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const importRefPec = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading) setRows(generatePecMonthRows(month, year, savedRows));
  }, [isLoading, savedRows, month, year, loadKey]);

  const updateCell = (idx: number, field: keyof PecRow, value: number) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value, _dirty: true };
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dirty = rows.filter(r => r._dirty);
      for (const row of dirty) {
        const { _dirty, id, ...data } = row as any;
        if (id) {
          const res = await fetch(`/api/pec-ventures-entries/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data), credentials: 'include',
          });
          if (!res.ok) throw new Error('Save failed');
        } else {
          const res = await fetch('/api/pec-ventures-entries', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data), credentials: 'include',
          });
          if (!res.ok) throw new Error('Save failed');
        }
      }
      await qc.invalidateQueries({ queryKey: ['/api/pec-ventures-entries', month, year] });
      toast({ title: 'Saved', description: 'PEC Ventures canteen data saved successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const PEC_COLS: { header: string; field: keyof PecRow; isDate?: boolean; isDay?: boolean }[] = [
    { header: 'Date',              field: 'entryDate', isDate: true },
    { header: 'Day',               field: 'weekDay',   isDay: true  },
    { header: 'Red Label Qty (Kg)',field: 'redLabelQty'    },
    { header: 'Tata Tea Qty (Kg)', field: 'tataTeaQty'     },
    { header: 'Coffee Qty (Gm)',   field: 'coffeeQty'      },
    { header: 'Sugar Qty (Kg)',    field: 'sugarQty'       },
    { header: 'Ginger Qty (Kg)',   field: 'gingerQty'      },
    { header: 'Biscuit Qty (Pcs)', field: 'biscuitQty'     },
    { header: 'Tea Cup Qty (Pcs)', field: 'teaCupQty'      },
    { header: 'Green Elaychi (Gm)',field: 'greenElaychiQty'},
    { header: 'Green Tea (Pkt)',   field: 'greenTeaQty'    },
    { header: 'Black Salt Qty (Kg)',field:'blackSaltQty'   },
    { header: 'Milk Morning (L)',  field: 'milkMorningQty' },
    { header: 'Milk Evening (L)',  field: 'milkEveningQty' },
  ];

  const pecDateDisplay = (ds: string) => {
    const d = new Date(ds + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  };

  const handleExportExcelPec = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('PEC Ventures Canteen');
    const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
    // Title row
    ws.mergeCells(1, 1, 1, PEC_COLS.length);
    const title = ws.getCell('A1');
    title.value = `DJ Hospitality — PEC Ventures Canteen — ${MONTHS[month-1]} ${year}`;
    title.font={bold:true,color:{argb:'FFFFFFFF'}}; title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F2B91'}}; title.alignment={horizontal:'center'}; title.border=thin;
    // Header row
    const hdr = ws.addRow(PEC_COLS.map(c => c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A3A5A'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    ws.columns = PEC_COLS.map((c,i) => ({ width: i<=1?14:18 }));
    // Data rows
    rows.forEach(r => {
      const row = ws.addRow(PEC_COLS.map(c => {
        if (c.isDate) return pecDateDisplay(r.entryDate);
        if (c.isDay) return r.weekDay;
        return n(r[c.field]) || '';
      }));
      if (r.weekDay === 'Sun') row.eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF3CD'}}; });
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:'center'}; });
    });
    // Totals row
    const totRow = ws.addRow(['', 'TOTAL', ...PEC_COLS.slice(2).map(c => rows.reduce((s,r)=>s+n(r[c.field]),0)||'')]);
    totRow.eachCell(cell => { cell.font={bold:true}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`PEC_Ventures_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleDownloadPecTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('PEC Ventures Template');
    const thin = { top:{style:'thin' as const}, bottom:{style:'thin' as const}, left:{style:'thin' as const}, right:{style:'thin' as const} };
    ws.mergeCells(1, 1, 1, PEC_COLS.length);
    const title = ws.getCell('A1');
    title.value = `PEC Ventures — Import Template — ${MONTHS[month-1]} ${year}`;
    title.font={bold:true,color:{argb:'FFFFFFFF'}}; title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F2B91'}}; title.alignment={horizontal:'center'}; title.border=thin;
    const hdr = ws.addRow(PEC_COLS.map(c => c.header));
    hdr.eachCell(cell => { cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A3A5A'}}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    ws.columns = PEC_COLS.map((c,i) => ({ width: i<=1?14:18 }));
    const days = getDaysInMonth(month, year);
    for (let d = 1; d <= days; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const row = ws.addRow([pecDateDisplay(ds), getWeekDay(ds), ...PEC_COLS.slice(2).map(()=>'')]);
      if (getWeekDay(ds) === 'Sun') row.eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF3CD'}}; });
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:'center'}; });
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`PEC_Ventures_Template_${MONTHS[month-1]}_${year}.xlsx`; a.click();
  };

  const handleImportExcelPec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      // Find header row (first row with 'Date' cell)
      let headerRowIdx = -1;
      ws.eachRow((row, ri) => {
        if (headerRowIdx >= 0) return;
        row.eachCell(cell => { if (String(cell.value??'').trim()==='Date') headerRowIdx=ri; });
      });
      if (headerRowIdx < 0) { toast({ title:'Import Failed', description:'Could not find header row with "Date" column.', variant:'destructive'}); return; }
      const headers: string[] = [];
      ws.getRow(headerRowIdx).eachCell(cell => headers.push(String(cell.value??'').trim()));
      const fieldMap: Record<number,keyof PecRow> = {};
      PEC_COLS.forEach(c => { const i = headers.indexOf(c.header); if (i>=0) fieldMap[i]=c.field; });
      const dateIdx = headers.indexOf('Date');
      const importedMap = new Map<string,PecRow>();
      ws.eachRow((row, ri) => {
        if (ri <= headerRowIdx) return;
        const rawDate = row.getCell(dateIdx+1).value;
        if (!rawDate) return;
        let ds = '';
        if (rawDate instanceof Date) {
          ds = `${rawDate.getFullYear()}-${String(rawDate.getMonth()+1).padStart(2,'0')}-${String(rawDate.getDate()).padStart(2,'0')}`;
        } else {
          const s = String(rawDate).trim();
          const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
          if (dmy) ds = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
          else if (/^\d{4}-\d{2}-\d{2}/.test(s)) ds = s.substring(0,10);
        }
        if (!ds) return;
        const existing = importedMap.get(ds) ?? { ...pecRowDefaults(ds, month, year) };
        row.eachCell((cell, ci) => {
          const f = fieldMap[ci-1];
          if (!f || f==='entryDate' || f==='weekDay' || f==='month' || f==='year') return;
          (existing as any)[f] = parseFloat(String(cell.value??0))||0;
        });
        existing._dirty = true;
        importedMap.set(ds, existing);
      });
      // Merge imported data into current rows
      setRows(prev => prev.map(r => importedMap.has(r.entryDate) ? { ...importedMap.get(r.entryDate)!, id: r.id } : r));
      toast({ title:`Imported ${importedMap.size} rows`, description:'Review and click Save to persist.' });
    } catch(err:any) {
      toast({ title:'Import Failed', description:err.message, variant:'destructive' });
    }
  };

  const handlePrint = () => {
    const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const fq = (v: number) => v === 0 ? '' : v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
    const fa = (v: number) => v === 0 ? '' : v.toFixed(2);
    const th = `border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;font-weight:600;background:#d9e1f2;`;
    const td = `border:1px solid #000;padding:2px 4px;text-align:center;font-size:8.5px;`;
    const tdr = `border:1px solid #000;padding:2px 4px;text-align:right;font-size:8.5px;`;
    const tdl = `border:1px solid #000;padding:2px 3px;text-align:left;font-size:8.5px;`;

    // First pass: compute column totals across ALL rows
    const tot = { redLabel:0,tataTea:0,coffee:0,sugar:0,ginger:0,biscuit:0,teaCup:0,greenElaychi:0,greenTea:0,blackSalt:0,milkMorning:0,milkEvening:0 };
    rows.forEach(r => {
      tot.redLabel += n(r.redLabelQty); tot.tataTea += n(r.tataTeaQty); tot.coffee += n(r.coffeeQty);
      tot.sugar += n(r.sugarQty); tot.ginger += n(r.gingerQty); tot.biscuit += n(r.biscuitQty);
      tot.teaCup += n(r.teaCupQty); tot.greenElaychi += n(r.greenElaychiQty); tot.greenTea += n(r.greenTeaQty);
      tot.blackSalt += n(r.blackSaltQty); tot.milkMorning += n(r.milkMorningQty); tot.milkEvening += n(r.milkEveningQty);
    });
    const milkTotTotal = tot.milkMorning + tot.milkEvening;

    // Column definitions — each item that may be shown/hidden
    const COLS: Array<{
      show: boolean; label: string; colspan: number;
      h2: string;
      cell: (r: PecRow) => string;
      totCell: () => string;
      amount: () => number;
    }> = [
      {
        show: tot.redLabel > 0, label: 'Red Label Tea Powder', colspan: 3,
        h2: `<th style="${th}">Qty in Kg</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.redLabelQty))}</td><td style="${tdr}">${n(r.redLabelQty)?PEC_RATES.redLabel:''}</td><td style="${tdr}">${fa(n(r.redLabelQty)*PEC_RATES.redLabel)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.redLabel)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.redLabel*PEC_RATES.redLabel)}</td>`,
        amount: () => tot.redLabel*PEC_RATES.redLabel,
      },
      {
        show: tot.tataTea > 0, label: 'Tata Tea Powder', colspan: 3,
        h2: `<th style="${th}">Qty in Kg</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.tataTeaQty))}</td><td style="${tdr}">${n(r.tataTeaQty)?PEC_RATES.tataTea:''}</td><td style="${tdr}">${fa(n(r.tataTeaQty)*PEC_RATES.tataTea)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.tataTea)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.tataTea*PEC_RATES.tataTea)}</td>`,
        amount: () => tot.tataTea*PEC_RATES.tataTea,
      },
      {
        show: tot.coffee > 0, label: 'Coffee', colspan: 3,
        h2: `<th style="${th}">Qty in Gm</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.coffeeQty))}</td><td style="${tdr}">${n(r.coffeeQty)?PEC_RATES.coffee:''}</td><td style="${tdr}">${fa(n(r.coffeeQty)*PEC_RATES.coffee)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.coffee)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.coffee*PEC_RATES.coffee)}</td>`,
        amount: () => tot.coffee*PEC_RATES.coffee,
      },
      {
        show: tot.sugar > 0, label: 'Sugar', colspan: 3,
        h2: `<th style="${th}">Qty in Kg</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.sugarQty))}</td><td style="${tdr}">${n(r.sugarQty)?PEC_RATES.sugar:''}</td><td style="${tdr}">${fa(n(r.sugarQty)*PEC_RATES.sugar)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.sugar)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.sugar*PEC_RATES.sugar)}</td>`,
        amount: () => tot.sugar*PEC_RATES.sugar,
      },
      {
        show: tot.ginger > 0, label: 'Ginger', colspan: 3,
        h2: `<th style="${th}">Qty in Kg</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.gingerQty))}</td><td style="${tdr}">${n(r.gingerQty)?PEC_RATES.ginger:''}</td><td style="${tdr}">${fa(n(r.gingerQty)*PEC_RATES.ginger)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.ginger)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.ginger*PEC_RATES.ginger)}</td>`,
        amount: () => tot.ginger*PEC_RATES.ginger,
      },
      {
        show: tot.biscuit > 0, label: 'Biscuit', colspan: 3,
        h2: `<th style="${th}">Qty in Pcs</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.biscuitQty))}</td><td style="${tdr}">${n(r.biscuitQty)?PEC_RATES.biscuit:''}</td><td style="${tdr}">${fa(n(r.biscuitQty)*PEC_RATES.biscuit)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.biscuit)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.biscuit*PEC_RATES.biscuit)}</td>`,
        amount: () => tot.biscuit*PEC_RATES.biscuit,
      },
      {
        show: tot.teaCup > 0, label: 'Tea Cup', colspan: 3,
        h2: `<th style="${th}">Qty in Pcs</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.teaCupQty))}</td><td style="${tdr}">${n(r.teaCupQty)?PEC_RATES.teaCup:''}</td><td style="${tdr}">${fa(n(r.teaCupQty)*PEC_RATES.teaCup)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.teaCup)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.teaCup*PEC_RATES.teaCup)}</td>`,
        amount: () => tot.teaCup*PEC_RATES.teaCup,
      },
      {
        show: tot.greenElaychi > 0, label: 'Green Elaychi', colspan: 3,
        h2: `<th style="${th}">Qty in Gm</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.greenElaychiQty))}</td><td style="${tdr}">${n(r.greenElaychiQty)?PEC_RATES.greenElaychi:''}</td><td style="${tdr}">${fa(n(r.greenElaychiQty)*PEC_RATES.greenElaychi)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.greenElaychi)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.greenElaychi*PEC_RATES.greenElaychi)}</td>`,
        amount: () => tot.greenElaychi*PEC_RATES.greenElaychi,
      },
      {
        show: tot.greenTea > 0, label: 'Green Tea', colspan: 3,
        h2: `<th style="${th}">Qty in Pkt</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.greenTeaQty))}</td><td style="${tdr}">${n(r.greenTeaQty)?PEC_RATES.greenTea:''}</td><td style="${tdr}">${fa(n(r.greenTeaQty)*PEC_RATES.greenTea)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.greenTea)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.greenTea*PEC_RATES.greenTea)}</td>`,
        amount: () => tot.greenTea*PEC_RATES.greenTea,
      },
      {
        show: tot.blackSalt > 0, label: 'Black Salt', colspan: 3,
        h2: `<th style="${th}">Qty in Kg</th><th style="${th}">Rate</th><th style="${th}">Total</th>`,
        cell: (r) => `<td style="${tdr}">${fq(n(r.blackSaltQty))}</td><td style="${tdr}">${n(r.blackSaltQty)?PEC_RATES.blackSalt:''}</td><td style="${tdr}">${fa(n(r.blackSaltQty)*PEC_RATES.blackSalt)}</td>`,
        totCell: () => `<td style="${tdr}">${fq(tot.blackSalt)}</td><td style="${td}"></td><td style="${tdr}">${fa(tot.blackSalt*PEC_RATES.blackSalt)}</td>`,
        amount: () => tot.blackSalt*PEC_RATES.blackSalt,
      },
      {
        show: milkTotTotal > 0, label: 'Milk', colspan: 5,
        h2: `<th style="${th}">Morning Qty</th><th style="${th}">Evning Qty</th><th style="${th}">Total</th><th style="${th}">Rate</th><th style="${th}">Total Amt</th>`,
        cell: (r) => { const mt = n(r.milkMorningQty)+n(r.milkEveningQty); return `<td style="${tdr}">${fq(n(r.milkMorningQty))}</td><td style="${tdr}">${fq(n(r.milkEveningQty))}</td><td style="${tdr}">${mt||''}</td><td style="${tdr}">${mt?PEC_RATES.milk:''}</td><td style="${tdr}">${fa(mt*PEC_RATES.milk)}</td>`; },
        totCell: () => `<td style="${tdr}">${fq(tot.milkMorning)}</td><td style="${tdr}">${fq(tot.milkEvening)}</td><td style="${tdr}">${milkTotTotal||''}</td><td style="${td}"></td><td style="${tdr}">${fa(milkTotTotal*PEC_RATES.milk)}</td>`,
        amount: () => milkTotTotal*PEC_RATES.milk,
      },
    ];

    const visCols = COLS.filter(c => c.show);
    const totalColspan = 2 + visCols.reduce((s, c) => s + c.colspan, 0);
    const grandTotal = visCols.reduce((s, c) => s + c.amount(), 0);

    // Build a lookup: dateStr → row
    const rowByDate = new Map(rows.map(r => [r.entryDate, r]));
    const DAYS_LABEL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const daysInMonth = getDaysInMonth(month, year);

    // Generate one row per day 1→last, using saved data or zeros
    const dataRows = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      const r: PecRow = rowByDate.get(dateStr) ?? {
        entryDate: dateStr, month, year,
        weekDay: DAYS_LABEL[new Date(dateStr + 'T00:00:00').getDay()],
        redLabelQty:0, tataTeaQty:0, coffeeQty:0, sugarQty:0, gingerQty:0,
        biscuitQty:0, teaCupQty:0, greenElaychiQty:0, greenTeaQty:0, blackSaltQty:0,
        milkMorningQty:0, milkEveningQty:0,
      };
      const dd = `${String(dayNum).padStart(2,'0')}-${String(month).padStart(2,'0')}-${year}`;
      return `<tr><td style="${tdl}">${dd}</td><td style="${td}">${r.weekDay}</td>${visCols.map(c => c.cell(r)).join('')}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PEC Ventures Canteen</title>
    <style>@page{size:A3 landscape;margin:8mm}body{font-family:Arial,sans-serif;margin:0}table{border-collapse:collapse;width:100%}@media print{.no-print{display:none}}</style>
    </head><body>
    <table>
      <tr><td colspan="${totalColspan}" style="text-align:center;font-size:13px;font-weight:bold;border:1px solid #000;padding:4px;background:#d9e1f2;">DJ Hospitality &amp; Facility Management Pvt. Ltd.</td></tr>
      <tr><td colspan="${totalColspan}" style="text-align:center;font-size:11px;font-weight:bold;border:1px solid #000;padding:4px;background:#e2efda;">Expense Toward Canteen Per Day to PEC VENTURES PRIVATE LIMITED - ${MN[month-1]} - ${year}</td></tr>
      <tr>
        <th style="${th}" rowspan="2">Date</th><th style="${th}" rowspan="2">Days</th>
        ${visCols.map(c => `<th style="${th}" colspan="${c.colspan}">${c.label}</th>`).join('')}
      </tr>
      <tr>
        ${visCols.map(c => c.h2).join('')}
      </tr>
      ${dataRows}
      <tr style="font-weight:bold;background:#fff2cc;">
        <td style="${tdl}" colspan="2">TOTAL</td>
        ${visCols.map(c => c.totCell()).join('')}
      </tr>
      <tr><td colspan="${totalColspan}" style="text-align:right;font-weight:bold;font-size:10px;border:1px solid #000;padding:4px;background:#fff2cc;">Grand Total: ₹${fa(grandTotal)}</td></tr>
    </table>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const totals = rows.reduce((acc, r) => ({
    redLabel: acc.redLabel + n(r.redLabelQty),
    tataTea: acc.tataTea + n(r.tataTeaQty),
    coffee: acc.coffee + n(r.coffeeQty),
    sugar: acc.sugar + n(r.sugarQty),
    ginger: acc.ginger + n(r.gingerQty),
    biscuit: acc.biscuit + n(r.biscuitQty),
    teaCup: acc.teaCup + n(r.teaCupQty),
    greenElaychi: acc.greenElaychi + n(r.greenElaychiQty),
    greenTea: acc.greenTea + n(r.greenTeaQty),
    blackSalt: acc.blackSalt + n(r.blackSaltQty),
    milkMorning: acc.milkMorning + n(r.milkMorningQty),
    milkEvening: acc.milkEvening + n(r.milkEveningQty),
  }), { redLabel:0, tataTea:0, coffee:0, sugar:0, ginger:0, biscuit:0, teaCup:0, greenElaychi:0, greenTea:0, blackSalt:0, milkMorning:0, milkEvening:0 });

  const fq = (v: number) => v === 0 ? '' : v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
  const fa = (v: number) => v === 0 ? '' : v.toFixed(2);

  const inputSx = "w-16 h-6 text-right text-xs border rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-900";
  const thSx = "border border-gray-300 dark:border-gray-600 bg-blue-100 dark:bg-blue-900/40 text-center text-xs font-semibold px-1 py-1 whitespace-nowrap";
  const tdSx = "border border-gray-200 dark:border-gray-700 text-center text-xs px-1 py-0.5";
  const tdRSx = "border border-gray-200 dark:border-gray-700 text-right text-xs px-1 py-0.5 text-gray-500 dark:text-gray-400";
  const totSx = "border border-gray-300 dark:border-gray-600 text-center text-xs font-bold px-1 py-1 bg-amber-50 dark:bg-amber-900/20";
  const totRSx = "border border-gray-300 dark:border-gray-600 text-right text-xs font-bold px-1 py-1 bg-amber-50 dark:bg-amber-900/20 text-emerald-700 dark:text-emerald-400";

  const COLS_PER_ROW = 12; // Red Label, Tata Tea, Coffee, Sugar, Ginger, Biscuit, Tea Cup, Green Elaychi, Green Tea, Black Salt, Milk Morning, Milk Evening
  const handlePecEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-pec-input]'));
    const idx = all.indexOf(e.currentTarget);
    if (idx < 0) return;
    const nextRowFirst = (Math.floor(idx / COLS_PER_ROW) + 1) * COLS_PER_ROW;
    if (nextRowFirst < all.length) {
      all[nextRowFirst].focus();
      all[nextRowFirst].select();
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={isSaving} className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm gap-2" data-testid="btn-pec-save">
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button onClick={handlePrint} variant="outline" className="h-8 px-4 text-sm gap-2" data-testid="btn-pec-print">
          <Printer className="w-3 h-3" /> Print
        </Button>
        <Button onClick={handleExportExcelPec} variant="outline" className="h-8 px-4 text-sm gap-2 text-green-700 border-green-300 hover:bg-green-50" data-testid="btn-pec-export">
          <FileDown className="w-3 h-3" /> Export Excel
        </Button>
        <Button onClick={() => importRefPec.current?.click()} variant="outline" className="h-8 px-4 text-sm gap-2 text-blue-700 border-blue-300 hover:bg-blue-50" data-testid="btn-pec-import">
          <FileUp className="w-3 h-3" /> Import Excel
        </Button>
        <Button onClick={handleDownloadPecTemplate} variant="outline" className="h-8 px-4 text-sm gap-2 text-purple-700 border-purple-300 hover:bg-purple-50" data-testid="btn-pec-template">
          <FileDown className="w-3 h-3" /> Template
        </Button>
        <input ref={importRefPec} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcelPec} />
        <span className="text-xs text-muted-foreground">Rates: Red Label ₹620/kg · Tata Tea ₹310/kg · Coffee ₹5.5/gm · Sugar ₹48/kg · Ginger ₹180/kg · Biscuit ₹5/pcs · Tea Cup ₹0.8/pcs · Green Elaychi ₹3.6/gm · Green Tea ₹120/pkt · Black Salt ₹115/kg · Milk ₹28/L</span>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="border-collapse min-w-max">
          <thead>
            <tr>
              <th className={`${thSx} sticky left-0 z-30 min-w-[88px]`} rowSpan={2}>Date</th>
              <th className={`${thSx} sticky left-[88px] z-30 min-w-[36px]`} rowSpan={2}>Day</th>
              <th className={`${thSx} bg-red-100 dark:bg-red-900/30`} colSpan={3}>Red Label Tea<br/>620/kg</th>
              <th className={`${thSx} bg-orange-100 dark:bg-orange-900/30`} colSpan={3}>Tata Tea<br/>310/kg</th>
              <th className={`${thSx} bg-amber-100 dark:bg-amber-900/30`} colSpan={3}>Coffee<br/>5.5/gm</th>
              <th className={`${thSx} bg-yellow-100 dark:bg-yellow-900/30`} colSpan={3}>Sugar<br/>48/kg</th>
              <th className={`${thSx} bg-lime-100 dark:bg-lime-900/30`} colSpan={3}>Ginger<br/>180/kg</th>
              <th className={`${thSx} bg-green-100 dark:bg-green-900/30`} colSpan={3}>Biscuit<br/>5/pcs</th>
              <th className={`${thSx} bg-teal-100 dark:bg-teal-900/30`} colSpan={3}>Tea Cup<br/>0.8/pcs</th>
              <th className={`${thSx} bg-cyan-100 dark:bg-cyan-900/30`} colSpan={3}>Grn Elaychi<br/>3.6/gm</th>
              <th className={`${thSx} bg-sky-100 dark:bg-sky-900/30`} colSpan={3}>Green Tea<br/>120/pkt</th>
              <th className={`${thSx} bg-indigo-100 dark:bg-indigo-900/30`} colSpan={3}>Black Salt<br/>115/kg</th>
              <th className={`${thSx} bg-purple-100 dark:bg-purple-900/30`} colSpan={5}>Milk · 28/L</th>
            </tr>
            <tr>
              {[["Qty","Rate","Amt"],["Qty","Rate","Amt"],["Qty(gm)","Rate","Amt"],["Qty","Rate","Amt"],["Qty","Rate","Amt"],
                ["Qty(pcs)","Rate","Amt"],["Qty(pcs)","Rate","Amt"],["Qty(gm)","Rate","Amt"],["Qty(pkt)","Rate","Amt"],["Qty","Rate","Amt"]].map((g,gi) =>
                g.map((h,hi) => <th key={`${gi}-${hi}`} className={thSx}>{h}</th>)
              )}
              <th className={thSx}>Morning</th><th className={thSx}>Evening</th><th className={thSx}>Total</th><th className={thSx}>Rate</th><th className={thSx}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const milkTot = n(r.milkMorningQty) + n(r.milkEveningQty);
              const isSun = r.weekDay === 'Sun';
              const rowBg = isSun ? 'bg-red-50 dark:bg-red-950/20' : '';
              return (
                <tr key={r.entryDate} className={rowBg}>
                  <td className={`${tdSx} sticky left-0 z-10 text-left font-medium whitespace-nowrap ${isSun ? 'bg-red-50 dark:bg-red-950/20' : 'bg-white dark:bg-slate-900'}`}>{safeFormat(r.entryDate)}</td>
                  <td className={`${tdSx} sticky left-[88px] z-10 ${isSun ? 'bg-red-50 dark:bg-red-950/20 text-red-600 font-semibold' : 'bg-white dark:bg-slate-900'}`}>{r.weekDay}</td>
                  {/* Red Label */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.redLabelQty)||''} onChange={e=>updateCell(i,'redLabelQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-redlabel-${i}`}/></td>
                  <td className={tdRSx}>{n(r.redLabelQty)?PEC_RATES.redLabel:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.redLabelQty)*PEC_RATES.redLabel)}</td>
                  {/* Tata Tea */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.tataTeaQty)||''} onChange={e=>updateCell(i,'tataTeaQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-tata-${i}`}/></td>
                  <td className={tdRSx}>{n(r.tataTeaQty)?PEC_RATES.tataTea:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.tataTeaQty)*PEC_RATES.tataTea)}</td>
                  {/* Coffee */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.coffeeQty)||''} onChange={e=>updateCell(i,'coffeeQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-coffee-${i}`}/></td>
                  <td className={tdRSx}>{n(r.coffeeQty)?PEC_RATES.coffee:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.coffeeQty)*PEC_RATES.coffee)}</td>
                  {/* Sugar */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.sugarQty)||''} onChange={e=>updateCell(i,'sugarQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-sugar-${i}`}/></td>
                  <td className={tdRSx}>{n(r.sugarQty)?PEC_RATES.sugar:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.sugarQty)*PEC_RATES.sugar)}</td>
                  {/* Ginger */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.gingerQty)||''} onChange={e=>updateCell(i,'gingerQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-ginger-${i}`}/></td>
                  <td className={tdRSx}>{n(r.gingerQty)?PEC_RATES.ginger:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.gingerQty)*PEC_RATES.ginger)}</td>
                  {/* Biscuit */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.biscuitQty)||''} onChange={e=>updateCell(i,'biscuitQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-biscuit-${i}`}/></td>
                  <td className={tdRSx}>{n(r.biscuitQty)?PEC_RATES.biscuit:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.biscuitQty)*PEC_RATES.biscuit)}</td>
                  {/* Tea Cup */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.teaCupQty)||''} onChange={e=>updateCell(i,'teaCupQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-teacup-${i}`}/></td>
                  <td className={tdRSx}>{n(r.teaCupQty)?PEC_RATES.teaCup:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.teaCupQty)*PEC_RATES.teaCup)}</td>
                  {/* Green Elaychi */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.greenElaychiQty)||''} onChange={e=>updateCell(i,'greenElaychiQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-elaychi-${i}`}/></td>
                  <td className={tdRSx}>{n(r.greenElaychiQty)?PEC_RATES.greenElaychi:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.greenElaychiQty)*PEC_RATES.greenElaychi)}</td>
                  {/* Green Tea */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.greenTeaQty)||''} onChange={e=>updateCell(i,'greenTeaQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-greentea-${i}`}/></td>
                  <td className={tdRSx}>{n(r.greenTeaQty)?PEC_RATES.greenTea:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.greenTeaQty)*PEC_RATES.greenTea)}</td>
                  {/* Black Salt */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.blackSaltQty)||''} onChange={e=>updateCell(i,'blackSaltQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-blacksalt-${i}`}/></td>
                  <td className={tdRSx}>{n(r.blackSaltQty)?PEC_RATES.blackSalt:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(n(r.blackSaltQty)*PEC_RATES.blackSalt)}</td>
                  {/* Milk */}
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.milkMorningQty)||''} onChange={e=>updateCell(i,'milkMorningQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-milk-morning-${i}`}/></td>
                  <td className={tdSx}><input type="number" min="0" step="0.001" className={inputSx} value={n(r.milkEveningQty)||''} onChange={e=>updateCell(i,'milkEveningQty',Number(e.target.value))} onKeyDown={handlePecEnter} data-pec-input data-testid={`pec-milk-evening-${i}`}/></td>
                  <td className={tdRSx}>{milkTot||''}</td>
                  <td className={tdRSx}>{milkTot?PEC_RATES.milk:''}</td>
                  <td className={`${tdRSx} font-medium`}>{fa(milkTot*PEC_RATES.milk)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${totSx} sticky left-0 z-10 text-left font-bold`} colSpan={2}>TOTAL</td>
              <td className={totSx}>{fq(totals.redLabel)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.redLabel*PEC_RATES.redLabel)}</td>
              <td className={totSx}>{fq(totals.tataTea)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.tataTea*PEC_RATES.tataTea)}</td>
              <td className={totSx}>{fq(totals.coffee)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.coffee*PEC_RATES.coffee)}</td>
              <td className={totSx}>{fq(totals.sugar)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.sugar*PEC_RATES.sugar)}</td>
              <td className={totSx}>{fq(totals.ginger)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.ginger*PEC_RATES.ginger)}</td>
              <td className={totSx}>{fq(totals.biscuit)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.biscuit*PEC_RATES.biscuit)}</td>
              <td className={totSx}>{fq(totals.teaCup)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.teaCup*PEC_RATES.teaCup)}</td>
              <td className={totSx}>{fq(totals.greenElaychi)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.greenElaychi*PEC_RATES.greenElaychi)}</td>
              <td className={totSx}>{fq(totals.greenTea)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.greenTea*PEC_RATES.greenTea)}</td>
              <td className={totSx}>{fq(totals.blackSalt)}</td><td className={totSx}></td><td className={totRSx}>{fa(totals.blackSalt*PEC_RATES.blackSalt)}</td>
              <td className={totSx}>{fq(totals.milkMorning)}</td><td className={totSx}>{fq(totals.milkEvening)}</td>
              <td className={totSx}>{fq(totals.milkMorning+totals.milkEvening)}</td><td className={totSx}></td>
              <td className={totRSx}>{fa((totals.milkMorning+totals.milkEvening)*PEC_RATES.milk)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

type PecYearRow = {
  month: number;
  redLabel: number; tataTea: number; coffee: number; sugar: number; ginger: number;
  biscuit: number; teaCup: number; greenElaychi: number; greenTea: number;
  blackSalt: number; milkMorning: number; milkEvening: number;
};

const PEC_ITEMS: { key: keyof PecYearRow; label: string; rate: number }[] = [
  { key: 'redLabel',    label: 'Red Label Tea',  rate: PEC_RATES.redLabel    },
  { key: 'tataTea',     label: 'Tata Tea',       rate: PEC_RATES.tataTea     },
  { key: 'coffee',      label: 'Coffee',         rate: PEC_RATES.coffee      },
  { key: 'sugar',       label: 'Sugar',          rate: PEC_RATES.sugar       },
  { key: 'ginger',      label: 'Ginger',         rate: PEC_RATES.ginger      },
  { key: 'biscuit',     label: 'Biscuit',        rate: PEC_RATES.biscuit     },
  { key: 'teaCup',      label: 'Tea Cup',        rate: PEC_RATES.teaCup      },
  { key: 'greenElaychi',label: 'Green Elaychi',  rate: PEC_RATES.greenElaychi},
  { key: 'greenTea',    label: 'Green Tea',      rate: PEC_RATES.greenTea    },
  { key: 'blackSalt',   label: 'Black Salt',     rate: PEC_RATES.blackSalt   },
];

function PecVentureSummaryTab({ currentYear }: { currentYear: number }) {
  const { toast } = useToast();
  const [summaryYear, setSummaryYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set(Array.from({length:12},(_,i)=>i+1)));

  const { data: yrData = [], isLoading } = useQuery<PecYearRow[]>({
    queryKey: ['/api/pec-ventures-entries/yearly-summary', summaryYear],
    queryFn: () => fetch(`/api/pec-ventures-entries/yearly-summary?year=${summaryYear}`,{credentials:'include'}).then(r=>r.json()),
  });

  const toggleMonth = (m: number) => setSelectedMonths(prev => {
    const s = new Set(prev); s.has(m) ? s.delete(m) : s.add(m); return s;
  });
  const allSelected = selectedMonths.size === 12;

  const rowsMap = new Map(yrData.map(r => [r.month, r]));
  const filteredMonths = Array.from({length:12},(_,i)=>i+1).filter(m => selectedMonths.has(m));

  const fq = (v: number) => v === 0 ? '' : v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/,'');
  const fa = (v: number) => v === 0 ? '' : '₹'+v.toFixed(2);

  const getMilkQty = (r: PecYearRow) => (r.milkMorning||0) + (r.milkEvening||0);
  const getMilkAmt = (r: PecYearRow) => getMilkQty(r) * PEC_RATES.milk;
  const getRowTotal = (r: PecYearRow) =>
    PEC_ITEMS.reduce((s,c)=>s+(r[c.key]||0)*c.rate, 0) + getMilkAmt(r);

  const grandTotQty = (key: keyof PecYearRow) =>
    filteredMonths.reduce((s,m) => s + ((rowsMap.get(m)?.[key] as number)||0), 0);
  const grandMilkQty = () => filteredMonths.reduce((s,m) => { const r=rowsMap.get(m); return s+(r?(getMilkQty(r)):0); }, 0);
  const grandTotal = () => filteredMonths.reduce((s,m) => { const r=rowsMap.get(m); return s+(r?getRowTotal(r):0); }, 0);

  const thS = "border border-gray-400 bg-blue-900 text-white text-center text-xs font-bold px-2 py-1 whitespace-nowrap";
  const tdS = "border border-gray-300 text-center text-xs px-2 py-1";
  const tdA = "border border-gray-300 text-right text-xs px-2 py-1 text-emerald-700 font-medium";
  const totS = "border border-gray-400 bg-amber-50 text-center text-xs font-bold px-2 py-1";
  const totA = "border border-gray-400 bg-amber-50 text-right text-xs font-bold px-2 py-1 text-emerald-800";

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('PEC Ventures Summary');
      const thin = { top:{style:'thin'as const},bottom:{style:'thin'as const},left:{style:'thin'as const},right:{style:'thin'as const} };
      const mkFill = (argb: string) => ({type:'pattern'as const,pattern:'solid'as const,fgColor:{argb}});
      const wFont = {bold:true,color:{argb:'FFFFFFFF'}};

      const itemCols = [...PEC_ITEMS.map(c=>c.label+' Qty'), 'Milk Qty (L)', ...PEC_ITEMS.map(c=>c.label+' Amt (₹)'), 'Milk Amt (₹)', 'Grand Total (₹)'];
      const allCols = ['Month', ...itemCols];

      // Title
      ws.mergeCells(1,1,1,allCols.length);
      const t=ws.getCell('A1'); t.value=`DJ Hospitality — PEC Ventures Yearly Summary — ${summaryYear}`; t.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; t.fill=mkFill('FF4F2B91'); t.alignment={horizontal:'center'}; t.border=thin;

      // Header
      const hdr = ws.addRow(allCols);
      hdr.eachCell((c:any)=>{ c.font=wFont; c.fill=mkFill('FF1A3A5A'); c.border=thin; c.alignment={horizontal:'center',wrapText:true}; });
      ws.columns = allCols.map((_,i)=>({width: i===0?16:14}));
      ws.getRow(2).height = 28;

      // Data
      filteredMonths.forEach(m => {
        const r: PecYearRow = rowsMap.get(m) ?? { month:m, redLabel:0,tataTea:0,coffee:0,sugar:0,ginger:0,biscuit:0,teaCup:0,greenElaychi:0,greenTea:0,blackSalt:0,milkMorning:0,milkEvening:0 };
        const milkQ = getMilkQty(r); const rowTot = getRowTotal(r);
        const vals = [MONTHS[m-1], ...PEC_ITEMS.map(c=>(r[c.key]||0)||''), milkQ||'', ...PEC_ITEMS.map(c=>((r[c.key]||0)*c.rate)||''), (milkQ*PEC_RATES.milk)||'', rowTot||''];
        const dr = ws.addRow(vals);
        dr.eachCell((c:any)=>{c.border=thin;c.alignment={horizontal:'center'};});
      });

      // Totals
      const totVals = ['GRAND TOTAL', ...PEC_ITEMS.map(c=>grandTotQty(c.key)||''), grandMilkQty()||'', ...PEC_ITEMS.map(c=>(grandTotQty(c.key)*c.rate)||''), (grandMilkQty()*PEC_RATES.milk)||'', grandTotal()||''];
      const totRow = ws.addRow(totVals);
      totRow.eachCell((c:any)=>{c.font={bold:true};c.fill=mkFill('FFFFF2CC');c.border=thin;c.alignment={horizontal:'center'};});

      // ---- Summary Sheet (amounts-only, one row per month) ----
      const wsSumm = wb.addWorksheet('Summary');
      const summCols = ['Month', ...PEC_ITEMS.map(c=>c.label+' (₹)'), 'Milk (₹)', 'Grand Total (₹)'];
      wsSumm.mergeCells(1,1,1,summCols.length);
      const sT=wsSumm.getCell('A1'); sT.value=`DJ Hospitality — PEC Ventures Amount Summary — ${summaryYear}`; sT.font={bold:true,size:12,color:{argb:'FFFFFFFF'}}; sT.fill=mkFill('FF4F2B91'); sT.alignment={horizontal:'center'}; sT.border=thin;
      const sHdr=wsSumm.addRow(summCols); sHdr.eachCell((c:any)=>{c.font=wFont;c.fill=mkFill('FF1A3A5A');c.border=thin;c.alignment={horizontal:'center',wrapText:true};});
      wsSumm.getRow(2).height=28;
      wsSumm.columns=summCols.map((_,i)=>({width:i===0?14:18}));
      filteredMonths.forEach(m=>{
        const r:PecYearRow = rowsMap.get(m) ?? {month:m,redLabel:0,tataTea:0,coffee:0,sugar:0,ginger:0,biscuit:0,teaCup:0,greenElaychi:0,greenTea:0,blackSalt:0,milkMorning:0,milkEvening:0};
        const milkAmt=getMilkQty(r)*PEC_RATES.milk; const rTotal=getRowTotal(r);
        const amtVals=[MONTHS[m-1],...PEC_ITEMS.map(c=>((r[c.key]||0)*c.rate)||''),milkAmt||'',rTotal||''];
        const dr=wsSumm.addRow(amtVals); dr.eachCell((c:any)=>{c.border=thin;c.alignment={horizontal:'center'};});
      });
      const gTotVals=['GRAND TOTAL',...PEC_ITEMS.map(c=>(grandTotQty(c.key)*c.rate)||''),(grandMilkQty()*PEC_RATES.milk)||'',grandTotal()||''];
      const gTotRow=wsSumm.addRow(gTotVals); gTotRow.eachCell((c:any)=>{c.font={bold:true};c.fill=mkFill('FFFFF2CC');c.border=thin;c.alignment={horizontal:'center'};});

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download=`PEC_Ventures_Summary_${summaryYear}.xlsx`; a.click();
    } catch(err:any){ toast({title:'Export Failed',description:err.message,variant:'destructive'}); }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Year:</span>
          <select value={summaryYear} onChange={e=>setSummaryYear(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm" data-testid="select-pec-summary-year">
            {Array.from({length:6},(_,i)=>currentYear-2+i).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={handleExportExcel} className="px-3 py-1.5 border rounded text-xs font-medium flex items-center gap-1 text-green-700 border-green-300 hover:bg-green-50" data-testid="btn-pec-summary-export">
          <FileDown className="w-3.5 h-3.5"/>Export Excel
        </button>
      </div>

      {/* Month filter */}
      <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/40 border">
        <span className="text-xs font-semibold text-muted-foreground self-center mr-1">Filter Months:</span>
        <button onClick={()=>setSelectedMonths(allSelected?new Set():new Set(Array.from({length:12},(_,i)=>i+1)))}
          className={`px-2 py-0.5 rounded text-xs font-medium border ${allSelected?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          data-testid="btn-pec-summary-all">
          All
        </button>
        {MONTHS.map((mn,i)=>(
          <button key={i} onClick={()=>toggleMonth(i+1)}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${selectedMonths.has(i+1)?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            data-testid={`btn-pec-month-${i+1}`}>
            {mn.slice(0,3)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="border-collapse min-w-max">
            <thead>
              <tr>
                <th className={thS} rowSpan={2}>Month</th>
                {PEC_ITEMS.map(c=><th key={c.key} className={thS} colSpan={2}>{c.label}</th>)}
                <th className={thS} colSpan={2}>Milk</th>
                <th className={thS} rowSpan={2}>Grand Total</th>
              </tr>
              <tr>
                {PEC_ITEMS.map(c=><><th key={c.key+'q'} className={thS}>Qty</th><th key={c.key+'a'} className={thS}>Amount</th></>)}
                <th className={thS}>Qty (L)</th><th className={thS}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonths.map(m => {
                const r: PecYearRow = rowsMap.get(m) ?? { month:m, redLabel:0,tataTea:0,coffee:0,sugar:0,ginger:0,biscuit:0,teaCup:0,greenElaychi:0,greenTea:0,blackSalt:0,milkMorning:0,milkEvening:0 };
                const milkQ = getMilkQty(r);
                return (
                  <tr key={m} className="hover:bg-muted/30">
                    <td className={`${tdS} font-semibold`}>{MONTHS[m-1]}</td>
                    {PEC_ITEMS.map(c=>(
                      <>
                        <td key={c.key+'q'} className={tdS}>{fq(r[c.key] as number)}</td>
                        <td key={c.key+'a'} className={tdA}>{fa((r[c.key] as number)*c.rate)}</td>
                      </>
                    ))}
                    <td className={tdS}>{fq(milkQ)}</td>
                    <td className={tdA}>{fa(milkQ*PEC_RATES.milk)}</td>
                    <td className={`${tdA} font-bold`}>{fa(getRowTotal(r))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className={totS}>TOTAL</td>
                {PEC_ITEMS.map(c=>(
                  <>
                    <td key={c.key+'q'} className={totS}>{fq(grandTotQty(c.key))}</td>
                    <td key={c.key+'a'} className={totA}>{fa(grandTotQty(c.key)*c.rate)}</td>
                  </>
                ))}
                <td className={totS}>{fq(grandMilkQty())}</td>
                <td className={totA}>{fa(grandMilkQty()*PEC_RATES.milk)}</td>
                <td className={`${totA} text-base`}>{fa(grandTotal())}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PecVenturesForm2Tab({ month, year, loadKey = 0 }: { month: number; year: number; loadKey?: number }) {
  const [activeMeal, setActiveMeal] = useState<'lunch'|'dinner'>('lunch');
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border overflow-hidden text-sm font-medium w-fit">
        <button
          onClick={() => setActiveMeal('lunch')}
          className={`px-4 py-1.5 transition-colors ${activeMeal==='lunch' ? 'bg-orange-500 text-white' : 'hover:bg-muted text-muted-foreground'}`}
          data-testid="btn-pec-meal-lunch">
          🍱 Lunch
        </button>
        <button
          onClick={() => setActiveMeal('dinner')}
          className={`px-4 py-1.5 transition-colors border-l ${activeMeal==='dinner' ? 'bg-indigo-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
          data-testid="btn-pec-meal-dinner">
          🍽️ Dinner
        </button>
      </div>
      <UnichemMealSubTab key={`pec-${activeMeal}-${month}-${year}`} month={month} year={year} location="PEC Ventures" mealType={activeMeal} loadKey={loadKey} />
    </div>
  );
}

// Main Date Entry Tab — with UBL sub-tabs
// ============================================================

const CLIENT_OPTIONS = [
  { value: "dashboard", label: "📊 All Clients Dashboard" },
  { value: "ubl", label: "United Breweries Ltd (UBL)" },
  { value: "unichem", label: "Unichem Laboratories Ltd" },
  { value: "cipla", label: "Cipla Limited" },
  { value: "hul", label: "Hindustan Unilever Limited (HUL)" },
  { value: "pec_ventures", label: "PEC Ventures Private Limited" },
];

export function DateEntryTab() {
  const now = new Date();
  const { data: currentUser } = useCurrentUser();

  const allowedClients = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") return CLIENT_OPTIONS;
    const perms = currentUser.permissions || [];
    const hasAny = perms.includes("dateentry_ubl") || perms.includes("dateentry_cipla") || perms.includes("dateentry_hul");
    return CLIENT_OPTIONS.filter(o => {
      if (o.value === "dashboard") return hasAny;
      if (o.value === "ubl") return perms.includes("dateentry_ubl");
      if (o.value === "unichem") return perms.includes("dateentry_ubl");
      if (o.value === "cipla") return perms.includes("dateentry_cipla");
      if (o.value === "hul") return perms.includes("dateentry_hul") || perms.includes("dateentry_ubl");
      if (o.value === "pec_ventures") return perms.includes("dateentry_ubl") || perms.includes("dateentry_cipla") || perms.includes("dateentry_hul");
      return false;
    });
  }, [currentUser]);

  const [selectedClient, setSelectedClient] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [ublSubTab, setUblSubTab] = useState("format1");
  const [unichEmSubTab, setUnichEmSubTab] = useState("unichem_snacks");
  const [loadKey, setLoadKey] = useState(0);
  const [isLoadPending, setIsLoadPending] = useState(false);

  useEffect(() => {
    if (allowedClients.length > 0 && !allowedClients.find(o => o.value === selectedClient)) {
      setSelectedClient(allowedClients[0].value);
    }
  }, [allowedClients, selectedClient]);

  const handleLoad = () => {
    setIsLoadPending(true);
    setLoadKey(k => k + 1);
    setTimeout(() => setIsLoadPending(false), 1500);
  };

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - 2 + i));
  const { label: billingLabel } = getBillingRange(parseInt(month), parseInt(year));
  const periodLabel = useMemo(() => {
    if (selectedClient === "unichem" || selectedClient === "hul" || selectedClient === "pec_ventures") {
      const m = parseInt(month); const y = parseInt(year);
      const lastDay = getDaysInMonth(m, y);
      return `1 ${MONTHS[m-1].slice(0,3)} ${y} – ${lastDay} ${MONTHS[m-1].slice(0,3)} ${y}`;
    }
    return billingLabel;
  }, [selectedClient, month, year, billingLabel]);

  if (allowedClients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="text-4xl">🔒</div>
        <p className="text-muted-foreground text-sm">You don't have permission to access Date Entry for any client.</p>
        <p className="text-muted-foreground text-xs">Contact your administrator to request access.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5 p-4 rounded-xl bg-muted/40 border">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground shrink-0">Client:</label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="flex-1 sm:w-56 h-10" data-testid="select-date-entry-client"><SelectValue/></SelectTrigger>
            <SelectContent>
              {allowedClients.map(o=>(
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selectedClient !== "dashboard" && (
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium text-muted-foreground shrink-0">Month:</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="flex-1 sm:w-32 h-10" data-testid="select-date-entry-month"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m,i)=>(<SelectItem key={i} value={String(i+1)}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Year:</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24 h-10" data-testid="select-date-entry-year"><SelectValue/></SelectTrigger>
              <SelectContent>
                {years.map(y=><SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedClient !== "dashboard" && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Badge variant="outline" className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 w-fit hidden sm:flex">
              Period: {periodLabel}
            </Badge>
            <Button
              onClick={handleLoad}
              disabled={isLoadPending}
              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
              data-testid="btn-load-data"
            >
              {isLoadPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isLoadPending ? "Loading..." : "Load Data"}
            </Button>
          </div>
        )}
      </div>
      {selectedClient !== "dashboard" && (
        <Badge variant="outline" className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 w-fit mb-3 sm:hidden">
          Period: {periodLabel}
        </Badge>
      )}

      {/* Client-specific content */}
      {selectedClient === "dashboard" && (
        <DateEntryDashboard year={parseInt(year)} />
      )}
      {selectedClient === "ubl" && (
        <Tabs value={ublSubTab} onValueChange={setUblSubTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="format1" className="text-xs sm:text-sm" data-testid="tab-ubl-format1">
              Format 1 — Bill Data Sheet
            </TabsTrigger>
            <TabsTrigger value="format2" className="text-xs sm:text-sm" data-testid="tab-ubl-format2">
              Format 2 — Lunch Per Day
            </TabsTrigger>
            <TabsTrigger value="ubl_summary" className="text-xs sm:text-sm" data-testid="tab-ubl-summary">
              Summary
            </TabsTrigger>
          </TabsList>
          <TabsContent value="format1">
            <div className="mb-2 text-sm text-muted-foreground font-medium">United Breweries Ltd — Food Items Bill Data Sheet (with rates)</div>
            <UblDateEntryTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="format2">
            <div className="mb-2 text-sm text-muted-foreground font-medium">United Breweries Ltd — Number of Lunch Per Day (Permanent / Casual / Contractual / Canteen)</div>
            <UblLunchEntryTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="ubl_summary">
            <div className="mb-2 text-sm text-muted-foreground font-medium">UBL — Combined Summary — Format 1 (Bill Data) + Format 2 (Lunch Per Day) — Monthly &amp; Yearly view</div>
            <UblSummaryTab month={parseInt(month)} year={parseInt(year)}/>
          </TabsContent>
        </Tabs>
      )}
      {selectedClient === "unichem" && (
        <Tabs value={unichEmSubTab} onValueChange={setUnichEmSubTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="unichem_snacks" className="text-xs sm:text-sm" data-testid="tab-unichem-snacks">
              Form 1 — Snacks
            </TabsTrigger>
            <TabsTrigger value="unichem_lunch" className="text-xs sm:text-sm" data-testid="tab-unichem-lunch">
              Form 2 — Lunch &amp; Dinner
            </TabsTrigger>
            <TabsTrigger value="unichem_summary" className="text-xs sm:text-sm" data-testid="tab-unichem-summary">
              Summary
            </TabsTrigger>
          </TabsList>
          <TabsContent value="unichem_snacks">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Unichem Laboratories Ltd — Breakfast, Evening Snacks, Night Snacks &amp; Sunday Extra Snacks (1st to last day of month)</div>
            <UnichemSnackTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="unichem_lunch">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Unichem Laboratories Ltd — Lunch &amp; Dinner per Location (1st to last day of month)</div>
            <UnichemLunchTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="unichem_summary">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Unichem — Combined Summary — All Locations (Snacks + Lunch + Dinner) — Monthly &amp; Yearly view</div>
            <UnichemSummaryTab month={parseInt(month)} year={parseInt(year)}/>
          </TabsContent>
        </Tabs>
      )}
      {selectedClient === "cipla" && (
        <Tabs defaultValue="cipla_entry">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="cipla_entry" className="text-xs sm:text-sm" data-testid="tab-cipla-entry">
              Data Entry
            </TabsTrigger>
            <TabsTrigger value="cipla_summary" className="text-xs sm:text-sm" data-testid="tab-cipla-summary">
              Summary
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cipla_entry">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Cipla Limited — Breakfast / Lunch / Dinner (Coopen / Coin / Sign / Machine)</div>
            <CiplaDateEntryTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="cipla_summary">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Cipla — Summary — Breakfast / Lunch / Dinner (All Methods Combined) — Monthly &amp; Yearly view</div>
            <CiplaSummaryTab month={parseInt(month)} year={parseInt(year)}/>
          </TabsContent>
        </Tabs>
      )}
      {selectedClient === "pec_ventures" && (
        <Tabs defaultValue="pec_form1">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="pec_form1" className="text-xs sm:text-sm" data-testid="tab-pec-form1">
              Form 1 — Canteen Expense
            </TabsTrigger>
            <TabsTrigger value="pec_form2" className="text-xs sm:text-sm" data-testid="tab-pec-form2">
              Form 2 — Lunch &amp; Dinner
            </TabsTrigger>
            <TabsTrigger value="pec_summary" className="text-xs sm:text-sm" data-testid="tab-pec-summary">
              Yearly Summary
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pec_form1">
            <div className="mb-2 text-sm text-muted-foreground font-medium">PEC Ventures Private Limited — Canteen Expense Per Day (1st to last day of month)</div>
            <PecVenturesTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="pec_form2">
            <div className="mb-2 text-sm text-muted-foreground font-medium">PEC Ventures Private Limited — Lunch &amp; Dinner Meal Count (1st to last day of month)</div>
            <PecVenturesForm2Tab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="pec_summary">
            <div className="mb-2 text-sm text-muted-foreground font-medium">PEC Ventures — Year-wise Summary (all 11 items · Qty &amp; Amount · Month filter · Excel export)</div>
            <PecVentureSummaryTab currentYear={parseInt(year)}/>
          </TabsContent>
        </Tabs>
      )}
      {selectedClient === "hul" && (
        <Tabs defaultValue="hul_kpf">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="hul_kpf" className="text-xs sm:text-sm" data-testid="tab-hul-kpf">
              KPF
            </TabsTrigger>
            <TabsTrigger value="hul_kpf_exec" className="text-xs sm:text-sm" data-testid="tab-hul-kpf-exec">
              KPF Exec Snacks
            </TabsTrigger>
            <TabsTrigger value="hul_tec" className="text-xs sm:text-sm" data-testid="tab-hul-tec">
              TEC
            </TabsTrigger>
            <TabsTrigger value="hul_special_order" className="text-xs sm:text-sm" data-testid="tab-hul-special-order">
              Special Order
            </TabsTrigger>
            <TabsTrigger value="hul_summary" className="text-xs sm:text-sm" data-testid="tab-hul-summary">
              Summary
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hul_kpf">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Hindustan Unilever Limited — KPF — Meal Charges &amp; Guest Meal Charges (1st to last day of month)</div>
            <HulLocationTab location="KPF" month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="hul_kpf_exec">
            <div className="mb-2 text-sm text-muted-foreground font-medium">HUL KPF — Number of Snacks Per Day For Executives &amp; Managers (1st to last day of month)</div>
            <HulKpfExecSnacksTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="hul_tec">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Hindustan Unilever Limited — TEC — Meal Charges &amp; Guest Meal Charges (1st to last day of month)</div>
            <HulLocationTab location="TEC" month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="hul_special_order">
            <div className="mb-2 text-sm text-muted-foreground font-medium">HUL — Special Order Entry (Sl. No., Particulars, Qty, Rate Per Plate, Total)</div>
            <HulSpecialOrderTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="hul_summary">
            <div className="mb-2 text-sm text-muted-foreground font-medium">HUL Combined Summary — KPF, TEC, KPF Exec Snacks (full month data + combined totals)</div>
            <HulSummaryTab month={parseInt(month)} year={parseInt(year)}/>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
