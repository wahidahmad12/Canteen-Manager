import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, FilePlus, Settings, Calculator, ClipboardList, UtensilsCrossed, LogOut, User } from 'lucide-react';
import logoImg from '@assets/logo1_1771660912341.png';
import { useCurrentUser, useLogout } from '@/hooks/use-reports';
import { Button } from '@/components/ui/button';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/new', label: 'KPF Delay Cash Expanse', icon: FilePlus },
    { href: '/cash-seal', label: 'KPF Delay CASH SEAL', icon: Calculator },
    { href: '/inventory', label: 'KPF Daily Inventory', icon: ClipboardList },
    { href: '/menu', label: 'Menu Manager', icon: UtensilsCrossed },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col md:flex-row">
      {/* Sidebar / Mobile Header */}
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border shrink-0 md:h-screen md:sticky md:top-0 z-20 flex flex-col">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img src={logoImg} alt="DJ Hospitality" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
          <div>
            <h1 className="font-bold text-lg leading-none">DJ KPF</h1>
            <p className="text-xs text-muted-foreground mt-1">Delay Cash Expanse</p>
          </div>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map(item => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
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
          })}
        </nav>

        {user && (
          <div className="mt-auto p-4 border-t border-border">
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
