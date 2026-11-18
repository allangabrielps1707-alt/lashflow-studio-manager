import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addMonths, startOfMonth, startOfYear } from "date-fns";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader, Section, StatCard } from "@/components/app/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { attendanceStats } from "@/lib/business";
import { capitalize, fmt, money } from "@/lib/format";
import { appointmentsRangeQuery, clientsQuery, transactionsRangeQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Period = "mes" | "anterior" | "trimestre" | "ano";
const PERIOD_LABEL: Record<Period, string> = { mes: "Este mês", anterior: "Mês passado", trimestre: "3 meses", ano: "Este ano" };
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function periodRange(p: Period): [Date, Date] {
  const m = startOfMonth(new Date());
  if (p === "anterior") return [addMonths(m, -1), m];
  if (p === "trimestre") return [addMonths(m, -2), addMonths(m, 1)];
  if (p === "ano") return [startOfYear(m), addMonths(m, 1)];
  return [m, addMonths(m, 1)];
}

export const Route = createFileRoute("/_authenticated/relatorios")({
  validateSearch: (s: Record<string, unknown>): { periodo?: Period | undefined } => {
    const p = s["periodo"];
    return { periodo: p === "mes" || p === "anterior" || p === "trimestre" || p === "ano" ? p : undefined };
  },
  head: () => ({
    meta: [
      { title: "Relatórios — Lash Studio" },
      { name: "description", content: "Desempenho, faturamento e frequência das clientes." },
      { property: "og:title", content: "Relatórios — Lash Studio" },
      { property: "og:description", content: "Desempenho, faturamento e frequência das clientes." },
    ],
  }),
  component: ReportsPage,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
  fontSize: 12,
};

function ReportsPage() {
  const { periodo = "mes" } = Route.useSearch();
  const navigate = useNavigate({ from: "/relatorios" });
  const [from, to] = periodRange(periodo);
  const chartFrom = addMonths(startOfMonth(new Date()), -5);
  const chartTo = addMonths(startOfMonth(new Date()), 1);

  const appts = useQuery({ ...appointmentsRangeQuery(from, to), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsRangeQuery(from, to), placeholderData: keepPreviousData });
  const history = useQuery(transactionsRangeQuery(chartFrom, chartTo));
  const clients = useQuery(clientsQuery);

  const data = useMemo(() => {
    const a = appts.data ?? [];
    const t = txs.data ?? [];
    const income = t.filter((x) => x.type === "receita").reduce((s, x) => s + Number(x.amount), 0);
    const expense = t.filter((x) => x.type === "despesa").reduce((s, x) => s + Number(x.amount), 0);
    const done = a.filter((x) => x.status === "concluido");
    const ticket = done.length ? done.reduce((s, x) => s + Number(x.price), 0) / done.length : 0;
    const stats = attendanceStats(a);

    const byProc = new Map<string, { name: string; count: number; total: number }>();
    for (const x of done) {
      const cur = byProc.get(x.procedure_name) ?? { name: x.procedure_name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(x.price);
      byProc.set(x.procedure_name, cur);
    }
    const procedures = [...byProc.values()].sort((p, q) => q.total - p.total);

    const byMethod = new Map<string, number>();
    for (const x of t) if (x.type === "receita") byMethod.set(x.payment_method ?? "Outro", (byMethod.get(x.payment_method ?? "Outro") ?? 0) + Number(x.amount));
    const methods = [...byMethod.entries()].map(([name, value]) => ({ name, value })).sort((p, q) => q.value - p.value);

    const byClient = new Map<string, { name: string; total: number; visits: number }>();
    for (const x of done) {
      const cur = byClient.get(x.client_id) ?? { name: x.client?.name ?? "Cliente", total: 0, visits: 0 };
      cur.total += Number(x.amount_paid);
      cur.visits += 1;
      byClient.set(x.client_id, cur);
    }
    const topClients = [...byClient.values()].sort((p, q) => q.total - p.total).slice(0, 5);

    const newClients = (clients.data ?? []).filter((c) => new Date(c.created_at) >= from && new Date(c.created_at) < to).length;

    const months = Array.from({ length: 6 }, (_, i) => addMonths(chartFrom, i));
    const monthly = months.map((m) => {
      const key = fmt(m, "yyyy-MM");
      const rows = (history.data ?? []).filter((x) => x.occurred_on.startsWith(key));
      return {
        mes: capitalize(fmt(m, "MMM")),
        Receitas: rows.filter((x) => x.type === "receita").reduce((s, x) => s + Number(x.amount), 0),
        Despesas: rows.filter((x) => x.type === "despesa").reduce((s, x) => s + Number(x.amount), 0),
      };
    });

    return { income, expense, ticket, stats, procedures, methods, topClients, newClients, monthly };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts.data, txs.data, history.data, clients.data, periodo]);

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Relatórios" title="Desempenho" />
      <Tabs value={periodo} onValueChange={(v) => navigate({ search: { periodo: v as Period } })} className="mb-5">
        <TabsList className="flex w-full overflow-x-auto md:w-auto">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <TabsTrigger key={p} value={p} className="flex-1">{PERIOD_LABEL[p]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", (appts.isFetching || txs.isFetching) && "opacity-70")}>
        <StatCard label="Faturamento" value={money(data.income)} tone="gold" />
        <StatCard label="Lucro" value={money(data.income - data.expense)} hint={`Despesas ${money(data.expense)}`} />
        <StatCard label="Atendimentos" value={data.stats.concluded} hint={`Ticket médio ${money(data.ticket)}`} />
        <StatCard label="Novas clientes" value={data.newClients} />
        <StatCard label="Cancelamentos" value={data.stats.cancelled} hint={`${pct(data.stats.cancelRate)} dos agendamentos`} />
        <StatCard label="Faltas" value={data.stats.noShow} hint={`${pct(data.stats.noShowRate)} dos agendamentos`} />
        <StatCard label="Remarcações" value={data.stats.rescheduled} hint={`de ${data.stats.total} agendamentos`} />
        <StatCard label="Agendados" value={data.stats.total} />
      </div>

      <Section title="Últimos 6 meses" className="mt-8">
        <div className="h-64 rounded-2xl border bg-card-gradient p-3 shadow-soft">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
              <Bar dataKey="Receitas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Por procedimento">
          {data.procedures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem atendimentos concluídos no período.</p>
          ) : (
            <ul className="grid gap-2">
              {data.procedures.map((p) => {
                const max = data.procedures[0]?.total || 1;
                return (
                  <li key={p.name} className="rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
                    <div className="flex justify-between text-sm">
                      <span>{p.name} <span className="text-muted-foreground">· {p.count}x</span></span>
                      <span className="font-display">{money(p.total)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${(p.total / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Formas de pagamento">
          {data.methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem receitas no período.</p>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border bg-card-gradient p-4 shadow-soft">
              <div className="h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.methods} dataKey="value" nameKey="name" innerRadius={40} outerRadius={64} paddingAngle={2} stroke="none">
                      {data.methods.map((m, i) => <Cell key={m.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid flex-1 gap-1.5 text-sm">
                {data.methods.map((m, i) => (
                  <li key={m.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {m.name}
                    </span>
                    <span className="text-muted-foreground">{money(m.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      <Section title="Clientes que mais investiram">
        {data.topClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <ol className="grid gap-2">
            {data.topClients.map((c, i) => (
              <li key={c.name + i} className="flex items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
                <span className="font-display text-xl text-gold">{i + 1}</span>
                <span className="flex-1">{c.name} <span className="text-sm text-muted-foreground">· {c.visits} visita(s)</span></span>
                <span className="font-display">{money(c.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
