import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  REMINDER_RULES,
  birthdayWithin,
  confirmationDue,
  doneKey,
  eveDue,
  maintenanceDue,
  stockAlerts,
  thanksDue,
  todayDue,
  type MaintenanceDue,
  type ReminderKind,
} from "@/lib/business";
import {
  clientsQuery,
  pendingPaymentsQuery,
  proceduresQuery,
  productsQuery,
  reminderLogsQuery,
  visitsQuery,
  type AppointmentWithClient,
  type Client,
  type Product,
} from "@/lib/queries";

export interface Reminders {
  /** Confirmation, 2 days ahead. */
  toConfirm: AppointmentWithClient[];
  /** Same-day reminder. */
  today: AppointmentWithClient[];
  /** Eve reminder (off unless REMINDER_RULES.showEve). */
  tomorrow: AppointmentWithClient[];
  thanks: AppointmentWithClient[];
  unresolved: AppointmentWithClient[];
  maintenance: (MaintenanceDue & { client: Client })[];
  pending: AppointmentWithClient[];
  birthdays: { client: Client; inDays: number }[];
  lowStock: Product[];
  expiring: { product: Product; inDays: number }[];
  total: number;
  ready: boolean;
}

export function useReminders(): Reminders {
  const visits = useQuery(visitsQuery);
  const clients = useQuery(clientsQuery);
  const procedures = useQuery(proceduresQuery);
  const pending = useQuery(pendingPaymentsQuery);
  const products = useQuery(productsQuery);
  const logs = useQuery(reminderLogsQuery);

  return useMemo(() => {
    const now = new Date();
    const all = visits.data ?? [];
    const clientList = clients.data ?? [];
    const byId = new Map(clientList.map((c) => [c.id, c]));
    const done = new Set((logs.data ?? []).map((l) => doneKey(l.appointment_id, l.kind as ReminderKind)));

    const toConfirm = confirmationDue(all, now, done);
    const today = todayDue(all, now, done);
    const tomorrow = REMINDER_RULES.showEve ? eveDue(all, now, done) : [];
    const thanks = thanksDue(all, now, done).reverse();
    const unresolved = all.filter(
      (a) =>
        (a.status === "agendado" || a.status === "confirmado") &&
        new Date(a.starts_at).getTime() + a.duration_minutes * 60_000 < now.getTime(),
    );
    const intervals = new Map((procedures.data ?? []).map((p) => [p.id, p.maintenance_days]));
    const intervalFor = (procedureId: string | null) =>
      REMINDER_RULES.maintenanceFromProcedure
        ? (procedureId ? intervals.get(procedureId) : null) ?? REMINDER_RULES.maintenanceDays
        : REMINDER_RULES.maintenanceDays;
    const maintenance = maintenanceDue(all, intervalFor, now, done)
      .map((m) => ({ ...m, client: byId.get(m.client_id)! }))
      .filter((m) => m.client);
    const birthdays = clientList
      .map((c) => ({ client: c, inDays: birthdayWithin(c.birthday, now, 7) }))
      .filter((b): b is { client: Client; inDays: number } => b.inDays !== null)
      .sort((a, b) => a.inDays - b.inDays);
    const pend = pending.data ?? [];
    const stock = stockAlerts(products.data ?? [], now);

    return {
      toConfirm,
      today,
      tomorrow,
      thanks,
      unresolved,
      maintenance,
      pending: pend,
      birthdays,
      lowStock: stock.low,
      expiring: stock.expiring,
      total:
        toConfirm.length +
        today.length +
        tomorrow.length +
        thanks.length +
        unresolved.length +
        maintenance.length +
        pend.length +
        birthdays.length +
        stock.low.length +
        stock.expiring.length,
      ready:
        !!visits.data && !!clients.data && !!procedures.data && !!pending.data && !!products.data && !!logs.data,
    };
  }, [visits.data, clients.data, procedures.data, pending.data, products.data, logs.data]);
}

/** Ticks a reminder off so it leaves the list (after sending on WhatsApp, or by hand). */
export function useMarkReminder() {
  const qc = useQueryClient();
  return useCallback(
    async (appointmentId: string, kind: ReminderKind) => {
      const { error } = await supabase
        .from("reminder_logs")
        .upsert({ appointment_id: appointmentId, kind }, { onConflict: "appointment_id,kind", ignoreDuplicates: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["reminder_logs"] });
    },
    [qc],
  );
}
