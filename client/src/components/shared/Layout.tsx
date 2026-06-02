import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Home, Users, RotateCcw, Trophy, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallAppButton } from '@/components/shared/InstallAppButton';
import { useThemeStore } from '@/store';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/players', icon: Users, label: 'Players' },
  { to: '/round-robin', icon: RotateCcw, label: 'Round Robin' },
  { to: '/tournament', icon: Trophy, label: 'Tournament' },
  { to: '/history', icon: History, label: 'History' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useThemeStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/90 shadow-sm shadow-slate-950/5 backdrop-blur supports-[backdrop-filter]:bg-card/75 no-print">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-3">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg shrink-0 tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xl text-primary">🏓</span>
            <span className="hidden sm:inline">Pickleball Manager</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <InstallAppButton />
            <Button variant="ghost" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden no-print">
        <div className="flex justify-around px-2 py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <aside className="hidden md:block fixed left-0 top-16 bottom-0 w-56 border-r bg-card/70 p-4 no-print">
        <nav className="space-y-1.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
