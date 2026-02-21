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
import Login from "./pages/login";
import { useCurrentUser } from "./hooks/use-reports";
import { Loader2 } from "lucide-react";

function PermRoute({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  const perms = user?.role === 'admin' ? ['expense', 'cashseal', 'inventory', 'menu'] : (user?.permissions || []);
  if (!perms.includes(perm)) return <Redirect to="/" />;
  return <>{children}</>;
}

function AdminRoute() {
  const { data: user } = useCurrentUser();
  if (user?.role !== "admin") return <Redirect to="/" />;
  return <Admin />;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new">{() => <PermRoute perm="expense"><ReportForm /></PermRoute>}</Route>
      <Route path="/report/:id">{(params) => <PermRoute perm="expense"><ReportForm /></PermRoute>}</Route>
      <Route path="/admin" component={AdminRoute} />
      <Route path="/cash-seal">{() => <PermRoute perm="cashseal"><CashSeal /></PermRoute>}</Route>
      <Route path="/inventory">{() => <PermRoute perm="inventory"><DailyInventory /></PermRoute>}</Route>
      <Route path="/menu">{() => <PermRoute perm="menu"><MenuManager /></PermRoute>}</Route>
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
