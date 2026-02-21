import { Link } from "wouter";
import { Plus, Loader2, AlertCircle, FileText, ArrowRight, Calculator, ClipboardList, UtensilsCrossed, ShoppingCart, Trash2, Check, X, FileDown, Eye, Pencil, Receipt } from "lucide-react";
import { useReports, useDeleteReport, useInventories, useCashSeals, useSavedMenus, useDeleteSavedMenu, usePurchaseRequests, useDeletePurchaseRequest, useUpdatePurchaseRequest, useCurrentUser, usePurchaseInvoices, useDeletePurchaseInvoice } from "@/hooks/use-reports";
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
  const { data: user } = useCurrentUser();
  const perms = user?.role === 'admin' ? ['expense', 'cashseal', 'inventory', 'menu', 'purchase'] : (user?.permissions || []);

  const hasExpense = perms.includes('expense');
  const hasCashSeal = perms.includes('cashseal');
  const hasInventory = perms.includes('inventory');
  const hasMenu = perms.includes('menu');
  const hasPurchase = perms.includes('purchase');

  const { data: reports, isLoading } = useReports({ enabled: hasExpense });
  const { data: inventories, isLoading: invLoading } = useInventories({ enabled: hasInventory });
  const { data: cashSeals, isLoading: csLoading } = useCashSeals({ enabled: hasCashSeal });
  const { data: savedMenus, isLoading: menusLoading } = useSavedMenus({ enabled: hasMenu });
  const { data: purchaseRequests, isLoading: prLoading } = usePurchaseRequests({ enabled: hasPurchase });
  const { data: purchaseInvoices, isLoading: piLoading } = usePurchaseInvoices({ enabled: hasPurchase });
  const isAdmin = user?.role === 'admin';
  const deleteMutation = useDeleteReport();
  const deleteMenuMutation = useDeleteSavedMenu();
  const deletePurchaseMutation = useDeletePurchaseRequest();
  const updatePurchaseMutation = useUpdatePurchaseRequest();
  const deleteInvoiceMutation = useDeletePurchaseInvoice();

  const tabItems = [
    { value: 'reports', label: 'Reports', icon: FileText, perm: 'expense' },
    { value: 'cashseal', label: 'Cash Seal', icon: Calculator, perm: 'cashseal' },
    { value: 'inventory', label: 'Inventory', icon: ClipboardList, perm: 'inventory' },
    { value: 'menus', label: 'Menus', icon: UtensilsCrossed, perm: 'menu' },
    { value: 'purchase', label: 'Purchase', icon: ShoppingCart, perm: 'purchase' },
    { value: 'invoices', label: 'Invoices', icon: Receipt, perm: 'purchase' },
  ].filter(item => perms.includes(item.perm));

  const defaultTab = tabItems.length > 0 ? tabItems[0].value : 'reports';

  const anyLoading = (hasExpense && isLoading) || (hasInventory && invLoading) || (hasCashSeal && csLoading) || (hasMenu && menusLoading) || (hasPurchase && prLoading) || (hasPurchase && piLoading);

  if (anyLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Delay Cash Expanse</h2>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Canteen Management</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {perms.includes('expense') && (
            <Link href="/new">
              <Button className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl shadow-lg shadow-primary/20 text-xs sm:text-sm" data-testid="button-new-report">
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Delay Cash Expanse</span>
                <span className="sm:hidden">New Report</span>
              </Button>
            </Link>
          )}
          {perms.includes('cashseal') && (
            <Link href="/cash-seal">
              <Button variant="outline" className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl text-xs sm:text-sm" data-testid="button-cash-seal">
                <Calculator className="w-4 h-4 mr-1 sm:mr-2" />
                Cash Seal
              </Button>
            </Link>
          )}
          {perms.includes('inventory') && (
            <Link href="/inventory">
              <Button variant="outline" className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl text-xs sm:text-sm" data-testid="button-inventory">
                <ClipboardList className="w-4 h-4 mr-1 sm:mr-2" />
                Inventory
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        {tabItems.length > 0 && (
          <TabsList className={`grid w-full h-auto`} style={{ gridTemplateColumns: `repeat(${Math.min(tabItems.length, 6)}, 1fr)` }} data-testid="tabs-dashboard">
            {tabItems.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm py-2" data-testid={`tab-${tab.value}`}>
                <tab.icon className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        )}

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
                              
                              {isAdmin && (
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
                              )}
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
                            {isAdmin && (
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
                            )}
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

        <TabsContent value="purchase">
          {!purchaseRequests || purchaseRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {isAdmin ? "No purchase requests to review" : "No approved purchase requests yet"}
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                  {isAdmin ? "Purchase requests from users will appear here for your approval." : "Your purchase requests are pending admin approval."}
                </p>
                <Link href="/purchase-request">
                  <Button data-testid="button-go-purchase">Create Purchase Request</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Client Name</th>
                      <th>Created By</th>
                      <th>Date</th>
                      <th className="text-center">Items</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRequests.map((pr: any) => (
                      <tr key={pr.id} className="group">
                        <td className="font-mono text-muted-foreground text-center">#{pr.serialNumber}</td>
                        <td className="font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <ShoppingCart className="w-5 h-5" />
                            </div>
                            <span className="truncate">{pr.clientName}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">
                          {pr.createdBy || '—'}
                        </td>
                        <td className="text-muted-foreground">
                          {format(new Date(pr.date), "dd MMM yyyy")}
                        </td>
                        <td className="text-center font-mono">{pr.items?.length || 0}</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            pr.status === 'approved' ? 'bg-green-100 text-green-700' :
                            pr.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {pr.status === 'approved' ? 'Approved' : pr.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {pr.status === 'approved' && (
                              <>
                                <Link href={`/purchase-request/${pr.id}/pdf`}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                    data-testid={`button-view-pdf-${pr.id}`}
                                  >
                                    <FileDown className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline text-xs">PDF</span>
                                  </Button>
                                </Link>
                                <Link href={`/purchase-invoice/from/${pr.id}`}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    data-testid={`button-create-invoice-${pr.id}`}
                                  >
                                    <Receipt className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline text-xs">Invoice</span>
                                  </Button>
                                </Link>
                              </>
                            )}
                            {isAdmin && (pr.status === 'pending' || pr.status === 'approved') && (
                              <Link href={`/purchase-request/${pr.id}/review`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-8 ${pr.status === 'pending' ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                                  data-testid={`button-review-purchase-${pr.id}`}
                                >
                                  {pr.status === 'pending' ? <Check className="w-4 h-4 mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
                                  <span className="text-xs">{pr.status === 'pending' ? 'Review' : 'Edit'}</span>
                                </Button>
                              </Link>
                            )}
                            {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-purchase-${pr.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete purchase request?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the purchase request for {pr.clientName} ({format(new Date(pr.date), "dd MMM yyyy")}).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePurchaseMutation.mutate(pr.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            )}
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

        <TabsContent value="invoices">
          {!purchaseInvoices || purchaseInvoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Receipt className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No purchase invoices yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                  Create invoices from approved purchase requests with vendor details, pricing and GST.
                </p>
                <Link href="/purchase-invoice">
                  <Button data-testid="button-go-invoice">Create Purchase Invoice</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Client Name</th>
                      <th>Vendor</th>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th className="text-right">Grand Total</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseInvoices.map((inv: any) => (
                      <tr key={inv.id} className="group">
                        <td className="font-mono text-muted-foreground text-center">#{inv.serialNumber}</td>
                        <td className="font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <Receipt className="w-5 h-5" />
                            </div>
                            <span className="truncate">{inv.clientName}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">{inv.vendorName}</td>
                        <td className="text-muted-foreground font-mono">{inv.vendorInvoiceNo || '—'}</td>
                        <td className="text-muted-foreground">
                          {format(new Date(inv.date), "dd MMM yyyy")}
                        </td>
                        <td className="text-right font-mono font-semibold text-primary">
                          {Number(inv.grandTotal).toFixed(2)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/purchase-invoice/${inv.id}/pdf`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                data-testid={`button-invoice-pdf-${inv.id}`}
                              >
                                <FileDown className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline text-xs">PDF</span>
                              </Button>
                            </Link>
                            <Link href={`/purchase-invoice/${inv.id}/edit`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                data-testid={`button-edit-invoice-${inv.id}`}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline text-xs">Edit</span>
                              </Button>
                            </Link>
                            {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-invoice-${inv.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete purchase invoice?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the invoice for {inv.clientName} - {inv.vendorName} ({format(new Date(inv.date), "dd MMM yyyy")}).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteInvoiceMutation.mutate(inv.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            )}
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
