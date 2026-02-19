import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Calculator, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function CashSeal() {
  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Income States
  const [morningQty, setMorningQty] = useState(0);
  const [lunchQty, setLunchQty] = useState(0);
  const [eveningQty, setEveningQty] = useState(0);
  const [nightQty, setNightQty] = useState(0);
  
  const [nonVegRate, setNonVegRate] = useState(0);
  const [nonVegQty, setNonVegQty] = useState(0);
  
  const [vegRate, setVegRate] = useState(0);
  const [vegQty, setVegQty] = useState(0);
  
  const [morningCashRate, setMorningCashRate] = useState(0);
  const [morningCashQty, setMorningCashQty] = useState(0);
  
  const [eveningCashRate, setEveningCashRate] = useState(0);
  const [eveningCashQty, setEveningCashQty] = useState(0);

  // Expense States
  const [bananaQty, setBananaQty] = useState(0);
  const [dahiBharQty, setDahiBharQty] = useState(0);
  const [dahiBharRate, setDahiBharRate] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [akbarAliAmount, setAkbarAliAmount] = useState(0);

  // Constants from image
  const MORNING_RATE = 5;
  const LUNCH_RATE = 20;
  const EVENING_RATE = 10;
  const NIGHT_RATE = 10;
  const BANANA_RATE = 4.5;

  // Totals
  const morningTotal = morningQty * MORNING_RATE;
  const lunchTotal = lunchQty * LUNCH_RATE;
  const eveningTotal = eveningQty * EVENING_RATE;
  const nightTotal = nightQty * NIGHT_RATE;
  const nonVegTotal = nonVegRate * nonVegQty;
  const vegTotal = vegRate * vegQty;
  const morningCashTotal = morningCashRate * morningCashQty;
  const eveningCashTotal = eveningCashRate * eveningCashQty;

  const totalIncome = morningTotal + lunchTotal + eveningTotal + nightTotal + nonVegTotal + vegTotal + morningCashTotal + eveningCashTotal;

  const bananaTotal = bananaQty * BANANA_RATE;
  const dahiBharTotal = dahiBharQty * dahiBharRate;
  const totalExpense = bananaTotal + dahiBharTotal + otherExpense;

  const balance = totalIncome - totalExpense;

  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log("Saving cash seal data:", {
        date: format(date, 'yyyy-MM-dd'),
        income: { morningQty, lunchQty, eveningQty, nightQty, nonVegRate, nonVegQty, vegRate, vegQty, morningCashRate, morningCashQty, eveningCashRate, eveningCashQty },
        expense: { bananaQty, dahiBharQty, dahiBharRate, otherExpense },
        akbarAliAmount
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Cash Seal KPF saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save Cash Seal KPF", variant: "destructive" });
    }
  });

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold tracking-tight">CASH SEAL KPF</h2>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Seal</>}
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
              <label className="text-sm font-medium whitespace-nowrap">Week Day:</label>
              <Input value={format(date, "EEEE")} readOnly className="bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden border-blue-200">
          <CardHeader className="bg-blue-600 py-2">
            <CardTitle className="text-center text-white text-lg">INCOME</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="border px-4 py-2 text-left">Name</th>
                  <th className="border px-4 py-2 text-center w-24">Rate</th>
                  <th className="border px-4 py-2 text-center w-12"></th>
                  <th className="border px-4 py-2 text-center w-32">Qty</th>
                  <th className="border px-4 py-2 text-center w-12"></th>
                  <th className="border px-4 py-2 text-right w-40">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { name: "MORNING", rate: MORNING_RATE, qty: morningQty, setQty: setMorningQty, total: morningTotal },
                  { name: "LUNCH", rate: LUNCH_RATE, qty: lunchQty, setQty: setLunchQty, total: lunchTotal },
                  { name: "EVENING", rate: EVENING_RATE, qty: eveningQty, setQty: setEveningQty, total: eveningTotal },
                  { name: "NIGHT", rate: NIGHT_RATE, qty: nightQty, setQty: setNightQty, total: nightTotal },
                ].map((item) => (
                  <tr key={item.name}>
                    <td className="border px-4 py-2 font-bold">{item.name}</td>
                    <td className="border px-4 py-2 text-center">{item.rate}</td>
                    <td className="border px-4 py-2 text-center text-muted-foreground">X</td>
                    <td className="border px-2 py-1">
                      <Input type="number" className="h-8 text-center" value={item.qty || ""} onChange={(e) => item.setQty(Number(e.target.value))} />
                    </td>
                    <td className="border px-4 py-2 text-center text-muted-foreground">=</td>
                    <td className="border px-4 py-2 text-right font-mono bg-muted/20">{item.total.toFixed(2)}</td>
                  </tr>
                ))}
                
                {[
                  { name: "CASH Non Veg", rate: nonVegRate, setRate: setNonVegRate, qty: nonVegQty, setQty: setNonVegQty, total: nonVegTotal },
                  { name: "CASH Veg", rate: vegRate, setRate: setVegRate, qty: vegQty, setQty: setVegQty, total: vegTotal },
                  { name: "Morning CASH", rate: morningCashRate, setRate: setMorningCashRate, qty: morningCashQty, setQty: setMorningCashQty, total: morningCashTotal },
                  { name: "Evening CASH", rate: eveningCashRate, setRate: setEveningCashRate, qty: eveningCashQty, setQty: setEveningCashQty, total: eveningCashTotal },
                ].map((item) => (
                  <tr key={item.name}>
                    <td className="border px-4 py-2 font-bold">{item.name}</td>
                    <td className="border px-2 py-1">
                      <Input type="number" placeholder="Rate" className="h-8 text-center" value={item.rate || ""} onChange={(e) => item.setRate(Number(e.target.value))} />
                    </td>
                    <td className="border px-4 py-2 text-center text-muted-foreground">X</td>
                    <td className="border px-2 py-1">
                      <Input type="number" className="h-8 text-center" value={item.qty || ""} onChange={(e) => item.setQty(Number(e.target.value))} />
                    </td>
                    <td className="border px-4 py-2 text-center text-muted-foreground">=</td>
                    <td className="border px-4 py-2 text-right font-mono bg-muted/20">{item.total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/10 font-bold">
                  <td colSpan={5} className="border px-4 py-3 text-right">Total Income</td>
                  <td className="border px-4 py-3 text-right text-lg font-mono">{totalIncome.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-blue-200">
          <CardHeader className="bg-blue-600 py-2">
            <CardTitle className="text-center text-white text-lg">EXPENSE</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="border px-4 py-2 text-left">Name</th>
                  <th className="border px-4 py-2 text-center w-24">Qty</th>
                  <th className="border px-4 py-2 text-center w-24">UoM</th>
                  <th className="border px-4 py-2 text-center w-32">Price</th>
                  <th className="border px-4 py-2 text-right w-40">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="border px-4 py-2 font-bold">Banana</td>
                  <td className="border px-2 py-1">
                    <Input type="number" className="h-8 text-center" value={bananaQty || ""} onChange={(e) => setBananaQty(Number(e.target.value))} />
                  </td>
                  <td className="border px-4 py-2 text-center">Pcs</td>
                  <td className="border px-4 py-2 text-center font-mono">{BANANA_RATE}</td>
                  <td className="border px-4 py-2 text-right font-mono bg-muted/20">{bananaTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="border px-4 py-2 font-bold">Dahi Bhar</td>
                  <td className="border px-2 py-1">
                    <Input type="number" className="h-8 text-center" value={dahiBharQty || ""} onChange={(e) => setDahiBharQty(Number(e.target.value))} />
                  </td>
                  <td className="border px-4 py-2 text-center">Pcs</td>
                  <td className="border px-2 py-1">
                    <Input type="number" placeholder="Rate" className="h-8 text-center" value={dahiBharRate || ""} onChange={(e) => setDahiBharRate(Number(e.target.value))} />
                  </td>
                  <td className="border px-4 py-2 text-right font-mono bg-muted/20">{dahiBharTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="border px-4 py-2 font-bold">Other Expense</td>
                  <td className="border px-4 py-2 text-center font-mono">1</td>
                  <td className="border px-4 py-2 text-center">-</td>
                  <td className="border px-2 py-1">
                    <Input type="number" placeholder="Amount" className="h-8 text-center" value={otherExpense || ""} onChange={(e) => setOtherExpense(Number(e.target.value))} />
                  </td>
                  <td className="border px-4 py-2 text-right font-mono bg-muted/20">{otherExpense.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-2 border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="flex border-b">
            <div className="flex-1 px-4 py-3 font-bold text-right bg-muted/10 border-r">Balance (Income - Expense)</div>
            <div className="w-40 px-4 py-3 text-right font-mono">{balance.toFixed(2)}</div>
          </div>
          <div className="flex">
            <div className="flex-1 px-4 py-3 font-bold text-right bg-muted/10 border-r">Total Amount Given to Akbar Ali</div>
            <div className="w-40 px-2 py-1">
              <Input type="number" className="h-full font-mono text-right bg-yellow-50" value={akbarAliAmount || ""} onChange={(e) => setAkbarAliAmount(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
