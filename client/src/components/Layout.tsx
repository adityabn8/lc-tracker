import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, List, BarChart3, LogOut, Settings, Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Due Today", shortLabel: "Due", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", shortLabel: "Problems", icon: List },
  { href: "/stats", label: "Stats", shortLabel: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-background flex flex-col page-glow">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-8 2xl:px-12 w-full">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Flame className="h-[18px] w-[18px]" />
            </span>
            <span className="hidden xs:inline sm:inline">LC Tracker</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 ml-4">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                  isActive(href)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <button
              onClick={logout}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title={`Logout (${user?.email})`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 lg:px-8 2xl:px-12 py-5 sm:py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-lg pb-safe">
        <div className="grid grid-cols-4 h-16">
          {navItems.map(({ href, shortLabel, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center h-7 w-12 rounded-full transition-all duration-200",
                    active && "bg-primary/10 dark:bg-primary/15"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-transform duration-200", active && "scale-110")} />
                </span>
                {shortLabel}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
