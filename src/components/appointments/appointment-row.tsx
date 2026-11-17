import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { durationLabel, fmtTime } from "@/lib/format";
import type { AppointmentWithClient } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useAppointments } from "./provider";

export function AppointmentRow({
  appt,
  showDate,
  className,
}: {
  appt: AppointmentWithClient;
  showDate?: (iso: string) => string;
  className?: string;
}) {
  const { openDetail } = useAppointments();
  const muted = appt.status === "cancelado" || appt.status === "falta";
  return (
    <button
      type="button"
      onClick={() => openDetail(appt.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 text-left shadow-soft transition hover:border-primary/40",
        muted && "opacity-60",
        className,
      )}
    >
      <div className="w-14 shrink-0 text-center">
        <p className="font-display text-lg leading-none">{fmtTime(appt.starts_at)}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {showDate ? showDate(appt.starts_at) : durationLabel(appt.duration_minutes)}
        </p>
      </div>
      <span className="h-10 w-px bg-gold opacity-60" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{appt.client?.name ?? "Cliente"}</p>
        <p className="truncate text-sm text-muted-foreground">{appt.procedure_name}</p>
      </div>
      <StatusBadge status={appt.status} />
      <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}
