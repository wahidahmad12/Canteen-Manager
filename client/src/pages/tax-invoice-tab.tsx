import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Save, Loader2, Pencil, Trash2, Printer, X, Receipt, Eye, Search, Calendar as CalendarIcon } from "lucide-react";
import logoPath from "@assets/logo1_1771660912341.png";
import signaturePath from "@assets/DJ_Stamp_wahid_Sig_1785080823452.png";

interface ClientOption { id: number; name: string; address?: string; gstNo?: string; stateCode?: string; clientCode?: string }

interface ItemMasterOption {
  id: number;
  itemName: string;
  uom: string;
  rate: string | null;
  hsnCode: string;
  gstPercent: string | null;
  itemType: string;
}

function toDisplayDate(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    return `${day}-${m}-${y}`;
  }
  return d;
}

function toInputDate(d: string): string {
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const [day, m, y] = d.split("-");
    return `${y}-${m}-${day}`;
  }
  return d;
}

interface TaxInvoiceItem {
  id?: number;
  itemName: string;
  description: string;
  hsn: string;
  quantity: string;
  uom: string;
  rate: string;
  igstPercent: string;
}

interface TaxInvoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  poNumber: string;
  poDate: string;
  vendorCode: string;
  billToName: string;
  billToAddress: string | null;
  placeOfSupply: string;
  billToGstin: string;
  shipToName: string;
  shipToAddress: string | null;
  notes: string | null;
  createdBy: string | null;
  items: TaxInvoiceItem[];
}

const COMPANY = {
  name: "DJ Hospitality & Facility Management Private Limited",
  regd: "Regd. & Head Office:- 730, Tinmade, Sodiem Siolim, Mapusa Bardez, North Goa - 403502",
  branch: "Branch Office: 7 Crematorium Street, Kolkata-700014",
  cin: "CIN: U74910GA2020PTC014271",
  gstin: "GSTIN: 30AAHCD6485G1ZO",
  acHolder: "DJ Hospitality and Facility Management Private Limited",
  acNo: "258705000626",
  ifsc: "ICIC0002587",
  bankBranch: "ICICI BANK, DULER-MAPUSA (SUNSET BOULEVARD SHOP NO AG-9 & AG-10 GROUND FLOOR DULER MAPUSA-403507)",
};

function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh(s)", "Crore"];
  function twoDigit(n: number): string { if (n < 20) return ones[n]; return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : ""); }
  function threeDigit(n: number): string { if (n === 0) return ""; if (n < 100) return twoDigit(n); return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigit(n % 100) : ""); }
  function inWords(n: number): string {
    if (n === 0) return "";
    const groups: number[] = [];
    let remaining = n;
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
    while (remaining > 0) { groups.push(remaining % 100); remaining = Math.floor(remaining / 100); }
    const parts: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) { const g = groups[i]; if (g === 0) continue; const word = i === 0 ? threeDigit(g) : twoDigit(g); parts.push(word + (scales[i] ? " " + scales[i] : "")); }
    return parts.join(" ");
  }
  const rounded = Math.round(num * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  let result = "Rupees ";
  result += rupees === 0 ? "Zero" : inWords(rupees);
  if (paise > 0) result += " And Paise " + inWords(paise);
  result += " Only";
  return result;
}

