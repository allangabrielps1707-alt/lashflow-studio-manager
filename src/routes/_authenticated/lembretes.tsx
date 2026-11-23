import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Cake, CalendarCheck, CalendarClock, CalendarX, Check, HandCoins, Heart, History, Package, PartyPopper, Repeat, Sun } from "lucide-react";

import { EmptyState, PageHeader, PageLoader, Section } from "@/components/app/page";
import { WhatsAppButton } from "@/components/app/whatsapp-button";
import { AppointmentRow } from "@/components/appointments/appointment-row";
import { useAppointments } from "@/components/appointments/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMarkReminder, useReminders } from "@/hooks/use-reminders";
import { REMINDER_RULES, balanceDue, type ReminderKind } from "@/lib/business";
import { fmt, fmtDate, fmtQty, money } from "@/lib/format";
import { buildMessage } from "@/lib/messages";
import { profileQuery } from "@/lib/queries";
import { firstName } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — Lash Studio" },
      { name: "description", content: "Confirmações, manutenções, pagamentos pendentes e aniversários em um só lugar." },
      { property: "og:title", content: "Lembretes — Lash Studio" },
      { property: "og:description", content: "Confirmações, manutenções, pagamentos pendentes e aniversários." },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  const r = useReminders();
  const { data: profile } = useQuery(profileQuery);
  const { openNew } = useAppointments();
  const p = profile?.profile;

  if (!r.ready) return <PageLoader />;

  const empty = r.total === 0;

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Rotina em dia" title="Lembretes" />

      {empty && (
        <EmptyState
          icon={PartyPopper}
          title="Tudo em dia!"
          text="Nenhuma confirmação, lembrete, agradecimento, manutenção, pagamento ou produto pendente no momento."
        />
      )}

      {r.unresolved.length > 0 && (
        <Group icon={History} title="Atendimentos sem baixa" hint="Marque como concluído ou falta para manter o financeiro certo.">
          {r.unresolved.map((a) => (
            <AppointmentRow key={a.id} appt={a} showDate={(d) => fmt(d, "dd/MM")} />
          ))}
        </Group>
      )}

      {r.today.length > 0 && (
        <Group icon={Sun} title="Lembrete do dia" hint="Atendimentos de hoje — envie o lembrete para sua cliente.">
          {r.today.map((a) => (
            <WithAction
              key={a.id}
              row={<AppointmentRow appt={a} />}
              action={
                <ReminderActions
                  appointmentId={a.id}
                  kind="hoje"
                  label="Lembrar"
                  phone={a.client?.phone}
                  message={buildMessage("today", p, {
                    clientName: a.client?.name ?? "",
                    startsAt: a.starts_at,
                    procedure: a.procedure_name,
                  })}
                />
              }
            />
          ))}
        </Group>
      )}

      {r.toConfirm.length > 0 && (
        <Group icon={CalendarCheck} title="Confirmar horário" hint={`Atendimentos dos próximos ${REMINDER_RULES.confirmDaysBefore} dias ainda não confirmados.`}>
          {r.toConfirm.map((a) => (
            <WithAction
              key={a.id}
              row={<AppointmentRow appt={a} showDate={(d) => fmt(d, "EEE dd/MM")} />}
              action={
                <ReminderActions
                  appointmentId={a.id}
                  kind="confirmacao"
                  label="Confirmar"
                  phone={a.client?.phone}
                  message={buildMessage("confirmation", p, {
                    clientName: a.client?.name ?? "",
                    startsAt: a.starts_at,
                    procedure: a.procedure_name,
                    price: Number(a.price),
                  })}
                />
              }
            />
          ))}
        </Group>
      )}

      {r.tomorrow.length > 0 && (
        <Group icon={CalendarClock} title="Amanhã" hint="Envie o lembrete na véspera para evitar faltas.">
          {r.tomorrow.map((a) => (
            <WithAction
              key={a.id}
              row={<AppointmentRow appt={a} />}
              action={
                <ReminderActions
                  appointmentId={a.id}
                  kind="vespera"
                  label="Lembrar"
                  phone={a.client?.phone}
                  message={buildMessage("reminder", p, {
                    clientName: a.client?.name ?? "",
                    startsAt: a.starts_at,
                    procedure: a.procedure_name,
                  })}
                />
              }
            />
          ))}
        </Group>
      )}

      {r.thanks.length > 0 && (
        <Group icon={Heart} title="Agradecimento" hint="Atendimentos concluídos — agradeça a visita da sua cliente.">
          {r.thanks.map((a) => (
            <WithAction
              key={a.id}
              row={<AppointmentRow appt={a} showDate={(d) => fmt(d, "dd/MM")} />}
              action={
                <ReminderActions
                  appointmentId={a.id}
                  kind="agradecimento"
                  label="Agradecer"
                  phone={a.client?.phone}
                  message={buildMessage("thanks", p, { clientName: a.client?.name ?? "" })}
                />
              }
            />
          ))}
        </Group>
      )}

      {r.maintenance.length > 0 && (
        <Group icon={Repeat} title="Convite para manutenção" hint={`Clientes com ${REMINDER_RULES.maintenanceDays} dias ou mais desde o último atendimento e sem horário marcado.`}>
          {r.maintenance.map((m) => (
            <div key={m.client_id} className="rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
              <div className="min-w-0">
                <Link to="/clientes/$id" params={{ id: m.client_id }} className="truncate font-medium hover:text-primary">
                  {m.client.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Último atendimento {fmtDate(m.lastVisit)} ·{" "}
                  <span className="text-primary">
                    {m.daysUntil === 0 ? `${REMINDER_RULES.maintenanceDays} dias hoje` : `há ${REMINDER_RULES.maintenanceDays - m.daysUntil} dias`}
                  </span>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="glass" onClick={() => openNew({ clientId: m.client_id })}>
                  Agendar
                </Button>
                <ReminderActions
                  appointmentId={m.appointment_id}
                  kind="manutencao"
                  label="Convidar"
                  phone={m.client.phone}
                  message={buildMessage("maintenance", p, { clientName: m.client.name })}
                />
              </div>
            </div>
          ))}
        </Group>
      )}

      {r.pending.length > 0 && (
        <Group icon={HandCoins} title="Pagamentos pendentes" hint="Atendimentos concluídos com saldo em aberto.">
          {r.pending.map((a) => {
            const due = balanceDue(a);
            return (
              <WithAction
                key={a.id}
                row={<AppointmentRow appt={a} showDate={(d) => fmt(d, "dd/MM")} />}
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gold">{money(due)}</span>
                    <WhatsAppButton
                      size="sm"
                      label="Cobrar"
                      phone={a.client?.phone}
                      message={`Oi ${firstName(a.client?.name ?? "")}! Passando para lembrar do saldo de ${money(due)} do atendimento de ${fmt(a.starts_at, "dd/MM")} (${a.procedure_name}). Pode ser por Pix. Obrigada! 💛`}
                    />
                  </div>
                }
              />
            );
          })}
        </Group>
      )}

      {r.lowStock.length > 0 && (
        <Group icon={Package} title="Estoque baixo" hint="Produtos que chegaram na quantidade mínima.">
          {r.lowStock.map((p) => (
            <StockRow
              key={p.id}
              name={p.name}
              detail={`${fmtQty(p.quantity)} ${p.unit} · mínimo ${fmtQty(p.min_quantity)}`}
              tone={Number(p.quantity) === 0 ? "danger" : "warning"}
              label={Number(p.quantity) === 0 ? "Esgotado" : "Repor"}
            />
          ))}
        </Group>
      )}

      {r.expiring.length > 0 && (
        <Group icon={CalendarX} title="Validade" hint="Produtos vencidos ou que vencem nos próximos 30 dias.">
          {r.expiring.map(({ product, inDays }) => (
            <StockRow
              key={product.id}
              name={product.name}
              detail={`Vence ${fmtDate(product.expires_on!)} · ${fmtQty(product.quantity)} ${product.unit}`}
              tone={inDays < 0 ? "danger" : "warning"}
              label={inDays < 0 ? "Vencido" : inDays === 0 ? "Vence hoje" : `${inDays} dia(s)`}
            />
          ))}
        </Group>
      )}

      {r.birthdays.length > 0 && (
        <Group icon={Cake} title="Aniversariantes da semana">
          {r.birthdays.map(({ client, inDays }) => (
            <div key={client.id} className="flex items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
              <div className="min-w-0 flex-1">
                <Link to="/clientes/$id" params={{ id: client.id }} className="truncate font-medium hover:text-primary">
                  {client.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {inDays === 0 ? "Hoje! 🎉" : inDays === 1 ? "Amanhã" : `Em ${inDays} dias`}
                </p>
              </div>
              <WhatsAppButton
                size="sm"
                label="Parabenizar"
                phone={client.phone}
                message={`Feliz aniversário, ${firstName(client.name)}! 🎂 Que seu dia seja tão lindo quanto seu olhar. Com carinho${p?.business_name ? `, ${p.business_name}` : ""} 💛`}
              />
            </div>
          ))}
        </Group>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <BellRing className="h-3.5 w-3.5" />
        <span>
          Ative os avisos no aparelho em{" "}
          <Link to="/ajustes" className="text-primary underline-offset-4 hover:underline">
            Ajustes
          </Link>
          .
        </span>
      </p>
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </span>
      }
    >
      {hint && <p className="-mt-2 mb-3 text-sm text-muted-foreground">{hint}</p>}
      <div className="grid gap-2">{children}</div>
    </Section>
  );
}

function StockRow({ name, detail, tone, label }: { name: string; detail: string; tone: "danger" | "warning"; label: string }) {
  return (
    <Link
      to="/estoque"
      className="flex items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 shadow-soft transition hover:border-primary/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={tone}>{label}</Badge>
    </Link>
  );
}

function ReminderActions({
  appointmentId,
  kind,
  label,
  phone,
  message,
}: {
  appointmentId: string;
  kind: ReminderKind;
  label: string;
  phone: string | null | undefined;
  message: string;
}) {
  const mark = useMarkReminder();
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={() => mark(appointmentId, kind)} aria-label="Marcar como feito">
        <Check /> Feito
      </Button>
      <WhatsAppButton size="sm" label={label} phone={phone} message={message} onSent={() => mark(appointmentId, kind)} />
    </div>
  );
}

function WithAction({ row, action }: { row: ReactNode; action: ReactNode }) {
  return (
    <div className="grid gap-2">
      {row}
      <div className="-mt-1 flex justify-end">{action}</div>
    </div>
  );
}
