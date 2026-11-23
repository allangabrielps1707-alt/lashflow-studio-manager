import { addDays, differenceInCalendarDays, isSameDay, startOfDay } from "date-fns";

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

/**
 * Money still to come in from appointments inside a period: every appointment that
 * started between `from` (inclusive) and `to` (exclusive) and still has a balance open.
 * Cancelled and no-show appointments are not owed, and rows already fully paid are skipped.
 */
export function pendingReceivable<T extends { starts_at: string; status: string; price: number; amount_paid: number }>(
  rows: T[],
  from: Date,
  to: Date,
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const a of rows) {
    const when = new Date(a.starts_at);
    if (when < from || when >= to) continue;
    if (a.status === "cancelado" || a.status === "falta") continue;
    const due = balanceDue(a);
    if (due <= 0) continue;
    total += due;
    count++;
  }
  return { total: Math.round(total * 100) / 100, count };
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
  id: string;
  client_id: string;
  starts_at: string;
  status: string;
  procedure_id: string | null;
}

export interface MaintenanceDue {
  client_id: string;
  appointment_id: string;
  lastVisit: string;
  dueDate: Date;
  daysUntil: number; // negative = overdue
}

/** The reminder kinds a lash designer works through, one per appointment each. */
export type ReminderKind = "confirmacao" | "hoje" | "agradecimento" | "manutencao" | "vespera";

/** Timing of the WhatsApp reminders, as the studio asked for them. */
export const REMINDER_RULES = {
  /** Confirmation reminder starts this many days before the appointment. */
  confirmDaysBefore: 2,
  /** Maintenance invite comes this many days after the last completed visit. */
  maintenanceDays: 15,
  /** When true, each procedure's own maintenance interval wins over `maintenanceDays`. */
  maintenanceFromProcedure: false,
  /** Thank-you reminders stay on the list this many days after the visit. */
  thanksWindowDays: 7,
  /** Maintenance invites stop showing this many days after they became due. */
  maintenanceMaxOverdueDays: 30,
  /** Extra reminder on the eve of the appointment. */
  showEve: false,
} as const;

export const doneKey = (appointmentId: string, kind: ReminderKind) => `${appointmentId}:${kind}`;

type ApptLike = { id: string; starts_at: string; status: string };

/** Booked but not yet confirmed, starting within the next `confirmDaysBefore` days (not today). */
export function confirmationDue<T extends ApptLike>(rows: T[], now: Date, done: Set<string>, daysBefore: number = REMINDER_RULES.confirmDaysBefore): T[] {
  const t0 = startOfDay(now);
  return rows.filter((a) => {
    if (a.status !== "agendado" || done.has(doneKey(a.id, "confirmacao"))) return false;
    const diff = differenceInCalendarDays(new Date(a.starts_at), t0);
    return diff >= 1 && diff <= daysBefore;
  });
}

/** Same-day reminder: today's active appointments that haven't started yet. */
export function todayDue<T extends ApptLike>(rows: T[], now: Date, done: Set<string>): T[] {
  return rows.filter((a) => {
    if (a.status !== "agendado" && a.status !== "confirmado") return false;
    if (done.has(doneKey(a.id, "hoje"))) return false;
    const when = new Date(a.starts_at);
    return isSameDay(when, now) && when > now;
  });
}

/** Eve reminder: tomorrow's active appointments. */
export function eveDue<T extends ApptLike>(rows: T[], now: Date, done: Set<string>): T[] {
  const t0 = startOfDay(now);
  return rows.filter(
    (a) =>
      (a.status === "agendado" || a.status === "confirmado") &&
      !done.has(doneKey(a.id, "vespera")) &&
      differenceInCalendarDays(new Date(a.starts_at), t0) === 1,
  );
}

/** Thank-you reminder: completed visits from the last `windowDays` days not thanked yet. */
export function thanksDue<T extends ApptLike>(rows: T[], now: Date, done: Set<string>, windowDays: number = REMINDER_RULES.thanksWindowDays): T[] {
  const t0 = startOfDay(now);
  return rows.filter((a) => {
    if (a.status !== "concluido" || done.has(doneKey(a.id, "agradecimento"))) return false;
    const when = new Date(a.starts_at);
    if (when > now) return false;
    return differenceInCalendarDays(t0, when) <= windowDays;
  });
}

/**
 * A client gets a maintenance invite once her last completed visit is `intervalFor(...)` days old
 * (overdue up to `maxOverdueDays`), she has no upcoming active appointment, and the invite
 * for that visit wasn't sent yet.
 */
export function maintenanceDue(
  visits: VisitRow[],
  intervalFor: (procedureId: string | null) => number | null | undefined,
  today: Date,
  done: Set<string> = new Set(),
  maxOverdueDays: number = REMINDER_RULES.maintenanceMaxOverdueDays,
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
    if (hasUpcoming.has(clientId) || done.has(doneKey(v.id, "manutencao"))) continue;
    const interval = intervalFor(v.procedure_id);
    if (!interval) continue;
    const due = addDays(startOfDay(new Date(v.starts_at)), interval);
    const daysUntil = differenceInCalendarDays(due, t0);
    if (daysUntil <= 0 && daysUntil >= -maxOverdueDays) {
      out.push({ client_id: clientId, appointment_id: v.id, lastVisit: v.starts_at, dueDate: due, daysUntil });
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

// ---------- Estoque ----------

export const PRODUCT_CATEGORIES = ["Fios", "Cola", "Removedor", "Primer", "Pinças", "Descartáveis", "Higiene", "Outros"];
export const PRODUCT_UNITS = ["un", "caixa", "pacote", "frasco", "ml", "g", "par"];

/** How many days before the expiry date the app starts warning. */
export const EXPIRY_WARNING_DAYS = 30;

export interface StockItem {
  quantity: number;
  min_quantity: number;
  expires_on: string | null;
}

/** A product is low once it reaches its minimum. A minimum of 0 means "don't watch this one". */
export function isLowStock(p: Pick<StockItem, "quantity" | "min_quantity">): boolean {
  const min = Number(p.min_quantity);
  return min > 0 && Number(p.quantity) <= min;
}

/** Days until the expiry date (negative once expired), or null when the product has no expiry. */
export function daysUntilExpiry(expiresOn: string | null, today: Date): number | null {
  if (!expiresOn) return null;
  const [y = 1970, m = 1, d = 1] = expiresOn.split("-").map(Number);
  return differenceInCalendarDays(new Date(y, m - 1, d), startOfDay(today));
}

/** Expired or within the warning window — only products still in stock matter. */
export function isExpiringSoon(p: StockItem, today: Date, days = EXPIRY_WARNING_DAYS): boolean {
  const left = daysUntilExpiry(p.expires_on, today);
  return left !== null && left <= days && Number(p.quantity) > 0;
}

export function stockAlerts<T extends StockItem>(products: T[], today: Date) {
  const low = products.filter(isLowStock);
  const expiring = products
    .filter((p) => isExpiringSoon(p, today))
    .map((p) => ({ product: p, inDays: daysUntilExpiry(p.expires_on, today)! }))
    .sort((a, b) => a.inDays - b.inDays);
  return { low, expiring };
}

/** Quantity after a movement; null when an exit would take more than what is in stock. */
export function applyMovement(current: number, type: "entrada" | "saida", qty: number): number | null {
  const next = type === "entrada" ? Number(current) + qty : Number(current) - qty;
  return next < 0 ? null : Math.round(next * 1000) / 1000;
}
