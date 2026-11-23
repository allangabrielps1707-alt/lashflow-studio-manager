import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { addDays, startOfDay, startOfMonth, addMonths } from "date-fns";
import { Bell, CalendarDays, CalendarPlus, ChevronRight, HandCoins, Receipt, TrendingUp, UserPlus } from "lucide-react";

import { EmptyState, PageHeader, Section, StatCard } from "@/components/app/page";
import { AppointmentRow } from "@/components/appointments/appointment-row";
import { useAppointments } from "@/components/appointments/provider";
import { Button } from "@/components/ui/button";
import { useReminders } from "@/hooks/use-reminders";
import { pendingReceivable } from "@/lib/business";
import { capitalize, fmt, fmtDayLong, money } from "@/lib/format";
import {
  appointmentsRangeQuery,
  profileQuery,
  transactionsRangeQuery,
} from "@/lib/queries";
import { firstName } from "@/lib/whatsapp";

function ranges() {
  const today = startOfDay(new Date());
  const month = startOfMonth(today);
  return {
    today,
    tomorrow: addDays(today, 1),
    weekEnd: addDays(today, 8),
    month,
    nextMonth: addMonths(month, 1),
  };
}

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Lash Studio" },
      { name: "description", content: "Resumo do dia: atendimentos, próximos horários e faturamento." },
      { property: "og:title", content: "Painel — Lash Studio" },
      { property: "og:description", content: "Resumo do dia: atendimentos, próximos horários e faturamento." },
    ],
  }),
  loader: ({ context: { queryClient } }) => {
    const r = ranges();
    return Promise.all([
      queryClient.ensureQueryData(profileQuery),
      queryClient.ensureQueryData(appointmentsRangeQuery(r.today, r.tomorrow)),
      queryClient.ensureQueryData(appointmentsRangeQuery(r.tomorrow, r.weekEnd)),
      queryClient.ensureQueryData(transactionsRangeQuery(r.month, r.nextMonth)),
      queryClient.ensureQueryData(appointmentsRangeQuery(r.month, r.nextMonth)),
    ]);
  },
  component: Dashboard,
});

function Dashboard() {
  const r = ranges();
  const { openNew } = useAppointments();
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: today } = useSuspenseQuery(appointmentsRangeQuery(r.today, r.tomorrow));
  const { data: upcoming } = useSuspenseQuery(appointmentsRangeQuery(r.tomorrow, r.weekEnd));
  const { data: monthTx } = useSuspenseQuery(transactionsRangeQuery(r.month, r.nextMonth));
  const { data: monthAppts } = useSuspenseQuery(appointmentsRangeQuery(r.month, r.nextMonth));
  const reminders = useReminders();

  const activeToday = today.filter((a) => a.status !== "cancelado");
  const todayExpected = activeToday.filter((a) => a.status !== "falta").reduce((s, a) => s + Number(a.price), 0);
  const income = monthTx.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const receivable = pendingReceivable(monthAppts, r.month, r.nextMonth);
  const nextOnes = upcoming.filter((a) => a.status === "agendado" || a.status === "confirmado").slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const name = profile.profile.full_name ? firstName(profile.profile.full_name) : "";

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow={capitalize(fmtDayLong(new Date()))}
        title={
          <>
            {greeting}
            {name && (
              <>
                , <span className="text-gold">{name}</span>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Hoje" value={activeToday.length} hint={`${money(todayExpected)} previstos`} icon={CalendarDays} />
        <StatCard label="Faturamento do mês" value={money(income)} hint={`Lucro ${money(income - expense)}`} icon={TrendingUp} tone="gold" />
        <StatCard label="A receber" value={money(receivable.total)} hint={`${receivable.count} pendente(s) no mês`} icon={HandCoins} />
        <StatCard label="Lembretes" value={reminders.total} hint="ver todos" icon={Bell} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="glass" className="h-auto flex-col gap-1.5 rounded-2xl py-3 text-xs" onClick={() => openNew()}>
          <CalendarPlus className="!size-5 text-primary" /> Agendar
        </Button>
        <Button variant="glass" className="h-auto flex-col gap-1.5 rounded-2xl py-3 text-xs" asChild>
          <Link to="/clientes" search={{ nova: true }}>
            <UserPlus className="!size-5 text-primary" /> Nova cliente
          </Link>
        </Button>
        <Button variant="glass" className="h-auto flex-col gap-1.5 rounded-2xl py-3 text-xs" asChild>
          <Link to="/financeiro" search={{ lancar: "despesa" }}>
            <Receipt className="!size-5 text-primary" /> Despesa
          </Link>
        </Button>
      </div>

      <Section
        className="mt-8"
        title="Atendimentos de hoje"
        action={
          <Link to="/agenda" className="flex items-center text-sm text-primary">
            Agenda <ChevronRight className="h-4 w-4" />
          </Link>
        }
      >
        {today.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Dia livre por aqui"
            text="Nenhum atendimento marcado para hoje."
            action={<Button variant="gold" size="sm" onClick={() => openNew()}>Novo agendamento</Button>}
          />
        ) : (
          <div className="grid gap-2">
            {today.map((a) => <AppointmentRow key={a.id} appt={a} />)}
          </div>
        )}
      </Section>

      <Section title="Próximos horários">
        {nextOnes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada agendado para os próximos 7 dias.</p>
        ) : (
          <div className="grid gap-2">
            {nextOnes.map((a) => (
              <AppointmentRow key={a.id} appt={a} showDate={(d) => fmt(d, "EEE dd/MM")} />
            ))}
          </div>
        )}
      </Section>

      {reminders.total > 0 && (
        <Link
          to="/lembretes"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent p-4 text-accent-foreground"
        >
          <Bell className="h-5 w-5" />
          <div className="flex-1 text-sm">
            {reminders.today.length > 0 && <p>{reminders.today.length} lembrete(s) do dia para enviar</p>}
            {reminders.toConfirm.length > 0 && <p>{reminders.toConfirm.length} horário(s) para confirmar</p>}
            {reminders.thanks.length > 0 && <p>{reminders.thanks.length} agradecimento(s) para enviar</p>}
            {reminders.maintenance.length > 0 && <p>{reminders.maintenance.length} convite(s) de manutenção</p>}
            {reminders.unresolved.length > 0 && <p>{reminders.unresolved.length} atendimento(s) sem baixa</p>}
            {reminders.birthdays.length > 0 && <p>{reminders.birthdays.length} aniversariante(s) da semana</p>}
            {reminders.pending.length > 0 && <p>{reminders.pending.length} pagamento(s) pendente(s)</p>}
            {reminders.lowStock.length + reminders.expiring.length > 0 && (
              <p>{reminders.lowStock.length + reminders.expiring.length} aviso(s) de estoque</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
