import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ShoppingCart, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseRequest, useClientNames, useSavedItemNames } from "@/hooks/use-reports";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";

interface PurchaseItem {
  itemName: string;
  uom: string;
  requestQty: number;
}

const UOM_OPTIONS = ["Kg", "Gm", "Ltr", "Ml", "Pcs", "Pkt", "Box", "Dz", "Nos", "Bag", "Tin", "Cyl", "Plats", "Cup", "Set"];

export default function PurchaseRequest() {
  const [date, setDate] = useState<Date>(new Date());
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: "", uom: "Kg", requestQty: 0 },
  ]);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createMutation = useCreatePurchaseRequest();
  const { data: clients } = useClientNames();
  const { data: savedItems } = useSavedItemNames();

  const addItem = () => {
    setItems([...items, { itemName: "", uom: "Kg", requestQty: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = () => {
    if (!clientName) {
      toast({ title: "Error", description: "Please select a client name", variant: "destructive" });
      return;
    }
    const validItems = items.filter(item => item.itemName.trim() !== "");
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please add at least one item", variant: "destructive" });
      return;
    }

    createMutation.mutate(
      {
        clientName,
        date: format(date, "yyyy-MM-dd"),
        items: validItems,
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase request saved successfully" });
          navigate("/");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout>
      <datalist id="purchase-item-suggestions">
        {savedItems?.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold" data-testid="text-purchase-title">Purchase Request</h2>
            <p className="text-sm text-muted-foreground">Create a new purchase request</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Select value={clientName} onValueChange={setClientName} data-testid="select-client">
                  <SelectTrigger data-testid="select-client-trigger">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.name} data-testid={`client-option-${c.id}`}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker date={date} setDate={(d: Date | undefined) => d && setDate(d)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Items</CardTitle>
              <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item Name</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground w-24">UOM</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground w-28">Qty</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
                        <td className="py-2 px-2">
                          <Input
                            value={item.itemName}
                            onChange={(e) => updateItem(index, "itemName", e.target.value)}
                            placeholder="Enter item name"
                            className="h-9"
                            list="purchase-item-suggestions"
                            data-testid={`input-item-name-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                            <SelectTrigger className="h-9" data-testid={`select-uom-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UOM_OPTIONS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.requestQty || ""}
                            onChange={(e) => updateItem(index, "requestQty", Number(e.target.value))}
                            className="h-9 text-right"
                            min={0}
                            data-testid={`input-request-qty-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sm:hidden space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Item #{index + 1}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Item Name</Label>
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateItem(index, "itemName", e.target.value)}
                      placeholder="Enter item name"
                      className="h-9"
                      list="purchase-item-suggestions"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">UOM</Label>
                      <Select value={item.uom} onValueChange={(v) => updateItem(index, "uom", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UOM_OPTIONS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        value={item.requestQty || ""}
                        onChange={(e) => updateItem(index, "requestQty", Number(e.target.value))}
                        className="h-9 text-right"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => navigate("/")} data-testid="button-cancel">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createMutation.isPending} data-testid="button-save-request">
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
