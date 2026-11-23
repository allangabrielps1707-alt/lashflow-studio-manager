import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isoDay } from "@/lib/format";

export type Client = Tables<"clients">;
export type Procedure = Tables<"procedures">;
export type Appointment = Tables<"appointments">;
export type Transaction = Tables<"transactions">;
export type Profile = Tables<"profiles">;
export type ClientPhoto = Tables<"client_photos">;
export type AppointmentEvent = Tables<"appointment_events">;
export type Product = Tables<"products">;
export type StockMovement = Tables<"stock_movements">;
export type ReminderLog = Tables<"reminder_logs">;
export type AppointmentWithClient = Appointment & {
  client: Pick<Client, "id" | "name" | "phone"> | null;
};

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error("Sessão expirada");
    const res = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    let profile = check(res);
    if (!profile) {
      profile = check(
        await supabase
          .from("profiles")
          .insert({ id: user.id, full_name: (user.user_metadata?.["full_name"] as string | undefined) ?? null })
          .select("*")
          .single(),
      );
    }
    return { profile: profile as Profile, email: user.email ?? "" };
  },
});

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: async () =>
    check(await supabase.from("clients").select("*").order("name")) as Client[],
});

export const proceduresQuery = queryOptions({
  queryKey: ["procedures"],
  queryFn: async () =>
    check(
      await supabase.from("procedures").select("*").order("category").order("name"),
    ) as Procedure[],
});

const APPT_SELECT = "*, client:clients(id,name,phone)";

export const appointmentsRangeQuery = (from: Date, to: Date) =>
  queryOptions({
    queryKey: ["appointments", "range", from.toISOString(), to.toISOString()],
    queryFn: async () =>
      check(
        await supabase
          .from("appointments")
          .select(APPT_SELECT)
          .gte("starts_at", from.toISOString())
          .lt("starts_at", to.toISOString())
          .order("starts_at"),
      ) as unknown as AppointmentWithClient[],
  });

export const appointmentQuery = (id: string) =>
  queryOptions({
    queryKey: ["appointments", "one", id],
    queryFn: async () => {
      const appt = check(
        await supabase.from("appointments").select(APPT_SELECT).eq("id", id).single(),
      ) as unknown as AppointmentWithClient;
      const events = check(
        await supabase
          .from("appointment_events")
          .select("*")
          .eq("appointment_id", id)
          .order("created_at", { ascending: false }),
      ) as AppointmentEvent[];
      const payments = check(
        await supabase
          .from("transactions")
          .select("*")
          .eq("appointment_id", id)
          .order("created_at"),
      ) as Transaction[];
      return { appt, events, payments };
    },
  });

export const pendingPaymentsQuery = queryOptions({
  queryKey: ["appointments", "pending"],
  queryFn: async () =>
    check(
      await supabase
        .from("appointments")
        .select(APPT_SELECT)
        .eq("status", "concluido")
        .gt("balance", 0)
        .order("starts_at", { ascending: false }),
    ) as unknown as AppointmentWithClient[],
});

export const transactionsRangeQuery = (from: Date, to: Date) =>
  queryOptions({
    queryKey: ["transactions", isoDay(from), isoDay(to)],
    queryFn: async () =>
      check(
        await supabase
          .from("transactions")
          .select("*")
          .gte("occurred_on", isoDay(from))
          .lt("occurred_on", isoDay(to))
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as Transaction[],
  });

/** Visits from the last ~13 months plus all future ones — used for reminders. */
export const visitsQuery = queryOptions({
  queryKey: ["appointments", "visits"],
  queryFn: async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 13);
    return check(
      await supabase
        .from("appointments")
        .select(APPT_SELECT)
        .gte("starts_at", since.toISOString())
        .order("starts_at"),
    ) as unknown as AppointmentWithClient[];
  },
});

export const clientDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["clients", id],
    queryFn: async () => {
      const client = check(
        await supabase.from("clients").select("*").eq("id", id).single(),
      ) as Client;
      const appointments = check(
        await supabase
          .from("appointments")
          .select("*")
          .eq("client_id", id)
          .order("starts_at", { ascending: false }),
      ) as Appointment[];
      return { client, appointments };
    },
  });

export const clientPhotosQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["photos", clientId],
    queryFn: async () => {
      const rows = check(
        await supabase
          .from("client_photos")
          .select("*")
          .eq("client_id", clientId)
          .order("taken_on", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as ClientPhoto[];
      if (!rows.length) return [] as (ClientPhoto & { url: string })[];
      const { data, error } = await supabase.storage
        .from("client-photos")
        .createSignedUrls(
          rows.map((r) => r.storage_path),
          60 * 60,
        );
      if (error) throw new Error(error.message);
      return rows.map((r, i) => ({ ...r, url: data?.[i]?.signedUrl ?? "" }));
    },
  });

/** Reminders already sent or dismissed in the last ~60 days. */
export const reminderLogsQuery = queryOptions({
  queryKey: ["reminder_logs"],
  queryFn: async () => {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    return check(
      await supabase.from("reminder_logs").select("appointment_id, kind").gte("done_at", since.toISOString()),
    ) as Pick<ReminderLog, "appointment_id" | "kind">[];
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () =>
    check(await supabase.from("products").select("*").order("name")) as Product[],
});

export const productMovementsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", "movements", productId],
    queryFn: async () =>
      check(
        await supabase
          .from("stock_movements")
          .select("*")
          .eq("product_id", productId)
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50),
      ) as StockMovement[],
  });

/** Data changes ripple across dashboard, agenda, finance and reminders — refresh them all. */
export function refreshData(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["appointments"] }),
    qc.invalidateQueries({ queryKey: ["transactions"] }),
    qc.invalidateQueries({ queryKey: ["clients"] }),
    qc.invalidateQueries({ queryKey: ["photos"] }),
    qc.invalidateQueries({ queryKey: ["products"] }),
  ]);
}

export { check };
