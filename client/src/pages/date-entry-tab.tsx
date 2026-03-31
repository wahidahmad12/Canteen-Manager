import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-reports";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2, Printer, Loader2, Save, AlertTriangle, CheckCircle2, FileDown, FileUp } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function normDate(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
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
      return data.map((r: UblRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
    },
  });

  const handleAutoFill = (freshRows?: UblRow[]) => {
    const source = freshRows ?? dbRows;
    const generated = generateBillingRows(month, year, ublRowDefaults);
    const existing = source.reduce((acc: Record<string, UblRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g));
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
      const row = ws.addRow(UBL1_COLS.map(c => c.field==="month" ? calMonth : ((r as any)[c.field] ?? "")));
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
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as UblRow);
      });
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
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
    setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g));
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
      return data.map((r: UblRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
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
      const row = ws.addRow(UBL2_COLS.map(c => c.field==="month" ? calMonth : ((r as any)[c.field] ?? "")));
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
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as UblLunchRow);
      });
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
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
      return data.map((r: SnackRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
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
      if (id) await updateMutation.mutateAsync({ id, data });
      else await createMutation.mutateAsync({ ...row });
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
      const row = ws.addRow(SNACK_COLS.map(c => (r as any)[c.field] ?? ""));
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
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as SnackRow);
      });
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
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
      return data.map((r: LunchRow) => ({ ...r, entryDate: normDate(r.entryDate), mealType: r.mealType || mealType }));
    },
  });

  useEffect(() => {
    if (loadKey > 0) {
      refetch().then(result => {
        const freshRows = (result.data || []) as LunchRow[];
        const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
        const existing = freshRows.reduce((acc: Record<string, LunchRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
        setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g));
      });
    }
  }, [loadKey]);

  // Always compute the full month grid merged with DB data (auto-load, no Auto-Fill click needed)
  const fullRows = useMemo(() => {
    const generated = generateMonthRows(month, year, (d, m, y) => unichEmLunchRowDefaults(d, m, y, location, mealType));
    const existing = dbRows.reduce((acc: Record<string, LunchRow>, r) => { acc[normDate(r.entryDate)] = r; return acc; }, {});
    return generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g);
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
    const merged = generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g);
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
      const row = ws.addRow(MEAL_COLS.map(c => (r as any)[c.field] ?? ""));
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
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as LunchRow);
      });
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
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
      return data.map((r: CiplaRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
    },
  });

  const handleAutoFill = (freshRows?: CiplaRow[]) => {
    const source = freshRows ?? dbRows;
    const generated = generateBillingRows(month, year, ciplaRowDefaults);
    const existing = source.reduce((acc: Record<string, CiplaRow>, r) => { acc[r.entryDate] = r; return acc; }, {});
    setLocalRows(generated.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g));
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
      const row = ws.addRow(CIPLA_COLS.map(c => c.field==="month" ? calMonth : ((r as any)[c.field] ?? "")));
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
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as CiplaRow);
      });
      setLocalRows(imported);
      toast({ title:`Imported ${imported.length} rows`, description:"Review and click Save All to persist." });
    } catch(err:any) {
      toast({ title:"Import Failed", description:err.message, variant:"destructive" });
    }
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
  _dirty?: boolean;
};

function execSnackRowDefaults(dateStr: string, month: number, year: number): ExecSnackRow {
  return { entryDate: dateStr, month, year, weekDay: getWeekDay(dateStr), snacks: 0, biscuit: 0, chips: 0, coldDrinkWater: 0, _dirty: true };
}

