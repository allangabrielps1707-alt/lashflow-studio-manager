import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BellRing, DatabaseBackup, FileSpreadsheet, LogOut, MessageCircle, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Section } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NOTIFY_KEY } from "@/hooks/use-browser-notifications";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile, toCsv } from "@/lib/backup";
import { REMINDER_RULES, STATUS_META, type AppointmentStatus } from "@/lib/business";
import { fmt, isoDay } from "@/lib/format";
import { buildMessage, type MessageKind } from "@/lib/messages";
import { check, profileQuery, type Appointment, type Profile } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — Lash Studio" },
      { name: "description", content: "Perfil do estúdio, mensagens do WhatsApp, avisos no celular e backup dos dados." },
      { property: "og:title", content: "Ajustes — Lash Studio" },
      { property: "og:description", content: "Perfil, mensagens, avisos e backup dos dados." },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(profileQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(profileQuery);
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Configurações" title="Ajustes" />
      <ProfileCard profile={data.profile} email={data.email} />
      <MessagesCard profile={data.profile} />
      <NotificationsCard />
      <BackupCard />
      <AccountCard />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card-gradient p-4 shadow-soft md:p-5">{children}</div>;
}

function Title({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {children}
    </span>
  );
}

function useSaveProfile() {
  const qc = useQueryClient();
  return async (id: string, patch: Partial<Profile>) => {
    check(await supabase.from("profiles").update(patch).eq("id", id).select("id").single());
    await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
  };
}

function ProfileCard({ profile, email }: { profile: Profile; email: string }) {
  const save = useSaveProfile();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [business, setBusiness] = useState(profile.business_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save(profile.id, {
        full_name: fullName.trim() || null,
        business_name: business.trim() || null,
        phone: phone.trim() || null,
      });
      toast.success("Perfil salvo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={<Title icon={UserRound}>Seu perfil</Title>}>
      <Card>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="full_name">Seu nome</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: Ana Souza" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="business">Nome do estúdio</Label>
            <Input id="business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ex.: Ana Lash Studio" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="grid gap-1.5">
            <Label>E-mail de acesso</Label>
            <Input value={email} disabled />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="gold" disabled={saving}>
              {saving ? "Salvando…" : "Salvar perfil"}
            </Button>
          </div>
        </form>
      </Card>
    </Section>
  );
}

const TEMPLATES: { kind: MessageKind; field: "msg_confirmation" | "msg_today" | "msg_reminder" | "msg_maintenance" | "msg_thanks"; label: string; sameDay?: boolean }[] = [
  { kind: "confirmation", field: "msg_confirmation", label: "Confirmação de horário (2 dias antes)" },
  { kind: "today", field: "msg_today", label: "Lembrete do dia", sameDay: true },
  ...(REMINDER_RULES.showEve ? [{ kind: "reminder" as const, field: "msg_reminder" as const, label: "Lembrete da véspera" }] : []),
  { kind: "maintenance", field: "msg_maintenance", label: `Convite para manutenção (${REMINDER_RULES.maintenanceDays} dias depois)` },
  { kind: "thanks", field: "msg_thanks", label: "Agradecimento pós-atendimento" },
];

function MessagesCard({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const [values, setValues] = useState(() => Object.fromEntries(TEMPLATES.map((t) => [t.field, profile[t.field]])) as Record<(typeof TEMPLATES)[number]["field"], string>);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(TEMPLATES.map((t) => [t.field, profile[t.field]])) as typeof values);
  }, [profile]);

  const draft: Profile = { ...profile, ...values };
  const sampleStart = new Date();
  sampleStart.setDate(sampleStart.getDate() + 1);
  sampleStart.setHours(14, 0, 0, 0);
  const sameDayStart = new Date(sampleStart);
  sameDayStart.setDate(sameDayStart.getDate() - 1);

  async function onSave() {
    if (TEMPLATES.some((t) => !values[t.field].trim())) {
      toast.error("As mensagens não podem ficar vazias.");
      return;
    }
    setSaving(true);
    try {
      await save(profile.id, values);
      toast.success("Mensagens salvas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={<Title icon={MessageCircle}>Mensagens do WhatsApp</Title>}>
      <Card>
        <p className="mb-4 text-sm text-muted-foreground">
          Use as palavras entre chaves para preencher automaticamente:{" "}
          {["{nome}", "{data}", "{hora}", "{procedimento}", "{valor}", "{studio}"].map((v) => (
            <code key={v} className="mr-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">{v}</code>
          ))}
        </p>
        <div className="grid gap-5">
          {TEMPLATES.map((t) => (
            <div key={t.field} className="grid gap-1.5">
              <Label htmlFor={t.field}>{t.label}</Label>
              <Textarea
                id={t.field}
                rows={3}
                value={values[t.field]}
                onChange={(e) => setValues((v) => ({ ...v, [t.field]: e.target.value }))}
              />
              <p className="rounded-xl bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="text-primary">Prévia: </span>
                {buildMessage(t.kind, draft, {
                  clientName: "Maria Silva",
                  startsAt: (t.sameDay ? sameDayStart : sampleStart).toISOString(),
                  procedure: "Volume brasileiro",
                  price: 180,
                })}
              </p>
            </div>
          ))}
          <div>
            <Button variant="gold" onClick={onSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar mensagens"}
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function NotificationsCard() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    setEnabled(localStorage.getItem(NOTIFY_KEY) === "1" && Notification.permission === "granted");
  }, []);

  async function toggle(on: boolean) {
    if (!on) {
      localStorage.setItem(NOTIFY_KEY, "0");
      setEnabled(false);
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      toast.error("Permissão negada. Libere as notificações nas configurações do navegador.");
      return;
    }
    localStorage.setItem(NOTIFY_KEY, "1");
    setEnabled(true);
    new Notification("Avisos ativados", { body: "Você será avisada 1h antes de cada atendimento.", icon: "/icon-512.png" });
  }

  return (
    <Section title={<Title icon={BellRing}>Avisos no aparelho</Title>}>
      <Card>
        {supported ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Avisar 1h antes de cada atendimento</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Funciona enquanto o app estiver aberto neste aparelho.
                {permission === "denied" && " As notificações estão bloqueadas no navegador."}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggle} aria-label="Ativar avisos" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Este navegador não suporta notificações.</p>
        )}
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-accent/60 p-3 text-sm">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            <span className="text-foreground">Instale no celular:</span> no iPhone, toque em Compartilhar → “Adicionar à Tela de Início”. No Android, abra o menu do Chrome → “Instalar app”.
          </p>
        </div>
      </Card>
    </Section>
  );
}

