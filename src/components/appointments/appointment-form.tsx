import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import { AlertTriangle, Check, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { findOverlap, PAYMENT_METHODS } from "@/lib/business";
import { combineLocal, durationLabel, fmtTime, isoDay, money } from "@/lib/format";
import {
  appointmentsRangeQuery,
  check,
  clientsQuery,
  proceduresQuery,
  refreshData,
  type Appointment,
  type Client,
} from "@/lib/queries";
import { formatPhone } from "@/lib/whatsapp";

export interface AppointmentDefaults {
  date?: string; // yyyy-MM-dd
  time?: string; // HH:mm
  clientId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Appointment | null;
  defaults?: AppointmentDefaults | undefined;
}

const NONE = "__none__";

export function AppointmentForm({ open, onOpenChange, editing, defaults }: Props) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ ...clientsQuery, enabled: open });
  const { data: procedures = [] } = useQuery({ ...proceduresQuery, enabled: open });

  const [client, setClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [newClient, setNewClient] = useState(false);
  const [phone, setPhone] = useState("");
  const [procedureId, setProcedureId] = useState<string>(NONE);
  const [procedureName, setProcedureName] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("120");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<string>("Pix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // reset when opening
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.starts_at);
      setDate(isoDay(d));
      setTime(fmtTime(d));
      setProcedureId(editing.procedure_id ?? NONE);
      setProcedureName(editing.procedure_name);
      setDuration(String(editing.duration_minutes));
      setPrice(String(editing.price));
      setDeposit(String(editing.deposit));
      setMethod(editing.payment_method ?? "Pix");
      setNotes(editing.notes ?? "");
    } else {
      setDate(defaults?.date ?? isoDay(new Date()));
      setTime(defaults?.time ?? "09:00");
      setProcedureId(NONE);
      setProcedureName("");
      setDuration("120");
      setPrice("");
      setDeposit("");
      setMethod("Pix");
      setNotes("");
    }
    setSearch("");
    setNewClient(false);
    setClient(null);
    setPhone("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // attach the client once the list arrives
  useEffect(() => {
    if (!open || client) return;
    const id = editing?.client_id ?? defaults?.clientId;
    if (!id) return;
    const found = clients.find((c) => c.id === id);
    if (found) {
      setClient(found);
      setPhone(found.phone ?? "");
    }
  }, [open, clients, editing?.client_id, defaults?.clientId, client]);

  const dayStart = useMemo(() => startOfDay(new Date(`${date}T00:00:00`)), [date]);
  const { data: dayAppointments = [] } = useQuery({
    ...appointmentsRangeQuery(dayStart, addDays(dayStart, 1)),
    enabled: open && !!date,
  });

  const overlap = useMemo(() => {
    if (!date || !time) return undefined;
    return findOverlap(dayAppointments, new Date(`${date}T${time}:00`), Number(duration) || 0, editing?.id);
  }, [dayAppointments, date, time, duration, editing?.id]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 6);
    const digits = q.replace(/\D/g, "");
    return clients
      .filter((c) => c.name.toLowerCase().includes(q) || (digits && c.phone?.replace(/\D/g, "").includes(digits)))
      .slice(0, 6);
  }, [clients, search]);

  const activeProcedures = procedures.filter((p) => p.active || p.id === procedureId);

  function pickProcedure(id: string) {
    setProcedureId(id);
    const p = procedures.find((x) => x.id === id);
    if (p) {
      setProcedureName(p.name);
      setDuration(String(p.duration_minutes));
      setPrice(String(p.price));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = newClient ? search.trim() : client?.name;
    if (!name) {
      toast.error("Selecione ou cadastre a cliente");
      return;
    }
    if (!procedureName.trim()) {
      toast.error("Informe o procedimento");
      return;
    }
    setSaving(true);
    try {
      let clientId = client?.id;
      if (newClient || !clientId) {
        const created = check(
          await supabase.from("clients").insert({ name, phone: phone || null }).select("*").single(),
        ) as Client;
        clientId = created.id;
      } else if ((client?.phone ?? "") !== phone) {
        check(await supabase.from("clients").update({ phone: phone || null }).eq("id", clientId));
      }

      const startsAt = combineLocal(date, time);
      const payload = {
        client_id: clientId,
        procedure_id: procedureId === NONE ? null : procedureId,
        procedure_name: procedureName.trim(),
        starts_at: startsAt,
        duration_minutes: Number(duration) || 60,
        price: Number(price) || 0,
        payment_method: method,
        notes: notes.trim() || null,
      };

      if (editing) {
        const moved = new Date(editing.starts_at).getTime() !== new Date(startsAt).getTime();
        check(
          await supabase
            .from("appointments")
            .update({
              ...payload,
              ...(moved ? { reschedule_count: editing.reschedule_count + 1 } : {}),
            })
            .eq("id", editing.id),
        );
        if (moved) {
          check(
            await supabase.from("appointment_events").insert({
              appointment_id: editing.id,
              event_type: "remarcado",
              from_starts_at: editing.starts_at,
              to_starts_at: startsAt,
            }),
          );
        }
        toast.success("Agendamento atualizado");
      } else {
        const dep = Number(deposit) || 0;
        const appt = check(
          await supabase
            .from("appointments")
            .insert({ ...payload, deposit: dep, status: "agendado" })
            .select("id")
            .single(),
        ) as { id: string };
        if (dep > 0) {
          check(
            await supabase.from("transactions").insert({
              type: "receita",
              category: "Sinal",
              amount: dep,
              description: `Sinal — ${name}`,
              payment_method: method,
              appointment_id: appt.id,
            }),
          );
        }
        check(await supabase.from("appointment_events").insert({ appointment_id: appt.id, event_type: "criado" }));
        toast.success("Agendamento criado");
      }
      await refreshData(qc);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl font-light">
            {editing ? "Editar agendamento" : "Novo agendamento"}
          </SheetTitle>
          <SheetDescription>Preencha os dados do atendimento.</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          {/* Client */}
          <div className="grid gap-1.5">
            <Label>Cliente</Label>
            {client && !newClient ? (
              <div className="flex items-center justify-between rounded-xl border bg-surface px-3.5 py-2.5">
                <div>
                  <p className="font-medium">{client.name}</p>
                  {client.phone && <p className="text-xs text-muted-foreground">{formatPhone(client.phone)}</p>}
                </div>
                {!editing && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setClient(null); setPhone(""); }} aria-label="Trocar cliente">
                    <X />
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar ou digitar nome da cliente"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setNewClient(false); }}
                  autoComplete="off"
                />
                {!newClient && (
                  <div className="grid gap-1">
                    {matches.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => { setClient(c); setPhone(c.phone ?? ""); }}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">{formatPhone(c.phone)}</span>
                      </button>
                    ))}
                    {search.trim().length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewClient(true)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-accent"
                      >
                        <UserPlus className="h-4 w-4" /> Cadastrar “{search.trim()}” como nova cliente
                      </button>
                    )}
                  </div>
                )}
                {newClient && (
                  <p className="flex items-center gap-1.5 text-xs text-success">
                    <Check className="h-3.5 w-3.5" /> Nova cliente será cadastrada
                  </p>
                )}
              </>
            )}
          </div>

          {(client || newClient) && (
            <div className="grid gap-1.5">
              <Label htmlFor="ap-phone">Telefone / WhatsApp</Label>
              <Input id="ap-phone" type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}

          {/* Procedure */}
          <div className="grid gap-1.5">
            <Label>Procedimento</Label>
            {activeProcedures.length > 0 && (
              <Select value={procedureId} onValueChange={pickProcedure}>
                <SelectTrigger><SelectValue placeholder="Escolha um procedimento" /></SelectTrigger>
                <SelectContent>
                  {activeProcedures.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {money(p.price)} · {durationLabel(p.duration_minutes)}
                    </SelectItem>
                  ))}
                  <SelectItem value={NONE}>Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
            )}
            {(procedureId === NONE || activeProcedures.length === 0) && (
              <Input placeholder="Ex.: Volume russo" value={procedureName} onChange={(e) => setProcedureName(e.target.value)} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ap-date">Data</Label>
              <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-time">Horário</Label>
              <Input id="ap-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          {overlap && (
            <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Conflito com {overlap.client?.name ?? "outro atendimento"} às {fmtTime(overlap.starts_at)}.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ap-dur">Duração (min)</Label>
              <Input id="ap-dur" type="number" inputMode="numeric" min={10} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-price">Valor (R$)</Label>
              <Input id="ap-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ap-dep">Sinal pago (R$)</Label>
              <Input
                id="ap-dep"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={deposit}
                disabled={!!editing}
                onChange={(e) => setDeposit(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editing && (
            <p className="-mt-2 text-xs text-muted-foreground">Pagamentos e sinais são registrados nos detalhes do atendimento.</p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="ap-notes">Observações</Label>
            <Textarea id="ap-notes" placeholder="Curvatura, espessura, mapping, preferências…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button type="submit" variant="gold" size="lg" disabled={saving}>
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Agendar"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
