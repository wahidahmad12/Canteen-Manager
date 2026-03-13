import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "./pages/dashboard";
import ReportForm from "./pages/report-form";
import Admin from "./pages/admin";
import CashSeal from "./pages/cash-seal";
import DailyInventory from "./pages/daily-inventory";
import MenuManager from "./pages/menu-manager";
import PurchaseRequest from "./pages/purchase-request";
import PurchaseRequestPDF from "./pages/purchase-request-pdf";
import PurchaseRequestReview from "./pages/purchase-request-review";
import PurchaseInvoice from "./pages/purchase-invoice";
import PurchaseInvoicePDF from "./pages/purchase-invoice-pdf";
import ReportPDF from "./pages/report-pdf";
import CashSealPDF from "./pages/cash-seal-pdf";
import CashSealMonthly from "./pages/cash-seal-monthly";
import InventoryPDF from "./pages/inventory-pdf";
import VendorReport from "./pages/vendor-report";
import EmployeeMaster from "./pages/employee-master";
import MusterRoll from "./pages/muster-roll";
import Salary from "./pages/salary";
import WageSlip from "./pages/wage-slip";
import Registers from "./pages/registers";
import FormXIII from "./pages/form-xiii";
import FormXIV from "./pages/form-xiv";
import FormXV from "./pages/form-xv";
import FormVIA from "./pages/form-vi-a";
import BonusReturn from "./pages/bonus-return";
import HalfYearlyReturn from "./pages/half-yearly-return";
import LeaveWithWages from "./pages/leave-with-wages";
import SkillWageRates from "./pages/skill-wage-rates";
import EpfoEsic from "./pages/epfo-esic";
import LetterheadPage from "./pages/letterhead";
import PtaxReport from "./pages/ptax-report";
import SalesInvoicePage from "./pages/sales-invoice";
import SalesDashboard from "./pages/sales-dashboard";
import EmployeeDashboard from "./pages/employee-dashboard";
import Login from "./pages/login";
import { useCurrentUser } from "./hooks/use-reports";
import { Loader2 } from "lucide-react";

function PermRoute({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  const perms = user?.role === 'admin' ? ['expense', 'cashseal', 'inventory', 'menu', 'purchase'] : (user?.permissions || []);
  if (!perms.includes(perm)) return <Redirect to="/" />;
  return <>{children}</>;
}

function AdminRoute() {
  const { data: user } = useCurrentUser();
  if (user?.role !== "admin") return <Redirect to="/" />;
  return <Admin />;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  if (user?.role !== "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new">{() => <PermRoute perm="expense"><ReportForm /></PermRoute>}</Route>
      <Route path="/report/:id/pdf">{() => <PermRoute perm="expense"><ReportPDF /></PermRoute>}</Route>
      <Route path="/report/:id">{(params) => <PermRoute perm="expense"><ReportForm /></PermRoute>}</Route>
      <Route path="/admin" component={AdminRoute} />
      <Route path="/cash-seal/monthly">{() => <PermRoute perm="cashseal"><CashSealMonthly /></PermRoute>}</Route>
      <Route path="/cash-seal/:id/pdf">{() => <PermRoute perm="cashseal"><CashSealPDF /></PermRoute>}</Route>
      <Route path="/cash-seal">{() => <PermRoute perm="cashseal"><CashSeal /></PermRoute>}</Route>
      <Route path="/inventory/:id/pdf">{() => <PermRoute perm="inventory"><InventoryPDF /></PermRoute>}</Route>
      <Route path="/inventory">{() => <PermRoute perm="inventory"><DailyInventory /></PermRoute>}</Route>
      <Route path="/menu">{() => <PermRoute perm="menu"><MenuManager /></PermRoute>}</Route>
      <Route path="/purchase-request">{() => <PermRoute perm="purchase"><PurchaseRequest /></PermRoute>}</Route>
      <Route path="/purchase-request/:id/pdf">{() => <PermRoute perm="purchase"><PurchaseRequestPDF /></PermRoute>}</Route>
      <Route path="/purchase-request/:id/review">{() => <AdminOnlyRoute><PurchaseRequestReview /></AdminOnlyRoute>}</Route>
      <Route path="/purchase-invoice">{() => <PermRoute perm="purchase"><PurchaseInvoice /></PermRoute>}</Route>
      <Route path="/purchase-invoice/from/:prId">{() => <PermRoute perm="purchase"><PurchaseInvoice /></PermRoute>}</Route>
      <Route path="/purchase-invoice/:id/edit">{() => <PermRoute perm="purchase"><PurchaseInvoice /></PermRoute>}</Route>
      <Route path="/purchase-invoice/:id/pdf">{() => <PermRoute perm="purchase"><PurchaseInvoicePDF /></PermRoute>}</Route>
      <Route path="/vendor-report">{() => <AdminOnlyRoute><VendorReport /></AdminOnlyRoute>}</Route>
      <Route path="/employee-master">{() => <AdminOnlyRoute><EmployeeMaster /></AdminOnlyRoute>}</Route>
      <Route path="/muster-roll" component={MusterRoll} />
      <Route path="/salary" component={Salary} />
      <Route path="/salary/:id/slip" component={WageSlip} />
      <Route path="/registers" component={Registers} />
      <Route path="/form-xiii" component={FormXIII} />
      <Route path="/form-xiv/:id" component={FormXIV} />
      <Route path="/form-xv/:id" component={FormXV} />
      <Route path="/form-vi-a" component={FormVIA} />
      <Route path="/bonus-return" component={BonusReturn} />
      <Route path="/half-yearly-return" component={HalfYearlyReturn} />
      <Route path="/leave-with-wages" component={LeaveWithWages} />
      <Route path="/skill-wage-rates">{() => <AdminOnlyRoute><SkillWageRates /></AdminOnlyRoute>}</Route>
      <Route path="/epfo-esic" component={EpfoEsic} />
      <Route path="/letterhead" component={LetterheadPage} />
      <Route path="/ptax-report" component={PtaxReport} />
      <Route path="/sales-invoice" component={SalesInvoicePage} />
      <Route path="/sales-dashboard" component={SalesDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === 'employee') {
    return <EmployeeDashboard />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
