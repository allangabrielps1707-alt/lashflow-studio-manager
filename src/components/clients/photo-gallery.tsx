import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, isoDay } from "@/lib/format";
import { check, clientPhotosQuery, type Appointment, type ClientPhoto } from "@/lib/queries";

const KIND_LABEL: Record<string, string> = { antes: "Antes", depois: "Depois", outro: "Outro" };
const NONE = "__none__";

export function PhotoGallery({ clientId, appointments }: { clientId: string; appointments: Appointment[] }) {
  const qc = useQueryClient();
  const { data: photos = [], isLoading } = useQuery(clientPhotosQuery(clientId));
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("depois");
  const [caption, setCaption] = useState("");
  const [apptId, setApptId] = useState(NONE);
  const [takenOn, setTakenOn] = useState(isoDay(new Date()));
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<(ClientPhoto & { url: string }) | null>(null);

  const concluded = appointments.filter((a) => a.status === "concluido").slice(0, 20);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Escolha uma imagem");
    if (f.size > 10 * 1024 * 1024) return toast.error("A foto deve ter até 10 MB");
    setFile(f);
    setCaption("");
    setApptId(concluded[0]?.id ?? NONE);
    setTakenOn(isoDay(new Date()));
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("client-photos").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      check(
        await supabase.from("client_photos").insert({
          client_id: clientId,
          storage_path: path,
          kind,
          caption: caption.trim() || null,
          appointment_id: apptId === NONE ? null : apptId,
          taken_on: takenOn,
        }),
      );
      await qc.invalidateQueries({ queryKey: ["photos", clientId] });
      toast.success("Foto adicionada");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no envio");
    } finally {
      setUploading(false);
    }
  }

  async function remove(p: ClientPhoto) {
    try {
      await supabase.storage.from("client-photos").remove([p.storage_path]);
      check(await supabase.from("client_photos").delete().eq("id", p.id));
      await qc.invalidateQueries({ queryKey: ["photos", clientId] });
      setViewing(null);
      toast.success("Foto excluída");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="soft" className="mb-4 w-full" onClick={() => fileRef.current?.click()}>
        <Camera /> Adicionar foto
      </Button>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando fotos…</p>
      ) : photos.length === 0 ? (
        <EmptyState icon={ImagePlus} title="Sem fotos ainda" text="Guarde o antes e depois de cada atendimento." />
      ) : (
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewing(p)}
              className="group relative aspect-square overflow-hidden rounded-xl border"
            >
              <img src={p.url} alt={p.caption ?? "Foto da cliente"} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              <span className="absolute left-1.5 top-1.5">
                <Badge variant={p.kind === "antes" ? "muted" : "gold"} className="backdrop-blur">{KIND_LABEL[p.kind] ?? p.kind}</Badge>
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-2 pb-1 pt-4 text-left text-[10px] text-muted-foreground">
                {fmtDate(p.taken_on)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Upload details */}
      <Dialog open={!!file} onOpenChange={(o) => !o && setFile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-xl font-light">Nova foto</DialogTitle></DialogHeader>
          {file && <img src={URL.createObjectURL(file)} alt="Prévia" className="max-h-56 w-full rounded-xl object-cover" />}
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="antes">Antes</SelectItem>
                    <SelectItem value="depois">Depois</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ph-date">Data</Label>
                <Input id="ph-date" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
              </div>
            </div>
            {concluded.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Atendimento</Label>
                <Select value={apptId} onValueChange={setApptId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {concluded.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{fmtDate(a.starts_at)} · {a.procedure_name}</SelectItem>
                    ))}
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="ph-cap">Legenda</Label>
              <Input id="ph-cap" placeholder="Ex.: Volume russo, curvatura D, 11mm" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <Button variant="gold" disabled={uploading} onClick={upload}>{uploading ? "Enviando…" : "Salvar foto"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Viewer */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-light">
                  {KIND_LABEL[viewing.kind]} · {fmtDate(viewing.taken_on)}
                </DialogTitle>
              </DialogHeader>
              <img src={viewing.url} alt={viewing.caption ?? "Foto"} className="max-h-[65vh] w-full rounded-xl object-contain" />
              {viewing.caption && <p className="text-sm text-muted-foreground">{viewing.caption}</p>}
              <Button variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={() => remove(viewing)}>
                <Trash2 /> Excluir foto
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
