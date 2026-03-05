import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Plus, Trash2, Calculator, Save, ArrowLeft, X, CalendarDays, Wallet, IndianRupee, ShoppingBasket, Leaf, TrendingDown, TrendingUp, Banknote } from "lucide-react";
import { useCreateReport, useUpdateReport, useReport, useItemMaster, useVegetableLastPrices } from "@/hooks/use-reports";
import { insertDailyReportSchema, insertExpenseItemSchema } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

function AddUpCalculator({ value, onApply }: { value: number; onApply: (total: number) => void }) {
  const [entries, setEntries] = useState<number[]>(() => value > 0 ? [value] : [0]);
  const [open, setOpen] = useState(false);

  const total = entries.reduce((sum, v) => sum + v, 0);

  const updateEntry = (index: number, val: number) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const addRow = () => setEntries(prev => [...prev, 0]);

  const removeRow = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onApply(total);
    setOpen(false);
  };

  useEffect(() => {
    if (open) {
      setEntries(value > 0 ? [value] : [0]);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" data-testid="button-calculator">
          <Calculator className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Add Up Amounts</span>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {entries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}.</span>
                <Input
                  type="number"
                  step="0.01"
                  value={entry || ""}
                  onChange={(e) => updateEntry(idx, Number(e.target.value) || 0)}
                  className="h-8 font-mono text-right"
                  autoFocus={idx === entries.length - 1}
                  data-testid={`input-calc-entry-${idx}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => removeRow(idx)}
                  disabled={entries.length <= 1}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={addRow} data-testid="button-calc-add-row">
            <Plus className="w-3 h-3 mr-1" /> Add Row
          </Button>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total: ₹{total.toFixed(2)}</span>
            <Button type="button" size="sm" onClick={handleApply} data-testid="button-calc-apply">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const formSchema = insertDailyReportSchema.extend({
  date: z.date(),
  items: z.array(insertExpenseItemSchema.extend({
    tempId: z.string().optional(),
    id: z.number().optional()
  })),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_FIXED_ITEMS = [
  { category: 'fixed', description: 'Cup Dahi 85g', uom: 'Kg', qty: 0, rate: 15, amount: 0 },
  { category: 'fixed', description: 'Dahi 100g Khatta', uom: 'Pcs', qty: 0, rate: 19, amount: 0 },
  { category: 'fixed', description: 'Dahi 100g Sweet', uom: 'Pcs', qty: 0, rate: 21, amount: 0 },
  { category: 'fixed', description: 'Pkt Dahi 1Kg', uom: 'Pkt', qty: 0, rate: 77, amount: 0 },
  { category: 'fixed', description: 'Rasgulla', uom: 'Pcs', qty: 0, rate: 6, amount: 0 },
  { category: 'fixed', description: 'Egg', uom: 'Box', qty: 0, rate: 1150, amount: 0 },
  { category: 'fixed', description: 'Paneer', uom: 'Kg', qty: 0, rate: 250, amount: 0 },
  { category: 'fixed', description: 'Petrol', uom: 'Ltr', qty: 0, rate: 105, amount: 0 },
  { category: 'fixed', description: 'Transport/Parking', uom: 'Trip', qty: 0, rate: 10, amount: 0 },
];


export default function ReportForm() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/report/:id");
  const isEditMode = !!match;
  const reportId = params?.id ? parseInt(params.id) : null;

  const { toast } = useToast();
  const { data: report, isLoading: isReportLoading } = useReport(reportId);
  const { data: salesItems = [] } = useItemMaster("sales");
  const vegetableItems = salesItems.map((item: any) => ({ id: item.id, name: item.itemName }));
  const { data: vegLastPrices = [] } = useVegetableLastPrices();
  const createMutation = useCreateReport();
  const updateMutation = useUpdateReport();

  const vegPriceMap = new Map(vegLastPrices.map(p => [p.description, p.rate]));
  const itemMasterRateMap = new Map(salesItems.map((item: any) => [item.itemName, { rate: Number(item.rate) || 0, uom: item.uom || "Kg" }]));

  const [lastEdited, setLastEdited] = useState<Record<number, 'rate' | 'amount'>>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      openingBalance: 0,
      receivedAmount: 0,
      items: [
        ...DEFAULT_FIXED_ITEMS.map(item => ({ ...item, reportId: 0 })),
      ],
    },
  });

  const selectedDate = useWatch({ control: form.control, name: "date" });

  useEffect(() => {
    if (!isEditMode && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetch(`/api/reports/previous-balance/${dateStr}`)
        .then(res => res.json())
        .then(data => {
          if (data.balance !== undefined) {
            form.setValue("openingBalance", data.balance);
          }
        });
    }
  }, [selectedDate, isEditMode, form]);

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (report) {
      form.reset({
        date: new Date(report.date),
        openingBalance: Number(report.openingBalance),
        receivedAmount: Number(report.receivedAmount),
        items: report.items.map((item: any) => ({
          ...item,
          qty: Number(item.qty),
          rate: Number(item.rate),
          amount: Number(item.amount),
        })),
      });
    }
  }, [report, form]);

  const items = useWatch({ control: form.control, name: "items" });
  const openingBalance = useWatch({ control: form.control, name: "openingBalance" }) || 0;
  const receivedAmount = useWatch({ control: form.control, name: "receivedAmount" }) || 0;

  const totalFixedCost = items
    .filter(i => i.category === 'fixed')
    .reduce((sum, item) => sum + (Number(item.qty) * Number(item.rate)), 0);

  const totalVegCost = items
    .filter(i => i.category === 'vegetable')
    .reduce((sum, item) => sum + (Number(item.qty) * Number(item.rate)), 0);

  const grandTotalExpense = totalFixedCost + totalVegCost;
  const totalCash = Number(openingBalance) + Number(receivedAmount);
  const balanceInHand = totalCash - grandTotalExpense;

  const handleItemChange = (index: number, field: 'qty' | 'rate', value: string) => {
    const numValue = parseFloat(value) || 0;
    const currentItem = items[index];
    const newQty = field === 'qty' ? numValue : Number(currentItem.qty);
    const newRate = field === 'rate' ? numValue : Number(currentItem.rate);
    const newAmount = newQty * newRate;

    form.setValue(`items.${index}.${field}`, numValue);
    form.setValue(`items.${index}.amount`, newAmount);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const formattedData = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        items: data.items.map(item => ({
          ...item,
          amount: Number(item.qty) * Number(item.rate)
        }))
      };

      if (isEditMode && reportId) {
        await updateMutation.mutateAsync({ id: reportId, ...formattedData });
        toast({ title: "Report updated", description: "The daily report has been saved." });
      } else {
        await createMutation.mutateAsync(formattedData);
        toast({ title: "Report created", description: "New daily report has been generated." });
        setLocation("/");
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive"
      });
    }
  };

  if (isEditMode && isReportLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8 pb-32 sm:pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="outline" size="icon" onClick={() => setLocation("/")} type="button" className="shrink-0 rounded-xl border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/30">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                {isEditMode ? "Edit Report" : "Daily Cash Expance"}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Fill in the daily expense details</p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 ml-12 sm:ml-0">
             <Button variant="outline" type="button" onClick={() => setLocation("/")} className="text-xs sm:text-sm h-9 sm:h-10 rounded-xl">
               Cancel
             </Button>
             <Button 
               type="submit" 
               disabled={createMutation.isPending || updateMutation.isPending}
               className="shadow-lg shadow-indigo-500/20 text-xs sm:text-sm h-9 sm:h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
               data-testid="button-save-report"
             >
               {(createMutation.isPending || updateMutation.isPending) ? (
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
               ) : (
                 <Save className="w-4 h-4 mr-2" />
               )}
               Save Report
             </Button>
          </div>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-general-info">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarDays className="w-5 h-5" />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/20">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Date
              </label>
              <DatePicker 
                date={form.watch("date")}
                setDate={(date) => date && form.setValue("date", date)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Opening Balance (₹)
              </label>
              <Input 
                type="number" 
                step="0.01"
                className="font-mono border-emerald-200 focus:border-emerald-400 dark:border-emerald-800"
                {...form.register("openingBalance", { valueAsNumber: true })}
                data-testid="input-opening-balance"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" /> Received Amount (₹)
              </label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  step="0.01"
                  className="font-mono border-violet-200 focus:border-violet-400 dark:border-violet-800"
                  {...form.register("receivedAmount", { valueAsNumber: true })}
                  data-testid="input-received-amount"
                />
                <AddUpCalculator
                  value={receivedAmount}
                  onApply={(total) => form.setValue("receivedAmount", total)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-fixed-items">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShoppingBasket className="w-5 h-5" />
              Fixed Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="sm:hidden divide-y">
              {fields.map((field, index) => {
                if (field.category !== 'fixed') return null;
                const fixedIndex = fields.slice(0, index).filter(f => f.category === 'fixed').length + 1;
                return (
                  <div key={field.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{fixedIndex}</span>
                        {field.description}
                      </span>
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-mono bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full font-semibold">{field.uom}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="h-9 font-mono text-center no-spinner"
                          placeholder="0"
                          value={items[index]?.qty || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            form.setValue(`items.${index}.qty`, val);
                            if (lastEdited[index] === 'amount') {
                              const amt = Number(items[index]?.amount) || 0;
                              if (val > 0) form.setValue(`items.${index}.rate`, amt / val);
                            } else {
                              const rate = Number(items[index]?.rate) || 0;
                              form.setValue(`items.${index}.amount`, val * rate);
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Rate ₹</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="h-9 font-mono text-center no-spinner"
                          placeholder="0"
                          value={items[index]?.rate || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const qty = Number(items[index]?.qty) || 0;
                            form.setValue(`items.${index}.rate`, val);
                            setLastEdited(prev => ({ ...prev, [index]: 'rate' }));
                            form.setValue(`items.${index}.amount`, qty * val);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Amount</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="h-9 font-mono text-center no-spinner"
                          placeholder="0"
                          value={items[index]?.amount || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const qty = Number(items[index]?.qty) || 0;
                            form.setValue(`items.${index}.amount`, val);
                            setLastEdited(prev => ({ ...prev, [index]: 'amount' }));
                            if (qty > 0) {
                              form.setValue(`items.${index}.rate`, val / qty);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="w-10">No.</th>
                    <th>Description</th>
                    <th className="w-16">UoM</th>
                    <th className="w-24">Qty</th>
                    <th className="w-24">Rate (₹)</th>
                    <th className="w-28 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    if (field.category !== 'fixed') return null;
                    const fixedIndex = fields.slice(0, index).filter(f => f.category === 'fixed').length + 1;
                    return (
                      <tr key={field.id}>
                        <td className="text-center">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{fixedIndex}</span>
                        </td>
                        <td className="font-medium">{field.description}</td>
                        <td>
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-mono bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full font-semibold">{field.uom}</span>
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="any"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0"
                            defaultValue=""
                            key={`fixed-qty-${field.id}`}
                            {...form.register(`items.${index}.qty` as const, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (lastEdited[index] === 'amount') {
                                  const amt = Number(items[index]?.amount) || 0;
                                  if (val > 0) form.setValue(`items.${index}.rate`, amt / val);
                                } else {
                                  const rate = Number(items[index]?.rate) || 0;
                                  form.setValue(`items.${index}.amount`, val * rate);
                                }
                              }
                            })}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="any"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0"
                            defaultValue=""
                            key={`fixed-rate-${field.id}`}
                            {...form.register(`items.${index}.rate` as const, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const qty = Number(items[index]?.qty) || 0;
                                setLastEdited(prev => ({ ...prev, [index]: 'rate' }));
                                form.setValue(`items.${index}.amount`, qty * val);
                              }
                            })}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="any"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0"
                            defaultValue=""
                            key={`fixed-amt-${field.id}`}
                            {...form.register(`items.${index}.amount` as const, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const qty = Number(items[index]?.qty) || 0;
                                setLastEdited(prev => ({ ...prev, [index]: 'amount' }));
                                if (qty > 0) {
                                  form.setValue(`items.${index}.rate`, val / qty);
                                }
                              }
                            })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-t border-orange-200 dark:border-orange-800/30 flex justify-end">
              <div className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBasket className="w-4 h-4 text-orange-500" />
                Total Fixed: <span className="font-mono ml-1 text-base sm:text-lg text-orange-600 dark:text-orange-400" data-testid="text-total-fixed">₹{totalFixedCost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-vegetable-items">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white pb-3 pt-4 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Leaf className="w-5 h-5" />
              Vegetable Purchase
            </CardTitle>
            <Button 
              type="button" 
              size="sm" 
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              onClick={() => append({ 
                reportId: reportId || 0,
                category: 'vegetable', 
                description: '', 
                uom: 'Kg', 
                qty: 0, 
                rate: 0, 
                amount: 0 
              })}
              data-testid="button-add-veg-top"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="sm:hidden divide-y">
              {fields.map((field, index) => {
                if (field.category !== 'vegetable') return null;
                const vegIndex = fields.slice(0, index).filter(f => f.category === 'vegetable').length + 1;
                return (
                  <div key={field.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{vegIndex}</span>
                        <Select
                          value={items[index]?.description || ''}
                          onValueChange={(val) => {
                            form.setValue(`items.${index}.description`, val);
                            const lastRate = vegPriceMap.get(val);
                            const masterInfo = itemMasterRateMap.get(val);
                            const rateToUse = lastRate || (masterInfo?.rate) || 0;
                            if (rateToUse && !items[index]?.rate) {
                              form.setValue(`items.${index}.rate`, rateToUse);
                              const qty = Number(items[index]?.qty) || 0;
                              form.setValue(`items.${index}.amount`, qty * rateToUse);
                            }
                            if (masterInfo?.uom) {
                              form.setValue(`items.${index}.uom`, masterInfo.uom);
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {vegetableItems.map((veg) => (
                              <SelectItem key={veg.id} value={veg.name}>{veg.name}</SelectItem>
                            ))}
                            {!vegetableItems.find(v => v.name === items[index]?.description) && items[index]?.description && (
                              <SelectItem value={items[index]?.description}>{items[index]?.description}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">UoM</label>
                        <Input
                          className="h-9 text-center text-sm"
                          placeholder="Kg"
                          {...form.register(`items.${index}.uom` as const)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Qty</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="h-9 font-mono text-center no-spinner"
                          placeholder="0"
                          value={items[index]?.qty || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            form.setValue(`items.${index}.qty`, val);
                            if (lastEdited[index] === 'amount') {
                              const amt = Number(items[index]?.amount) || 0;
                              if (val > 0) form.setValue(`items.${index}.rate`, amt / val);
                            } else {
                              const rate = Number(items[index]?.rate) || 0;
                              form.setValue(`items.${index}.amount`, val * rate);
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Rate ₹</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="h-9 font-mono text-center no-spinner"
                          placeholder="0"
                          value={items[index]?.rate || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const qty = Number(items[index]?.qty) || 0;
                            form.setValue(`items.${index}.rate`, val);
                            setLastEdited(prev => ({ ...prev, [index]: 'rate' }));
                            form.setValue(`items.${index}.amount`, qty * val);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Amt</label>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="h-9 font-mono text-center no-spinner"
                          placeholder="0"
                          value={items[index]?.amount || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const qty = Number(items[index]?.qty) || 0;
                            form.setValue(`items.${index}.amount`, val);
                            setLastEdited(prev => ({ ...prev, [index]: 'amount' }));
                            if (qty > 0) {
                              form.setValue(`items.${index}.rate`, val / qty);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {fields.filter(f => f.category === 'vegetable').length === 0 && (
                <div className="text-center py-8 text-muted-foreground italic text-sm">
                  No vegetable items added yet. Tap "Add Item" to start.
                </div>
              )}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="w-10">No.</th>
                    <th>Description</th>
                    <th className="w-20">UoM</th>
                    <th className="w-24">Qty</th>
                    <th className="w-24">Rate (₹)</th>
                    <th className="w-28 text-right">Amount (₹)</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    if (field.category !== 'vegetable') return null;
                    const vegIndex = fields.slice(0, index).filter(f => f.category === 'vegetable').length + 1;
                    return (
                      <tr key={field.id}>
                        <td className="text-center">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{vegIndex}</span>
                        </td>
                        <td>
                          <Select
                            value={items[index]?.description || ''}
                            onValueChange={(val) => {
                              form.setValue(`items.${index}.description`, val);
                              const lastRate = vegPriceMap.get(val);
                              const masterInfo = itemMasterRateMap.get(val);
                              const rateToUse = lastRate || (masterInfo?.rate) || 0;
                              if (rateToUse && !items[index]?.rate) {
                                form.setValue(`items.${index}.rate`, rateToUse);
                                const qty = Number(items[index]?.qty) || 0;
                                form.setValue(`items.${index}.amount`, qty * rateToUse);
                              }
                              if (masterInfo?.uom) {
                                form.setValue(`items.${index}.uom`, masterInfo.uom);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {vegetableItems.map((veg) => (
                                <SelectItem key={veg.id} value={veg.name}>
                                  {veg.name}
                                </SelectItem>
                              ))}
                              {!vegetableItems.find(v => v.name === items[index]?.description) && items[index]?.description && (
                                <SelectItem value={items[index]?.description}>
                                  {items[index]?.description}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                        <td>
                          <Input 
                            className="h-8" 
                            placeholder="Kg/Pcs"
                            {...form.register(`items.${index}.uom` as const)}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="any"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0"
                            key={`veg-qty-${field.id}`}
                            {...form.register(`items.${index}.qty` as const, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (lastEdited[index] === 'amount') {
                                  const amt = Number(items[index]?.amount) || 0;
                                  if (val > 0) form.setValue(`items.${index}.rate`, amt / val);
                                } else {
                                  const rate = Number(items[index]?.rate) || 0;
                                  form.setValue(`items.${index}.amount`, val * rate);
                                }
                              }
                            })}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="any"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0"
                            key={`veg-rate-${field.id}`}
                            {...form.register(`items.${index}.rate` as const, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const qty = Number(items[index]?.qty) || 0;
                                setLastEdited(prev => ({ ...prev, [index]: 'rate' }));
                                form.setValue(`items.${index}.amount`, qty * val);
                              }
                            })}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="any"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0"
                            key={`veg-amt-${field.id}`}
                            {...form.register(`items.${index}.amount` as const, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const qty = Number(items[index]?.qty) || 0;
                                setLastEdited(prev => ({ ...prev, [index]: 'amount' }));
                                if (qty > 0) {
                                  form.setValue(`items.${index}.rate`, val / qty);
                                }
                              }
                            })}
                          />
                        </td>
                        <td>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {fields.filter(f => f.category === 'vegetable').length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground italic">
                        No vegetable items added yet. Click "Add Item" to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-t border-emerald-200 dark:border-emerald-800/30 flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                onClick={() => append({
                  reportId: reportId || 0,
                  category: 'vegetable',
                  description: '',
                  uom: 'Kg',
                  qty: 0,
                  rate: 0,
                  amount: 0
                })}
                data-testid="button-add-veg-bottom"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
              <div className="text-sm font-semibold flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-500" />
                Total Vegetables: <span className="font-mono ml-1 text-base sm:text-lg text-emerald-600 dark:text-emerald-400" data-testid="text-total-veg">₹{totalVegCost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 md:static bg-background/80 backdrop-blur-md md:bg-transparent border-t md:border-0 p-3 sm:p-4 md:p-0 z-10">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-4">
                <div className="p-3 sm:p-5 bg-gradient-to-br from-rose-500 to-pink-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Total Expense
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-total-expense">₹{grandTotalExpense.toFixed(2)}</p>
                </div>
                <div className="p-3 sm:p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Total Cash
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-total-cash">₹{totalCash.toFixed(2)}</p>
                </div>
                <div className={`p-3 sm:p-5 col-span-2 ${balanceInHand < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-emerald-500 to-green-600'} text-white`}>
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Balance In Hand
                  </p>
                  <p className="text-xl sm:text-3xl font-bold font-mono" data-testid="text-balance">
                    ₹{balanceInHand.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </Layout>
  );
}
