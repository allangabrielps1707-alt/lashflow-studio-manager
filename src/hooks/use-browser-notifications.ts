import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { fmtTime } from "@/lib/format";
import { visitsQuery } from "@/lib/queries";

export const NOTIFY_KEY = "lash.notify";
const LEAD_MINUTES = 60;

/** While the app is open, shows a device notification 1h before each upcoming appointment. */
export function useBrowserNotifications() {
  const { data } = useQuery(visitsQuery);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (localStorage.getItem(NOTIFY_KEY) !== "1" || Notification.permission !== "granted") return;
    const now = Date.now();
    const timers: number[] = [];
    for (const a of data ?? []) {
      if (a.status !== "agendado" && a.status !== "confirmado") continue;
      const at = new Date(a.starts_at).getTime() - LEAD_MINUTES * 60_000;
      const delay = at - now;
      if (delay < 0 || delay > 24 * 3600_000) continue;
      timers.push(
        window.setTimeout(() => {
          new Notification("Próximo atendimento", {
            body: `${a.client?.name ?? "Cliente"} às ${fmtTime(a.starts_at)} — ${a.procedure_name}`,
            icon: "/icon-512.png",
            tag: a.id,
          });
        }, delay),
      );
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [data]);
}
