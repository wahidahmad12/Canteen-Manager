import { Switch, Route, Redirect, useLocation } from "wouter";
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
import ShiftDuty from "./pages/shift-duty";
import EpfoEsic from "./pages/epfo-esic";
import LetterheadPage from "./pages/letterhead";
import PtaxReport from "./pages/ptax-report";
import SalesInvoicePage from "./pages/sales-invoice";
import SalesDashboard from "./pages/sales-dashboard";
import DailyPnlPage from "./pages/daily-pnl";
import MonthlyPnlPage from "./pages/monthly-pnl";
import BomPage from "./pages/bom";
import PriceHistoryPage from "./pages/price-history";
import ItemStockReportPage from "./pages/item-stock-report";
import EmployeeDashboard from "./pages/employee-dashboard";
import QrScannerPage from "./pages/qr-scanner";
import DailyAttendancePage from "./pages/daily-attendance";
import AttendanceReportPage from "./pages/attendance-report";
import AttendanceKiosk from "./pages/attendance-kiosk";
import Login from "./pages/login";
import { useCurrentUser } from "./hooks/use-reports";
import { LanguageProvider } from "./contexts/language-context";
import logoImg from "@assets/logo1_1771660912341.png";

function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="absolute bottom-[-60px] right-[-60px] w-56 h-56 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-teal-700/10 blur-3xl" />

      {/* Logo + title */}
      <div className="relative flex flex-col items-center gap-5 z-10">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-teal-400/30 blur-xl scale-110 animate-pulse" />
          <img src={logoImg} alt="DJ Hospitality" className="relative w-24 h-24 rounded-3xl object-cover shadow-2xl shadow-teal-900/60 ring-2 ring-white/10" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wide">DJ Hospitality</h1>
          <p className="text-sm text-teal-300/80 mt-1 font-medium">& Facility Management</p>
          <p className="text-xs text-slate-400 mt-0.5">Daily Cash Expance</p>
        </div>
        {/* Animated dots */}
        <div className="flex items-center gap-2 mt-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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
      <Route path="/shift-duty">{() => <AdminOnlyRoute><ShiftDuty /></AdminOnlyRoute>}</Route>
      <Route path="/epfo-esic" component={EpfoEsic} />
      <Route path="/letterhead" component={LetterheadPage} />
      <Route path="/ptax-report" component={PtaxReport} />
      <Route path="/sales-invoice" component={SalesInvoicePage} />
      <Route path="/sales-dashboard" component={SalesDashboard} />
      <Route path="/daily-pnl" component={DailyPnlPage} />
      <Route path="/monthly-pnl" component={MonthlyPnlPage} />
      <Route path="/bom" component={BomPage} />
      <Route path="/price-history">{() => <PermRoute perm="purchase"><PriceHistoryPage /></PermRoute>}</Route>
      <Route path="/item-stock-report">{() => <PermRoute perm="purchase"><ItemStockReportPage /></PermRoute>}</Route>
      <Route path="/qr-scanner" component={QrScannerPage} />
      <Route path="/daily-attendance">{() => <PermRoute perm="attendance"><DailyAttendancePage /></PermRoute>}</Route>
      <Route path="/attendance-report">{() => <PermRoute perm="attendance"><AttendanceReportPage /></PermRoute>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { data: user, isLoading } = useCurrentUser();

  if (location === "/kiosk") {
    return <AttendanceKiosk />;
  }

  if (isLoading) {
    return <SplashScreen />;
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
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
