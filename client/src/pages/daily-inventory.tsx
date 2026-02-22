import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateInventory, useInventories } from "@/hooks/use-reports";
import { useLocation } from "wouter";

const DEFAULT_KITCHEN_STOCK = [
  { name: "Banana", unit: "Pcs" },
  { name: "Dahi Khatta", unit: "Pcs" },
  { name: "Dahi Mithai", unit: "Pcs" },
  { name: "Dahi 84g", unit: "Pcs" },
  { name: "Dahi 1Kg", unit: "Kg" },
  { name: "Rosgulla", unit: "Pcs" },
  { name: "Chicken", unit: "Plate" },
  { name: "Fish", unit: "Plate" },
  { name: "Lunch Egg", unit: "Pcs" },
  { name: "Eve Egg", unit: "Pcs" },
  { name: "Night Egg", unit: "Pcs" },
];

const DEFAULT_BISCUITS = [
  { name: "Biscuit KPF" },
  { name: "Bisc/Chira" },
];

export default function DailyInventory() {
  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createMutation = useCreateInventory();

  const [kitchenStock, setKitchenStock] = useState(
    DEFAULT_KITCHEN_STOCK.map(item => ({
      ...item,
      open: 0,
      used: 0,
      balance: 0,
      remarks: "",
    }))
  );

  const [biscuits, setBiscuits] = useState(
    DEFAULT_BISCUITS.map(item => ({
      ...item,
      expDate: "",
      brand: "",
      given: 0,
      used: 0,
      balance: 0,
    }))
  );

  const updateKitchenStock = (index: number, field: string, value: any) => {
    setKitchenStock(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "open" || field === "used") {
        const open = field === "open" ? Number(value) : Number(updated[index].open);
        const used = field === "used" ? Number(value) : Number(updated[index].used);
        updated[index].balance = open - used;
      }
      return updated;
    });
  };

  const updateBiscuit = (index: number, field: string, value: any) => {
    setBiscuits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "given" || field === "used") {
        const given = field === "given" ? Number(value) : Number(updated[index].given);
        const used = field === "used" ? Number(value) : Number(updated[index].used);
        updated[index].balance = given - used;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      await createMutation.mutateAsync({
        date: format(date, "yyyy-MM-dd"),
        kitchenStock: kitchenStock.map(item => ({
          name: item.name,
          unit: item.unit,
          open: Number(item.open),
          used: Number(item.used),
          balance: Number(item.balance),
          remarks: item.remarks,
        })),
        biscuits: biscuits.map(item => ({
          name: item.name,
          expDate: item.expDate,
          brand: item.brand,
          given: Number(item.given),
          used: Number(item.used),
          balance: Number(item.balance),
        })),
      });
      toast({ title: "Success", description: "Daily Inventory saved successfully" });
      navigate("/");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save inventory", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-inventory-title">Daily Inventory</h2>
        <Button onClick={handleSave} disabled={createMutation.isPending} data-testid="button-save-inventory" className="w-full sm:w-auto">
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Inventory
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">Date:</label>
              <DatePicker date={date} setDate={(d) => d && setDate(d)} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">Day:</label>
              <Input value={format(date, "EEEE")} readOnly className="bg-muted" data-testid="input-day" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden border-blue-200">
          <CardHeader className="bg-blue-600 py-2">
            <CardTitle className="text-center text-white text-lg">Kitchen Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-blue-500 px-4 py-2 text-left">Name</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-20">Unit</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-24 bg-yellow-100 text-black">Open</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-24 bg-yellow-100 text-black">Use</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-24 bg-yellow-100 text-black">Bal</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-32">Rem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {kitchenStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="border px-4 py-2 font-medium">{item.name}</td>
                      <td className="border px-4 py-2 text-center text-muted-foreground">{item.unit}</td>
                      <td className="border px-1 py-1 bg-yellow-50">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1"
                          value={item.open || ""}
                          onChange={(e) => updateKitchenStock(idx, "open", Number(e.target.value))}
                          data-testid={`input-kitchen-open-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1 bg-yellow-50">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1"
                          value={item.used || ""}
                          onChange={(e) => updateKitchenStock(idx, "used", Number(e.target.value))}
                          data-testid={`input-kitchen-used-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1 bg-yellow-50">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1"
                          value={item.balance || ""}
                          readOnly
                          data-testid={`input-kitchen-balance-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1">
                        <Input
                          className="h-8 text-center border-0 focus-visible:ring-1"
                          value={item.remarks}
                          onChange={(e) => updateKitchenStock(idx, "remarks", e.target.value)}
                          placeholder="..."
                          data-testid={`input-kitchen-remarks-${idx}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden p-3 space-y-3">
              {kitchenStock.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2" data-testid={`mobile-kitchen-item-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{item.unit}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Open</Label>
                      <Input
                        type="number"
                        className="h-8 text-center bg-yellow-50"
                        value={item.open || ""}
                        onChange={(e) => updateKitchenStock(idx, "open", Number(e.target.value))}
                        data-testid={`input-mobile-kitchen-open-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Used</Label>
                      <Input
                        type="number"
                        className="h-8 text-center bg-yellow-50"
                        value={item.used || ""}
                        onChange={(e) => updateKitchenStock(idx, "used", Number(e.target.value))}
                        data-testid={`input-mobile-kitchen-used-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Balance</Label>
                      <Input
                        type="number"
                        className="h-8 text-center bg-yellow-50"
                        value={item.balance || ""}
                        readOnly
                        data-testid={`input-mobile-kitchen-balance-${idx}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Remarks</Label>
                    <Input
                      className="h-8 text-sm"
                      value={item.remarks}
                      onChange={(e) => updateKitchenStock(idx, "remarks", e.target.value)}
                      placeholder="Add remarks..."
                      data-testid={`input-mobile-kitchen-remarks-${idx}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-blue-200">
          <CardHeader className="bg-blue-600 py-2">
            <CardTitle className="text-center text-white text-lg">Biscuits</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-blue-500 px-4 py-2 text-left">Name</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-28">Exp. Date</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-32">Brand</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-20 bg-yellow-100 text-black">Gvn</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-20 bg-yellow-100 text-black">Use</th>
                    <th className="border border-blue-500 px-4 py-2 text-center w-20 bg-yellow-100 text-black">Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {biscuits.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="border px-4 py-2 font-medium">{item.name}</td>
                      <td className="border px-1 py-1">
                        <DatePicker
                          date={item.expDate ? new Date(item.expDate) : undefined}
                          setDate={(d) => updateBiscuit(idx, "expDate", d ? format(d, "yyyy-MM-dd") : "")}
                          className="h-8 text-xs border-0 focus-visible:ring-1"
                          dateFormat="dd/MM/yy"
                          placeholder="Exp Date"
                          data-testid={`input-biscuit-expdate-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1">
                        <Input
                          className="h-8 text-center border-0 focus-visible:ring-1"
                          value={item.brand}
                          onChange={(e) => updateBiscuit(idx, "brand", e.target.value)}
                          placeholder="..."
                          data-testid={`input-biscuit-brand-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1 bg-yellow-50">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1"
                          value={item.given || ""}
                          onChange={(e) => updateBiscuit(idx, "given", Number(e.target.value))}
                          data-testid={`input-biscuit-given-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1 bg-yellow-50">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1"
                          value={item.used || ""}
                          onChange={(e) => updateBiscuit(idx, "used", Number(e.target.value))}
                          data-testid={`input-biscuit-used-${idx}`}
                        />
                      </td>
                      <td className="border px-1 py-1 bg-yellow-50">
                        <Input
                          type="number"
                          className="h-8 text-center bg-transparent border-0 focus-visible:ring-1"
                          value={item.balance || ""}
                          readOnly
                          data-testid={`input-biscuit-balance-${idx}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden p-3 space-y-3">
              {biscuits.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2" data-testid={`mobile-biscuit-item-${idx}`}>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Exp. Date</Label>
                      <DatePicker
                        date={item.expDate ? new Date(item.expDate) : undefined}
                        setDate={(d) => updateBiscuit(idx, "expDate", d ? format(d, "yyyy-MM-dd") : "")}
                        className="h-8 text-xs"
                        dateFormat="dd/MM/yy"
                        placeholder="Exp Date"
                        data-testid={`input-mobile-biscuit-expdate-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Brand</Label>
                      <Input
                        className="h-8 text-sm"
                        value={item.brand}
                        onChange={(e) => updateBiscuit(idx, "brand", e.target.value)}
                        placeholder="Brand..."
                        data-testid={`input-mobile-biscuit-brand-${idx}`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Given</Label>
                      <Input
                        type="number"
                        className="h-8 text-center bg-yellow-50"
                        value={item.given || ""}
                        onChange={(e) => updateBiscuit(idx, "given", Number(e.target.value))}
                        data-testid={`input-mobile-biscuit-given-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Used</Label>
                      <Input
                        type="number"
                        className="h-8 text-center bg-yellow-50"
                        value={item.used || ""}
                        onChange={(e) => updateBiscuit(idx, "used", Number(e.target.value))}
                        data-testid={`input-mobile-biscuit-used-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Balance</Label>
                      <Input
                        type="number"
                        className="h-8 text-center bg-yellow-50"
                        value={item.balance || ""}
                        readOnly
                        data-testid={`input-mobile-biscuit-balance-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
