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
import { Loader2, Plus, Trash2, Calculator, Save, ArrowLeft } from "lucide-react";
import { useCreateReport, useUpdateReport, useReport } from "@/hooks/use-reports";
import { insertDailyReportSchema, insertExpenseItemSchema } from "@shared/schema";
import { format } from "date-fns";

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
  { category: 'fixed', description: 'Ginger (Adarak)', uom: 'Kg', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Garlic (Lahasun)', uom: 'Kg', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Tomato (Tamaatar)', uom: 'Kg', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Green Chilli (Mirch)', uom: 'Kg', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Lemon (Neemboo)', uom: 'Pcs', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Cup Dahi 85g', uom: 'Kg', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Dahi 100g Khatta', uom: 'Pcs', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Dahi 100g Sweet', uom: 'Pcs', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Pkt Dahi 1Kg', uom: 'Pkt', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Rasgulla', uom: 'Pcs', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Egg', uom: 'Box', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Paneer', uom: 'Kg', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Petrol', uom: 'Ltr', qty: 0, rate: 0, amount: 0 },
  { category: 'fixed', description: 'Transport/Parking', uom: 'Trip', qty: 0, rate: 0, amount: 0 },
];

export default function ReportForm() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/report/:id");
  const isEditMode = !!match;
  const reportId = params?.id ? parseInt(params.id) : null;

  const { toast } = useToast();
  const { data: report, isLoading: isReportLoading } = useReport(reportId);
  const createMutation = useCreateReport();
  const updateMutation = useUpdateReport();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      openingBalance: 0,
      receivedAmount: 0,
      items: DEFAULT_FIXED_ITEMS,
    },
  });

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
        items: report.items.map(item => ({
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

    update(index, { 
      ...currentItem, 
      [field]: numValue,
      amount: newAmount 
    });
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setLocation("/")} type="button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isEditMode ? "Edit Report" : "New Daily Report"}
              </h1>
              <p className="text-muted-foreground">Fill in the daily expense details.</p>
            </div>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" type="button" onClick={() => setLocation("/")}>
               Cancel
             </Button>
             <Button 
               type="submit" 
               disabled={createMutation.isPending || updateMutation.isPending}
               className="shadow-lg shadow-primary/20"
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
              <Input 
                type="number" 
                step="0.01"
                className="font-mono"
                {...form.register("receivedAmount", { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fixed Items Section */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Fixed Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="w-12">No.</th>
                    <th>Description</th>
                    <th className="w-24">UoM</th>
                    <th className="w-32">Qty</th>
                    <th className="w-32">Rate (₹)</th>
                    <th className="w-32 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    if (field.category !== 'fixed') return null;
                    return (
                      <tr key={field.id}>
                        <td className="text-center text-muted-foreground">{index + 1}</td>
                        <td className="font-medium">{field.description}</td>
                        <td className="text-muted-foreground text-xs font-mono bg-muted/30 px-2 py-1 rounded inline-block w-fit">
                          {field.uom}
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="0.01"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0.00"
                            value={items[index]?.qty || ''}
                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="0.01"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0.00"
                            value={items[index]?.rate || ''}
                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          />
                        </td>
                        <td className="text-right font-mono font-medium">
                          {(items[index]?.amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-muted/20 border-t border-border flex justify-end">
              <div className="text-sm font-medium">
                Total Fixed: <span className="font-mono ml-2 text-lg">₹{totalFixedCost.toFixed(2)}</span>
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
            <div className="overflow-x-auto">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th className="w-12">No.</th>
                    <th>Description</th>
                    <th className="w-32">UoM</th>
                    <th className="w-32">Qty</th>
                    <th className="w-32">Rate (₹)</th>
                    <th className="w-32 text-right">Amount (₹)</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    if (field.category !== 'vegetable') return null;
                    return (
                      <tr key={field.id}>
                        <td className="text-center text-muted-foreground">{index + 1}</td>
                        <td>
                          <Input 
                            className="h-8" 
                            placeholder="Item name"
                            {...form.register(`items.${index}.description` as const)}
                          />
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
                            step="0.01"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0.00"
                            value={items[index]?.qty || ''}
                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          />
                        </td>
                        <td>
                          <Input 
                            type="number"
                            step="0.01"
                            className="h-8 font-mono text-right no-spinner"
                            placeholder="0.00"
                            value={items[index]?.rate || ''}
                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          />
                        </td>
                        <td className="text-right font-mono font-medium">
                          {(items[index]?.amount || 0).toFixed(2)}
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
            <div className="p-4 bg-muted/20 border-t border-border flex justify-end">
              <div className="text-sm font-medium">
                Total Vegetables: <span className="font-mono ml-2 text-lg">₹{totalVegCost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Footer - Sticky at bottom on mobile, inline on desktop */}
        <div className="fixed bottom-0 left-0 right-0 md:static bg-background/80 backdrop-blur-md md:bg-transparent border-t md:border-0 p-4 md:p-0 z-10">
          <Card className="border-primary/20 bg-primary/5 shadow-lg">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Expense</p>
                  <p className="text-2xl font-bold font-mono text-primary">₹{grandTotalExpense.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Cash</p>
                  <p className="text-2xl font-bold font-mono">₹{totalCash.toFixed(2)}</p>
                </div>
                <div className="md:col-span-2 text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Balance In Hand</p>
                  <p className={`text-3xl font-bold font-mono ${balanceInHand < 0 ? 'text-destructive' : 'text-green-600'}`}>
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