function fmt(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemTotal(it: TaxInvoiceItem) { return (Number(it.quantity) || 0) * (Number(it.rate) || 0); }
function itemIgst(it: TaxInvoiceItem) { return itemTotal(it) * (Number(it.igstPercent) || 0) / 100; }
function itemAmount(it: TaxInvoiceItem) { return itemTotal(it) + itemIgst(it); }

function emptyItem(): TaxInvoiceItem {
  return { itemName: "", description: "", hsn: "", quantity: "0", uom: "", rate: "0", igstPercent: "0" };
}

function buildPrintHtml(inv: {
  invoiceNumber: string; invoiceDate: string; poNumber: string; poDate: string; vendorCode: string;
  billToName: string; billToAddress: string; placeOfSupply: string; billToGstin: string;
  shipToName: string; shipToAddress: string; notes: string; items: TaxInvoiceItem[];
}, logoSrc: string, autoPrint = true, signatureMode: "blank" | "stamp" | "dsc" = "blank", signatureSrc?: string): string {
  const totalTaxable = inv.items.reduce((s, it) => s + itemTotal(it), 0);
  const totalIgst = inv.items.reduce((s, it) => s + itemIgst(it), 0);
  const grandTotal = inv.items.reduce((s, it) => s + itemAmount(it), 0);

  const hsnMap = new Map<string, { taxable: number; igstPercent: string; igst: number }>();
  for (const it of inv.items) {
    const key = it.hsn || "-";
    const cur = hsnMap.get(key) || { taxable: 0, igstPercent: it.igstPercent, igst: 0 };
    cur.taxable += itemTotal(it);
    cur.igst += itemIgst(it);
    cur.igstPercent = it.igstPercent;
    hsnMap.set(key, cur);
  }
  const overallIgstPercent = inv.items.length && inv.items.every(it => it.igstPercent === inv.items[0].igstPercent) ? inv.items[0].igstPercent : "";

  const b = "1px solid #000";
  const itemRows = inv.items.map((it, i) => `
    <tr>
      <td style="border:${b};text-align:center;padding:4px;font-weight:700;">${i + 1}</td>
      <td style="border:${b};padding:4px;">
        <div style="font-weight:700;font-size:13px;">${esc(it.itemName)}</div>
        ${it.description ? `<div style="font-size:10px;">${esc(it.description).replace(/\n/g, "<br>")}</div>` : ""}
      </td>
      <td style="border:${b};text-align:center;padding:4px;">${esc(it.hsn)}</td>
      <td style="border:${b};text-align:center;padding:4px;">${Number(it.quantity) || 0}</td>
      <td style="border:${b};text-align:center;padding:4px;">${esc(it.uom)}</td>
      <td style="border:${b};text-align:center;padding:4px;">${Number(it.rate) || 0}</td>
      <td style="border:${b};text-align:right;padding:4px;">${fmt(itemTotal(it))}</td>
      <td style="border:${b};text-align:center;padding:4px;">${Number(it.igstPercent) || 0}</td>
      <td style="border:${b};text-align:right;padding:4px;">${fmt(itemIgst(it))}</td>
      <td style="border:${b};text-align:right;padding:4px;">${fmt(itemAmount(it))}</td>
    </tr>`).join("");

  const hsnRows = Array.from(hsnMap.entries()).map(([hsn, v]) => `
    <tr>
      <td style="border:${b};text-align:center;padding:4px;font-weight:700;">${esc(hsn)}</td>
      <td style="border:${b};text-align:right;padding:4px;font-weight:700;">${Math.round(v.taxable).toLocaleString("en-IN")}</td>
      <td style="border:${b};text-align:center;padding:4px;"></td>
      <td style="border:${b};text-align:center;padding:4px;"></td>
      <td style="border:${b};text-align:center;padding:4px;"></td>
      <td style="border:${b};text-align:center;padding:4px;"></td>
      <td style="border:${b};text-align:center;padding:4px;">${Number(v.igstPercent) || 0}</td>
      <td style="border:${b};text-align:right;padding:4px;">${fmt(v.igst)}</td>
      <td style="border:${b};text-align:right;padding:4px;font-weight:700;">${fmt(v.igst)}</td>
    </tr>`).join("");

  const head = "#cce6f4";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tax Invoice ${esc(inv.invoiceNumber)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; color: #000; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { border-collapse: collapse; width: 100%; }
    .b { border: ${b}; }
    td, th { font-size: 12px; word-wrap: break-word; overflow-wrap: break-word; }
    .lbl { font-weight: 700; }
  </style></head><body>
  <div style="font-weight:700;font-size:13px;margin-bottom:2px;">TAX INVOICE <span style="font-weight:400;color:#888;">ORIGINAL FOR RECIPIENT</span></div>
  <table class="b">
    <tr>
      <td class="b" style="width:55%;vertical-align:top;padding:6px;">
        <table style="border:none;"><tr>
          <td style="border:none;width:60px;vertical-align:top;"><img src="${logoSrc}" style="width:52px;height:auto;" /></td>
          <td style="border:none;vertical-align:top;">
            <div style="color:#c0392b;font-weight:700;font-size:16px;line-height:1.1;">${esc(COMPANY.name)}</div>
            <div style="font-size:9px;margin-top:3px;">${COMPANY.regd}</div>
            <div style="font-size:9px;">${COMPANY.branch}</div>
            <div style="font-size:9px;margin-top:3px;">${COMPANY.cin} &nbsp;&nbsp; ${COMPANY.gstin}</div>
          </td>
        </tr></table>
      </td>
      <td class="b" style="padding:0;vertical-align:top;">
        <table style="border:none;table-layout:fixed;height:100%;">
          <colgroup>
            <col style="width:16.66%"><col style="width:16.66%"><col style="width:16.67%">
            <col style="width:16.67%"><col style="width:16.67%"><col style="width:16.67%">
          </colgroup>
          <tr>
            <td class="b" colspan="3" style="text-align:center;font-weight:700;padding:4px;">Invoice Number</td>
            <td class="b" colspan="3" style="text-align:center;font-weight:700;padding:4px;">Invoice Date</td>
          </tr>
          <tr>
            <td class="b" colspan="3" style="text-align:center;font-weight:700;font-size:16px;padding:6px;">${esc(inv.invoiceNumber)}</td>
            <td class="b" colspan="3" style="text-align:center;font-weight:700;font-size:16px;padding:6px;">${esc(inv.invoiceDate)}</td>
          </tr>
          <tr>
            <td class="b" colspan="2" style="text-align:center;font-weight:700;padding:4px;">Po Number</td>
            <td class="b" colspan="2" style="text-align:center;font-weight:700;padding:4px;">PO Date</td>
            <td class="b" colspan="2" style="text-align:center;font-weight:700;padding:4px;">Vendor Code</td>
          </tr>
          <tr>
            <td class="b" colspan="2" style="text-align:center;font-weight:700;padding:4px;">${esc(inv.poNumber)}</td>
            <td class="b" colspan="2" style="text-align:center;font-weight:700;padding:4px;">${esc(inv.poDate)}</td>
            <td class="b" colspan="2" style="text-align:center;font-weight:700;padding:4px;">${esc(inv.vendorCode)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table class="b" style="border-top:none;">
    <tr>
      <td class="b" style="width:50%;vertical-align:top;padding:5px;">
        <div class="lbl">BILL TO</div>
        <table style="border:none;">
          <tr><td style="border:none;width:105px;vertical-align:top;" class="lbl">Name :</td><td style="border:none;font-weight:700;">${esc(inv.billToName)}</td></tr>
          <tr><td style="border:none;vertical-align:top;" class="lbl">Address :</td><td style="border:none;">${esc(inv.billToAddress)}</td></tr>
          <tr><td style="border:none;vertical-align:top;" class="lbl">Place of Supply :</td><td style="border:none;">${esc(inv.placeOfSupply)}</td></tr>
          <tr><td style="border:none;vertical-align:top;" class="lbl">GSTIN:</td><td style="border:none;">${esc(inv.billToGstin)}</td></tr>
        </table>
      </td>
      <td class="b" style="width:50%;vertical-align:top;padding:5px;">
        <div class="lbl">SHIP TO</div>
        <table style="border:none;">
          <tr><td style="border:none;width:80px;vertical-align:top;" class="lbl">Name :</td><td style="border:none;font-weight:700;">${esc(inv.shipToName || inv.billToName)}</td></tr>
          <tr><td style="border:none;vertical-align:top;" class="lbl">Address :</td><td style="border:none;">${esc(inv.shipToAddress || inv.billToAddress)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table class="b" style="border-top:none;table-layout:fixed;">
    <colgroup>
      <col style="width:5%"><col style="width:27%"><col style="width:8%"><col style="width:9%">
      <col style="width:6%"><col style="width:8%"><col style="width:11%"><col style="width:6%">
      <col style="width:9%"><col style="width:11%">
    </colgroup>
    <thead>
      <tr style="background:${head};">
        <th class="b" style="padding:5px;">S.NO</th>
        <th class="b" style="padding:5px;">ITEMS</th>
        <th class="b" style="padding:5px;">HSN</th>
        <th class="b" style="padding:5px;">QUANTITY</th>
        <th class="b" style="padding:5px;">UoM</th>
        <th class="b" style="padding:5px;">RATE</th>
        <th class="b" style="padding:5px;">Total</th>
        <th class="b" style="padding:5px;">IGST %</th>
        <th class="b" style="padding:5px;">IGST</th>
        <th class="b" style="padding:5px;">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr style="background:${head};">
        <td class="b" colspan="6" style="text-align:right;font-weight:700;padding:5px;">TOTAL AMOUNT</td>
        <td class="b" style="text-align:right;font-weight:700;padding:5px;">${fmt(totalTaxable)}</td>
        <td class="b" style="text-align:center;font-weight:700;padding:5px;">${overallIgstPercent ? overallIgstPercent + "%" : ""}</td>
        <td class="b" style="text-align:right;font-weight:700;padding:5px;">${fmt(totalIgst)}</td>
        <td class="b" style="text-align:right;font-weight:700;padding:5px;">${fmt(grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <table class="b" style="border-top:none;table-layout:fixed;">
    <colgroup>
      <col style="width:12%"><col style="width:14%"><col style="width:9%"><col style="width:12%">
      <col style="width:9%"><col style="width:12%"><col style="width:9%"><col style="width:11%">
      <col style="width:12%">
    </colgroup>
    <thead>
      <tr style="background:${head};">
        <th class="b" rowspan="2" style="padding:4px;vertical-align:middle;">HSN/SAC</th>
        <th class="b" rowspan="2" style="padding:4px;vertical-align:middle;">TAXABLE VALUE</th>
        <th class="b" colspan="6" style="padding:4px;">IGST</th>
        <th class="b" rowspan="2" style="padding:4px;vertical-align:middle;">TOTAL TAX</th>
      </tr>
      <tr style="background:${head};">
        <th class="b" style="padding:4px;">CGST %</th>
        <th class="b" style="padding:4px;">CGST Amount</th>
        <th class="b" style="padding:4px;">SGST %</th>
        <th class="b" style="padding:4px;">SGST Amount</th>
        <th class="b" style="padding:4px;">IGST %</th>
        <th class="b" style="padding:4px;">IGST AMOUNT</th>
      </tr>
    </thead>
    <tbody>${hsnRows}</tbody>
  </table>
  <table class="b" style="border-top:none;">
    <tr><td class="b" style="padding:4px;font-weight:700;">INVOICE AMOUNT IN WORDS</td></tr>
    <tr><td class="b" style="padding:5px;font-weight:700;font-size:13px;">${numberToWords(grandTotal)}</td></tr>
  </table>
  <table class="b" style="border-top:none;">
    <tr><td class="b" style="padding:4px;font-weight:700;">BANK DETAILS</td></tr>
    <tr><td class="b" style="padding:4px;"><span class="lbl">A/C Holder Name :</span> &nbsp; <span class="lbl">${COMPANY.acHolder}</span></td></tr>
    <tr><td class="b" style="padding:4px;"><span class="lbl">Account Number:</span> &nbsp; <span class="lbl">${COMPANY.acNo}</span></td></tr>
    <tr><td class="b" style="padding:4px;"><span class="lbl">IFSC code:</span> &nbsp; <span class="lbl">${COMPANY.ifsc}</span></td></tr>
    <tr><td class="b" style="padding:4px;"><span class="lbl">Bank & Branch:</span> &nbsp; <span class="lbl">${COMPANY.bankBranch}</span></td></tr>
  </table>
  <table class="b" style="border-top:none;">
    <tr>
      <td class="b" style="width:60%;vertical-align:top;padding:5px;height:90px;">
        <div class="lbl">Notes:-</div>
        <div style="font-size:11px;white-space:pre-line;">${esc(inv.notes)}</div>
      </td>
      <td class="b" style="vertical-align:bottom;text-align:center;padding:5px;">
        ${signatureMode === "stamp" && signatureSrc ? `<img src="${signatureSrc}" style="width:190px;height:auto;display:block;margin:0 auto 2px;" />` : ""}
        ${signatureMode === "dsc" ? `
        <div style="border:1px dashed #444;margin:0 auto 4px;max-width:230px;padding:5px 8px;text-align:left;">
          <div style="font-size:10px;font-weight:700;">Digitally signed by</div>
          <div style="font-size:11px;font-weight:700;">WAHID AHMED</div>
          <div style="font-size:9px;">for ${esc(COMPANY.name)}</div>
          <div style="font-size:9px;">Signed using DSC (Digital Signature Certificate)</div>
        </div>` : ""}
        <div style="font-size:11px;">Authorised Signature for</div>
        <div style="font-weight:700;font-size:11px;">DJ Hospitality & Facility Management Private Limited</div>
      </td>
    </tr>
  </table>
  ${autoPrint ? `<script>
    (function(){
      var printed = false;
      function doPrint(){ if (printed) return; printed = true; setTimeout(function(){ window.print(); }, 150); }
      function ready(){
        var imgs = document.images;
        for (var i = 0; i < imgs.length; i++) {
          if (!imgs[i].complete || imgs[i].naturalWidth === 0) return false;
        }
        return true;
      }
      var tries = 0;
      var timer = setInterval(function(){
        tries++;
        if (ready() || tries > 40) { clearInterval(timer); doPrint(); }
      }, 100);
      window.onload = function(){ if (ready()) { clearInterval(timer); doPrint(); } };
      setTimeout(function(){ clearInterval(timer); doPrint(); }, 5000);
    })();
  </script>` : ""}
  </body></html>`;
}

export function TaxInvoiceTab({ clients }: { clients: ClientOption[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery<TaxInvoice[]>({ queryKey: ["/api/tax-invoices"] });
  const { data: allMasterItems = [] } = useQuery<ItemMasterOption[]>({ queryKey: ["/api/item-master"] });
  const { data: purchaseOrders = [] } = useQuery<{ id: number; poNumber: string; poDate: string; poAmount: string; clientName: string }[]>({ queryKey: ["/api/purchase-orders"] });
  const masterItems = allMasterItems.filter(mi => mi.itemType === "sales" || mi.itemType === "both");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaxInvoice | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [billToName, setBillToName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [billToGstin, setBillToGstin] = useState("");
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TaxInvoiceItem[]>([emptyItem()]);

  function resetForm() {
    setInvoiceNumber(""); setInvoiceDate(""); setPoNumber(""); setPoDate(""); setVendorCode("");
    setBillToName(""); setBillToAddress(""); setPlaceOfSupply(""); setBillToGstin("");
    setShipToName(""); setShipToAddress(""); setNotes(""); setItems([emptyItem()]);
  }

  function openNew() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(inv: TaxInvoice) {
    setEditing(inv);
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(toInputDate(inv.invoiceDate));
    setPoNumber(inv.poNumber || "");
    setPoDate(toInputDate(inv.poDate || ""));
    setVendorCode(inv.vendorCode || "");
    setBillToName(inv.billToName);
    setBillToAddress(inv.billToAddress || "");
    setPlaceOfSupply(inv.placeOfSupply || "");
    setBillToGstin(inv.billToGstin || "");
    setShipToName(inv.shipToName || "");
    setShipToAddress(inv.shipToAddress || "");
    setNotes(inv.notes || "");
    setItems(inv.items.length ? inv.items.map(it => ({ ...it })) : [emptyItem()]);
    setDialogOpen(true);
  }

  function applyClient(name: string) {
    const c = clients.find(cl => cl.name === name);
    setBillToName(name);
    if (c) {
      setBillToAddress(c.address || "");
      setBillToGstin(c.gstNo || "");
      setVendorCode(c.clientCode || "");
      if (!editing && c.stateCode) {
        const d = invoiceDate ? new Date(invoiceDate) : new Date();
        const fiscalYearStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
        fetch(`/api/tax-invoices/next-invoice-number?stateCode=${encodeURIComponent(c.stateCode.trim().toUpperCase())}&year=${fiscalYearStart}`, { credentials: "include" })
          .then(r => r.json())
          .then(data => { if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber); })
          .catch(() => {});
      }
    }
  }

  function applyShipClient(name: string) {
    const c = clients.find(cl => cl.name === name);
    setShipToName(name);
    if (c) setShipToAddress(c.address || "");
  }

  function updateItem(idx: number, field: keyof TaxInvoiceItem, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function applyMasterItem(idx: number, name: string) {
    const m = masterItems.find(mi => mi.itemName === name);
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      if (!m) return { ...it, itemName: name };
      return {
        ...it,
        itemName: m.itemName,
        hsn: m.hsnCode || it.hsn,
        uom: m.uom || it.uom,
        rate: m.rate && Number(m.rate) > 0 ? String(Number(m.rate)) : it.rate,
        igstPercent: m.gstPercent && Number(m.gstPercent) > 0 ? String(Number(m.gstPercent)) : it.igstPercent,
      };
    }));
  }
  function addItem() { setItems(prev => [...prev, emptyItem()]); }
  function removeItem(idx: number) { setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev); }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: toDisplayDate(invoiceDate),
        poNumber,
        poDate: toDisplayDate(poDate),
        vendorCode,
        billToName: billToName.trim(),
        billToAddress, placeOfSupply, billToGstin,
        shipToName, shipToAddress, notes,
        items: items.filter(it => it.itemName.trim()).map(it => ({
          itemName: it.itemName.trim(),
          description: it.description || "",
          hsn: it.hsn || "",
          quantity: String(Number(it.quantity) || 0),
          uom: it.uom || "",
          rate: String(Number(it.rate) || 0),
          igstPercent: String(Number(it.igstPercent) || 0),
        })),
      };
      const validItems = items.filter(it => it.itemName.trim());
      const billAmount = Math.round(validItems.reduce((s, it) => s + itemTotal(it), 0) * 100) / 100;
      const gstAmount = Math.round(validItems.reduce((s, it) => s + itemIgst(it), 0) * 100) / 100;
      const totalBillAmount = Math.round((billAmount + gstAmount) * 100) / 100;
      const gstPercent = billAmount > 0 ? Math.round((gstAmount / billAmount) * 10000) / 100 : 0;
      const matchedPo = poNumber.trim() ? purchaseOrders.find(p => p.poNumber === poNumber.trim()) : undefined;

      if (editing) {
        await apiRequest("PUT", `/api/tax-invoices/${editing.id}`, payload);

        // Automatically update the matching Sales Invoice ledger entry
        let salesUpdated = false;
        let salesError = "";
        try {
          const listRes = await fetch("/api/sales-invoices", { credentials: "include" });
          if (listRes.ok) {
            const salesList: { id: number; billNumber: string; tdsPercent: string }[] = await listRes.json();
            const match = salesList.find(s => s.billNumber === editing.invoiceNumber);
            if (match) {
              const tdsPct = Number(match.tdsPercent) || 0;
              const updatePayload = {
                clientName: billToName.trim(),
                billDate: invoiceDate,
                billNumber: invoiceNumber.trim(),
                billAmount,
                gstPercent,
                gstAmount,
                totalBillAmount,
                tdsPercent: tdsPct,
                tdsAmount: Math.round(billAmount * tdsPct) / 100,
                poId: matchedPo ? matchedPo.id : null,
                bypassPO: true,
              };
              const res = await fetch(`/api/sales-invoices/${match.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload), credentials: "include",
              });
              if (res.ok) {
                salesUpdated = true;
              } else {
                const j = await res.json().catch(() => ({}));
                salesError = j.message || "Failed to update sales invoice entry";
              }
            }
          }
        } catch (e: any) {
          salesError = e?.message || "Failed to update sales invoice entry";
        }
        return { salesCreated: false as boolean, salesUpdated, salesError };
      }
      await apiRequest("POST", "/api/tax-invoices", payload);

      // Automatically create a Sales Invoice ledger entry from this tax invoice
      let salesCreated = false;
      let salesError = "";
      try {
        const salesPayload = {
          clientName: billToName.trim(),
          billDate: invoiceDate,
          billNumber: invoiceNumber.trim(),
          billAmount,
          gstPercent,
          gstAmount,
          totalBillAmount,
          tdsPercent: 2,
          tdsAmount: Math.round(billAmount * 2) / 100,
          paymentReceivedDate: null,
          paymentReceivedAmount: 0,
          utrNo: null,
          poId: matchedPo ? matchedPo.id : null,
          bypassPO: true,
        };
        const res = await fetch("/api/sales-invoices", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(salesPayload), credentials: "include",
        });
        if (res.ok) {
          salesCreated = true;
        } else {
          const j = await res.json().catch(() => ({}));
          salesError = j.message || "Failed to create sales invoice entry";
        }
      } catch (e: any) {
        salesError = e?.message || "Failed to create sales invoice entry";
      }
      return { salesCreated, salesUpdated: false as boolean, salesError };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      if (result?.salesCreated || result?.salesUpdated) {
        queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
        toast({
          title: result.salesCreated ? "Created" : "Updated",
          description: result.salesCreated
            ? "Tax invoice saved & sales invoice entry created automatically"
            : "Tax invoice saved & sales invoice entry updated automatically",
        });
      } else if (result?.salesError) {
        toast({ title: "Tax invoice saved", description: `But sales invoice entry failed: ${result.salesError}`, variant: "destructive" });
      } else {
        toast({ title: editing ? "Updated" : "Created", description: "Tax invoice saved" });
      }
      setDialogOpen(false);
      resetForm();
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/tax-invoices/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      toast({ title: "Deleted", description: "Tax invoice deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" }),
  });

  const [poChecking, setPoChecking] = useState(false);

  async function handleSave() {
    if (poChecking || saveMutation.isPending) return;
    if (!invoiceNumber.trim()) { toast({ title: "Missing", description: "Invoice Number is required", variant: "destructive" }); return; }
    if (!invoiceDate) { toast({ title: "Missing", description: "Invoice Date is required", variant: "destructive" }); return; }
    if (!billToName.trim()) { toast({ title: "Missing", description: "Bill To name is required", variant: "destructive" }); return; }
    if (!items.some(it => it.itemName.trim())) { toast({ title: "Missing", description: "Add at least one line item", variant: "destructive" }); return; }
    const matchedPo = poNumber.trim() ? purchaseOrders.find(p => p.poNumber === poNumber.trim()) : undefined;
    setPoChecking(true);
    try {
      if (matchedPo) {
        const taxableTotal = Math.round(items.filter(it => it.itemName.trim()).reduce((s, it) => s + itemTotal(it), 0) * 100) / 100;
        const poAmt = Number(matchedPo.poAmount) || 0;
        // Cumulative check: one PO can hold multiple invoices, but all invoices together must not exceed the PO amount
        let usedAmount = 0;
        try {
          const res = await fetch("/api/sales-invoices", { credentials: "include" });
          if (res.ok) {
            const salesList: { id: number; billNumber: string; billAmount: string; poId: number | null }[] = await res.json();
            usedAmount = salesList
              .filter(s => s.poId === matchedPo.id && (!editing || s.billNumber !== editing.invoiceNumber))
              .reduce((sum, s) => sum + (Number(s.billAmount) || 0), 0);
          }
        } catch { /* if fetch fails, fall back to single-invoice check */ }
        const fmtInr = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
        if (Math.round((usedAmount + taxableTotal) * 100) / 100 > poAmt) {
          toast({
            title: "Exceeds Total PO amount",
            description: `Exceeds Total PO amount ${fmtInr(poAmt)}. Already billed on this PO: ${fmtInr(usedAmount)}. This invoice (without GST): ${fmtInr(taxableTotal)}. Balance left: ${fmtInr(Math.max(poAmt - usedAmount, 0))}. Invoice not saved.`,
            variant: "destructive",
          });
          return;
        }
      }
      saveMutation.mutate();
    } finally {
      setPoChecking(false);
    }
  }

  function invoiceHtml(inv: TaxInvoice, autoPrint = true, signatureMode: "blank" | "stamp" | "dsc" = "blank") {
    const logoSrc = new URL(logoPath, window.location.origin).href;
    const signatureSrc = signatureMode === "stamp" ? new URL(signaturePath, window.location.origin).href : undefined;
    return buildPrintHtml({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      poNumber: inv.poNumber || "",
      poDate: inv.poDate || "",
      vendorCode: inv.vendorCode || "",
      billToName: inv.billToName,
      billToAddress: inv.billToAddress || "",
      placeOfSupply: inv.placeOfSupply || "",
      billToGstin: inv.billToGstin || "",
      shipToName: inv.shipToName || "",
      shipToAddress: inv.shipToAddress || "",
      notes: inv.notes || "",
      items: inv.items,
    }, logoSrc, autoPrint, signatureMode, signatureSrc);
  }

  function printInvoice(inv: TaxInvoice, signatureMode: "blank" | "stamp" | "dsc" = "blank") {
    const html = invoiceHtml(inv, true, signatureMode);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    setPrintChoiceInv(null);
  }

  const [previewInv, setPreviewInv] = useState<TaxInvoice | null>(null);
  const [printChoiceInv, setPrintChoiceInv] = useState<TaxInvoice | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  // invoiceDate is stored as dd-mm-yyyy
  const invYear = (d: string) => (d || "").split("-")[2] || "";
  const invMonth = (d: string) => String(Number((d || "").split("-")[1] || 0));

  const yearOptions = Array.from(new Set(invoices.map(i => invYear(i.invoiceDate)).filter(Boolean))).sort().reverse();
  const clientOptions = Array.from(new Set(invoices.map(i => i.billToName).filter(Boolean))).sort();
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const filteredInvoices = invoices.filter(inv => {
    const q = searchTerm.trim().toLowerCase();
    const qMatch = !q
      || inv.invoiceNumber.toLowerCase().includes(q)
      || (inv.billToName || "").toLowerCase().includes(q)
      || (inv.poNumber || "").toLowerCase().includes(q);
    const cMatch = filterClient === "all" || inv.billToName === filterClient;
    const mMatch = filterMonth === "all" || invMonth(inv.invoiceDate) === filterMonth;
    const yMatch = filterYear === "all" || invYear(inv.invoiceDate) === filterYear;
    return qMatch && cMatch && mMatch && yMatch;
  });

  const formGrand = items.reduce((s, it) => s + itemAmount(it), 0);

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-3">
        <Button className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg" onClick={openNew} data-testid="button-new-tax-invoice">
          <Plus className="w-4 h-4 mr-2" /> New Tax Invoice
        </Button>
      </div>

      <Card className="border-0 shadow-md mb-4">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_1fr] gap-3">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Search</span>
              </div>
              <div className="relative">
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search bill number or client..."
                  className="h-10"
                  data-testid="input-tax-invoice-search"
                />
                {searchTerm && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")} data-testid="button-clear-tax-search">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Client</span>
              </div>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full h-10 rounded-md border bg-background text-sm px-2" data-testid="select-tax-filter-client">
                <option value="all">All Clients</option>
                {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Month</span>
              </div>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-full h-10 rounded-md border bg-background text-sm px-2" data-testid="select-tax-filter-month">
                <option value="all">All Months</option>
                {MONTH_NAMES.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs font-semibold">Year</span>
              </div>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full h-10 rounded-md border bg-background text-sm px-2" data-testid="select-tax-filter-year">
                <option value="all">All Years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
      ) : invoices.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Receipt className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No tax invoices yet</p>
            <Button className="mt-4" onClick={openNew} data-testid="button-new-tax-invoice-empty">
              <Plus className="w-4 h-4 mr-2" /> Create First Tax Invoice
            </Button>
          </CardContent>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No invoices match your search / filter</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{filteredInvoices.length} of {invoices.length} invoices</p>
          {filteredInvoices.map(inv => {
            const grand = inv.items.reduce((s, it) => s + itemAmount(it), 0);
            return (
              <Card key={inv.id} className="border-0 shadow-md" data-testid={`card-tax-invoice-${inv.id}`}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base" data-testid={`text-tax-invoice-number-${inv.id}`}>{inv.invoiceNumber}</span>
                      <span className="text-xs text-muted-foreground">{inv.invoiceDate}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{inv.billToName}</div>
                    <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">₹{fmt(grand)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewInv(inv)} data-testid={`button-view-tax-invoice-${inv.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPrintChoiceInv(inv)} data-testid={`button-print-tax-invoice-${inv.id}`}>
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(inv)} data-testid={`button-edit-tax-invoice-${inv.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { if (confirm(`Delete tax invoice ${inv.invoiceNumber}?`)) deleteMutation.mutate(inv.id); }} data-testid={`button-delete-tax-invoice-${inv.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl w-full max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tax Invoice" : "New Tax Invoice"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Invoice Number *</Label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="DJ-KOL-26-044" data-testid="input-tax-invoice-number" />
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} data-testid="input-tax-invoice-date" />
              </div>
              <div>
                <Label>Vendor Code</Label>
                <Input value={vendorCode} onChange={e => setVendorCode(e.target.value)} data-testid="input-tax-vendor-code" />
              </div>
              <div>
                <Label>Choose from PO</Label>
                <Select
                  value=""
                  onValueChange={(v) => {
                    const po = purchaseOrders.find(p => String(p.id) === v);
                    if (po) {
                      setPoNumber(po.poNumber);
                      setPoDate(toInputDate(po.poDate));
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-tax-po"><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const pool = billToName && purchaseOrders.some(p => p.clientName === billToName)
                        ? purchaseOrders.filter(p => p.clientName === billToName)
                        : purchaseOrders;
                      const sorted = [...pool].sort((a, b) => new Date(b.poDate).getTime() - new Date(a.poDate).getTime());
                      if (sorted.length === 0) return <SelectItem value="none" disabled>No purchase orders</SelectItem>;
                      return sorted.map(p => (
                        <SelectItem key={p.id} value={String(p.id)} data-testid={`option-tax-po-${p.id}`}>
                          {p.poNumber} — {toDisplayDate(p.poDate)} — ₹{Number(p.poAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({p.clientName})
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>PO Number</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} data-testid="input-tax-po-number" />
              </div>
              <div>
                <Label>PO Date</Label>
                <Input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} data-testid="input-tax-po-date" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 border rounded-md p-3">
                <div className="font-semibold text-sm">BILL TO</div>
                <div>
                  <Label>Client</Label>
                  <Select value={billToName} onValueChange={applyClient}>
                    <SelectTrigger data-testid="select-tax-bill-to"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={billToName} onChange={e => setBillToName(e.target.value)} data-testid="input-tax-bill-name" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={billToAddress} onChange={e => setBillToAddress(e.target.value)} data-testid="input-tax-bill-address" />
                </div>
                <div>
                  <Label>Place of Supply</Label>
                  <Input value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} placeholder="West Bengal" data-testid="input-tax-place-supply" />
                </div>
                <div>
                  <Label>GSTIN</Label>
                  <Input value={billToGstin} onChange={e => setBillToGstin(e.target.value)} data-testid="input-tax-bill-gstin" />
                </div>
              </div>
              <div className="space-y-2 border rounded-md p-3">
                <div className="font-semibold text-sm">SHIP TO <span className="font-normal text-xs text-muted-foreground">(blank = same as Bill To)</span></div>
                <div>
                  <Label>Client</Label>
                  <Select value={shipToName} onValueChange={applyShipClient}>
                    <SelectTrigger data-testid="select-tax-ship-to"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={shipToName} onChange={e => setShipToName(e.target.value)} data-testid="input-tax-ship-name" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} data-testid="input-tax-ship-address" />
                </div>
              </div>
            </div>

            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm">Line Items</div>
                <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-tax-item"><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
              </div>
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2 bg-muted/30" data-testid={`row-tax-item-${idx}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Item {idx + 1}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => removeItem(idx)} data-testid={`button-remove-tax-item-${idx}`}><X className="w-4 h-4" /></Button>
                    </div>
                    {masterItems.length > 0 && (
                      <Select value={masterItems.some(mi => mi.itemName === it.itemName) ? it.itemName : ""} onValueChange={v => applyMasterItem(idx, v)}>
                        <SelectTrigger data-testid={`select-tax-item-master-${idx}`}><SelectValue placeholder="Choose from Item Master" /></SelectTrigger>
                        <SelectContent>
                          {masterItems.map(mi => <SelectItem key={mi.id} value={mi.itemName}>{mi.itemName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input value={it.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} placeholder="Item name (e.g. Breakfast)" data-testid={`input-tax-item-name-${idx}`} />
                      <Input value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Description / period (optional)" data-testid={`input-tax-item-desc-${idx}`} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <div>
                        <Label className="text-[10px]">HSN</Label>
                        <Input value={it.hsn} onChange={e => updateItem(idx, "hsn", e.target.value)} data-testid={`input-tax-item-hsn-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Quantity</Label>
                        <Input type="number" value={it.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} data-testid={`input-tax-item-qty-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-[10px]">UoM</Label>
                        <Input value={it.uom} onChange={e => updateItem(idx, "uom", e.target.value)} placeholder="PLT" data-testid={`input-tax-item-uom-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Rate</Label>
                        <Input type="number" value={it.rate} onChange={e => updateItem(idx, "rate", e.target.value)} data-testid={`input-tax-item-rate-${idx}`} />
                      </div>
                      <div>
                        <Label className="text-[10px]">IGST %</Label>
                        <Input type="number" value={it.igstPercent} onChange={e => updateItem(idx, "igstPercent", e.target.value)} data-testid={`input-tax-item-igst-${idx}`} />
                      </div>
                      <div className="flex flex-col justify-end text-xs">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-semibold" data-testid={`text-tax-item-amount-${idx}`}>₹{fmt(itemAmount(it))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3 text-sm font-bold">
                Grand Total: <span className="ml-2 text-violet-600" data-testid="text-tax-grand-total">₹{fmt(formGrand)}</span>
              </div>
              <div className="text-xs text-muted-foreground text-right mt-1">{numberToWords(formGrand)}</div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for the invoice" data-testid="input-tax-notes" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-tax-invoice">Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || poChecking} className="bg-gradient-to-r from-violet-500 to-purple-500 text-white" data-testid="button-save-tax-invoice">
                {(saveMutation.isPending || poChecking) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {editing ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewInv} onOpenChange={(o) => { if (!o) setPreviewInv(null); }}>
        <DialogContent className="max-w-5xl w-full max-h-[92vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
            <DialogTitle>Invoice {previewInv?.invoiceNumber}</DialogTitle>
            <Button size="sm" variant="outline" className="mr-8" onClick={() => previewInv && setPrintChoiceInv(previewInv)} data-testid="button-print-from-preview">
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </DialogHeader>
          {previewInv && (
            <iframe
              title="Invoice preview"
              className="w-full bg-white"
              style={{ height: "calc(92vh - 70px)", border: "none" }}
              sandbox=""
              srcDoc={invoiceHtml(previewInv, false)}
              data-testid="iframe-invoice-preview"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!printChoiceInv} onOpenChange={(o) => { if (!o) setPrintChoiceInv(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Print Invoice {printChoiceInv?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => printChoiceInv && printInvoice(printChoiceInv, "blank")}
              data-testid="button-print-blank"
            >
              <Printer className="w-4 h-4 mr-2" /> 1. Blank (sign by hand)
            </Button>
            <Button
              className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
              onClick={() => printChoiceInv && printInvoice(printChoiceInv, "stamp")}
              data-testid="button-print-with-stamp"
            >
              <Printer className="w-4 h-4 mr-2" /> 2. Stamp &amp; Signature
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => printChoiceInv && printInvoice(printChoiceInv, "dsc")}
              data-testid="button-print-dsc"
            >
              <Printer className="w-4 h-4 mr-2" /> 3. Thru DSC (digital signature)
            </Button>
            <p className="text-xs text-muted-foreground">
              For DSC: choose option 3, save as PDF from the print window, then sign the PDF with your DSC pendrive token utility.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
