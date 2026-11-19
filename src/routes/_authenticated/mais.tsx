import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Bell, ChevronRight, Settings, Sparkles, Wallet } from "lucide-react";

import { PageHeader } from "@/components/app/page";
import { useReminders } from "@/hooks/use-reminders";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "Mais — Lash Studio" },
      { name: "description", content: "Atalhos para financeiro, procedimentos, relatórios, lembretes e ajustes." },
      { property: "og:title", content: "Mais — Lash Studio" },
      { property: "og:description", content: "Atalhos para todas as áreas do seu estúdio." },
    ],
  }),
  component: MorePage,
});

const ITEMS = [
  { to: "/financeiro", label: "Financeiro", text: "Receitas, despesas e pendências", icon: Wallet },
  { to: "/procedimentos", label: "Procedimentos", text: "Serviços, modelos, preços e duração", icon: Sparkles },
  { to: "/relatorios", label: "Relatórios", text: "Desempenho e faturamento", icon: BarChart3 },
  { to: "/lembretes", label: "Lembretes", text: "Confirmações, manutenções e aniversários", icon: Bell },
  { to: "/ajustes", label: "Ajustes", text: "Perfil, mensagens, avisos e backup", icon: Settings },
] as const;

function MorePage() {
  const reminders = useReminders();
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Seu estúdio" title="Mais" />
      <div className="grid grid-cols-1 gap-2">
        {ITEMS.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex min-w-0 items-center gap-4 rounded-2xl border bg-card-gradient p-4 shadow-soft transition hover:border-primary/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <it.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{it.label}</p>
              <p className="truncate text-sm text-muted-foreground">{it.text}</p>
            </div>
            {it.to === "/lembretes" && reminders.total > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {reminders.total}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
