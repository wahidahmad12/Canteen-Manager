import { Link } from "wouter";
import { Plus, Loader2, AlertCircle, FileText, ArrowRight, Calculator, ClipboardList, UtensilsCrossed, Trash2 } from "lucide-react";
import { useReports, useDeleteReport, useInventories, useCashSeals, useSavedMenus, useDeleteSavedMenu } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const { data: reports, isLoading, error } = useReports();
  const { data: inventories, isLoading: invLoading } = useInventories();
  const { data: cashSeals, isLoading: csLoading } = useCashSeals();
  const deleteMutation = useDeleteReport();
  const { data: savedMenus, isLoading: menusLoading } = useSavedMenus();
  const deleteMenuMutation = useDeleteSavedMenu();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-8 border border-destructive/20 rounded-2xl bg-destructive/5 text-destructive flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-4" />
          <h2 className="text-lg font-bold mb-2">Failed to load reports</h2>
          <p>{error.message}</p>
        </div>
      </Layout>
    );
  }

  const sortedReports = reports ? [...reports].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  const sortedInventories = inventories ? [...inventories].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">DJ KPF</h2>
          <p className="text-muted-foreground mt-2">Delay Cash Expanse Manager</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/new">
            <Button className="h-11 px-5 rounded-xl shadow-lg shadow-primary/20" data-testid="button-new-report">
              <Plus className="w-4 h-4 mr-2" />
              New Report
            </Button>
          </Link>
          <Link href="/cash-seal">
            <Button variant="outline" className="h-11 px-5 rounded-xl" data-testid="button-cash-seal">
              <Calculator className="w-4 h-4 mr-2" />
              Cash Seal
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="outline" className="h-11 px-5 rounded-xl" data-testid="button-inventory">
              <ClipboardList className="w-4 h-4 mr-2" />
              Daily Inventory
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-dashboard">
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="w-4 h-4 mr-2" />
            Expense Reports
          </TabsTrigger>
          <TabsTrigger value="cashseal" data-testid="tab-cashseal">
            <Calculator className="w-4 h-4 mr-2" />
            Cash Seal
          </TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">
            <ClipboardList className="w-4 h-4 mr-2" />
            Daily Inventory
          </TabsTrigger>
          <TabsTrigger value="menus" data-testid="tab-menus">
            <UtensilsCrossed className="w-4 h-4 mr-2" />
            Saved Menus
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          {reports?.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No reports yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                Create your first daily expense report to start tracking.
              </p>
              <Link href="/new">
                <Button>Create Report</Button>
              </Link>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Date</th>
                      <th className="text-right">Opening Bal.</th>
                      <th className="text-right">Received</th>
                      <th className="text-right">Total Cash</th>
                      <th className="text-right">Total Expense</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReports.map((report) => {
                      const opening = Number(report.openingBalance) || 0;
                      const received = Number(report.receivedAmount) || 0;
                      const totalCash = opening + received;
                      const totalExpense = report.items?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
                      
                      return (
                        <tr key={report.id} className="group">
                          <td className="font-mono text-muted-foreground text-center">#{report.reportNumber}</td>
                          <td className="font-medium text-foreground">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {format(new Date(report.date), "dd")}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{format(new Date(report.date), "MMMM yyyy")}</span>
                                <span className="text-xs text-muted-foreground truncate">{format(new Date(report.date), "EEEE")}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-right font-mono text-muted-foreground">₹{opening.toFixed(2)}</td>
                          <td className="text-right font-mono text-muted-foreground">₹{received.toFixed(2)}</td>
                          <td className="text-right font-mono font-bold text-primary">₹{totalCash.toFixed(2)}</td>
                          <td className="text-right font-mono text-destructive">₹{totalExpense.toFixed(2)}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/report/${report.id}`}>
                                <Button size="sm" variant="ghost" className="h-8 hover-elevate" data-testid={`button-view-report-${report.id}`}>
                                  View <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 hover-elevate" data-testid={`button-delete-report-${report.id}`}>
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the report for {format(new Date(report.date), "PPP")}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteMutation.mutate(report.id)}
                                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cashseal">
          {csLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !cashSeals || cashSeals.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Calculator className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Cash Seal records yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">Start recording your daily cash seal income and expenses.</p>
                <Link href="/cash-seal">
                  <Button data-testid="button-go-cashseal">Create Cash Seal Record</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Date</th>
                      <th className="text-right">Total Income</th>
                      <th className="text-right">Total Expense</th>
                      <th className="text-right">Balance</th>
                      <th className="text-right">Given to Akbar Ali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashSeals.map((seal: any) => {
                      const MORNING_RATE = 5, LUNCH_RATE = 20, EVENING_RATE = 10, NIGHT_RATE = 10, BANANA_RATE = 4.5;
                      const income = (Number(seal.incomeMorningQty) * MORNING_RATE) +
                        (Number(seal.incomeLunchQty) * LUNCH_RATE) +
                        (Number(seal.incomeEveningQty) * EVENING_RATE) +
                        (Number(seal.incomeNightQty) * NIGHT_RATE) +
                        (Number(seal.incomeNonVegRate) * Number(seal.incomeNonVegQty)) +
                        (Number(seal.incomeVegRate) * Number(seal.incomeVegQty)) +
                        (Number(seal.incomeMorningCashRate) * Number(seal.incomeMorningCashQty)) +
                        (Number(seal.incomeEveningCashRate) * Number(seal.incomeEveningCashQty));
                      const expense = (Number(seal.expenseBananaQty) * BANANA_RATE) +
                        (Number(seal.expenseDahiBharQty) * Number(seal.expenseDahiBharRate)) +
                        Number(seal.expenseOtherAmount);
                      const balance = income - expense;
                      
                      return (
                        <tr key={seal.id} className="group">
                          <td className="font-mono text-muted-foreground text-center">#{seal.serialNumber}</td>
                          <td className="font-medium text-foreground">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {format(new Date(seal.date), "dd")}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{format(new Date(seal.date), "MMMM yyyy")}</span>
                                <span className="text-xs text-muted-foreground truncate">{format(new Date(seal.date), "EEEE")}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-right font-mono text-green-600">₹{income.toFixed(2)}</td>
                          <td className="text-right font-mono text-destructive">₹{expense.toFixed(2)}</td>
                          <td className="text-right font-mono font-bold text-primary">₹{balance.toFixed(2)}</td>
                          <td className="text-right font-mono text-orange-600">₹{Number(seal.totalGivenToAkbarAli).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory">
          {invLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : sortedInventories.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ClipboardList className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No inventory records yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">Start tracking your daily kitchen stock and biscuit inventory.</p>
                <Link href="/inventory">
                  <Button data-testid="button-create-inventory">Create Inventory Record</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Date</th>
                      <th className="text-center">Kitchen Items</th>
                      <th className="text-center">Biscuit Items</th>
                      <th className="text-right">Total Used</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInventories.map((inv) => {
                      const totalKitchenUsed = inv.kitchenStock?.reduce((sum: number, item: any) => sum + (Number(item.used) || 0), 0) || 0;
                      const totalBiscuitUsed = inv.biscuits?.reduce((sum: number, item: any) => sum + (Number(item.used) || 0), 0) || 0;
                      
                      return (
                        <tr key={inv.id} className="group">
                          <td className="font-mono text-muted-foreground text-center">#{(inv as any).serialNumber}</td>
                          <td className="font-medium text-foreground">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {format(new Date(inv.date), "dd")}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{format(new Date(inv.date), "MMMM yyyy")}</span>
                                <span className="text-xs text-muted-foreground truncate">{format(new Date(inv.date), "EEEE")}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-center font-mono">{inv.kitchenStock?.length || 0}</td>
                          <td className="text-center font-mono">{inv.biscuits?.length || 0}</td>
                          <td className="text-right font-mono text-orange-600">{(totalKitchenUsed + totalBiscuitUsed).toFixed(0)} items</td>
                          <td className="text-right">
                            <Button size="sm" variant="ghost" className="h-8" data-testid={`button-view-inventory-${inv.id}`}>
                              View <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="menus">
          {menusLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !savedMenus || savedMenus.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No saved menus yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">Create a menu in the Menu Manager and save it to see it here.</p>
                <Link href="/menu">
                  <Button data-testid="button-go-menu">Go to Menu Manager</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Date Range</th>
                      <th>Saved On</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedMenus.map((menu) => (
                      <tr key={menu.id} className="group">
                        <td className="font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <UtensilsCrossed className="w-5 h-5" />
                            </div>
                            <span className="truncate">{menu.clientName}</span>
                          </div>
                        </td>
                        <td className="font-mono text-muted-foreground">
                          {format(new Date(menu.startDate), "dd MMM yyyy")} — {format(new Date(menu.endDate), "dd MMM yyyy")}
                        </td>
                        <td className="text-muted-foreground text-sm">
                          {menu.createdAt ? format(new Date(menu.createdAt), "dd MMM yyyy, hh:mm a") : "-"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/menu?load=${menu.id}`}>
                              <Button size="sm" variant="ghost" className="h-8" data-testid={`button-view-menu-${menu.id}`}>
                                View <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-menu-${menu.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete saved menu?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the saved menu for {menu.clientName} ({format(new Date(menu.startDate), "dd MMM")} - {format(new Date(menu.endDate), "dd MMM yyyy")}).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMenuMutation.mutate(menu.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
