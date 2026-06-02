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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 no-print">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 gap-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <span className="text-2xl">🏓</span>
            <span className="hidden sm:inline">Pickleball Manager</span>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
          <InstallAppButton />
          <Button variant="ghost" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden no-print">
        <div className="flex justify-around py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <aside className="hidden md:block fixed left-0 top-14 bottom-0 w-56 border-r bg-background p-4 no-print">
        <nav className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
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
