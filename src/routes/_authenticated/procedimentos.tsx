import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { LASH_MODELS, PROCEDURE_CATEGORIES, SUGGESTED_PROCEDURES } from "@/lib/business";
import { durationLabel, money } from "@/lib/format";
import { check, proceduresQuery, type Procedure } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/procedimentos")({
  head: () => ({
    meta: [
      { title: "Procedimentos — Lash Studio" },
      { name: "description", content: "Procedimentos, modelos de cílios, preços e duração." },
      { property: "og:title", content: "Procedimentos — Lash Studio" },
      { property: "og:description", content: "Procedimentos, modelos de cílios, preços e duração." },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(proceduresQuery),
  component: ProceduresPage,
});

function ProceduresPage() {
  const qc = useQueryClient();
  const { data: procedures } = useSuspenseQuery(proceduresQuery);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    setSeeding(true);
    try {
      check(await supabase.from("procedures").insert(SUGGESTED_PROCEDURES));
      await qc.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedimentos adicionados — ajuste os preços quando quiser");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSeeding(false);
    }
  }

  const groups = Object.entries(PROCEDURE_CATEGORIES)
    .map(([key, label]) => ({ key, label, items: procedures.filter((p) => p.category === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Catálogo"
        title="Procedimentos"
        actions={
          <Button variant="gold" size="icon" aria-label="Novo procedimento" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus />
          </Button>
        }
      />

      {procedures.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Monte seu catálogo"
          text="Cadastre seus procedimentos com preço, duração e intervalo de manutenção."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="gold" size="sm" disabled={seeding} onClick={seed}>Usar sugestões</Button>
              <Button variant="glass" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Criar do zero</Button>
            </div>
          }
        />
      ) : (
        groups.map((g) => (
          <Section key={g.key} title={g.label}>
            <div className="grid gap-2 md:grid-cols-2">
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setEditing(p); setOpen(true); }}
                  className="flex items-center gap-3 rounded-2xl border bg-card-gradient p-4 text-left shadow-soft transition hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{p.name}</p>
                      {!p.active && <Badge variant="muted">Inativo</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {[p.lash_model, durationLabel(p.duration_minutes), p.maintenance_days ? `manutenção ${p.maintenance_days} dias` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="font-display text-lg text-gold">{money(p.price)}</p>
                </button>
              ))}
            </div>
          </Section>
        ))
      )}

      <ProcedureForm open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ProcedureForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Procedure | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("aplicacao");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("120");
  const [maintenance, setMaintenance] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "aplicacao");
    setModel(editing?.lash_model ?? "");
    setPrice(editing ? String(editing.price) : "");
    setDuration(String(editing?.duration_minutes ?? 120));
    setMaintenance(editing?.maintenance_days ? String(editing.maintenance_days) : "");
    setDescription(editing?.description ?? "");
    setActive(editing?.active ?? true);
  }, [open, editing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        lash_model: model.trim() || null,
        price: Number(price) || 0,
        duration_minutes: Number(duration) || 60,
        maintenance_days: maintenance ? Number(maintenance) : null,
        description: description.trim() || null,
        active,
      };
      if (editing) check(await supabase.from("procedures").update(payload).eq("id", editing.id));
      else check(await supabase.from("procedures").insert(payload));
      await qc.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedimento salvo");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      check(await supabase.from("procedures").delete().eq("id", editing.id));
      await qc.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedimento excluído");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl font-light">{editing ? "Editar procedimento" : "Novo procedimento"}</SheetTitle>
          <SheetDescription>Preço, duração e modelo de cílios.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pr-name">Nome</Label>
            <Input id="pr-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Volume russo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROCEDURE_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pr-model">Modelo de cílios</Label>
              <Input id="pr-model" list="lash-models" value={model} onChange={(e) => setModel(e.target.value)} />
              <datalist id="lash-models">
                {LASH_MODELS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pr-price">Preço (R$)</Label>
              <Input id="pr-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pr-dur">Duração (min)</Label>
              <Input id="pr-dur" type="number" inputMode="numeric" min={10} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pr-maint">Manutenção (dias)</Label>
              <Input id="pr-maint" type="number" inputMode="numeric" min={1} placeholder="15" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pr-desc">Descrição</Label>
            <Textarea id="pr-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fios, espessura, curvaturas…" />
          </div>
          <label className="flex items-center justify-between rounded-xl border bg-surface px-4 py-3 text-sm">
            Disponível para agendar
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
          <Button type="submit" variant="gold" size="lg" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          {editing && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>Excluir procedimento</Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