const EXEC_SNACK_FIELDS: (keyof ExecSnackRow)[] = ['snacks', 'biscuit', 'chips', 'coldDrinkWater'];
const EXEC_SNACK_LABELS = ['Snacks', 'Biscuit', 'Chips', 'Cold Drink & Water'];

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
      return data.map((r: ExecSnackRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
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
    return scaffold.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks', month, year] }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/hul-kpf-exec-snacks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks', month, year] }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/hul-kpf-exec-snacks/${id}`, { method: 'DELETE', credentials: 'include' }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/hul-kpf-exec-snacks', month, year] }),
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
    const dirty = rows.filter(r => r._dirty && (r.snacks || r.biscuit || r.chips || r.coldDrinkWater));
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
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const FIELD_MAP: Record<string, keyof ExecSnackRow> = {
        'Date': 'entryDate', 'Days': 'weekDay',
        'Snacks': 'snacks', 'Biscuit': 'biscuit', 'Chips': 'chips',
        'Cold Drink & Water': 'coldDrinkWater', 'Cold Drink and Water': 'coldDrinkWater',
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
      setLocalRows(imported);
      toast({ title: `Imported ${imported.length} rows`, description: 'Review and click Save All to persist.' });
    } catch (err: any) { toast({ title: 'Import Failed', description: err.message, variant: 'destructive' }); }
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
    ws.mergeCells('A1:G1');
    const t1 = ws.getCell('A1'); t1.value = 'DJ Hospitality & Facility Management Pvt. Ltd.'; t1.font={bold:true,size:13}; t1.alignment={horizontal:'center'}; t1.border=thin;
    ws.mergeCells('A2:G2');
    const t2 = ws.getCell('A2'); t2.value = `Number of Snacks Per Day For Executives & Managers - ${MONTHS[month-1]} - ${year}`; t2.font={bold:true,size:11}; t2.alignment={horizontal:'center'}; t2.border=thin;
    const hdr = ws.addRow(['Sl.No.','Date','Days','Snacks','Biscuit','Chips','Cold Drink & Water']);
    hdr.eachCell(cell => { cell.font={bold:true}; cell.border=thin; cell.alignment={horizontal:'center'}; });
    ws.columns = [7,14,8,10,10,10,16].map(w=>({width:w}));
    rows.forEach((r,i) => {
      const row = ws.addRow([i+1, safeFormat(r.entryDate), r.weekDay, r.snacks||'', r.biscuit||'', r.chips||'', r.coldDrinkWater||'']);
      if (isSunday(r.entryDate)) row.eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFB380'}}; });
      row.eachCell(cell => { cell.border=thin; cell.alignment={horizontal:'center'}; });
    });
    const tot = ws.addRow(['','Total','', rows.reduce((s,r)=>s+(r.snacks||0),0), rows.reduce((s,r)=>s+(r.biscuit||0),0), rows.reduce((s,r)=>s+(r.chips||0),0), rows.reduce((s,r)=>s+(r.coldDrinkWater||0),0)]);
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
            <th>Sl.No.</th><th>Date</th><th>Days</th><th>Snacks</th><th>Biscuit</th><th>Chips</th><th>Cold Drink &amp; Water</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} className={isSunday(row.entryDate)?"sun-row":""}>
              <td>{i+1}</td><td>{safeFormat(row.entryDate)}</td><td>{row.weekDay}</td>
              <td>{row.snacks||""}</td><td>{row.biscuit||""}</td><td>{row.chips||""}</td><td>{row.coldDrinkWater||""}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3}>Total</td>
            <td>{rows.reduce((s,r)=>s+(r.snacks||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.biscuit||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.chips||0),0)||""}</td>
            <td>{rows.reduce((s,r)=>s+(r.coldDrinkWater||0),0)||""}</td>
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
              <th colSpan={7} style={{padding:'8px', border:'1px solid #ccc', textAlign:'center', fontSize:13, fontWeight:'bold', background:'#fff'}}>
                DJ Hospitality &amp; Facility Management Pvt. Ltd.
              </th>
            </tr>
            <tr>
              <th colSpan={7} style={{padding:'5px', border:'1px solid #ccc', textAlign:'center', fontSize:11, background:'#fff'}}>
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
      return data.map((r: HulRow) => ({ ...r, entryDate: normDate(r.entryDate) }));
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
    return scaffold.map(g => existing[g.entryDate] ? { ...existing[g.entryDate], _dirty: false } : g);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/hul-date-entries', month, year, location] }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/hul-date-entries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/hul-date-entries', month, year, location] }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/hul-date-entries/${id}`, { method: 'DELETE', credentials: 'include' }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/hul-date-entries', month, year, location] }),
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
          r[f] = (f === 'entryDate' || f === 'weekDay') ? String(v ?? '').trim() : (parseInt(String(v || 0)) || 0);
        });
        if (!r.entryDate || String(r.entryDate).toLowerCase().includes('total')) return;
        r.entryDate = normDate(r.entryDate);
        if (!r.weekDay) r.weekDay = getWeekDay(r.entryDate);
        imported.push(r as HulRow);
      });
      if (!imported.length) { toast({ title: 'No data found in file', variant: 'destructive' }); return; }
      setLocalRows(imported);
      toast({ title: `Imported ${imported.length} rows`, description: 'Review and click Save All to persist.' });
    } catch (err: any) { toast({ title: 'Import Failed', description: err.message, variant: 'destructive' }); }
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
          <Button size="sm" variant="outline" onClick={() => importRefHul.current?.click()} className="h-9 text-blue-700 border-blue-300 hover:bg-blue-50" data-testid="btn-hul-import">
            <FileUp className="w-3.5 h-3.5 mr-1"/>Import Excel
          </Button>
          <input ref={importRefHul} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcelHul}/>
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
// Main Date Entry Tab — with UBL sub-tabs
// ============================================================

