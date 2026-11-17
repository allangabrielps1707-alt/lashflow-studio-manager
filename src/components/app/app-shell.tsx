import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Ellipsis,
  Home,
  Plus,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { useAppointments } from "@/components/appointments/provider";
import { Button } from "@/components/ui/button";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { useReminders } from "@/hooks/use-reminders";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";

const NAV = [
  { to: "/painel", label: "Início", icon: Home },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/procedimentos", label: "Procedimentos", icon: Sparkles },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/lembretes", label: "Lembretes", icon: Bell },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

const MOBILE_MORE = ["/financeiro", "/procedimentos", "/relatorios", "/lembretes", "/ajustes", "/mais"];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { openNew } = useAppointments();
  const reminders = useReminders();
  useBrowserNotifications();

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-dvh md:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <Link to="/painel" className="px-2">
          <Brand />
        </Link>
        <Button variant="gold" className="mt-8" onClick={() => openNew()}>
          <Plus /> Novo agendamento
        </Button>
        <nav className="mt-6 grid gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive(n.to) && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.to === "/lembretes" && reminders.total > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {reminders.total}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/painel"><Brand /></Link>
        <Link to="/lembretes" className="relative rounded-full border bg-card p-2.5" aria-label="Lembretes">
          <Bell className="h-4 w-4" />
          {reminders.total > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {reminders.total}
            </span>
          )}
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2 pb-2">
          <BottomLink to="/painel" label="Início" icon={Home} active={isActive("/painel")} />
          <BottomLink to="/agenda" label="Agenda" icon={CalendarDays} active={isActive("/agenda")} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openNew()}
              aria-label="Novo agendamento"
              className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-gold ring-4 ring-background transition active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <BottomLink to="/clientes" label="Clientes" icon={Users} active={isActive("/clientes")} />
          <BottomLink to="/mais" label="Mais" icon={Ellipsis} active={MOBILE_MORE.some(isActive)} />
        </div>
      </nav>
    </div>
  );
}

function BottomLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: "/painel" | "/agenda" | "/clientes" | "/mais";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 py-1 text-[11px] text-muted-foreground transition",
        active && "text-primary",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
