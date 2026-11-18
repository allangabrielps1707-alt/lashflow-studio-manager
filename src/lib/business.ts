import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

export type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado" | "falta";

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; variant: "info" | "gold" | "success" | "danger" | "warning" }
> = {
  agendado: { label: "Agendado", variant: "info" },
  confirmado: { label: "Confirmado", variant: "gold" },
  concluido: { label: "Concluído", variant: "success" },
  cancelado: { label: "Cancelado", variant: "danger" },
  falta: { label: "Faltou", variant: "warning" },
};

export const ACTIVE_STATUSES: AppointmentStatus[] = ["agendado", "confirmado"];

export const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência",
] as const;

export const PROCEDURE_CATEGORIES: Record<string, string> = {
  aplicacao: "Aplicação",
  manutencao: "Manutenção",
  remocao: "Remoção",
  outros: "Outros",
};

export const LASH_MODELS = [
  "Fio a fio (clássico)",
  "Volume brasileiro",
  "Volume russo",
  "Híbrido",
  "Mega volume",
  "Fox eyes",
  "Efeito molhado",
  "Lash lifting",
];

export const INCOME_CATEGORIES = ["Atendimento", "Sinal", "Venda de produtos", "Outros"];
export const EXPENSE_CATEGORIES = [
  "Material",
  "Produtos",
  "Aluguel",
  "Contas",
  "Marketing",
  "Cursos",
  "Reembolso de sinal",
  "Outros",
];

export const SUGGESTED_PROCEDURES = [
  { name: "Fio a fio", category: "aplicacao", lash_model: "Fio a fio (clássico)", price: 150, duration_minutes: 120, maintenance_days: 15 },
  { name: "Volume brasileiro", category: "aplicacao", lash_model: "Volume brasileiro", price: 180, duration_minutes: 150, maintenance_days: 15 },
  { name: "Volume russo", category: "aplicacao", lash_model: "Volume russo", price: 220, duration_minutes: 180, maintenance_days: 20 },
  { name: "Manutenção", category: "manutencao", lash_model: null, price: 100, duration_minutes: 90, maintenance_days: 15 },
  { name: "Remoção", category: "remocao", lash_model: null, price: 40, duration_minutes: 30, maintenance_days: null },
  { name: "Lash lifting", category: "outros", lash_model: "Lash lifting", price: 130, duration_minutes: 60, maintenance_days: 45 },
];

/** Amount still owed on an appointment (never negative). */
export function balanceDue(a: { price: number; amount_paid: number }): number {
  return Math.max(0, Math.round((Number(a.price) - Number(a.amount_paid)) * 100) / 100);
}

export interface TimedItem {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
}

/** Finds an active appointment that overlaps the proposed slot (ignoring `ignoreId`). */
export function findOverlap<T extends TimedItem>(
  items: T[],
  startsAt: Date,
  durationMinutes: number,
  ignoreId?: string,
): T | undefined {
  const start = startsAt.getTime();
  const end = start + durationMinutes * 60_000;
  return items.find((it) => {
    if (it.id === ignoreId) return false;
    if (!ACTIVE_STATUSES.includes(it.status as AppointmentStatus)) return false;
    const s = new Date(it.starts_at).getTime();
    const e = s + it.duration_minutes * 60_000;
    return s < end && start < e;
  });
}

export interface VisitRow {
  client_id: string;
  starts_at: string;
  status: string;
  procedure_id: string | null;
}

export interface MaintenanceDue {
  client_id: string;
  lastVisit: string;
  dueDate: Date;
  daysUntil: number; // negative = overdue
}

/**
 * A client is due for maintenance when her last completed visit + the procedure's
 * maintenance interval falls within `windowDays` from today (or is overdue up to
 * `maxOverdueDays`), and she has no upcoming active appointment.
 */
export function maintenanceDue(
  visits: VisitRow[],
  intervals: Record<string, number | null | undefined>,
  today: Date,
  windowDays = 3,
  maxOverdueDays = 30,
): MaintenanceDue[] {
  const t0 = startOfDay(today);
  const lastByClient = new Map<string, VisitRow>();
  const hasUpcoming = new Set<string>();
  for (const v of visits) {
    const d = new Date(v.starts_at);
    if (ACTIVE_STATUSES.includes(v.status as AppointmentStatus) && d >= t0) {
      hasUpcoming.add(v.client_id);
    }
    if (v.status !== "concluido") continue;
    const prev = lastByClient.get(v.client_id);
    if (!prev || new Date(prev.starts_at) < d) lastByClient.set(v.client_id, v);
  }
  const out: MaintenanceDue[] = [];
  for (const [clientId, v] of lastByClient) {
    if (hasUpcoming.has(clientId)) continue;
    const interval = v.procedure_id ? intervals[v.procedure_id] : null;
    if (!interval) continue;
    const due = addDays(startOfDay(new Date(v.starts_at)), interval);
    const daysUntil = differenceInCalendarDays(due, t0);
    if (daysUntil <= windowDays && daysUntil >= -maxOverdueDays) {
      out.push({ client_id: clientId, lastVisit: v.starts_at, dueDate: due, daysUntil });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Whether a birthday (yyyy-MM-dd) falls within the next `days` days, including today. */
export function birthdayWithin(birthday: string | null, today: Date, days = 7): number | null {
  if (!birthday) return null;
  const [, m = 1, d = 1] = birthday.split("-").map(Number);
  const t0 = startOfDay(today);
  let next = new Date(t0.getFullYear(), m - 1, d);
  if (next < t0) next = new Date(t0.getFullYear() + 1, m - 1, d);
  const diff = differenceInCalendarDays(next, t0);
  return diff <= days ? diff : null;
}

export interface AttendanceStats {
  total: number;
  concluded: number;
  cancelled: number;
  noShow: number;
  rescheduled: number;
  cancelRate: number;
  noShowRate: number;
}

export function attendanceStats(
  rows: { status: string; reschedule_count: number }[],
): AttendanceStats {
  const total = rows.length;
  const concluded = rows.filter((r) => r.status === "concluido").length;
  const cancelled = rows.filter((r) => r.status === "cancelado").length;
  const noShow = rows.filter((r) => r.status === "falta").length;
  const rescheduled = rows.filter((r) => r.reschedule_count > 0).length;
  return {
    total,
    concluded,
    cancelled,
    noShow,
    rescheduled,
    cancelRate: total ? cancelled / total : 0,
    noShowRate: total ? noShow / total : 0,
  };
}
