import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, FilePlus, Settings, Calculator, ClipboardList, UtensilsCrossed, ShoppingCart, LogOut, User, Menu, X, Users, CalendarDays, Wallet, FileText, BookOpen, HardHat, ChevronDown, ChevronRight, IndianRupee, Smartphone, Download, Share, MoreHorizontal, Receipt, BarChart3, Languages } from 'lucide-react';
import logoImg from '@assets/logo1_1771660912341.png';
import { useCurrentUser, useLogout } from '@/hooks/use-reports';
import { Button } from '@/components/ui/button';
import { useLang } from '@/contexts/language-context';
import type { Lang } from '@/lib/translations';

const labourWorksPaths = ['/employee-master', '/muster-roll', '/salary', '/skill-wage-rates', '/shift-duty', '/registers', '/form-xiii', '/form-vi-a', '/bonus-return', '/half-yearly-return', '/leave-with-wages', '/epfo-esic', '/letterhead', '/ptax-report'];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const { tr, lang, setLang } = useLang();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [labourOpen, setLabourOpen] = useState(() => labourWorksPaths.some(p => location.startsWith(p)));
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const perms = user?.role === 'admin' ? ['expense', 'cashseal', 'inventory', 'menu', 'purchase', 'labour', 'salesinvoice'] : (user?.permissions || []);

  const deferredPrompt = useRef<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (!user) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isStandalone) return;

    const dismissKey = `pwa-install-dismissed:${user.id}`;
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) return;

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    if (isiOS) {
      setIsIos(true);
      setShowInstallBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [user]);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const result = await deferredPrompt.current.userChoice;
      if (result.outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      deferredPrompt.current = null;
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    if (user) {
      localStorage.setItem(`pwa-install-dismissed:${user.id}`, 'true');
    }
  };

  useEffect(() => {
    if (labourWorksPaths.some(p => location.startsWith(p))) {
      setLabourOpen(true);
    }
  }, [location]);

  const mainNavItems = [
    { href: '/', label: tr('dashboard'), icon: LayoutDashboard, perm: null },
    { href: '/new', label: tr('dailyCashExpense'), icon: FilePlus, perm: 'expense' },
    { href: '/cash-seal', label: tr('dailyCashSeal'), icon: Calculator, perm: 'cashseal' },
    { href: '/inventory', label: tr('dailyInventory'), icon: ClipboardList, perm: 'inventory' },
    { href: '/menu', label: tr('menuManager'), icon: UtensilsCrossed, perm: 'menu' },
    { href: '/purchase-request', label: tr('purchaseRequest'), icon: ShoppingCart, perm: 'purchase' },
    { href: '/purchase-invoice', label: tr('purchaseInvoices'), icon: Receipt, perm: 'purchase' },
    { href: '/sales-invoice', label: tr('salesInvoiceLedger'), icon: FileText, perm: 'salesinvoice' },
    { href: '/daily-pnl', label: tr('dailyPnl'), icon: BarChart3, perm: null },
  ].filter(item => item.perm === null || perms.includes(item.perm));

  const labourSubItems = [
    ...(user?.role === 'admin' ? [{ href: '/employee-master', label: tr('employeeMaster'), icon: Users }] : []),
    { href: '/muster-roll', label: tr('musterRoll'), icon: CalendarDays },
    { href: '/salary', label: tr('salaryRegister'), icon: Wallet },
    ...(user?.role === 'admin' ? [{ href: '/skill-wage-rates', label: tr('baseWageRates'), icon: IndianRupee }] : []),
    ...(user?.role === 'admin' ? [{ href: '/shift-duty', label: tr('shiftDutyChart'), icon: CalendarDays }] : []),
    { href: '/registers', label: tr('registers'), icon: BookOpen },
    { href: '/form-xiii', label: tr('workmenRegister'), icon: FileText },
    { href: '/form-vi-a', label: tr('formVIA'), icon: FileText },
    { href: '/bonus-return', label: tr('bonusReturn'), icon: FileText },
    { href: '/half-yearly-return', label: tr('halfYearlyReturn'), icon: FileText },
    { href: '/leave-with-wages', label: tr('leaveWithWages'), icon: FileText },
    { href: '/epfo-esic', label: tr('epfoEsic'), icon: FileText },
    { href: '/ptax-report', label: tr('ptaxReport'), icon: IndianRupee },
    { href: '/letterhead', label: tr('letterheadLetters'), icon: FileText },
  ];

  const bottomNavItems = [
    ...(user?.role === 'admin' ? [{ href: '/admin', label: tr('admin'), icon: Settings, perm: null }] : []),
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

      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-900 to-teal-900 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="button-menu-toggle"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={logoImg} alt="DJ Hospitality" className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/20" />
          <div>
            <h1 className="font-bold text-sm leading-tight text-white">DJ Hospitality</h1>
            <p className="text-[10px] text-teal-300/80 leading-tight">{tr('canteenManagement')}</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-white leading-tight">{user.displayName}</p>
              <p className="text-[10px] text-teal-300/70 leading-tight capitalize">{user.role}</p>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
              <p className="text-xs text-muted-foreground mt-1">{tr('canteenManagement')}</p>
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

          {(user?.role === 'admin' || perms.includes('labour')) && (
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
              <span className="flex-1 text-left">{tr('labourWorks')}</span>
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
          )}

          {bottomNavItems.map(item => renderNavLink(item))}
        </nav>

        {user && (
          <div className="p-4 border-t border-border space-y-2">
            <div className="flex items-center gap-2 px-4 py-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.clientName || user.role}</p>
              </div>
            </div>

            {/* Language switcher */}
            <div className="flex items-center gap-1.5 px-4">
              <Languages className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {(["en", "hi", "bn"] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  data-testid={`button-lang-${l}`}
                  className={`flex-1 text-xs py-1 rounded font-semibold transition-colors ${
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {l === "en" ? "EN" : l === "hi" ? "हिं" : "বাং"}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 text-muted-foreground hover:text-destructive"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              {tr('logout')}
            </Button>
          </div>
        )}
      </aside>

      <main className="flex-1 p-3 sm:p-4 md:p-8 overflow-x-hidden pb-20 md:pb-8">
        {showInstallBanner && (
          <div className="max-w-6xl mx-auto mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 shadow-lg text-white relative" data-testid="banner-install-app">
              <button onClick={dismissInstallBanner} className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition" data-testid="button-dismiss-install">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">{tr('installApp')}</h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {isIos ? tr('installIosDesc') : tr('installDesc')}
                  </p>
                </div>
              </div>
              {isIos ? (
                <div className="mt-3 flex items-center justify-center gap-2 bg-white/10 rounded-lg p-2 text-xs">
                  <span>{tr('installTapShare')}</span>
                  <Share className="w-4 h-4" />
                  <span>{tr('installThenAdd')}</span>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  className="mt-3 w-full bg-white text-blue-700 hover:bg-blue-50 font-bold shadow"
                  size="sm"
                  data-testid="button-install-app"
                >
                  <Download className="w-4 h-4 mr-2" /> {tr('installBtn')}
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>

      {/* ── Bottom Navigation Bar (mobile only) ───────────────────── */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700/60 shadow-2xl safe-area-inset-bottom">
          <div className="flex items-stretch h-16">
            {/* Dashboard — always visible */}
            <Link href="/" onClick={closeSidebar}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location === '/' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
              data-testid="bottom-nav-dashboard">
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tr('home')}</span>
            </Link>

            {/* Expense — if permitted */}
            {perms.includes('expense') && (
              <Link href="/new" onClick={closeSidebar}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location === '/new' || location.startsWith('/report') ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                data-testid="bottom-nav-expense">
                <FilePlus className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tr('expense')}</span>
              </Link>
            )}

            {/* Cash Seal — if permitted */}
            {perms.includes('cashseal') && (
              <Link href="/cash-seal" onClick={closeSidebar}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.startsWith('/cash-seal') ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                data-testid="bottom-nav-cashseal">
                <Calculator className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tr('cashSeal')}</span>
              </Link>
            )}

            {/* Inventory — if permitted */}
            {perms.includes('inventory') && (
              <Link href="/inventory" onClick={closeSidebar}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${location.startsWith('/inventory') ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                data-testid="bottom-nav-inventory">
                <ClipboardList className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tr('inventory')}</span>
              </Link>
            )}

            {/* More — opens sidebar */}
            <button onClick={() => setSidebarOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors"
              data-testid="bottom-nav-more">
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tr('more')}</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