const CLIENT_OPTIONS = [
  { value: "ubl", label: "United Breweries Ltd (UBL)" },
  { value: "unichem", label: "Unichem Laboratories Ltd" },
  { value: "cipla", label: "Cipla Limited" },
  { value: "hul", label: "Hindustan Unilever Limited (HUL)" },
];

export function DateEntryTab() {
  const now = new Date();
  const { data: currentUser } = useCurrentUser();

  const allowedClients = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") return CLIENT_OPTIONS;
    const perms = currentUser.permissions || [];
    return CLIENT_OPTIONS.filter(o => {
      if (o.value === "ubl") return perms.includes("dateentry_ubl");
      if (o.value === "unichem") return perms.includes("dateentry_ubl");
      if (o.value === "cipla") return perms.includes("dateentry_cipla");
      if (o.value === "hul") return perms.includes("dateentry_hul") || perms.includes("dateentry_ubl");
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
    if (selectedClient === "unichem" || selectedClient === "hul") {
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
            <SelectTrigger className="flex-1 sm:w-52 h-10" data-testid="select-date-entry-client"><SelectValue/></SelectTrigger>
            <SelectContent>
              {allowedClients.map(o=>(
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm font-medium text-muted-foreground shrink-0">Month:</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="flex-1 sm:w-32 h-10" data-testid="select-date-entry-month"><SelectValue/></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m,i)=>(<SelectItem key={i} value={String(i+1)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
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
      </div>
      <Badge variant="outline" className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 w-fit mb-3 sm:hidden">
        Period: {periodLabel}
      </Badge>

      {/* Client-specific content */}
      {selectedClient === "ubl" && (
        <Tabs value={ublSubTab} onValueChange={setUblSubTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="format1" className="text-xs sm:text-sm" data-testid="tab-ubl-format1">
              Format 1 — Bill Data Sheet
            </TabsTrigger>
            <TabsTrigger value="format2" className="text-xs sm:text-sm" data-testid="tab-ubl-format2">
              Format 2 — Lunch Per Day
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
          </TabsList>
          <TabsContent value="unichem_snacks">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Unichem Laboratories Ltd — Breakfast, Evening Snacks, Night Snacks &amp; Sunday Extra Snacks (1st to last day of month)</div>
            <UnichemSnackTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
          <TabsContent value="unichem_lunch">
            <div className="mb-2 text-sm text-muted-foreground font-medium">Unichem Laboratories Ltd — Lunch &amp; Dinner per Location (1st to last day of month)</div>
            <UnichemLunchTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
          </TabsContent>
        </Tabs>
      )}
      {selectedClient === "cipla" && (
        <>
          <div className="mb-2 text-sm text-muted-foreground font-medium">Cipla Limited — Breakfast / Lunch / Dinner (Coopen / Coin / Sign / Machine)</div>
          <CiplaDateEntryTab month={parseInt(month)} year={parseInt(year)} loadKey={loadKey}/>
        </>
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
        </Tabs>
      )}
    </div>
  );
}
