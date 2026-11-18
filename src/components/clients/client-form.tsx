import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { check, refreshData, type Client } from "@/lib/queries";

export function ClientForm({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Client | null | undefined;
  onSaved?: ((client: Client) => void) | undefined;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setBirthday(editing?.birthday ?? "");
    setAllergies(editing?.allergies ?? "");
    setNotes(editing?.notes ?? "");
  }, [open, editing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        birthday: birthday || null,
        allergies: allergies.trim() || null,
        notes: notes.trim() || null,
      };
      const saved = editing
        ? (check(await supabase.from("clients").update(payload).eq("id", editing.id).select("*").single()) as Client)
        : (check(await supabase.from("clients").insert(payload).select("*").single()) as Client);
      await refreshData(qc);
      toast.success(editing ? "Cliente atualizada" : "Cliente cadastrada");
      onOpenChange(false);
      onSaved?.(saved);
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
          <SheetTitle className="font-display text-2xl font-light">{editing ? "Editar cliente" : "Nova cliente"}</SheetTitle>
          <SheetDescription>Dados de contato e ficha de anamnese.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cl-name">Nome</Label>
            <Input id="cl-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cl-phone">Telefone / WhatsApp</Label>
              <Input id="cl-phone" type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-bday">Aniversário</Label>
              <Input id="cl-bday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cl-email">E-mail</Label>
            <Input id="cl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cl-all">Alergias / sensibilidades</Label>
            <Input id="cl-all" placeholder="Ex.: cola, látex, fita…" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cl-notes">Observações</Label>
            <Textarea id="cl-notes" placeholder="Curvatura preferida, espessura, mapping, olhos sensíveis…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" variant="gold" size="lg" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
