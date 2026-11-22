import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(value: number | string | null | undefined): string {
  return brl.format(Number(value ?? 0));
}

export function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

export function fmt(value: string | Date, pattern: string): string {
  return format(toDate(value), pattern, { locale: ptBR });
}

export const fmtDate = (v: string | Date) => fmt(v, "dd/MM/yyyy");
export const fmtTime = (v: string | Date) => fmt(v, "HH:mm");
export const fmtDayLong = (v: string | Date) => fmt(v, "EEEE, d 'de' MMMM");
export const fmtDateTime = (v: string | Date) => fmt(v, "dd/MM 'às' HH:mm");

/** yyyy-MM-dd in local time */
export const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

/** Combine a local date (yyyy-MM-dd) and time (HH:mm) into an ISO timestamp. */
export function combineLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
export const fmtQty = (v: number | string | null | undefined) => qty.format(Number(v ?? 0));
