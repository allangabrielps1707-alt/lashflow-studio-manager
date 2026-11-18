import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageHeader } from "@/components/app/page";
import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, initials } from "@/lib/format";
import { clientsQuery, visitsQuery } from "@/lib/queries";
import { formatPhone } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/clientes/")({
  validateSearch: (s: Record<string, unknown>): { nova?: boolean | undefined } => ({
    nova: s["nova"] === true || s["nova"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Clientes — Lash Studio" },
      { name: "description", content: "Cadastro de clientes com histórico de atendimentos e fotos." },
      { property: "og:title", content: "Clientes — Lash Studio" },
      { property: "og:description", content: "Cadastro de clientes com histórico de atendimentos e fotos." },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(clientsQuery), queryClient.ensureQueryData(visitsQuery)]),
  component: ClientsPage,
});

function ClientsPage() {
  const { nova } = Route.useSearch();
  const navigate = useNavigate();
  const { data: clients } = useSuspenseQuery(clientsQuery);
  const { data: visits } = useSuspenseQuery(visitsQuery);
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(!!nova);

  const lastVisit = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of visits) if (v.status === "concluido") m.set(v.client_id, v.starts_at);
    return m;
  }, [visits]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    if (!t) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(t) || (digits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [clients, q]);

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow={`${clients.length} cliente(s)`}
        title="Clientes"
        actions={
          <Button variant="gold" size="icon" onClick={() => setFormOpen(true)} aria-label="Nova cliente">
            <Plus />
          </Button>
        }
      />
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhuma cliente ainda"
          text="Cadastre aqui ou direto ao criar um agendamento."
          action={<Button variant="gold" size="sm" onClick={() => setFormOpen(true)}>Cadastrar cliente</Button>}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/clientes/$id"
              params={{ id: c.id }}
              className="group flex items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 shadow-soft transition hover:border-primary/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-accent font-display text-accent-foreground">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {formatPhone(c.phone) || "Sem telefone"}
                  {lastVisit.get(c.id) && ` · última visita ${fmtDate(lastVisit.get(c.id)!)}`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma cliente encontrada.</p>}
        </div>
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o && nova) navigate({ to: "/clientes", search: { nova: undefined }, replace: true });
        }}
        onSaved={(c) => navigate({ to: "/clientes/$id", params: { id: c.id } })}
      />
    </div>
  );
}
