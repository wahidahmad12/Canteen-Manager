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
import { Loader2, Plus, Trash2, Calculator, Save, ArrowLeft, X } from "lucide-react";
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

// Schema for the form
const formSchema = insertDailyReportSchema.extend({
  date: z.date(), // Use Date object in form, convert to string for API
  items: z.array(insertExpenseItemSchema.extend({
    // Add temporary ID for tracking fields in array
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

  // Load data for edit mode
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

  // Watch values for real-time calculations
  const items = useWatch({ control: form.control, name: "items" });
  const openingBalance = useWatch({ control: form.control, name: "openingBalance" }) || 0;
  const receivedAmount = useWatch({ control: form.control, name: "receivedAmount" }) || 0;

  // Derived calculations
  const totalFixedCost = items
    .filter(i => i.category === 'fixed')
    .reduce((sum, item) => sum + (Number(item.qty) * Number(item.rate)), 0);

  const totalVegCost = items
    .filter(i => i.category === 'vegetable')
    .reduce((sum, item) => sum + (Number(item.qty) * Number(item.rate)), 0);

  const grandTotalExpense = totalFixedCost + totalVegCost;
  const totalCash = Number(openingBalance) + Number(receivedAmount);
  const balanceInHand = totalCash - grandTotalExpense;

  // Handle row calculation updates
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
          // Recalculate amount one last time to be safe
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
            <Button variant="outline" size="icon" onClick={() => setLocation("/")} type="button" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">
                {isEditMode ? "Edit Report" : "Daily Cash Expance"}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Fill in the daily expense details.</p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 ml-12 sm:ml-0">
             <Button variant="outline" type="button" onClick={() => setLocation("/")} className="text-xs sm:text-sm h-9 sm:h-10">
               Cancel
             </Button>
             <Button 
               type="submit" 
               disabled={createMutation.isPending || updateMutation.isPending}
               className="shadow-lg shadow-primary/20 text-xs sm:text-sm h-9 sm:h-10"
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

        {/* General Info Card */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <DatePicker 
                date={form.watch("date")}
                setDate={(date) => date && form.setValue("date", date)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Opening Balance (₹)</label>
              <Input 
                type="number" 
                step="0.01"
                className="font-mono"
                {...form.register("openingBalance", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Received Amount (₹)</label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  step="0.01"
                  className="font-mono"
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

        {/* Fixed Items Section */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Fixed Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y">
              {fields.map((field, index) => {
                if (field.category !== 'fixed') return null;
                const fixedIndex = fields.slice(0, index).filter(f => f.category === 'fixed').length + 1;
                return (
                  <div key={field.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{fixedIndex}. {field.description}</span>
                      <span className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded">{field.uom}</span>
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
            {/* Desktop table layout */}
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
                        <td className="text-center text-muted-foreground">{fixedIndex}</td>
                        <td className="font-medium">{field.description}</td>
                        <td className="text-muted-foreground text-xs font-mono bg-muted/30 px-2 py-1 rounded">
                          {field.uom}
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
            <div className="p-3 sm:p-4 bg-muted/20 border-t border-border flex justify-end">
              <div className="text-sm font-medium">
                Total Fixed: <span className="font-mono ml-2 text-base sm:text-lg">₹{totalFixedCost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vegetable Items Section */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Vegetable Purchase</CardTitle>
            <Button 
              type="button" 
              size="sm" 
              variant="outline"
              onClick={() => append({ 
                reportId: reportId || 0,
                category: 'vegetable', 
                description: '', 
                uom: 'Kg', 
                qty: 0, 
                rate: 0, 
                amount: 0 
              })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y">
              {fields.map((field, index) => {
                if (field.category !== 'vegetable') return null;
                const vegIndex = fields.slice(0, index).filter(f => f.category === 'vegetable').length + 1;
                return (
                  <div key={field.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground shrink-0">{vegIndex}.</span>
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
            {/* Desktop table layout */}
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
                        <td className="text-center text-muted-foreground">{vegIndex}</td>
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
            <div className="p-3 sm:p-4 bg-muted/20 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                variant="outline"
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
              <div className="text-sm font-medium">
                Total Vegetables: <span className="font-mono ml-2 text-base sm:text-lg">₹{totalVegCost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 md:static bg-background/80 backdrop-blur-md md:bg-transparent border-t md:border-0 p-3 sm:p-4 md:p-0 z-10">
          <Card className="border-primary/20 bg-primary/5 shadow-lg">
            <CardContent className="p-3 sm:p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Expense</p>
                  <p className="text-lg sm:text-2xl font-bold font-mono text-primary">₹{grandTotalExpense.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Cash</p>
                  <p className="text-lg sm:text-2xl font-bold font-mono">₹{totalCash.toFixed(2)}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Balance In Hand</p>
                  <p className={`text-xl sm:text-3xl font-bold font-mono ${balanceInHand < 0 ? 'text-destructive' : 'text-green-600'}`}>
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
