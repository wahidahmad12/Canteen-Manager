import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Save, Users, Printer, Download, Upload, FileSpreadsheet, MessageCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { useRef } from "react";
import qrImg from "@assets/image_1786018663605.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Contractor = { id: number; vendorCode: string; name: string; clientName: string; mobile?: string; address?: string };
type MealEntry = {
  id: number; entryDate: string; month: number; year: number; contractorId: number;
  mealType: string; qty: number; billNo: string; rate: number | string; vendorCode: string; contractorName: string; clientName: string;
};

// ---- Amount in words (Indian system) ----
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")).trim();
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  return ((h ? ONES[h] + " Hundred" : "") + (r ? (h ? " " : "") + twoDigits(r) : "")).trim();
}
function numberToWordsIndian(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(numberToWordsIndian(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}
function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let s = "Rupees " + numberToWordsIndian(rupees);
  if (paise > 0) s += " And Paise " + twoDigits(paise);
  return s + " Only";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ContractorMealsPage() {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/contractors"],
    queryFn: async () => (await apiRequest("GET", "/api/contractors")).json(),
  });
  const { data: clients = [] } = useClientNames();

  // ---- Meal entry state ----
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [entryDate, setEntryDate] = useState(() => {
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  // edits[contractorId] = { billNo, breakfast, lunch, dinner } (strings so blanks allowed)
  const [edits, setEdits] = useState<Record<number, { billNo: string; breakfast: string; lunch: string; dinner: string }>>({});

  const { data: entries = [], isFetching } = useQuery<MealEntry[]>({
    queryKey: ["/api/contractor-meals", month, year],
    queryFn: async () => (await apiRequest("GET", `/api/contractor-meals?month=${month}&year=${year}`)).json(),
  });

  const filteredContractors = useMemo(
    () => contractors.filter((c) => clientFilter === "all" || c.clientName === clientFilter),
    [contractors, clientFilter],
  );

  // Load button: true = sab contractors dikhao; false = sirf jinka data hai
  const [showAll, setShowAll] = useState(false);

  // Merge saved entries + local edits into row values
  const rowValue = (c: Contractor) => {
    const saved = { billNo: "", breakfast: "", lunch: "", dinner: "", entryDate: "" };
    for (const e of entries) {
      if (e.contractorId !== c.id) continue;
      if (e.billNo) saved.billNo = e.billNo;
      if (e.entryDate) saved.entryDate = e.entryDate;
      if (e.mealType === "Breakfast") saved.breakfast = String(e.qty);
      if (e.mealType === "Lunch") saved.lunch = String(e.qty);
      if (e.mealType === "Dinner") saved.dinner = String(e.qty);
    }
    const ed = edits[c.id];
    return {
      billNo: ed?.billNo ?? saved.billNo,
      breakfast: ed?.breakfast ?? saved.breakfast,
      lunch: ed?.lunch ?? saved.lunch,
      dinner: ed?.dinner ?? saved.dinner,
    };
  };

  const hasRowData = (c: Contractor) => {
    const v = rowValue(c);
    return (Number(v.breakfast) || 0) > 0 || (Number(v.lunch) || 0) > 0 || (Number(v.dinner) || 0) > 0 || v.billNo.trim() !== "";
  };
  const gridContractors = showAll ? filteredContractors : filteredContractors.filter(hasRowData);

  const setCell = (c: Contractor, key: "billNo" | "breakfast" | "lunch" | "dinner", val: string) => {
    setEdits((prev) => ({ ...prev, [c.id]: { ...rowValue(c), ...prev[c.id], [key]: val } }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = filteredContractors.map((c) => {
        const v = rowValue(c);
        return {
          contractorId: c.id,
          billNo: v.billNo,
          breakfast: v.breakfast === "" ? null : Number(v.breakfast),
          lunch: v.lunch === "" ? null : Number(v.lunch),
          dinner: v.dinner === "" ? null : Number(v.dinner),
        };
      });
      await apiRequest("POST", "/api/contractor-meals/bulk", { entryDate, month, year, rows });
    },
    onSuccess: () => {
      setEdits({});
      setShowAll(false); // save ke baad sirf data wale contractors dikhao
      qc.invalidateQueries({ queryKey: ["/api/contractor-meals", month, year] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-dashboard"] });
      toast({ title: "Saved", description: `${MONTHS[month - 1]} ${year} entries saved.` });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message || "", variant: "destructive" }),
  });

  const monthName = MONTHS[month - 1];
  const totals = useMemo(() => {
    let b = 0, l = 0, d = 0;
    for (const c of filteredContractors) {
      const v = rowValue(c);
      b += Number(v.breakfast) || 0;
      l += Number(v.lunch) || 0;
      d += Number(v.dinner) || 0;
    }
    return { b, l, d, all: b + l + d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContractors, entries, edits]);

  // ---- Import / Export / Template ----
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = filteredContractors.map((c) => {
      const v = rowValue(c);
      return {
        "Vender Code": c.vendorCode,
        "Contractor Name": c.name,
        "Breakfast": v.breakfast === "" ? "" : Number(v.breakfast),
        "Lunch": v.lunch === "" ? "" : Number(v.lunch),
        "Dinner": v.dinner === "" ? "" : Number(v.dinner),
        "Bill No": v.billNo,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meal Entry");
    XLSX.writeFile(wb, `Contractor_Meal_Template_${monthName}_${year}.xlsx`);
  };

  const exportExcel = () => {
    // Same layout as the user's original Excel: one row per contractor per meal type
    const mm = String(month).padStart(2, "0");
    const dateStr = `01-${mm}-${year}`;
    const out: any[] = [];
    let sl = 1;
    for (const meal of ["Breakfast", "Lunch", "Dinner"] as const) {
      for (const c of filteredContractors) {
        const v = rowValue(c);
        const qty = v[meal.toLowerCase() as "breakfast" | "lunch" | "dinner"];
        if (qty === "") continue;
        out.push({
          "Sl No": sl++,
          "Vender Code": c.vendorCode,
          "Date": dateStr,
          "Month": monthName.slice(0, 3),
          "Contractor Name": c.name,
          "Type Of Meal": meal,
          "Qty": Number(qty) || 0,
          "Cont & Month": `${c.name}${monthName.slice(0, 3)}${year}`,
          "Bill No": v.billNo,
          "Year": year,
        });
      }
    }
    if (!out.length) { toast({ title: "Koi entry nahi", description: "Pehle qty daal kar Save kijiye.", variant: "destructive" }); return; }
    const ws = XLSX.utils.json_to_sheet(out);
    ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 11 }, { wch: 7 }, { wch: 34 }, { wch: 12 }, { wch: 7 }, { wch: 36 }, { wch: 16 }, { wch: 7 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`);
    XLSX.writeFile(wb, `Contractor_Meal_${monthName}_${year}.xlsx`);
  };

  const importFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const byCode = new Map(contractors.map((c) => [c.vendorCode.trim().toUpperCase(), c]));
      const byName = new Map(contractors.map((c) => [c.name.trim().toUpperCase(), c]));
      const norm = (r: any, keys: string[]) => {
        for (const k of Object.keys(r)) {
          if (keys.some((x) => k.trim().toLowerCase().replace(/\s+/g, "") === x)) return r[k];
        }
        return undefined;
      };
      const newEdits: typeof edits = {};
      let matched = 0, skipped = 0;
      const applyCell = (c: Contractor, key: "breakfast" | "lunch" | "dinner" | "billNo", val: any) => {
        if (val === undefined || val === null || String(val).trim() === "") return;
        const base = newEdits[c.id] ?? { ...rowValue(c) };
        if (key === "billNo") {
          base[key] = String(val).trim();
        } else {
          const qty = Math.max(0, Math.round(Number(val) || 0));
          // qty 0 => leave blank so it is not saved and never printed on the bill
          base[key] = qty > 0 ? String(qty) : "";
        }
        newEdits[c.id] = base;
      };
      for (const r of rows) {
        const code = String(norm(r, ["vendercode", "vendorcode", "code"]) ?? "").trim().toUpperCase();
        const name = String(norm(r, ["contractorname", "name"]) ?? "").trim().toUpperCase();
        const c = byCode.get(code) || byName.get(name);
        if (!c) { skipped++; continue; }
        matched++;
        const meal = String(norm(r, ["typeofmeal", "mealtype", "meal"]) ?? "").trim().toLowerCase();
        const qty = norm(r, ["qty", "quantity"]);
        if (meal === "breakfast" || meal === "lunch" || meal === "dinner") {
          // export-style file: one row per meal
          applyCell(c, meal as any, qty);
        } else {
          // template-style file: Breakfast/Lunch/Dinner columns
          applyCell(c, "breakfast", norm(r, ["breakfast"]));
          applyCell(c, "lunch", norm(r, ["lunch"]));
          applyCell(c, "dinner", norm(r, ["dinner"]));
        }
        applyCell(c, "billNo", norm(r, ["billno", "bill"]));
      }
      if (!matched) { toast({ title: "Import failed", description: "Vendor code ya contractor name match nahi hua.", variant: "destructive" }); return; }
      setEdits((prev) => ({ ...prev, ...newEdits }));
      toast({
        title: `${matched} rows import ho gayi`,
        description: `${skipped ? skipped + " rows match nahi hui. " : ""}Ab "Save All" dabaiye.`,
      });
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "File padh nahi paye.", variant: "destructive" });
    }
  };

  // ---- Invoice (without GST) state ----
  const [invContractor, setInvContractor] = useState<Contractor | null>(null);
  const [invNo, setInvNo] = useState("");
  const [invDate, setInvDate] = useState("");
  const [invRates, setInvRates] = useState({ Breakfast: "", Lunch: "", Dinner: "" });

  const openInvoice = (c: Contractor) => {
    const v = rowValue(c);
    const saved: Record<string, string> = { Breakfast: "", Lunch: "", Dinner: "" };
    for (const e of entries) {
      if (e.contractorId === c.id && Number(e.rate) > 0) saved[e.mealType] = String(Number(e.rate));
    }
    setInvContractor(c);
    setInvNo(v.billNo);
    const t = new Date();
    setInvDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
    // Default rates (change anytime in this box; saved per contractor per month)
    setInvRates({
      Breakfast: saved.Breakfast || "4.6",
      Lunch: saved.Lunch || "11.6",
      Dinner: saved.Dinner || "11.6",
    });
  };

  // persist rates first — do not print/share if the save fails, so invoice and saved data never diverge
  const saveInvoiceRates = async (c: Contractor) => {
    try {
      await apiRequest("POST", "/api/contractor-meals/rates", {
        contractorId: c.id, month, year,
        rates: { Breakfast: Number(invRates.Breakfast) || 0, Lunch: Number(invRates.Lunch) || 0, Dinner: Number(invRates.Dinner) || 0 },
      });
      qc.invalidateQueries({ queryKey: ["/api/contractor-meals", month, year] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-dashboard"] });
      return true;
    } catch (e: any) {
      toast({ title: "Rate save failed", description: e?.message || "Dobara try kijiye.", variant: "destructive" });
      return false;
    }
  };

  const buildInvoiceHtml = (
    c: Contractor,
    forPrint: boolean,
    override?: { rates: Record<"Breakfast" | "Lunch" | "Dinner", string>; invNo: string; invDate: string; bodyOnly?: boolean },
  ) => {
    const useRates = override?.rates ?? invRates;
    const useInvNo = override?.invNo ?? invNo;
    const useInvDate = override?.invDate ?? invDate;
    const v = rowValue(c);
    const lastDay = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, "0");
    const period = `01-${mm}-${year} To ${lastDay}-${mm}-${year}`;
    const client = clients.find((cl) => cl.name === c.clientName);
    // BILL TO = contractor's own address (from Contractor master)
    const billToAddr = c.address?.trim() || "";
    // SHIP TO = client's address (Cipla / Hindustan Unilever etc. from Client master)
    const shipToAddr = `${c.clientName.toUpperCase()}${client?.address ? " " + client.address : " Unut - 1 Rangpo Rohatang Road, Kumrek Sikkim - 737132"}`;
    const mobileNo = c.mobile?.trim() || "9641627280";
    const qrUrl = new URL(qrImg, window.location.origin).href;
    const [dy, dm, dd] = useInvDate.split("-");
    const dateDisp = useInvDate ? `${dd}-${dm}-${dy}` : "";

    const items = (["Breakfast", "Lunch", "Dinner"] as const)
      .map((meal) => {
        const qty = Number(v[meal.toLowerCase() as "breakfast" | "lunch" | "dinner"]) || 0;
        const rate = Number(useRates[meal]) || 0;
        return { meal, qty, rate, total: Math.round(qty * rate * 100) / 100 };
      })
      .filter((it) => it.qty > 0);
    const grand = Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rowsHtml = items.map((it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td><div class="item-name">${it.meal}</div><div class="item-period">${period}</div></td>
        <td class="c">${it.qty}</td>
        <td class="c">NOS</td>
        <td class="c">${it.rate}</td>
        <td class="r">${fmt(it.total)}</td>
        <td class="r">${fmt(it.total)}</td>
      </tr>`).join("");

    const page = `<div class="title">INVOICE <span>ORIGINAL FOR RECIPIENT</span></div>
<div class="frame">
  <table class="bordered">
    <tr>
      <td style="width:50%"><div class="company">DJ Hospitality &amp; Facility<br>Management Pvt Ltd</div></td>
      <td class="c" style="width:25%"><b>Invoice Number</b><br><br><span style="font-size:15px;font-weight:bold">${esc(useInvNo)}</span></td>
      <td class="c" style="width:25%"><b>Invoice Date</b><br><br><span style="font-size:15px;font-weight:bold">${dateDisp}</span></td>
    </tr>
    <tr><td colspan="3">Rangpo Rohatang Road, Kumrek Sikkim - 737132</td></tr>
  </table>
  <table class="bordered">
    <tr>
      <td style="width:50%; padding:0">
        <table>
          <tr><td class="lbl">BILL TO</td><td><b>${esc(c.vendorCode)}</b></td></tr>
          <tr><td class="lbl">Name :</td><td><b>${esc(c.name)}</b></td></tr>
          <tr><td class="lbl">Address :</td><td rowspan="2">${esc(billToAddr)}</td></tr>
          <tr><td class="lbl">Place of Supply :</td></tr>
          <tr><td class="lbl">Mobile No</td><td><b>${esc(mobileNo)}</b></td></tr>
        </table>
      </td>
      <td style="width:50%; padding:0">
        <table>
          <tr><td class="lbl">SHIP TO</td><td></td></tr>
          <tr><td class="lbl">Name :</td><td><b>${esc(c.clientName)}</b></td></tr>
          <tr><td class="lbl">Address :</td><td>${esc(shipToAddr)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table class="bordered">
    <tr class="head-blue">
      <th style="width:7%">S.NO</th><th style="width:38%">ITEMS</th>
      <th style="width:12%">QUANTITY</th><th style="width:9%">UoM</th><th style="width:10%">RATE</th>
      <th style="width:12%">Total</th><th style="width:12%">AMOUNT</th>
    </tr>
    ${rowsHtml}
    <tr class="head-blue">
      <td colspan="5" class="r"><b>TOTAL AMOUNT</b></td>
      <td class="r"><b>${fmt(grand)}</b></td>
      <td class="r"><b>${fmt(grand)}</b></td>
    </tr>
  </table>
  <div class="sec-title" style="border-bottom:1px solid #000">INVOICE AMOUNT IN WORDS<br><br>${esc(amountInWords(grand))}</div>
  <div class="sec-title">BANK DETAILS</div>
  <table>
    <tr><td class="lbl" style="width:160px">A/C Holder Name :</td><td><b>Sunita Devi</b></td></tr>
    <tr><td class="lbl">Account Number:</td><td><b>03720100022770</b></td></tr>
    <tr><td class="lbl">IFSC code:</td><td><b>BARB0PATRIX</b></td></tr>
    <tr><td class="lbl">Bank &amp; Branch:</td><td><b>BANK OF BARODA, PATRI BRANCH PATDI</b></td></tr>
    <tr><td class="lbl">UPI ID : -</td><td><b>amardeepkumar2427-1@oksbi</b></td></tr>
  </table>
  <table class="bordered">
    <tr>
      <td style="width:22%" class="c"><img src="${qrUrl}" alt="UPI QR" style="width:90px;height:90px;object-fit:contain"></td>
      <td style="width:33%"><b style="font-size:14px">Notes:-</b></td>
      <td class="sign" style="width:45%">
        <div class="space"></div>
        Authorised Signature for<br><b>DJ Hospitality &amp; Facility Management Private Limited</b>
      </td>
    </tr>
  </table>
</div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(c.name)} - ${esc(useInvNo || "Invoice")} - ${dateDisp}</title>
<style>
  @page { size: A5; margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .frame { border: 1px solid #000; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 3px 6px; vertical-align: top; }
  .bordered td, .bordered th { border: 1px solid #000; }
  .title { font-weight: bold; font-size: 12px; padding: 4px; }
  .title span { color: #888; font-weight: normal; font-size: 9px; letter-spacing: 1px; }
  .company { color: #7A1FA2; font-size: 16px; font-weight: bold; line-height: 1.2; }
  .c { text-align: center; } .r { text-align: right; }
  .head-blue { background: #cfe6f5; font-weight: bold; text-align: center; }
  .item-name { font-weight: bold; font-size: 11px; }
  .item-period { font-size: 8px; margin-top: 2px; }
  .lbl { font-weight: bold; white-space: nowrap; }
  .sec-title { font-weight: bold; padding: 4px 6px; }
  .sign { text-align: center; font-size: 9px; vertical-align: bottom; padding-bottom: 4px; }
  .sign .space { height: 40px; }
  .page-break { page-break-after: always; }
</style></head><body>
${page}
${forPrint ? "<script>window.onload = function(){ window.print(); };</scr" + "ipt>" : ""}
</body></html>`;
    return { html, page, fileName: `Invoice-${c.vendorCode}-${mm}-${year}.jpg` };
  };

  const printBusy = useRef(false);
  const printInvoice = async () => {
    const c = invContractor;
    if (!c || printBusy.current) return;
    printBusy.current = true;
    try {
      await doPrintInvoice(c);
    } finally {
      printBusy.current = false;
    }
  };
  const doPrintInvoice = async (c: Contractor) => {
    if (!(await saveInvoiceRates(c))) return;
    const { html } = buildInvoiceHtml(c, true);
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Popup blocked", description: "Browser me popup allow kijiye.", variant: "destructive" }); return; }
    w.document.write(html);
    w.document.close();
    setInvContractor(null);
  };

  // ---- Convert all saved meal data of the month into invoices (one per contractor) ----
  const [convertingAll, setConvertingAll] = useState(false);
  const convertAllToInvoices = async () => {
    if (convertingAll) return;
    setConvertingAll(true);
    try {
      const t = new Date();
      const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      const list = contractors.filter((c) => {
        const v = rowValue(c);
        return (Number(v.breakfast) || 0) > 0 || (Number(v.lunch) || 0) > 0 || (Number(v.dinner) || 0) > 0;
      });
      if (!list.length) {
        toast({ title: "Koi data nahi", description: "Is month me kisi contractor ki qty nahi hai. Pehle data bhar kar Save All kijiye.", variant: "destructive" });
        return;
      }
      const pages: string[] = [];
      for (const c of list) {
        // rate: is month ki saved rate, warna default
        const saved: Record<"Breakfast" | "Lunch" | "Dinner", string> = { Breakfast: "", Lunch: "", Dinner: "" };
        for (const e of entries) {
          if (e.contractorId === c.id && Number(e.rate) > 0) saved[e.mealType as "Breakfast" | "Lunch" | "Dinner"] = String(Number(e.rate));
        }
        const rates = { Breakfast: saved.Breakfast || "4.6", Lunch: saved.Lunch || "11.6", Dinner: saved.Dinner || "11.6" };
        // rate save pehle — fail ho to poora convert rok do, taki invoice aur data alag na ho
        await apiRequest("POST", "/api/contractor-meals/rates", {
          contractorId: c.id, month, year,
          rates: { Breakfast: Number(rates.Breakfast) || 0, Lunch: Number(rates.Lunch) || 0, Dinner: Number(rates.Dinner) || 0 },
        });
        const { page } = buildInvoiceHtml(c, false, { rates, invNo: rowValue(c).billNo || "", invDate: today });
        pages.push(page);
      }
      qc.invalidateQueries({ queryKey: ["/api/contractor-meals", month, year] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-billing-summary"] });
      // sab invoices ek saath, har ek apne page par
      const { html } = buildInvoiceHtml(list[0], false);
      const head = html.slice(0, html.indexOf("</head>") + 7);
      const combined = `${head}<body>${pages.map((p) => `<div class="page-break">${p}</div>`).join("")}<script>window.onload = function(){ window.print(); };</scr${""}ipt></body></html>`;
      const w = window.open("", "_blank");
      if (!w) { toast({ title: "Popup blocked", description: "Browser me popup allow kijiye.", variant: "destructive" }); return; }
      w.document.write(combined);
      w.document.close();
      toast({ title: `${list.length} invoice ban gaye`, description: "Print window me sab invoices ek saath hain." });
    } catch (e: any) {
      toast({ title: "Convert failed", description: e?.message || "Dobara try kijiye.", variant: "destructive" });
    } finally {
      setConvertingAll(false);
    }
  };

  const [sharingJpeg, setSharingJpeg] = useState(false);
  const shareInvoiceJpeg = async () => {
    const c = invContractor;
    if (!c || sharingJpeg) return;
    setSharingJpeg(true); // single-flight guard set before any await
    try {
      if (!(await saveInvoiceRates(c))) return;
      const { html, fileName } = buildInvoiceHtml(c, false);
      // render the invoice off-screen at A4 width, then snapshot to JPEG
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;height:1200px;border:0;";
      document.body.appendChild(iframe);
      try {
        const doc = iframe.contentDocument!;
        doc.open(); doc.write(html); doc.close();
        // wait for images (QR) to load
        await Promise.all(
          Array.from(doc.images).map((img) =>
            img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })
          )
        );
        await new Promise((r) => setTimeout(r, 100));
        // html-to-image renders via the browser's own engine, so text sits exactly like the print
        const { toJpeg } = await import("html-to-image");
        const dataUrl = await toJpeg(doc.body, {
          quality: 0.97,
          pixelRatio: 4, // ultra HD — ~3280px wide image

          backgroundColor: "#ffffff",
          width: 820,
          height: doc.body.scrollHeight,
        });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/jpeg" });
        // mobile: share sheet me WhatsApp choose kar ke seedha bhej sakte hain
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: fileName });
            return;
          } catch (err: any) {
            if (err?.name === "AbortError") return; // user cancelled the share sheet
          }
        }
        // desktop fallback: JPEG download + WhatsApp Web kholo, user attach kar de
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast({ title: "Invoice JPEG download ho gayi", description: "WhatsApp me photo attach kar ke bhej dijiye." });
        window.open("https://web.whatsapp.com/", "_blank");
      } finally {
        iframe.remove();
      }
    } catch (e: any) {
      toast({ title: "JPEG banane me dikkat", description: e?.message || "Dobara try kijiye.", variant: "destructive" });
    } finally {
      setSharingJpeg(false);
    }
  };

  // ---- Payments state ----
  type Payment = { id: number; contractorId: number; paymentDate: string; amount: number | string; note: string; vendorCode: string; contractorName: string };
  type BillingSummary = { contractorId: number; vendorCode: string; name: string; clientName: string; billed: number; received: number; balance: number };

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/contractor-payments"],
    queryFn: async () => (await apiRequest("GET", "/api/contractor-payments")).json(),
  });
  const { data: billing = [] } = useQuery<BillingSummary[]>({
    queryKey: ["/api/contractor-billing-summary"],
    queryFn: async () => (await apiRequest("GET", "/api/contractor-billing-summary")).json(),
  });

  const [payContractorId, setPayContractorId] = useState<string>("");
  const [payDate, setPayDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const addPayment = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/contractor-payments", {
        contractorId: Number(payContractorId), paymentDate: payDate, amount: Number(payAmount), note: payNote,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contractor-payments"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-billing-summary"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-dashboard"] });
      setPayAmount(""); setPayNote("");
      toast({ title: "Payment saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "", variant: "destructive" }),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/contractor-payments/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contractor-payments"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-billing-summary"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-dashboard"] });
      toast({ title: "Payment deleted" });
    },
  });

  const fmtInr = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  // ---- Dashboard state ----
  const [dashYear, setDashYear] = useState(() => new Date().getFullYear());
  const [dashContractor, setDashContractor] = useState<string>("all");
  const [dashMonth, setDashMonth] = useState<string>("all");
  const [dashClient, setDashClient] = useState<string>("all");
  type DashData = {
    monthly: { month: number; billed: number; received: number; balance: number }[];
    yearly: { year: number; billed: number; received: number; balance: number }[];
    contractors: { contractorId: number; vendorCode: string; name: string; billed: number; received: number; balance: number }[];
  };
  const { data: dash } = useQuery<DashData>({
    queryKey: ["/api/contractor-dashboard", dashYear, dashContractor, dashMonth, dashClient],
    queryFn: async () =>
      (await apiRequest(
        "GET",
        `/api/contractor-dashboard?year=${dashYear}&contractorId=${dashContractor === "all" ? 0 : dashContractor}&month=${dashMonth === "all" ? 0 : dashMonth}&client=${encodeURIComponent(dashClient === "all" ? "" : dashClient)}`,
      )).json(),
  });
  const dashMonthly = (dash?.monthly ?? []).map((m) => ({ ...m, name: MONTH_NAMES[m.month - 1] }));
  const dashYearly = dash?.yearly ?? [];
  const dashContractors = (dash?.contractors ?? []).filter((c) => c.billed > 0 || c.received > 0);
  const dashMonthlyShown = dashMonth === "all" ? dashMonthly : dashMonthly.filter((m) => m.month === Number(dashMonth));
  const dashTotals = dashMonthlyShown.reduce(
    (s, m) => ({ billed: s.billed + m.billed, received: s.received + m.received }),
    { billed: 0, received: 0 },
  );
  const dashPeriodLabel = dashMonth === "all" ? String(dashYear) : `${MONTH_NAMES[Number(dashMonth) - 1]} ${dashYear}`;
  const dashYearOptions = useMemo(() => {
    const ys = new Set<number>(dashYearly.map((y) => y.year));
    ys.add(new Date().getFullYear());
    ys.add(dashYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [dashYearly, dashYear]);
  const dashContractorName =
    dashContractor === "all" ? "All Contractors" : contractors.find((c) => String(c.id) === dashContractor)?.name || "";

  const exportDashboard = () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(
      dashMonthlyShown.map((m) => ({ Month: m.name, "Bill Amount": m.billed, "Payment Received": m.received, Balance: m.balance })),
    );
    XLSX.utils.book_append_sheet(wb, ws1, `Monthwise ${dashPeriodLabel}`.slice(0,31));
    const ws2 = XLSX.utils.json_to_sheet(
      dashYearly.map((y) => ({ Year: y.year, "Bill Amount": y.billed, "Payment Received": y.received, Balance: y.balance })),
    );
    XLSX.utils.book_append_sheet(wb, ws2, "Yearwise");
    const ws3 = XLSX.utils.json_to_sheet(
      dashContractors.map((c) => ({ "Vendor Code": c.vendorCode, Contractor: c.name, "Bill Amount": c.billed, "Payment Received": c.received, Balance: c.balance })),
    );
    XLSX.utils.book_append_sheet(wb, ws3, `Contractorwise ${dashPeriodLabel}`.slice(0,31));
    XLSX.writeFile(wb, `Contractor-Dashboard-${dashYear}${dashContractor === "all" ? "" : "-" + dashContractorName.replace(/\s+/g, "")}.xlsx`);
  };

  const printDashboard = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const money = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const rows = (arr: { label: string; billed: number; received: number; balance: number }[]) =>
      arr.map((r) => `<tr><td>${esc(r.label)}</td><td class="r">${money(r.billed)}</td><td class="r">${money(r.received)}</td><td class="r ${r.balance > 0 ? "red" : ""}">${money(r.balance)}</td></tr>`).join("");
    const tbl = (title: string, arr: { label: string; billed: number; received: number; balance: number }[]) => {
      const t = arr.reduce((s, r) => ({ billed: s.billed + r.billed, received: s.received + r.received, balance: s.balance + r.balance }), { billed: 0, received: 0, balance: 0 });
      return `<h3>${esc(title)}</h3>
      <table><tr class="head"><th></th><th class="r">Bill Amount</th><th class="r">Received</th><th class="r">Balance</th></tr>
      ${rows(arr)}
      <tr class="total"><td>Total</td><td class="r">${money(t.billed)}</td><td class="r">${money(t.received)}</td><td class="r">${money(t.balance)}</td></tr></table>`;
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contractor Dashboard ${dashYear}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 12px; color: #000; }
  h2 { margin: 0; color: #7A1FA2; } .sub { margin: 2px 0 12px; color: #444; }
  h3 { margin: 14px 0 4px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #999; padding: 4px 8px; text-align: left; }
  .r { text-align: right; } .red { color: #c00; }
  .head th { background: #cfe6f5; } .total td { font-weight: bold; background: #f2f2f2; }
</style></head><body>
<h2>DJ Hospitality &amp; Facility Management Pvt Ltd</h2>
<div class="sub">Contractor Meal Dashboard — ${dashPeriodLabel} — ${esc(dashClient === "all" ? "All Clients" : dashClient)} — ${esc(dashContractorName)}</div>
${tbl(`Month-wise (${dashPeriodLabel})`, dashMonthlyShown.map((m) => ({ label: m.name, billed: m.billed, received: m.received, balance: m.balance })))}
${tbl("Year-wise", dashYearly.map((y) => ({ label: String(y.year), billed: y.billed, received: y.received, balance: y.balance })))}
${tbl(`Contractor-wise (${dashPeriodLabel})`, dashContractors.map((c) => ({ label: `${c.vendorCode} — ${c.name}`, billed: c.billed, received: c.received, balance: c.balance })))}
<script>window.onload = function(){ window.print(); };</scr${""}ipt>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Popup blocked", description: "Browser me popup allow kijiye.", variant: "destructive" }); return; }
    w.document.write(html);
    w.document.close();
  };

  // ---- Contractor master state ----
  const emptyForm = { vendorCode: "", name: "", clientName: "Cipla Limited", mobile: "", address: "" };
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);

  const nextCode = useMemo(() => {
    let max = 0;
    for (const c of contractors) {
      const m = /^DJ-SKI-(\d+)$/.exec(c.vendorCode || "");
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `DJ-SKI-${String(max + 1).padStart(3, "0")}`;
  }, [contractors]);

  const upsertContractor = useMutation({
    mutationFn: async () => {
      if (editId) await apiRequest("PUT", `/api/contractors/${editId}`, form);
      else await apiRequest("POST", "/api/contractors", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contractors"] });
      setForm(emptyForm);
      setEditId(null);
      toast({ title: editId ? "Contractor updated" : "Contractor added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message || "", variant: "destructive" }),
  });

  const deleteContractor = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/contractors/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/contractors"] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-meals", month, year] });
      qc.invalidateQueries({ queryKey: ["/api/contractor-dashboard"] });
      toast({ title: "Contractor deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Contractor Meal Entry</h1>
      </div>

      <Tabs defaultValue="entry">
        <TabsList>
          <TabsTrigger value="entry" data-testid="tab-meal-entry">Meal Entry</TabsTrigger>
          <TabsTrigger value="master" data-testid="tab-contractor-list">Contractor List</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
        </TabsList>

        {/* ============ MEAL ENTRY ============ */}
        <TabsContent value="entry" className="space-y-4">
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-end gap-3">
              <div>
                <Label>Month</Label>
                <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setEdits({}); }}>
                  <SelectTrigger className="w-36" data-testid="select-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setEdits({}); }}>
                  <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[year - 2, year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) =>
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" className="w-40" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} data-testid="input-entry-date" />
              </div>
              <div>
                <Label>Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-44" data-testid="select-client-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant={showAll ? "secondary" : "default"} onClick={() => setShowAll(!showAll)} data-testid="button-load-contractors">
                <Users className="h-4 w-4 mr-1" /> {showAll ? "Sirf Data Wale" : "Load"}
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-entries">
                <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save All"}
              </Button>
              <Button variant="outline" className="text-purple-700 border-purple-700" onClick={convertAllToInvoices} disabled={convertingAll} data-testid="button-convert-invoices">
                <Printer className="h-4 w-4 mr-1" /> {convertingAll ? "Ban raha hai..." : "Convert to Invoice"}
              </Button>
              <Button variant="outline" onClick={downloadTemplate} data-testid="button-template">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Template
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-import">
                <Upload className="h-4 w-4 mr-1" /> Import
              </Button>
              <Button variant="outline" onClick={exportExcel} data-testid="button-export">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile(f);
                  e.target.value = "";
                }}
                data-testid="input-import-file"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                {monthName} {year} — qty likhiye (Breakfast / Lunch / Dinner) {isFetching ? "…" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Vendor Code</th>
                    <th className="p-2">Contractor Name</th>
                    <th className="p-2 text-center">Breakfast</th>
                    <th className="p-2 text-center">Lunch</th>
                    <th className="p-2 text-center">Dinner</th>
                    <th className="p-2">Bill No</th>
                    <th className="p-2 text-center">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {gridContractors.map((c) => {
                    const v = rowValue(c);
                    return (
                      <tr key={c.id} className="border-b" data-testid={`row-meal-${c.vendorCode}`}>
                        <td className="p-2 whitespace-nowrap font-mono text-xs">{c.vendorCode}</td>
                        <td className="p-2">{c.name}</td>
                        {(["breakfast", "lunch", "dinner"] as const).map((k) => (
                          <td key={k} className="p-1 text-center">
                            <Input
                              type="number" min={0} inputMode="numeric"
                              className="w-20 h-8 text-center mx-auto"
                              value={v[k]}
                              onChange={(e) => setCell(c, k, e.target.value)}
                              data-testid={`input-${k}-${c.vendorCode}`}
                            />
                          </td>
                        ))}
                        <td className="p-1">
                          <Input
                            className="w-36 h-8"
                            placeholder="DJ-SKI-26-C…"
                            value={v.billNo}
                            onChange={(e) => setCell(c, "billNo", e.target.value)}
                            data-testid={`input-billno-${c.vendorCode}`}
                          />
                        </td>
                        <td className="p-1 text-center">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Print invoice (without GST)"
                            onClick={() => openInvoice(c)}
                            data-testid={`button-invoice-${c.vendorCode}`}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {gridContractors.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                      {filteredContractors.length === 0
                        ? 'No contractors. Pehle "Contractor List" tab me add kijiye.'
                        : 'Is month me abhi koi data nahi. Naya data bharne ke liye "Load" button dabaiye.'}
                    </td></tr>
                  )}
                </tbody>
                {gridContractors.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td className="p-2" colSpan={2}>Total</td>
                      <td className="p-2 text-center" data-testid="text-total-breakfast">{totals.b}</td>
                      <td className="p-2 text-center" data-testid="text-total-lunch">{totals.l}</td>
                      <td className="p-2 text-center" data-testid="text-total-dinner">{totals.d}</td>
                      <td className="p-2" colSpan={2}>Grand Total: {totals.all}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ CONTRACTOR MASTER ============ */}
        <TabsContent value="master" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{editId ? "Edit Contractor" : "Add Contractor"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Vendor Code</Label>
                <Input
                  className="w-36" placeholder={nextCode}
                  value={form.vendorCode}
                  onChange={(e) => setForm({ ...form, vendorCode: e.target.value })}
                  data-testid="input-vendor-code"
                />
              </div>
              <div>
                <Label>Contractor Name</Label>
                <Input
                  className="w-64"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-contractor-name"
                />
              </div>
              <div>
                <Label>Client</Label>
                <Select value={form.clientName} onValueChange={(v) => setForm({ ...form, clientName: v })}>
                  <SelectTrigger className="w-48" data-testid="select-contractor-client"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mobile No</Label>
                <Input
                  className="w-40" placeholder="9641627280" inputMode="tel"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  data-testid="input-contractor-mobile"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  className="w-80" placeholder="CIPLA LIMITED Unit - 1 Rangpo Rohatang Road…"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  data-testid="input-contractor-address"
                />
              </div>
              <Button
                onClick={() => upsertContractor.mutate()}
                disabled={upsertContractor.isPending || !form.name.trim() || !(form.vendorCode.trim() || !editId)}
                data-testid="button-save-contractor"
              >
                <Plus className="h-4 w-4 mr-1" /> {editId ? "Update" : "Add"}
              </Button>
              {editId && (
                <Button variant="outline" onClick={() => { setEditId(null); setForm(emptyForm); }}>Cancel</Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Vendor Code</th>
                    <th className="p-2">Contractor Name</th>
                    <th className="p-2">Client</th>
                    <th className="p-2">Mobile</th>
                    <th className="p-2">Address</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((c) => (
                    <tr key={c.id} className="border-b" data-testid={`row-contractor-${c.vendorCode}`}>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{c.vendorCode}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">{c.clientName}</td>
                      <td className="p-2 whitespace-nowrap">{c.mobile || ""}</td>
                      <td className="p-2 text-xs max-w-56 truncate" title={c.address || ""}>{c.address || ""}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditId(c.id); setForm({ vendorCode: c.vendorCode, name: c.name, clientName: c.clientName, mobile: c.mobile || "", address: c.address || "" }); }}
                          data-testid={`button-edit-${c.vendorCode}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            onClick={() => { if (confirm(`Delete ${c.name}? Iski saari meal entries bhi delete ho jayengi.`)) deleteContractor.mutate(c.id); }}
                            data-testid={`button-delete-${c.vendorCode}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {contractors.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No contractors yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PAYMENTS ============ */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Payment Received (naya payment)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Contractor</Label>
                <Select value={payContractorId} onValueChange={setPayContractorId}>
                  <SelectTrigger className="w-64" data-testid="select-pay-contractor"><SelectValue placeholder="Choose contractor" /></SelectTrigger>
                  <SelectContent>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.vendorCode} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Received Date</Label>
                <Input type="date" className="w-40" value={payDate} onChange={(e) => setPayDate(e.target.value)} data-testid="input-pay-date" />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input
                  type="text" inputMode="decimal" placeholder="0.00" className="w-32" value={payAmount}
                  onChange={(e) => {
                    // allow only digits and one decimal point, so typing kabhi block na ho
                    const v = e.target.value.replace(/[^\d.]/g, "");
                    const parts = v.split(".");
                    setPayAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : v);
                  }}
                  data-testid="input-pay-amount"
                />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input className="w-48" placeholder="Bill no / UPI / cheque…" value={payNote} onChange={(e) => setPayNote(e.target.value)} data-testid="input-pay-note" />
              </div>
              <Button
                onClick={() => addPayment.mutate()}
                disabled={addPayment.isPending || !payContractorId || !(Number(payAmount) > 0)}
                data-testid="button-add-payment"
              >
                <Plus className="h-4 w-4 mr-1" /> {addPayment.isPending ? "Saving..." : "Add Payment"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Contractor-wise Balance (total bill vs received)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Vendor Code</th>
                    <th className="p-2">Contractor</th>
                    <th className="p-2 text-right">Total Bill</th>
                    <th className="p-2 text-right">Received</th>
                    <th className="p-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.filter((b) => b.billed > 0 || b.received > 0).map((b) => (
                    <tr key={b.contractorId} className="border-b" data-testid={`row-balance-${b.vendorCode}`}>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{b.vendorCode}</td>
                      <td className="p-2">{b.name}</td>
                      <td className="p-2 text-right">{fmtInr(b.billed)}</td>
                      <td className="p-2 text-right text-green-600">{fmtInr(b.received)}</td>
                      <td className={`p-2 text-right font-semibold ${b.balance > 0 ? "text-red-600" : "text-green-600"}`}>{fmtInr(b.balance)}</td>
                    </tr>
                  ))}
                  {billing.filter((b) => b.billed > 0 || b.received > 0).length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Abhi koi bill ya payment nahi. Bill amount ke liye invoice me Rate save kijiye.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-semibold">
                    <td className="p-2" colSpan={2}>Total</td>
                    <td className="p-2 text-right">{fmtInr(billing.reduce((s, b) => s + b.billed, 0))}</td>
                    <td className="p-2 text-right">{fmtInr(billing.reduce((s, b) => s + b.received, 0))}</td>
                    <td className="p-2 text-right">{fmtInr(billing.reduce((s, b) => s + b.balance, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Date</th>
                    <th className="p-2">Contractor</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2">Note</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b" data-testid={`row-payment-${p.id}`}>
                      <td className="p-2 whitespace-nowrap">{p.paymentDate.split("-").reverse().join("-")}</td>
                      <td className="p-2">{p.vendorCode} — {p.contractorName}</td>
                      <td className="p-2 text-right">{fmtInr(Number(p.amount))}</td>
                      <td className="p-2 text-xs">{p.note}</td>
                      <td className="p-2 text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            onClick={() => { if (confirm("Delete this payment?")) deletePayment.mutate(p.id); }}
                            data-testid={`button-delete-payment-${p.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No payments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ DASHBOARD ============ */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-4">
              <div>
                <Label>Year</Label>
                <Select value={String(dashYear)} onValueChange={(v) => setDashYear(Number(v))}>
                  <SelectTrigger className="w-28" data-testid="select-dash-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dashYearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month</Label>
                <Select value={dashMonth} onValueChange={setDashMonth}>
                  <SelectTrigger className="w-32" data-testid="select-dash-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTH_NAMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client</Label>
                <Select value={dashClient} onValueChange={setDashClient}>
                  <SelectTrigger className="w-44" data-testid="select-dash-client"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contractor</Label>
                <Select value={dashContractor} onValueChange={setDashContractor}>
                  <SelectTrigger className="w-64" data-testid="select-dash-contractor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contractors</SelectItem>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.vendorCode} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <Button variant="outline" onClick={exportDashboard} data-testid="button-dash-export">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
              </Button>
              <Button variant="outline" onClick={printDashboard} data-testid="button-dash-print">
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Bill ({dashPeriodLabel})</div>
              <div className="text-2xl font-bold" data-testid="text-dash-billed">{fmtInr(dashTotals.billed)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Payment Received ({dashPeriodLabel})</div>
              <div className="text-2xl font-bold text-green-600" data-testid="text-dash-received">{fmtInr(dashTotals.received)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Balance ({dashPeriodLabel})</div>
              <div className={`text-2xl font-bold ${dashTotals.billed - dashTotals.received > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-dash-balance">
                {fmtInr(dashTotals.billed - dashTotals.received)}
              </div>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Month-wise — Bill vs Received vs Balance ({dashPeriodLabel})</CardTitle></CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashMonthlyShown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => "₹" + Number(v).toLocaleString("en-IN")} width={80} />
                  <Tooltip formatter={(v: any) => "₹" + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })} />
                  <Legend />
                  <Bar dataKey="billed" name="Bill Amount" fill="#7A1FA2" />
                  <Bar dataKey="received" name="Received" fill="#16a34a" />
                  <Bar dataKey="balance" name="Balance" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Year-wise — Bill vs Received</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashYearly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => "₹" + Number(v).toLocaleString("en-IN")} width={80} />
                  <Tooltip formatter={(v: any) => "₹" + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })} />
                  <Legend />
                  <Bar dataKey="billed" name="Bill Amount" fill="#7A1FA2" />
                  <Bar dataKey="received" name="Received" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Contractor-wise ({dashPeriodLabel})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Vendor Code</th>
                    <th className="p-2">Contractor</th>
                    <th className="p-2 text-right">Bill Amount</th>
                    <th className="p-2 text-right">Received</th>
                    <th className="p-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {dashContractors.map((c) => (
                    <tr key={c.contractorId} className="border-b" data-testid={`row-dash-${c.vendorCode}`}>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{c.vendorCode}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-right">{fmtInr(c.billed)}</td>
                      <td className="p-2 text-right text-green-600">{fmtInr(c.received)}</td>
                      <td className={`p-2 text-right font-semibold ${c.balance > 0 ? "text-red-600" : "text-green-600"}`}>{fmtInr(c.balance)}</td>
                    </tr>
                  ))}
                  {dashContractors.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Is year me koi bill/payment nahi mila.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-semibold">
                    <td className="p-2" colSpan={2}>Total</td>
                    <td className="p-2 text-right">{fmtInr(dashContractors.reduce((s, c) => s + c.billed, 0))}</td>
                    <td className="p-2 text-right">{fmtInr(dashContractors.reduce((s, c) => s + c.received, 0))}</td>
                    <td className="p-2 text-right">{fmtInr(dashContractors.reduce((s, c) => s + c.balance, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice (without GST) dialog */}
      <Dialog open={!!invContractor} onOpenChange={(o) => { if (!o) setInvContractor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice — {invContractor?.name}</DialogTitle>
          </DialogHeader>
          {invContractor && (() => {
            const v = rowValue(invContractor);
            const qtys = { Breakfast: Number(v.breakfast) || 0, Lunch: Number(v.lunch) || 0, Dinner: Number(v.dinner) || 0 };
            const total = (["Breakfast", "Lunch", "Dinner"] as const)
              .reduce((s, m) => s + qtys[m] * (Number(invRates[m]) || 0), 0);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Invoice Number</Label>
                    <Input value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="DJ-SKI-26-C…" data-testid="input-invoice-no" />
                  </div>
                  <div>
                    <Label>Invoice Date</Label>
                    <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} data-testid="input-invoice-date" />
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty ({monthName.slice(0, 3)} {year})</th>
                      <th className="py-1 text-center">Rate (₹)</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["Breakfast", "Lunch", "Dinner"] as const).map((m) => (
                      <tr key={m} className="border-b">
                        <td className="py-1">{m}</td>
                        <td className="py-1 text-center">{qtys[m]}</td>
                        <td className="py-1 text-center">
                          <Input
                            type="number" min={0} step="0.01" className="w-24 h-8 text-center mx-auto"
                            value={invRates[m]}
                            onChange={(e) => setInvRates({ ...invRates, [m]: e.target.value })}
                            data-testid={`input-rate-${m.toLowerCase()}`}
                          />
                        </td>
                        <td className="py-1 text-right">{(qtys[m] * (Number(invRates[m]) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="py-1" colSpan={3}>Total Amount</td>
                      <td className="py-1 text-right" data-testid="text-invoice-total">₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground">Bina GST wala invoice — qty is month ki saved entry se aati hai. Pehle "Save All" kar lijiye agar qty change ki hai.</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={printInvoice} data-testid="button-print-invoice">
                    <Printer className="h-4 w-4 mr-1" /> Print Invoice
                  </Button>
                  <Button
                    variant="outline" className="flex-1 text-green-600 border-green-600"
                    disabled={sharingJpeg}
                    onClick={shareInvoiceJpeg}
                    data-testid="button-whatsapp-invoice"
                  >
                    <MessageCircle className="h-4 w-4 mr-1" /> {sharingJpeg ? "Ban raha hai..." : "WhatsApp (JPEG)"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">WhatsApp button invoice ki JPEG photo banata hai — mobile par share sheet se seedha WhatsApp me bhejiye; computer par photo download ho kar WhatsApp Web khulega, wahan attach kar dijiye.</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
