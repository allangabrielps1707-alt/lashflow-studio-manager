import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  CheckCheck,
  CircleCheck,
  Clock,
  HandCoins,
  Pencil,
  RotateCcw,
  Trash2,
  UserRound,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { WhatsAppButton } from "@/components/app/whatsapp-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { balanceDue, PAYMENT_METHODS } from "@/lib/business";
import { capitalize, combineLocal, durationLabel, fmtDate, fmtDateTime, fmtDayLong, fmtTime, isoDay, money } from "@/lib/format";
import { buildMessage } from "@/lib/messages";
import { appointmentQuery, check, profileQuery, refreshData, type Appointment } from "@/lib/queries";

const EVENT_LABEL: Record<string, string> = {
  criado: "Agendamento criado",
  confirmado: "Confirmado",
  concluido: "Atendimento concluído",
  cancelado: "Cancelado",
  falta: "Cliente faltou",
  remarcado: "Remarcado",
  reaberto: "Reaberto",
};

type SubDialog = null | "pay" | "reschedule" | "cancel" | "noshow" | "delete";

export function AppointmentDetail({
  id,
  onOpenChange,
  onEdit,
}: {
  id: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (appt: Appointment) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ ...appointmentQuery(id ?? ""), enabled: !!id });
  const { data: profileData } = useQuery(profileQuery);
  const [dialog, setDialog] = useState<SubDialog>(null);
  const [busy, setBusy] = useState(false);

  // sub-dialog fields
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Pix");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(false);

  const appt = data?.appt;
  const balance = appt ? balanceDue(appt) : 0;
  const profile = profileData?.profile;

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await refreshData(qc);
      toast.success(ok);
      setDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string, extra: Record<string, unknown> = {}, note?: string) {
    if (!appt) return;
    check(await supabase.from("appointments").update({ status, ...extra }).eq("id", appt.id));
    check(
      await supabase.from("appointment_events").insert({
        appointment_id: appt.id,
        event_type: status === "agendado" ? "reaberto" : status,
        note: note ?? null,
      }),
    );
  }

  function openPay() {
    setAmount(String(balance || ""));
    setMethod(appt?.payment_method ?? "Pix");
    setDialog("pay");
  }

  const conclude = () =>
    run(async () => {
      await setStatus("concluido");
    }, "Atendimento concluído").then(() => {
      if (balance > 0) openPay();
    });

  const pay = () =>
    run(async () => {
      if (!appt) return;
      const v = Number(amount);
      if (!v || v <= 0) throw new Error("Informe um valor");
      check(
        await supabase.from("transactions").insert({
          type: "receita",
          category: "Atendimento",
          amount: v,
          payment_method: method,
          description: `${appt.procedure_name} — ${appt.client?.name ?? ""}`,
          appointment_id: appt.id,
        }),
      );
    }, "Pagamento registrado");

  const reschedule = () =>
    run(async () => {
      if (!appt) return;
      const to = combineLocal(newDate, newTime);
      check(
        await supabase
          .from("appointments")
          .update({ starts_at: to, status: "agendado", reschedule_count: appt.reschedule_count + 1 })
          .eq("id", appt.id),
      );
      check(
        await supabase.from("appointment_events").insert({
          appointment_id: appt.id,
          event_type: "remarcado",
          from_starts_at: appt.starts_at,
          to_starts_at: to,
          note: reason.trim() || null,
        }),
      );
    }, "Atendimento remarcado");

  const cancel = () =>
    run(async () => {
      if (!appt) return;
      await setStatus("cancelado", { cancel_reason: reason.trim() || null }, reason.trim() || undefined);
      if (refund && appt.amount_paid > 0) {
        check(
          await supabase.from("transactions").insert({
            type: "despesa",
            category: "Reembolso de sinal",
            amount: appt.amount_paid,
            description: `Reembolso — ${appt.client?.name ?? ""}`,
            appointment_id: appt.id,
            payment_method: appt.payment_method,
          }),
        );
      }
    }, "Atendimento cancelado");

  const remove = () =>
    run(async () => {
      if (!appt) return;
      check(await supabase.from("appointments").delete().eq("id", appt.id));
      onOpenChange(false);
    }, "Agendamento excluído");

  const isActive = appt && (appt.status === "agendado" || appt.status === "confirmado");

  return (
    <>
      <Sheet open={!!id} onOpenChange={onOpenChange}>
        <SheetContent side="bottom">
          {isLoading || !appt ? (
            <div className="py-16 text-center text-muted-foreground">Carregando…</div>
          ) : (
            <div className="grid gap-5">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2">
                  <StatusBadge status={appt.status} />
                  {appt.reschedule_count > 0 && (
                    <span className="text-xs text-muted-foreground">Remarcado {appt.reschedule_count}x</span>
                  )}
                </div>
                <SheetTitle className="font-display text-2xl font-light">{appt.client?.name}</SheetTitle>
                <SheetDescription className="text-base">
                  {appt.procedure_name} · {capitalize(fmtDayLong(appt.starts_at))}
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Info label="Horário" value={fmtTime(appt.starts_at)} />
                <Info label="Duração" value={durationLabel(appt.duration_minutes)} />
                <Info label="Valor" value={money(appt.price)} />
                <Info label="Sinal" value={money(appt.deposit)} />
                <Info label="Pago" value={money(appt.amount_paid)} />
                <Info label="A receber" value={money(balance)} highlight={balance > 0} />
              </div>

              {(appt.payment_method || appt.notes || appt.cancel_reason) && (
                <div className="grid gap-1.5 rounded-2xl border bg-surface p-4 text-sm">
                  {appt.payment_method && <p><span className="text-muted-foreground">Pagamento:</span> {appt.payment_method}</p>}
                  {appt.notes && <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Obs.:</span> {appt.notes}</p>}
                  {appt.cancel_reason && <p><span className="text-muted-foreground">Motivo:</span> {appt.cancel_reason}</p>}
                </div>
              )}

              {/* Primary actions */}
              <div className="grid grid-cols-2 gap-2">
                {appt.status === "agendado" && (
                  <Button variant="soft" disabled={busy} onClick={() => run(() => setStatus("confirmado"), "Horário confirmado")}>
                    <CheckCheck /> Confirmar
                  </Button>
                )}
                {isActive && (
                  <Button variant="gold" disabled={busy} onClick={conclude}>
                    <CircleCheck /> Concluir
                  </Button>
                )}
                {balance > 0 && appt.status !== "cancelado" && (
                  <Button variant="soft" onClick={openPay}>
                    <HandCoins /> Receber
                  </Button>
                )}
                {appt.status !== "concluido" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewDate(isoDay(new Date(appt.starts_at)));
                      setNewTime(fmtTime(appt.starts_at));
                      setReason("");
                      setDialog("reschedule");
                    }}
                  >
                    <CalendarClock /> Remarcar
                  </Button>
                )}
                {isActive && (
                  <>
                    <Button variant="outline" onClick={() => setDialog("noshow")}>
                      <UserX /> Faltou
                    </Button>
                    <Button variant="outline" onClick={() => { setReason(""); setRefund(false); setDialog("cancel"); }}>
                      <Ban /> Cancelar
                    </Button>
                  </>
                )}
                {(appt.status === "cancelado" || appt.status === "falta") && (
                  <Button variant="outline" disabled={busy} onClick={() => run(() => setStatus("agendado"), "Atendimento reaberto")}>
                    <RotateCcw /> Reabrir
                  </Button>
                )}
              </div>

              {/* WhatsApp */}
              <div className="grid gap-2">
                <p className="eyebrow">WhatsApp</p>
                <div className="flex flex-wrap gap-2">
                  {isActive && (
                    <>
                      <WhatsAppButton size="sm" label="Confirmar horário" phone={appt.client?.phone}
                        message={buildMessage("confirmation", profile, { clientName: appt.client?.name ?? "", startsAt: appt.starts_at, procedure: appt.procedure_name })} />
                      <WhatsAppButton size="sm" label="Lembrete" phone={appt.client?.phone}
                        message={buildMessage("reminder", profile, { clientName: appt.client?.name ?? "", startsAt: appt.starts_at, procedure: appt.procedure_name })} />
                    </>
                  )}
                  {appt.status === "concluido" && (
                    <WhatsAppButton size="sm" label="Agradecer" phone={appt.client?.phone}
                      message={buildMessage("thanks", profile, { clientName: appt.client?.name ?? "" })} />
                  )}
                  {!isActive && appt.status !== "concluido" && (
                    <WhatsAppButton size="sm" label="Abrir conversa" phone={appt.client?.phone} />
                  )}
                </div>
              </div>

              {/* History */}
              {(data.payments.length > 0 || data.events.length > 0) && (
                <div className="grid gap-2">
                  <p className="eyebrow">Histórico</p>
                  <ul className="grid gap-2 text-sm">
                    {data.payments.map((p) => (
                      <li key={p.id} className="flex justify-between rounded-xl bg-surface px-3 py-2">
                        <span>{p.category} · {fmtDate(p.occurred_on)}{p.payment_method ? ` · ${p.payment_method}` : ""}</span>
                        <span className={p.type === "receita" ? "text-success" : "text-destructive"}>
                          {p.type === "receita" ? "+" : "−"}{money(p.amount)}
                        </span>
                      </li>
                    ))}
                    {data.events.map((ev) => (
                      <li key={ev.id} className="flex items-start gap-2 px-1 text-muted-foreground">
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {EVENT_LABEL[ev.event_type] ?? ev.event_type} · {fmtDateTime(ev.created_at)}
                          {ev.from_starts_at && ev.to_starts_at && ` (de ${fmtDateTime(ev.from_starts_at)} para ${fmtDateTime(ev.to_starts_at)})`}
                          {ev.note && ` — ${ev.note}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/clientes/$id" params={{ id: appt.client_id }} onClick={() => onOpenChange(false)}>
                    <UserRound /> Ficha da cliente
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(appt)}>
                  <Pencil /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog("delete")}>
                  <Trash2 /> Excluir
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment */}
      <Dialog open={dialog === "pay"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display font-light text-xl">Registrar pagamento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pay-amount">Valor (R$)</Label>
              <Input id="pay-amount" type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="gold" disabled={busy} onClick={pay}>Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule */}
      <Dialog open={dialog === "reschedule"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display font-light text-xl">Remarcar atendimento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label htmlFor="rs-date">Nova data</Label><Input id="rs-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="rs-time">Horário</Label><Input id="rs-time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} /></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="rs-reason">Motivo (opcional)</Label><Input id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <Button variant="gold" disabled={busy || !newDate || !newTime} onClick={reschedule}>Remarcar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display font-light text-xl">Cancelar atendimento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label htmlFor="cc-reason">Motivo</Label><Textarea id="cc-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            {appt && appt.amount_paid > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={refund} onCheckedChange={(v) => setRefund(!!v)} />
                Devolver {money(appt.amount_paid)} pagos (senão o sinal fica retido)
              </label>
            )}
            <Button variant="destructive" disabled={busy} onClick={cancel}>Confirmar cancelamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "noshow"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como falta?</AlertDialogTitle>
            <AlertDialogDescription>O sinal pago continua registrado como receita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => setStatus("falta"), "Falta registrada")}>Marcar falta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele some da agenda e dos relatórios. Para manter o histórico, prefira “Cancelar”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-2xl border border-primary/30 bg-accent p-2.5" : "rounded-2xl border bg-surface p-2.5"}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={highlight ? "mt-0.5 font-display text-base text-gold" : "mt-0.5 font-display text-base"}>{value}</p>
    </div>
  );
}
