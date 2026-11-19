import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Cake, CalendarCheck, CalendarClock, HandCoins, History, PartyPopper, Repeat } from "lucide-react";

import { EmptyState, PageHeader, PageLoader, Section } from "@/components/app/page";
import { WhatsAppButton } from "@/components/app/whatsapp-button";
import { AppointmentRow } from "@/components/appointments/appointment-row";
import { useAppointments } from "@/components/appointments/provider";
import { Button } from "@/components/ui/button";
import { useReminders } from "@/hooks/use-reminders";
import { balanceDue } from "@/lib/business";
import { fmt, fmtDate, money } from "@/lib/format";
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

  const empty = r.total === 0 && r.tomorrow.length === 0;

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Rotina em dia" title="Lembretes" />

      {empty && (
        <EmptyState
          icon={PartyPopper}
          title="Tudo em dia!"
          text="Nenhuma confirmação, manutenção ou pagamento pendente no momento."
        />
      )}

      {r.unresolved.length > 0 && (
        <Group icon={History} title="Atendimentos sem baixa" hint="Marque como concluído ou falta para manter o financeiro certo.">
          {r.unresolved.map((a) => (
            <AppointmentRow key={a.id} appt={a} showDate={(d) => fmt(d, "dd/MM")} />
          ))}
        </Group>
      )}

      {r.toConfirm.length > 0 && (
        <Group icon={CalendarCheck} title="Confirmar presença" hint="Horários das próximas 48h ainda não confirmados.">
          {r.toConfirm.map((a) => (
            <WithAction
              key={a.id}
              row={<AppointmentRow appt={a} showDate={(d) => fmt(d, "EEE dd/MM")} />}
              action={
                <WhatsAppButton
                  size="sm"
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
                <WhatsAppButton
                  size="sm"
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

      {r.maintenance.length > 0 && (
        <Group icon={Repeat} title="Hora da manutenção" hint="Clientes sem horário marcado e com manutenção vencendo.">
          {r.maintenance.map((m) => (
            <div key={m.client_id} className="rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link to="/clientes/$id" params={{ id: m.client_id }} className="truncate font-medium hover:text-primary">
                    {m.client.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Última visita {fmtDate(m.lastVisit)} ·{" "}
                    <span className={m.daysUntil < 0 ? "text-destructive" : "text-primary"}>
                      {m.daysUntil < 0
                        ? `atrasada ${Math.abs(m.daysUntil)} dia(s)`
                        : m.daysUntil === 0
                          ? "vence hoje"
                          : `vence em ${m.daysUntil} dia(s)`}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <WhatsAppButton
                  size="sm"
                  phone={m.client.phone}
                  message={buildMessage("maintenance", p, { clientName: m.client.name })}
                />
                <Button size="sm" variant="glass" onClick={() => openNew({ clientId: m.client_id })}>
                  Agendar
                </Button>
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

function WithAction({ row, action }: { row: ReactNode; action: ReactNode }) {
  return (
    <div className="grid gap-2">
      {row}
      <div className="-mt-1 flex justify-end">{action}</div>
    </div>
  );
}
