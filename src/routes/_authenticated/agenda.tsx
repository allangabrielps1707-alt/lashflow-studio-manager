import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/app/page";
import { AppointmentRow } from "@/components/appointments/appointment-row";
import { useAppointments } from "@/components/appointments/provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { capitalize, fmt, fmtTime, isoDay, money } from "@/lib/format";
import { appointmentsRangeQuery, type AppointmentWithClient } from "@/lib/queries";
import { cn } from "@/lib/utils";

type View = "dia" | "semana" | "mes";

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: (s: Record<string, unknown>): { view?: View; data?: string } => ({
    view: s.view === "dia" || s.view === "semana" || s.view === "mes" ? s.view : undefined,
    data: typeof s.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.data) ? s.data : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agenda — Lash Studio" },
      { name: "description", content: "Agenda diária, semanal e mensal dos seus atendimentos." },
      { property: "og:title", content: "Agenda — Lash Studio" },
      { property: "og:description", content: "Agenda diária, semanal e mensal dos seus atendimentos." },
    ],
  }),
  component: AgendaPage,
});

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 64;
const WEEK_OPTS = { weekStartsOn: 1 as const };

function AgendaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/agenda" });
  const view: View = search.view ?? "dia";
  const current = search.data ? new Date(`${search.data}T00:00:00`) : startOfDay(new Date());
  const { openNew } = useAppointments();

  const [from, to] = useMemo(() => {
    if (view === "dia") return [current, addDays(current, 1)];
    if (view === "semana") return [startOfWeek(current, WEEK_OPTS), addDays(endOfWeek(current, WEEK_OPTS), 1)];
    return [startOfWeek(startOfMonth(current), WEEK_OPTS), addDays(endOfWeek(endOfMonth(current), WEEK_OPTS), 1)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search.data]);

  const { data: appts = [], isFetching } = useQuery({
    ...appointmentsRangeQuery(from, to),
    placeholderData: keepPreviousData,
  });

  const go = (d: Date, v: View = view) => navigate({ search: { view: v, data: isoDay(d) } });
  const step = (dir: 1 | -1) => {
    if (view === "dia") go(addDays(current, dir));
    else if (view === "semana") go(addWeeks(current, dir));
    else go(addMonths(current, dir));
  };

  const title =
    view === "dia"
      ? capitalize(fmt(current, "EEEE, d MMM"))
      : view === "semana"
        ? `${fmt(from, "d MMM")} – ${fmt(addDays(to, -1), "d MMM")}`
        : capitalize(fmt(current, "MMMM yyyy"));

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Agenda"
        title={title}
        actions={
          <Button variant="gold" size="icon" onClick={() => openNew({ date: isoDay(current) })} aria-label="Novo agendamento">
            <Plus />
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => go(current, v as View)}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1.5">
          <Button variant="glass" size="icon-sm" onClick={() => step(-1)} aria-label="Anterior"><ChevronLeft /></Button>
          <Button variant="glass" size="sm" onClick={() => go(startOfDay(new Date()))}>Hoje</Button>
          <Button variant="glass" size="icon-sm" onClick={() => step(1)} aria-label="Próximo"><ChevronRight /></Button>
        </div>
      </div>

      <div className={cn("transition-opacity", isFetching && "opacity-70")}>
        {view === "dia" && <DayView day={current} appts={appts} />}
        {view === "semana" && <WeekView from={from} appts={appts} onPickDay={(d) => go(d, "dia")} />}
        {view === "mes" && <MonthView month={current} from={from} to={to} appts={appts} onPickDay={(d) => go(d, "dia")} />}
      </div>
    </div>
  );
}

function assignLanes(items: AppointmentWithClient[]) {
  const lanes: number[] = [];
  const result = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const ends: number[] = [];
  for (const a of sorted) {
    const s = new Date(a.starts_at).getTime();
    let lane = ends.findIndex((e) => e <= s);
    if (lane === -1) lane = ends.length;
    ends[lane] = s + a.duration_minutes * 60_000;
    lanes.push(lane);
    result.set(a.id, { lane, lanes: 0 });
  }
  const total = Math.max(1, ends.length);
  for (const v of result.values()) v.lanes = total;
  return result;
}

