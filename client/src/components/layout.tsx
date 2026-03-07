import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, FilePlus, Settings, Calculator, ClipboardList, UtensilsCrossed, ShoppingCart, LogOut, User, Menu, X, Users, CalendarDays, Wallet, FileText, BookOpen, HardHat, ChevronDown, ChevronRight } from 'lucide-react';
import logoImg from '@assets/logo1_1771660912341.png';
import { useCurrentUser, useLogout } from '@/hooks/use-reports';
import { Button } from '@/components/ui/button';

const labourWorksPaths = ['/employee-master', '/muster-roll', '/salary', '/registers', '/form-xiii', '/bonus-return'];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [labourOpen, setLabourOpen] = useState(() => labourWorksPaths.some(p => location.startsWith(p)));

  const perms = user?.role === 'admin' ? ['expense', 'cashseal', 'inventory', 'menu', 'purchase'] : (user?.permissions || []);

  useEffect(() => {
    if (labourWorksPaths.some(p => location.startsWith(p))) {
      setLabourOpen(true);
    }
  }, [location]);

  const mainNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, perm: null },
    { href: '/new', label: 'Daily Cash Expance', icon: FilePlus, perm: 'expense' },
    { href: '/cash-seal', label: 'Daily Cash Seal', icon: Calculator, perm: 'cashseal' },
    { href: '/inventory', label: 'Daily Inventory', icon: ClipboardList, perm: 'inventory' },
    { href: '/menu', label: 'Menu Manager', icon: UtensilsCrossed, perm: 'menu' },
    { href: '/purchase-request', label: 'Purchase Request', icon: ShoppingCart, perm: 'purchase' },
  ].filter(item => item.perm === null || perms.includes(item.perm));

  const labourSubItems = [
    ...(user?.role === 'admin' ? [{ href: '/employee-master', label: 'Employee Master', icon: Users }] : []),
    { href: '/muster-roll', label: 'Muster Roll', icon: CalendarDays },
    { href: '/salary', label: 'Salary Register', icon: Wallet },
    { href: '/registers', label: 'Registers', icon: BookOpen },
    { href: '/form-xiii', label: 'Workmen Register', icon: FileText },
    { href: '/bonus-return', label: 'Bonus Return', icon: FileText },
  ];

  const bottomNavItems = [
    ...(user?.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: Settings, perm: null }] : []),
  ];

  const isLabourActive = labourWorksPaths.some(p => location.startsWith(p));

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const renderNavLink = (item: { href: string; label: string; icon: any }, indent = false) => {
    const isActive = location === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeSidebar}
        className={`
          flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
          ${indent ? 'ml-4 pl-4' : ''}
          ${isActive
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }
        `}
      >
        <Icon className="w-4 h-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col md:flex-row">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeSidebar}
          data-testid="sidebar-overlay"
        />
      )}

      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-menu-toggle"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <img src={logoImg} alt="DJ Hospitality" className="w-8 h-8 rounded-lg object-cover" />
          <h1 className="font-bold text-base leading-none">DJ Hospitality</h1>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.displayName}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
              className="h-8 w-8"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </header>

      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-40 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:sticky md:top-0 md:z-20
      `}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="DJ Hospitality" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
            <div>
              <h1 className="font-bold text-lg leading-none">DJ Hospitality</h1>
              <p className="text-xs text-muted-foreground mt-1">Canteen Management</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={closeSidebar}
            data-testid="button-close-sidebar"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {mainNavItems.map(item => renderNavLink(item))}

          <div className="pt-1">
            <button
              onClick={() => setLabourOpen(!labourOpen)}
              data-testid="button-labour-works-menu"
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isLabourActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <HardHat className="w-4 h-4" />
              <span className="flex-1 text-left">Labour Works</span>
              {labourOpen
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
              }
            </button>

            {labourOpen && (
              <div className="mt-1 space-y-0.5 border-l-2 border-border ml-6">
                {labourSubItems.map(item => renderNavLink(item, true))}
              </div>
            )}
          </div>

          {bottomNavItems.map(item => renderNavLink(item))}
        </nav>

        {user && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 px-4 py-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.clientName || user.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 text-muted-foreground hover:text-destructive"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}
      </aside>

      <main className="flex-1 p-3 sm:p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
