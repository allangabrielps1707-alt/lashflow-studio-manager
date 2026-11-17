import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, isSameDay, startOfDay } from "date-fns";

import { birthdayWithin, maintenanceDue, type MaintenanceDue } from "@/lib/business";
import {
  clientsQuery,
  pendingPaymentsQuery,
  proceduresQuery,
  visitsQuery,
  type AppointmentWithClient,
  type Client,
} from "@/lib/queries";

export interface Reminders {
  toConfirm: AppointmentWithClient[];
  tomorrow: AppointmentWithClient[];
  unresolved: AppointmentWithClient[];
  maintenance: (MaintenanceDue & { client: Client })[];
  pending: AppointmentWithClient[];
  birthdays: { client: Client; inDays: number }[];
  total: number;
  ready: boolean;
}

export function useReminders(): Reminders {
  const visits = useQuery(visitsQuery);
  const clients = useQuery(clientsQuery);
  const procedures = useQuery(proceduresQuery);
  const pending = useQuery(pendingPaymentsQuery);

  return useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrowDate = addDays(today, 1);
    const in48h = new Date(now.getTime() + 48 * 3600_000);
    const all = visits.data ?? [];
    const clientList = clients.data ?? [];
    const byId = new Map(clientList.map((c) => [c.id, c]));

    const toConfirm = all.filter(
      (a) => a.status === "agendado" && new Date(a.starts_at) >= now && new Date(a.starts_at) <= in48h,
    );
    const tomorrow = all.filter(
      (a) => (a.status === "agendado" || a.status === "confirmado") && isSameDay(new Date(a.starts_at), tomorrowDate),
    );
    const unresolved = all.filter(
      (a) =>
        (a.status === "agendado" || a.status === "confirmado") &&
        new Date(a.starts_at).getTime() + a.duration_minutes * 60_000 < now.getTime(),
    );
    const intervals = Object.fromEntries((procedures.data ?? []).map((p) => [p.id, p.maintenance_days]));
    const maintenance = maintenanceDue(all, intervals, now)
      .map((m) => ({ ...m, client: byId.get(m.client_id)! }))
      .filter((m) => m.client);
    const birthdays = clientList
      .map((c) => ({ client: c, inDays: birthdayWithin(c.birthday, now, 7) }))
      .filter((b): b is { client: Client; inDays: number } => b.inDays !== null)
      .sort((a, b) => a.inDays - b.inDays);
    const pend = pending.data ?? [];

    return {
      toConfirm,
      tomorrow,
      unresolved,
      maintenance,
      pending: pend,
      birthdays,
      total: toConfirm.length + unresolved.length + maintenance.length + pend.length + birthdays.length,
      ready: !!visits.data && !!clients.data && !!procedures.data && !!pending.data,
    };
  }, [visits.data, clients.data, procedures.data, pending.data]);
}