function DayView({ day, appts }: { day: Date; appts: AppointmentWithClient[] }) {
  const { openNew, openDetail } = useAppointments();
  const visible = appts.filter((a) => a.status !== "cancelado");
  const cancelled = appts.filter((a) => a.status === "cancelado");
  const lanes = assignLanes(visible);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const total = visible.filter((a) => a.status !== "falta").reduce((s, a) => s + Number(a.price), 0);
  const now = new Date();
  const nowTop = ((now.getHours() - START_HOUR) * 60 + now.getMinutes()) / 60 * HOUR_PX;

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        {visible.length} atendimento(s) · {money(total)} previstos
      </p>
      <div className="relative rounded-2xl border bg-card-gradient p-2 shadow-soft">
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <button
              key={h}
              type="button"
              onClick={() => openNew({ date: isoDay(day), time: `${String(h).padStart(2, "0")}:00` })}
              className="absolute inset-x-0 flex border-t border-border/60 text-left hover:bg-accent/30"
              style={{ top: i * HOUR_PX, height: HOUR_PX }}
              aria-label={`Agendar às ${h}h`}
            >
              <span className="w-12 shrink-0 -translate-y-2 pr-2 text-right text-[11px] text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </span>
            </button>
          ))}
          {isToday(day) && nowTop > 0 && nowTop < hours.length * HOUR_PX && (
            <div className="pointer-events-none absolute left-12 right-0 z-10 h-px bg-primary" style={{ top: nowTop }}>
              <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-y-0 left-12 right-1">
            {visible.map((a) => {
              const d = new Date(a.starts_at);
              const top = ((d.getHours() - START_HOUR) * 60 + d.getMinutes()) / 60 * HOUR_PX;
              const height = Math.max(28, (a.duration_minutes / 60) * HOUR_PX - 3);
              const l = lanes.get(a.id)!;
              const width = 100 / l.lanes;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openDetail(a.id)}
                  className={cn(
                    "pointer-events-auto absolute overflow-hidden rounded-xl border-l-2 px-2.5 py-1.5 text-left text-xs shadow-soft transition hover:brightness-110",
                    a.status === "concluido" && "border-success bg-success/15",
                    a.status === "confirmado" && "border-primary bg-accent",
                    a.status === "agendado" && "border-info bg-info/15",
                    a.status === "falta" && "border-warning bg-warning/10 opacity-70",
                  )}
                  style={{ top: Math.max(0, top), height, left: `calc(${l.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                >
                  <p className="truncate font-semibold">{a.client?.name}</p>
                  <p className="truncate text-muted-foreground">{fmtTime(a.starts_at)} · {a.procedure_name}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {cancelled.length > 0 && (
        <div className="mt-5 grid gap-2">
          <p className="eyebrow">Cancelados</p>
          {cancelled.map((a) => <AppointmentRow key={a.id} appt={a} />)}
        </div>
      )}
    </div>
  );
}

function WeekView({ from, appts, onPickDay }: { from: Date; appts: AppointmentWithClient[]; onPickDay: (d: Date) => void }) {
  const { openNew } = useAppointments();
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid gap-5">
      {days.map((d) => {
        const list = appts.filter((a) => isSameDay(new Date(a.starts_at), d));
        return (
          <div key={d.toISOString()}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => onPickDay(d)} className="flex items-baseline gap-2 text-left">
                <span className={cn("font-display text-xl", isToday(d) && "text-gold")}>{fmt(d, "dd")}</span>
                <span className="text-sm capitalize text-muted-foreground">{fmt(d, "EEEE")}</span>
              </button>
              <Button variant="ghost" size="icon-sm" onClick={() => openNew({ date: isoDay(d) })} aria-label="Agendar neste dia">
                <Plus />
              </Button>
            </div>
            {list.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Livre</p>
            ) : (
              <div className="grid gap-2">{list.map((a) => <AppointmentRow key={a.id} appt={a} />)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  month,
  from,
  to,
  appts,
  onPickDay,
}: {
  month: Date;
  from: Date;
  to: Date;
  appts: AppointmentWithClient[];
  onPickDay: (d: Date) => void;
}) {
  const days = eachDayOfInterval({ start: from, end: addDays(to, -1) });
  const byDay = new Map<string, AppointmentWithClient[]>();
  for (const a of appts) {
    if (a.status === "cancelado") continue;
    const k = isoDay(new Date(a.starts_at));
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  return (
    <div className="rounded-2xl border bg-card-gradient p-2 shadow-soft">
      <div className="grid grid-cols-7 pb-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const list = byDay.get(isoDay(d)) ?? [];
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex aspect-square flex-col items-center justify-start rounded-xl p-1 pt-1.5 text-sm transition hover:bg-accent md:aspect-[4/3]",
                !isSameMonth(d, month) && "opacity-35",
                isToday(d) && "border border-primary/60",
              )}
            >
              <span className={cn(isToday(d) && "text-gold font-semibold")}>{fmt(d, "d")}</span>
              {list.length > 0 && (
                <span className="mt-auto mb-1 flex items-center gap-0.5">
                  {list.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        a.status === "concluido" ? "bg-success" : a.status === "falta" ? "bg-warning" : "bg-primary",
                      )}
                    />
                  ))}
                  {list.length > 3 && <span className="text-[9px] text-muted-foreground">+{list.length - 3}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
