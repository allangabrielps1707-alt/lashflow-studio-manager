import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatCard } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { WhatsAppButton } from "@/components/app/whatsapp-button";
import { useAppointments } from "@/components/appointments/provider";
import { ClientForm } from "@/components/clients/client-form";
import { PhotoGallery } from "@/components/clients/photo-gallery";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { balanceDue } from "@/lib/business";
import { fmtDate, fmtTime, initials, money } from "@/lib/format";
import { buildMessage } from "@/lib/messages";
import { check, clientDetailQuery, profileQuery, refreshData } from "@/lib/queries";
import { formatPhone } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha da cliente — Lash Studio" },
      { name: "description", content: "Histórico de atendimentos, fotos e observações da cliente." },
      { property: "og:title", content: "Ficha da cliente — Lash Studio" },
      { property: "og:description", content: "Histórico de atendimentos, fotos e observações da cliente." },
    ],
  }),
  loader: ({ context: { queryClient }, params }) => queryClient.ensureQueryData(clientDetailQuery(params.id)),
  errorComponent: () => (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">Cliente não encontrada.</p>
      <Button asChild variant="soft" className="mt-4"><Link to="/clientes">Voltar</Link></Button>
    </div>
  ),
  notFoundComponent: () => <p className="py-16 text-center text-muted-foreground">Cliente não encontrada.</p>,
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openNew, openDetail } = useAppointments();
  const { data } = useSuspenseQuery(clientDetailQuery(id));
  const { data: profileData } = useQuery(profileQuery);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { client, appointments } = data;

  const done = appointments.filter((a) => a.status === "concluido");
  const spent = done.reduce((s, a) => s + Number(a.amount_paid), 0);
  const owed = done.reduce((s, a) => s + balanceDue(a), 0);
  const noShows = appointments.filter((a) => a.status === "falta").length;
  const cancels = appointments.filter((a) => a.status === "cancelado").length;
  const last = done[0];
  const upcoming = appointments
    .filter((a) => (a.status === "agendado" || a.status === "confirmado") && new Date(a.starts_at) >= new Date())
    .at(-1);

  async function remove() {
    try {
      check(await supabase.from("clients").delete().eq("id", client.id));
      await refreshData(qc);
      toast.success("Cliente excluída");
      navigate({ to: "/clientes", search: { nova: undefined } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div className="animate-rise">
      <Link to="/clientes" search={{ nova: undefined }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-accent font-display text-xl text-accent-foreground shadow-gold">
          {initials(client.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-light">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {formatPhone(client.phone) || "Sem telefone"}
            {client.birthday && ` · 🎂 ${fmtDate(client.birthday).slice(0, 5)}`}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant="gold" size="sm" onClick={() => openNew({ clientId: client.id })}>
          <CalendarPlus /> Agendar
        </Button>
        <WhatsAppButton size="sm" phone={client.phone} />
        {last && (
          <WhatsAppButton
            size="sm"
            label="Chamar p/ manutenção"
            phone={client.phone}
            message={buildMessage("maintenance", profileData?.profile, { clientName: client.name })}
          />
        )}
        <Button variant="glass" size="sm" onClick={() => setEditOpen(true)}><Pencil /> Editar</Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Atendimentos" value={done.length} hint={`${noShows} falta(s) · ${cancels} cancel.`} />
        <StatCard label="Total pago" value={money(spent)} tone="gold" />
        <StatCard label="Última visita" value={last ? fmtDate(last.starts_at) : "—"} hint={last?.procedure_name} />
        <StatCard
          label="Próximo"
          value={upcoming ? fmtDate(upcoming.starts_at) : "—"}
          hint={upcoming ? `${fmtTime(upcoming.starts_at)} · ${upcoming.procedure_name}` : owed > 0 ? `Deve ${money(owed)}` : undefined}
        />
      </div>

      {(client.allergies || client.notes) && (
        <div className="mb-6 grid gap-2 rounded-2xl border bg-surface p-4 text-sm">
          {client.allergies && (
            <p><span className="font-medium text-warning">Alergias:</span> {client.allergies}</p>
          )}
          {client.notes && <p className="whitespace-pre-wrap text-muted-foreground">{client.notes}</p>}
        </div>
      )}

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="mt-4">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>
          ) : (
            <ul className="grid gap-2">
              {appointments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(a.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 text-left shadow-soft hover:border-primary/40"
                  >
                    <div className="w-20 shrink-0">
                      <p className="font-display">{fmtDate(a.starts_at)}</p>
                      <p className="text-xs text-muted-foreground">{fmtTime(a.starts_at)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{a.procedure_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(a.price)}
                        {balanceDue(a) > 0 && a.status === "concluido" && ` · falta ${money(balanceDue(a))}`}
                        {a.reschedule_count > 0 && ` · remarcado ${a.reschedule_count}x`}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="fotos" className="mt-4">
          <PhotoGallery clientId={client.id} appointments={appointments} />
        </TabsContent>
      </Tabs>

      <Button variant="ghost" size="sm" className="mt-10 text-destructive" onClick={() => setConfirmDelete(true)}>
        <Trash2 /> Excluir cliente
      </Button>

      <ClientForm open={editOpen} onOpenChange={setEditOpen} editing={client} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os atendimentos e fotos dela também serão apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

