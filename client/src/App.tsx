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
import VendorReport from "./pages/vendor-report";
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
      <Route path="/cash-seal">{() => <PermRoute perm="cashseal"><CashSeal /></PermRoute>}</Route>
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
