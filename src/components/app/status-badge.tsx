import { Badge } from "@/components/ui/badge";
import { STATUS_META, type AppointmentStatus } from "@/lib/business";

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as AppointmentStatus] ?? STATUS_META.agendado;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