function BackupCard() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
      toast.success("Arquivo baixado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível exportar");
    } finally {
      setBusy(null);
    }
  }

  const stamp = () => isoDay(new Date());

  const fullBackup = () =>
    run("json", async () => {
      const [profiles, clients, procedures, appointments, events, transactions, photos, products, movements] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("procedures").select("*"),
        supabase.from("appointments").select("*"),
        supabase.from("appointment_events").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("client_photos").select("*"),
        supabase.from("products").select("*"),
        supabase.from("stock_movements").select("*"),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        app: "Lash Studio",
        profile: check(profiles)[0] ?? null,
        clients: check(clients),
        procedures: check(procedures),
        appointments: check(appointments),
        appointment_events: check(events),
        transactions: check(transactions),
        client_photos: check(photos),
        products: check(products),
        stock_movements: check(movements),
      };
      downloadFile(`backup-lash-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
    });

  const clientsCsv = () =>
    run("clients", async () => {
      const rows = check(await supabase.from("clients").select("*").order("name"));
      downloadFile(
        `clientes-${stamp()}.csv`,
        toCsv(rows, [
          { key: "name", label: "Nome" },
          { key: "phone", label: "Telefone" },
          { key: "email", label: "E-mail" },
          { key: "birthday", label: "Aniversário" },
          { key: "allergies", label: "Alergias" },
          { key: "notes", label: "Observações" },
        ]),
        "text/csv;charset=utf-8",
      );
    });

  const financeCsv = () =>
    run("finance", async () => {
      const rows = check(await supabase.from("transactions").select("*").order("occurred_on", { ascending: false }));
      downloadFile(
        `financeiro-${stamp()}.csv`,
        toCsv(
          rows.map((t) => ({ ...t, type: t.type === "receita" ? "Receita" : "Despesa", amount: Number(t.amount).toFixed(2).replace(".", ",") })),
          [
            { key: "occurred_on", label: "Data" },
            { key: "type", label: "Tipo" },
            { key: "category", label: "Categoria" },
            { key: "description", label: "Descrição" },
            { key: "payment_method", label: "Forma de pagamento" },
            { key: "amount", label: "Valor (R$)" },
          ],
        ),
        "text/csv;charset=utf-8",
      );
    });

  const appointmentsCsv = () =>
    run("appts", async () => {
      const rows = check(await supabase.from("appointments").select("*, client:clients(name,phone)").order("starts_at", { ascending: false })) as unknown as (Appointment & { client: { name: string; phone: string | null } | null })[];
      downloadFile(
        `agendamentos-${stamp()}.csv`,
        toCsv(
          rows.map((a) => ({
            ...a,
            data: fmt(a.starts_at, "dd/MM/yyyy HH:mm"),
            cliente: a.client?.name ?? "",
            telefone: a.client?.phone ?? "",
            situacao: STATUS_META[a.status as AppointmentStatus]?.label ?? a.status,
            valor: Number(a.price).toFixed(2).replace(".", ","),
            pago: Number(a.amount_paid).toFixed(2).replace(".", ","),
          })),
          [
            { key: "data", label: "Data e hora" },
            { key: "cliente", label: "Cliente" },
            { key: "telefone", label: "Telefone" },
            { key: "procedure_name", label: "Procedimento" },
            { key: "situacao", label: "Situação" },
            { key: "valor", label: "Valor (R$)" },
            { key: "pago", label: "Pago (R$)" },
            { key: "payment_method", label: "Forma de pagamento" },
            { key: "notes", label: "Observações" },
          ],
        ),
        "text/csv;charset=utf-8",
      );
    });

  return (
    <Section title={<Title icon={DatabaseBackup}>Backup e segurança</Title>}>
      <Card>
        <div className="mb-4 flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Seus dados ficam guardados na nuvem com acesso só pela sua conta, sincronizados em todos os aparelhos. Baixe uma cópia sempre que quiser.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="gold" onClick={fullBackup} disabled={!!busy}>
            <DatabaseBackup /> {busy === "json" ? "Gerando…" : "Backup completo"}
          </Button>
          <Button variant="glass" onClick={clientsCsv} disabled={!!busy}>
            <FileSpreadsheet /> {busy === "clients" ? "Gerando…" : "Planilha de clientes"}
          </Button>
          <Button variant="glass" onClick={appointmentsCsv} disabled={!!busy}>
            <FileSpreadsheet /> {busy === "appts" ? "Gerando…" : "Planilha de agendamentos"}
          </Button>
          <Button variant="glass" onClick={financeCsv} disabled={!!busy}>
            <FileSpreadsheet /> {busy === "finance" ? "Gerando…" : "Planilha financeira"}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

function AccountCard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }
  return (
    <Section title="Conta">
      <Button variant="outline" onClick={signOut} className="w-full sm:w-auto">
        <LogOut /> Sair da conta
      </Button>
    </Section>
  );
}
