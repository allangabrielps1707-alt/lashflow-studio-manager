import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { AppointmentDetail } from "./appointment-detail";
import { AppointmentForm, type AppointmentDefaults } from "./appointment-form";
import type { Appointment } from "@/lib/queries";

interface Ctx {
  openNew: (defaults?: AppointmentDefaults) => void;
  openEdit: (appt: Appointment) => void;
  openDetail: (id: string) => void;
}

const AppointmentsContext = createContext<Ctx | null>(null);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [defaults, setDefaults] = useState<AppointmentDefaults | undefined>();
  const [detailId, setDetailId] = useState<string | null>(null);

  const openNew = useCallback((d?: AppointmentDefaults) => {
    setEditing(null);
    setDefaults(d);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback((appt: Appointment) => {
    setDetailId(null);
    setEditing(appt);
    setFormOpen(true);
  }, []);
  const openDetail = useCallback((id: string) => setDetailId(id), []);

  const value = useMemo(() => ({ openNew, openEdit, openDetail }), [openNew, openEdit, openDetail]);

  return (
    <AppointmentsContext.Provider value={value}>
      {children}
      <AppointmentForm open={formOpen} onOpenChange={setFormOpen} editing={editing} defaults={defaults} />
      <AppointmentDetail id={detailId} onOpenChange={(o) => !o && setDetailId(null)} onEdit={openEdit} />
    </AppointmentsContext.Provider>
  );
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error("useAppointments must be used inside AppointmentsProvider");
  return ctx;
}
