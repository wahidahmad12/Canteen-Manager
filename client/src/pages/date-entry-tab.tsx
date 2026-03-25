import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2, Printer, Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getWeekDay(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS[d.getDay()] || "";
}
const isSunday = (dateStr: string) => { try { return new Date(dateStr+"T00:00:00").getDay() === 0; } catch { return false; } };
const isWed = (dateStr: string) => { try { return new Date(dateStr+"T00:00:00").getDay() === 3; } catch { return false; } };

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

function UblDateEntryTab({ month, year }: { month: number; year: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [localRows, setLocalRows] = useState<UblRow[]>([]);

  const { data: dbRows = [], isLoading } = useQuery<UblRow[]>({
    queryKey: ['/api/ubl-date-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/ubl-date-entries?month=${month}&year=${year}`, { credentials: "include" });
      return res.json();
    },
  });

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
      row._dirty = true;
      updated[idx] = row;
      return updated;
    });
  };

  const handleAddRow = () => {
    const defaultDate = `${year}-${String(month).padStart(2,'0')}-21`;
    syncRows();
    setLocalRows(prev => [...prev, ublRowDefaults(defaultDate, month, year)]);
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
      body{font-family:Arial,sans-serif;margin:10px;font-size:11px;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th,td{border:1px solid #333;padding:3px 4px;text-align:center;font-size:10px;}
      th{background:#1a3a5a;color:white;font-size:9px;}
      .total-row{font-weight:bold;background:#e8f0fe;}
      @media print{@page{margin:8mm;size:A3 landscape;}}
    </style></head><body>${printContent}</body></html>`);
    win.document.close();
    win.print();
  };

  const totalTea = rows.reduce((s,r)=>s+(r.tea1||0)+(r.tea2||0)+(r.tea3||0)+(r.tea4||0)+(r.tea5||0)+(r.tea6||0),0);
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
    <input type="number" min={0} value={(row as any)[field]??0}
      onChange={e=>handleCellChange(idx,field,e.target.value)}
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
            <th rowSpan={2} style={{width:30}}>Sl.</th>
            <th rowSpan={2} style={{width:75}}>Date</th>
            <th rowSpan={2} style={{width:35}}>Month</th>
            <th rowSpan={2} style={{width:40}}>Week Day</th>
            <th colSpan={3} style={{background:"#4a5568",color:"white"}}>5:30 AM to 9:00 AM</th>
            <th colSpan={3} style={{background:"#2d6a4f",color:"white"}}>11:30 AM to 1:30 PM</th>
            <th colSpan={4} style={{background:"#6b2d2d",color:"white"}}>3:30 PM to 7:00 PM</th>
            <th colSpan={2} style={{background:"#1a3a5a",color:"white"}}>10:00 PM to 11:30 PM</th>
            <th colSpan={1} style={{background:"#4a2040",color:"white"}}>12:00 AM</th>
            <th colSpan={1} style={{background:"#1a4060",color:"white"}}>4:00 AM</th>
          </tr>
          <tr>
            <th>Tea</th><th>Biscuit</th><th>Breakfast</th>
            <th>Lunch</th><th>Mutton</th><th>Tea</th>
            <th>Biscuit</th><th>Teffin</th><th>BoiledEgg</th><th>Tea</th>
            <th>Dinner</th><th>Tea</th><th>Tea</th><th>Tea</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>{
            const bg=isSunday(row.entryDate)?"#ffa500":isWed(row.entryDate)?"#90EE90":"transparent";
            return (
              <tr key={i} style={{background:bg}}>
                <td>{i+1}</td>
                <td>{row.entryDate?format(new Date(row.entryDate+"T00:00:00"),"dd-MM-yyyy"):""}</td>
                <td>{row.month}</td><td>{row.weekDay}</td>
                <td>{row.tea1||""}</td><td>{row.biscuit1||""}</td><td>{row.breakfast||""}</td>
                <td>{row.lunch||""}</td><td>{row.mutton||""}</td><td>{row.tea2||""}</td>
                <td>{row.biscuit2||""}</td><td>{row.tiffin||""}</td><td>{row.boiledEgg||""}</td><td>{row.tea3||""}</td>
                <td>{row.dinner||""}</td><td>{row.tea4||""}</td>
                <td>{row.tea5||""}</td><td>{row.tea6||""}</td>
              </tr>
            );
          })}
          <tr style={{fontWeight:"bold",background:"#e8f0fe"}}>
            <td colSpan={4}>Total</td>
            <td>{rows.reduce((s,r)=>s+(r.tea1||0),0)}</td>
            <td>{rows.reduce((s,r)=>s+(r.biscuit1||0),0)}</td>
            <td>{totalBreakfast}</td>
            <td>{totalLunch}</td><td>{totalMutton}</td>
            <td>{rows.reduce((s,r)=>s+(r.tea2||0),0)}</td>
            <td>{rows.reduce((s,r)=>s+(r.biscuit2||0),0)}</td>
            <td>{totalTiffin}</td><td>{totalBoiledEgg}</td>
            <td>{rows.reduce((s,r)=>s+(r.tea3||0),0)}</td>
            <td>{totalDinner}</td>
            <td>{rows.reduce((s,r)=>s+(r.tea4||0),0)}</td>
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
        <Button size="sm" onClick={handleAddRow} className="bg-blue-600 text-white"><Plus className="w-3.5 h-3.5 mr-1"/>Add Row</Button>
        <Button size="sm" onClick={handleSaveAll} className="bg-green-600 text-white" disabled={createMutation.isPending||updateMutation.isPending}><Save className="w-3.5 h-3.5 mr-1"/>Save All</Button>
        <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-1"/>Print</Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span className="inline-block w-3 h-3 rounded" style={{background:"#ffa500"}}></span>Sunday
          <span className="inline-block w-3 h-3 rounded" style={{background:"#90EE90"}}></span>Wednesday
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:"collapse",minWidth:1400,fontFamily:"Arial,sans-serif",fontSize:12}}>
          <thead>
            <tr style={{background:"#1a3a5a",color:"white"}}>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:32}}>Sl</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:100}}>Date</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:50}}>Month</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:44}}>Day</th>
              <th colSpan={3} style={{padding:"4px",border:"1px solid #334",background:"#4a5568"}}>5:30-9:00 AM</th>
              <th colSpan={3} style={{padding:"4px",border:"1px solid #334",background:"#2d6a4f"}}>11:30AM-1:30PM</th>
              <th colSpan={4} style={{padding:"4px",border:"1px solid #334",background:"#6b2d2d"}}>3:30-7:00 PM</th>
              <th colSpan={2} style={{padding:"4px",border:"1px solid #334",background:"#1a3a5a"}}>10-11:30 PM</th>
              <th style={{padding:"4px",border:"1px solid #334",background:"#4a2040"}}>12AM</th>
              <th style={{padding:"4px",border:"1px solid #334",background:"#1a4060"}}>4AM</th>
              <th rowSpan={2} style={{padding:"4px",border:"1px solid #334",width:40}}>Act</th>
            </tr>
            <tr style={{background:"#2a4a6a",color:"white"}}>
              {["Tea","Biscuit","Breakfast","Lunch","Mutton","Tea","Biscuit","Teffin","BoiledEgg","Tea","Dinner","Tea","Tea","Tea"].map((c,i)=>(
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
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.month}</td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.weekDay}</td>
                  {(["tea1","biscuit1","breakfast","lunch","mutton","tea2","biscuit2","tiffin","boiledEgg","tea3","dinner","tea4","tea5","tea6"] as (keyof UblRow)[]).map(f=>(
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
              {(["tea1","biscuit1","breakfast","lunch","mutton","tea2","biscuit2","tiffin","boiledEgg","tea3","dinner","tea4","tea5","tea6"] as (keyof UblRow)[]).map(f=>(
                <td key={f} style={{border:"1px solid #ccc",textAlign:"center",padding:"4px",fontSize:12}}>
                  {rows.reduce((s,r)=>s+((r as any)[f]||0),0)}
                </td>
              ))}
              <td style={{border:"1px solid #ccc"}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
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

function UblLunchEntryTab({ month, year }: { month: number; year: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [localRows, setLocalRows] = useState<UblLunchRow[]>([]);

  const { data: dbRows = [], isLoading } = useQuery<UblLunchRow[]>({
    queryKey: ['/api/ubl-lunch-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/ubl-lunch-entries?month=${month}&year=${year}`, { credentials:"include" });
      return res.json();
    },
  });

  // Also load Format 1 data for cross-validation
  const { data: f1Rows = [] } = useQuery<UblRow[]>({
    queryKey: ['/api/ubl-date-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/ubl-date-entries?month=${month}&year=${year}`, { credentials:"include" });
      return res.json();
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

  const handleAddRow = () => {
    const defaultDate = `${year}-${String(month).padStart(2,'0')}-21`;
    syncRows();
    setLocalRows(prev => [...prev, lunchRowDefaults(defaultDate, month, year)]);
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

  const numFld = (row: UblLunchRow, idx: number, field: keyof UblLunchRow, w=56) => (
    <input type="number" min={0} value={(row as any)[field]??0}
      onChange={e=>handleCellChange(idx,field,e.target.value)}
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
                <td>{row.entryDate?format(new Date(row.entryDate+"T00:00:00"),"dd-MM-yyyy"):""}</td>
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
                  {r.entryDate?format(new Date(r.entryDate+"T00:00:00"),"dd-MM-yyyy"):"?"}: Format2={f2Total} vs Format1 Lunch+Mutton={f1Total}
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
        <Button size="sm" onClick={handleAddRow} className="bg-blue-600 text-white"><Plus className="w-3.5 h-3.5 mr-1"/>Add Row</Button>
        <Button size="sm" onClick={handleSaveAll} className="bg-green-600 text-white" disabled={createMutation.isPending||updateMutation.isPending}><Save className="w-3.5 h-3.5 mr-1"/>Save All</Button>
        <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-1"/>Print</Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span className="inline-block w-3 h-3 rounded" style={{background:"#ffa500"}}></span>Sunday
          <span className="inline-block w-3 h-3 rounded bg-red-200"></span>Mismatch
        </div>
      </div>

      {/* Editable Table */}
      <div className="overflow-x-auto rounded-xl border shadow-sm">
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

function CiplaDateEntryTab({ month, year }: { month: number; year: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [localRows, setLocalRows] = useState<CiplaRow[]>([]);

  const { data: dbRows = [], isLoading } = useQuery<CiplaRow[]>({
    queryKey: ['/api/cipla-date-entries', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/cipla-date-entries?month=${month}&year=${year}`, { credentials:"include" });
      return res.json();
    },
  });

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

  const handleAddRow = () => {
    const defaultDate = `${year}-${String(month).padStart(2,'0')}-21`;
    syncRows();
    setLocalRows(prev => [...prev, ciplaRowDefaults(defaultDate, month, year)]);
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
  const totBfMachine=rows.reduce((s,r)=>s+(r.breakfastMachine||0),0);
  const totLuCoopen=rows.reduce((s,r)=>s+(r.lunchCoopen||0),0);
  const totLuCoin=rows.reduce((s,r)=>s+(r.lunchCoin||0),0);
  const totLuSign=rows.reduce((s,r)=>s+(r.lunchSign||0),0);
  const totLuTotal=totLuCoopen+totLuCoin+totLuSign;
  const totLuMachine=rows.reduce((s,r)=>s+(r.lunchMachine||0),0);
  const totDiCoopen=rows.reduce((s,r)=>s+(r.dinnerCoopen||0),0);
  const totDiCoin=rows.reduce((s,r)=>s+(r.dinnerCoin||0),0);
  const totDiSign=rows.reduce((s,r)=>s+(r.dinnerSign||0),0);
  const totDiTotal=totDiCoopen+totDiCoin+totDiSign;
  const totDiMachine=rows.reduce((s,r)=>s+(r.dinnerMachine||0),0);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('','_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Cipla Bill Data Sheet</title><style>
      body{font-family:Arial,sans-serif;margin:10px;font-size:11px;}
      h3,h4,p{text-align:center;margin:2px 0;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th,td{border:1px solid #333;padding:3px 4px;text-align:center;font-size:10px;}
      th{background:#1a3a5a;color:white;font-size:9px;}
      .orange{background:#ffa500 !important;}
      .total-row{font-weight:bold;background:#e8f0fe;}
      @media print{@page{margin:8mm;size:A3 landscape;}}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const numFld = (row: CiplaRow, idx: number, field: keyof CiplaRow, w=50) => (
    <input type="number" min={0} value={(row as any)[field]??0}
      onChange={e=>handleCellChange(idx,field,e.target.value)}
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
            <th rowSpan={2} style={{width:30}}>Sl.</th>
            <th rowSpan={2} style={{width:75}}>Date</th>
            <th rowSpan={2} style={{width:40}}>Month</th>
            <th rowSpan={2} style={{width:40}}>Week Day</th>
            <th colSpan={6} style={{background:"#4a5568",color:"white"}}>Breakfast</th>
            <th colSpan={6} style={{background:"#2d6a4f",color:"white"}}>Lunch</th>
            <th colSpan={6} style={{background:"#1a3a5a",color:"white"}}>Dinner</th>
          </tr>
          <tr>
            <th>Coopen</th><th>Coin</th><th>Sign</th><th>Total</th><th>Machine</th><th>Diff</th>
            <th>Coopen</th><th>Coin</th><th>Sign</th><th>Total</th><th>Machine</th><th>Diff</th>
            <th>Coopen</th><th>Coin</th><th>Sign</th><th>Total</th><th>Machine</th><th>Diff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>{
            const bfTotal=(row.breakfastCoopen||0)+(row.breakfastCoin||0)+(row.breakfastSign||0);
            const luTotal=(row.lunchCoopen||0)+(row.lunchCoin||0)+(row.lunchSign||0);
            const diTotal=(row.dinnerCoopen||0)+(row.dinnerCoin||0)+(row.dinnerSign||0);
            const bfDiff=(row.breakfastCoopen||0)-(row.breakfastMachine||0);
            const luDiff=(row.lunchCoopen||0)-(row.lunchMachine||0);
            const diDiff=(row.dinnerCoopen||0)-(row.dinnerMachine||0);
            return (
              <tr key={i} style={{background:isSunday(row.entryDate)?"#ffa500":"transparent"}}>
                <td>{i+1}</td>
                <td>{row.entryDate?format(new Date(row.entryDate+"T00:00:00"),"dd-MM-yyyy"):""}</td>
                <td>{row.month}</td><td>{row.weekDay}</td>
                <td>{row.breakfastCoopen||""}</td><td>{row.breakfastCoin||""}</td><td>{row.breakfastSign||""}</td><td>{bfTotal||""}</td><td>{row.breakfastMachine||""}</td><td style={{color:bfDiff!==0?"#c00":"inherit"}}>{(row.breakfastCoopen||row.breakfastMachine)?bfDiff:""}</td>
                <td>{row.lunchCoopen||""}</td><td>{row.lunchCoin||""}</td><td>{row.lunchSign||""}</td><td>{luTotal||""}</td><td>{row.lunchMachine||""}</td><td style={{color:luDiff!==0?"#c00":"inherit"}}>{(row.lunchCoopen||row.lunchMachine)?luDiff:""}</td>
                <td>{row.dinnerCoopen||""}</td><td>{row.dinnerCoin||""}</td><td>{row.dinnerSign||""}</td><td>{diTotal||""}</td><td>{row.dinnerMachine||""}</td><td style={{color:diDiff!==0?"#c00":"inherit"}}>{(row.dinnerCoopen||row.dinnerMachine)?diDiff:""}</td>
              </tr>
            );
          })}
          <tr style={{fontWeight:"bold",background:"#e8f0fe"}}>
            <td colSpan={4}>Total</td>
            <td>{totBfCoopen}</td><td>{totBfCoin}</td><td>{totBfSign}</td><td>{totBfTotal}</td><td>{totBfMachine}</td><td>{totBfCoopen-totBfMachine}</td>
            <td>{totLuCoopen}</td><td>{totLuCoin}</td><td>{totLuSign}</td><td>{totLuTotal}</td><td>{totLuMachine}</td><td>{totLuCoopen-totLuMachine}</td>
            <td>{totDiCoopen}</td><td>{totDiCoin}</td><td>{totDiSign}</td><td>{totDiTotal}</td><td>{totDiMachine}</td><td>{totDiCoopen-totDiMachine}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" onClick={handleAddRow} className="bg-blue-600 text-white"><Plus className="w-3.5 h-3.5 mr-1"/>Add Row</Button>
        <Button size="sm" onClick={handleSaveAll} className="bg-green-600 text-white" disabled={createMutation.isPending||updateMutation.isPending}><Save className="w-3.5 h-3.5 mr-1"/>Save All</Button>
        <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-1"/>Print</Button>
      </div>
      <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span style={{display:"inline-block",width:14,height:14,background:"#fff7ed",border:"1px solid #c97316",borderRadius:2}}/> Machine Data — manually enter</span>
        <span className="flex items-center gap-1"><span style={{display:"inline-block",width:14,height:14,background:"#f0f4ff",border:"1px solid #ccc",borderRadius:2}}/> Total — auto calculated</span>
      </div>
      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <table style={{borderCollapse:"collapse",minWidth:900,fontFamily:"Arial,sans-serif",fontSize:12}}>
          <thead>
            <tr style={{background:"#1a3a5a",color:"white"}}>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:32}}>Sl</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:100}}>Date</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:46}}>Month</th>
              <th rowSpan={2} style={{padding:"6px 4px",border:"1px solid #334",width:44}}>Day</th>
              <th colSpan={5} style={{padding:"4px",border:"1px solid #334",background:"#4a5568"}}>Breakfast</th>
              <th colSpan={5} style={{padding:"4px",border:"1px solid #334",background:"#2d6a4f"}}>Lunch</th>
              <th colSpan={5} style={{padding:"4px",border:"1px solid #334",background:"#1a3a5a"}}>Dinner</th>
              <th rowSpan={2} style={{padding:"4px",border:"1px solid #334",width:40}}>Act</th>
            </tr>
            <tr style={{background:"#2a4a6a",color:"white"}}>
              {["Coopen","Coin","Sign","Total","Machine","Coopen","Coin","Sign","Total","Machine","Coopen","Coin","Sign","Total","Machine"].map((c,i)=>(
                <th key={i} style={{padding:"4px 2px",border:"1px solid #334",fontSize:10,background:c==="Machine"?"#b45309":undefined}}>{c}</th>
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
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.month}</td>
                  <td style={{textAlign:"center",border:"1px solid #ccc",fontSize:11}}>{row.weekDay}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"breakfastCoopen")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"breakfastCoin")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"breakfastSign")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",background:"#f0f4ff"}}>{bfTotal||""}</td>
                  <td style={{border:"1px solid #c97316",padding:0,textAlign:"center",background:"#fff7ed"}}>{numFld(row,idx,"breakfastMachine",46)}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"lunchCoopen")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"lunchCoin")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"lunchSign")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",background:"#f0f4ff"}}>{luTotal||""}</td>
                  <td style={{border:"1px solid #c97316",padding:0,textAlign:"center",background:"#fff7ed"}}>{numFld(row,idx,"lunchMachine",46)}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"dinnerCoopen")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"dinnerCoin")}</td>
                  <td style={{border:"1px solid #ccc",padding:0,textAlign:"center"}}>{numFld(row,idx,"dinnerSign")}</td>
                  <td style={{border:"1px solid #ccc",textAlign:"center",fontWeight:"bold",background:"#f0f4ff"}}>{diTotal||""}</td>
                  <td style={{border:"1px solid #c97316",padding:0,textAlign:"center",background:"#fff7ed"}}>{numFld(row,idx,"dinnerMachine",46)}</td>
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
              <td style={{border:"1px solid #c97316",textAlign:"center",background:"#ffedd5"}}>{totBfMachine}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totLuCoopen}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totLuCoin}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totLuSign}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",background:"#d0d8ff"}}>{totLuTotal}</td>
              <td style={{border:"1px solid #c97316",textAlign:"center",background:"#ffedd5"}}>{totLuMachine}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totDiCoopen}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totDiCoin}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center"}}>{totDiSign}</td>
              <td style={{border:"1px solid #ccc",textAlign:"center",background:"#d0d8ff"}}>{totDiTotal}</td>
              <td style={{border:"1px solid #c97316",textAlign:"center",background:"#ffedd5"}}>{totDiMachine}</td>
              <td style={{border:"1px solid #ccc"}}></td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Summary */}
      <div className="mt-4 flex justify-end">
        <div className="border rounded-xl overflow-hidden shadow-sm" style={{minWidth:480}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#1a3a5a",color:"white"}}>
                <th style={{padding:"6px 10px",textAlign:"left"}}>Particulars</th>
                <th colSpan={3} style={{padding:"6px 8px",textAlign:"center"}}>Manual Data</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Machine Data</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Difference</th>
              </tr>
              <tr style={{background:"#2a4a6a",color:"white"}}>
                <th></th>
                <th style={{padding:"4px 8px"}}>Coopen</th>
                <th style={{padding:"4px 8px"}}>Coin</th>
                <th style={{padding:"4px 8px"}}>Total</th>
                <th></th><th></th>
              </tr>
            </thead>
            <tbody>
              {[
                { label:"Breakfast", coopen:totBfCoopen, coin:totBfCoin, total:totBfTotal, machine:totBfMachine },
                { label:"Lunch", coopen:totLuCoopen, coin:totLuCoin, total:totLuTotal, machine:totLuMachine },
                { label:"Dinner", coopen:totDiCoopen, coin:totDiCoin, total:totDiTotal, machine:totDiMachine },
              ].map((s,i)=>{
                const diff=s.coopen-s.machine;
                return (
                  <tr key={s.label} style={{background:i%2===0?"#fff":"#f9f9f9"}}>
                    <td style={{padding:"4px 10px",borderBottom:"1px solid #eee"}}>{s.label}</td>
                    <td style={{padding:"4px 8px",textAlign:"center",borderBottom:"1px solid #eee"}}>{s.coopen||""}</td>
                    <td style={{padding:"4px 8px",textAlign:"center",borderBottom:"1px solid #eee"}}>{s.coin||""}</td>
                    <td style={{padding:"4px 8px",textAlign:"center",fontWeight:"bold",borderBottom:"1px solid #eee"}}>{s.total||""}</td>
                    <td style={{padding:"4px 8px",textAlign:"center",borderBottom:"1px solid #eee"}}>{s.machine||""}</td>
                    <td style={{padding:"4px 8px",textAlign:"center",fontWeight:"bold",color:diff!==0?"#c00":"#060",borderBottom:"1px solid #eee"}}>
                      {s.machine>0||s.coopen>0?diff:""}
                    </td>
                  </tr>
                );
              })}
              <tr style={{background:"#e8f0fe",fontWeight:"bold"}}>
                <td style={{padding:"5px 10px"}}>Total</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfCoopen+totLuCoopen+totDiCoopen}</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfCoin+totLuCoin+totDiCoin}</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfTotal+totLuTotal+totDiTotal}</td>
                <td style={{padding:"5px 8px",textAlign:"center"}}>{totBfMachine+totLuMachine+totDiMachine}</td>
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
// Main Date Entry Tab — with UBL sub-tabs
// ============================================================

const CLIENT_OPTIONS = [
  { value: "ubl", label: "United Breweries Ltd (UBL)" },
  { value: "cipla", label: "Cipla Limited" },
];

export function DateEntryTab() {
  const now = new Date();
  const [selectedClient, setSelectedClient] = useState("ubl");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [ublSubTab, setUblSubTab] = useState("format1");

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - 2 + i));
  const { label: billingLabel } = getBillingRange(parseInt(month), parseInt(year));

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 rounded-xl bg-muted/40 border">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Client:</label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-52 h-9" data-testid="select-date-entry-client"><SelectValue/></SelectTrigger>
            <SelectContent>
              {CLIENT_OPTIONS.map(o=>(
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Billing Month:</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 h-9" data-testid="select-date-entry-month"><SelectValue/></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m,i)=>(<SelectItem key={i} value={String(i+1)}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Year:</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9" data-testid="select-date-entry-year"><SelectValue/></SelectTrigger>
            <SelectContent>
              {years.map(y=><SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 ml-auto">
          Period: {billingLabel}
        </Badge>
      </div>

      {/* Client-specific content */}
      {selectedClient === "ubl" ? (
        <Tabs value={ublSubTab} onValueChange={setUblSubTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="format1" className="text-xs sm:text-sm" data-testid="tab-ubl-format1">
              Format 1 — Bill Data Sheet
            </TabsTrigger>
            <TabsTrigger value="format2" className="text-xs sm:text-sm" data-testid="tab-ubl-format2">
              Format 2 — Lunch Per Day Count
            </TabsTrigger>
          </TabsList>
          <TabsContent value="format1">
            <div className="mb-2 text-sm text-muted-foreground font-medium">UBL — Food Items Bill Data Sheet (with rates)</div>
            <UblDateEntryTab month={parseInt(month)} year={parseInt(year)}/>
          </TabsContent>
          <TabsContent value="format2">
            <div className="mb-2 text-sm text-muted-foreground font-medium">UBL — Number of Lunch Per Day (Perment / Casual / Contractual / Canteen)</div>
            <UblLunchEntryTab month={parseInt(month)} year={parseInt(year)}/>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="mb-2 text-sm text-muted-foreground font-medium">Cipla Limited — Breakfast / Lunch / Dinner (Coopen / Coin / Sign / Machine)</div>
          <CiplaDateEntryTab month={parseInt(month)} year={parseInt(year)}/>
        </>
      )}
    </div>
  );
}
