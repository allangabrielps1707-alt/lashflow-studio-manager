import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, CalendarX, Package, PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, StatCard } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPIRY_WARNING_DAYS,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  applyMovement,
  daysUntilExpiry,
  isExpiringSoon,
  isLowStock,
} from "@/lib/business";
import { fmtDate, fmtQty, isoDay, money } from "@/lib/format";
import { check, productMovementsQuery, productsQuery, type Product } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Lash Studio" },
      { name: "description", content: "Controle de produtos: quantidade, validade, estoque mínimo, entradas e saídas." },
      { property: "og:title", content: "Estoque — Lash Studio" },
      { property: "og:description", content: "Quantidade, validade, estoque mínimo, entradas e saídas dos seus produtos." },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(productsQuery),
  component: StockPage,
});

type Filter = "todos" | "baixo" | "validade";
type Mode = "detail" | "edit" | "move";

function StockPage() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("detail");
  const [moveType, setMoveType] = useState<"entrada" | "saida">("entrada");
  const [open, setOpen] = useState(false);

  const today = new Date();
  const low = products.filter(isLowStock);
  const expiring = products.filter((p) => isExpiringSoon(p, today));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = filter === "baixo" ? low : filter === "validade" ? expiring : products;
    return q ? base.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q)) : base;
  }, [products, search, filter, low, expiring]);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  const openNew = () => { setSelectedId(null); setMode("edit"); setOpen(true); };
  const openProduct = (p: Product) => { setSelectedId(p.id); setMode("detail"); setOpen(true); };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Materiais"
        title="Estoque"
        actions={
          <Button variant="gold" size="icon" aria-label="Novo produto" onClick={openNew}>
            <Plus />
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Cadastre seus produtos"
          text="Fios, cola, removedor, descartáveis… Defina o estoque mínimo e a validade para receber lembretes."
          action={<Button variant="gold" size="sm" onClick={openNew}><PackagePlus /> Adicionar produto</Button>}
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-2">
            <StatCard label="Produtos" value={products.length} />
            <StatCard label="Baixo" value={low.length} tone={low.length ? "gold" : "default"} />
            <StatCard label="Validade" value={expiring.length} tone={expiring.length ? "gold" : "default"} />
          </div>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto" className="pl-9" aria-label="Buscar produto" />
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {([
              ["todos", "Todos"],
              ["baixo", `Estoque baixo (${low.length})`],
              ["validade", `Validade (${expiring.length})`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition",
                  filter === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nenhum produto aqui.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} today={today} onClick={() => openProduct(p)} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          {mode === "edit" ? (
            <ProductForm
              editing={selected}
              onDone={(id) => { if (id) { setSelectedId(id); setMode("detail"); } else setOpen(false); }}
              onCancel={() => (selected ? setMode("detail") : setOpen(false))}
            />
          ) : selected && mode === "move" ? (
            <MovementForm product={selected} type={moveType} onType={setMoveType} onDone={() => setMode("detail")} />
          ) : selected ? (
            <ProductDetail
              product={selected}
              onMove={(t) => { setMoveType(t); setMode("move"); }}
              onEdit={() => setMode("edit")}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StockBadges({ product, today }: { product: Product; today: Date }) {
  const left = daysUntilExpiry(product.expires_on, today);
  return (
    <>
      {isLowStock(product) && (
        <Badge variant={Number(product.quantity) === 0 ? "danger" : "warning"}>
          {Number(product.quantity) === 0 ? "Esgotado" : "Estoque baixo"}
        </Badge>
      )}
      {isExpiringSoon(product, today) && left !== null && (
        <Badge variant={left < 0 ? "danger" : "warning"}>
          {left < 0 ? "Vencido" : left === 0 ? "Vence hoje" : `Vence em ${left}d`}
        </Badge>
      )}
    </>
  );
}

function ProductCard({ product: p, today, onClick }: { product: Product; today: Date; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card-gradient p-4 text-left shadow-soft transition hover:border-primary/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{p.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[p.category, p.expires_on ? `validade ${fmtDate(p.expires_on)}` : null].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden">
          <StockBadges product={p} today={today} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("font-display text-2xl leading-none", isLowStock(p) ? "text-destructive" : "text-gold")}>{fmtQty(p.quantity)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{p.unit}{Number(p.min_quantity) > 0 ? ` · mín. ${fmtQty(p.min_quantity)}` : ""}</p>
      </div>
    </button>
  );
}

function ProductDetail({ product: p, onMove, onEdit }: { product: Product; onMove: (t: "entrada" | "saida") => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const { data: moves } = useQuery(productMovementsQuery(p.id));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = new Date();

  async function removeMove(id: string) {
    try {
      check(await supabase.from("stock_movements").delete().eq("id", id));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success("Movimentação apagada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="font-display text-2xl font-light">{p.name}</SheetTitle>
        <SheetDescription>{p.category}{p.notes ? ` · ${p.notes}` : ""}</SheetDescription>
      </SheetHeader>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatCard label="Em estoque" value={`${fmtQty(p.quantity)} ${p.unit}`} tone="gold" />
        <StatCard label="Mínimo" value={Number(p.min_quantity) > 0 ? fmtQty(p.min_quantity) : "—"} />
        <StatCard label="Validade" value={p.expires_on ? fmtDate(p.expires_on) : "—"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 empty:hidden">
        <StockBadges product={p} today={today} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="gold" onClick={() => onMove("entrada")}><ArrowDownToLine /> Entrada</Button>
        <Button variant="glass" onClick={() => onMove("saida")} disabled={Number(p.quantity) <= 0}><ArrowUpFromLine /> Saída</Button>
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={onEdit}><Pencil /> Editar produto</Button>

      <h3 className="mb-2 mt-6 font-display text-lg">Movimentações</h3>
      {!moves ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : moves.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma entrada ou saída ainda.</p>
      ) : (
        <div className="grid gap-2 pb-4">
          {moves.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", m.type === "entrada" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                {m.type === "entrada" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.type === "entrada" ? "+" : "−"}{fmtQty(m.quantity)} {p.unit}
                  {m.total_cost ? <span className="font-normal text-muted-foreground"> · {money(m.total_cost)}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{[fmtDate(m.occurred_on), m.note].filter(Boolean).join(" · ")}</p>
              </div>
              {confirmId === m.id ? (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMove(m.id)}>Apagar?</Button>
              ) : (
                <button type="button" aria-label="Apagar movimentação" className="rounded-lg p-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmId(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MovementForm({
  product: p,
  type,
  onType,
  onDone,
}: {
  product: Product;
  type: "entrada" | "saida";
  onType: (t: "entrada" | "saida") => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(isoDay(new Date()));
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const amount = Number(qty.replace(",", ".")) || 0;
  const after = amount > 0 ? applyMovement(Number(p.quantity), type, amount) : Number(p.quantity);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      toast.error("Informe a quantidade");
      return;
    }
    if (after === null) {
      toast.error("Saída maior que o estoque disponível");
      return;
    }
    setSaving(true);
    try {
      const total = type === "entrada" ? Number(cost.replace(",", ".")) || 0 : 0;
      check(
        await supabase.from("stock_movements").insert({
          product_id: p.id,
          type,
          quantity: amount,
          occurred_on: date,
          total_cost: total > 0 ? total : null,
          note: note.trim() || null,
        }),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success(total > 0 ? "Entrada salva e despesa lançada no Financeiro" : type === "entrada" ? "Entrada salva" : "Saída salva");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="font-display text-2xl font-light">{type === "entrada" ? "Entrada" : "Saída"} de material</SheetTitle>
        <SheetDescription>{p.name} · hoje {fmtQty(p.quantity)} {p.unit}</SheetDescription>
      </SheetHeader>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-surface p-1">
          {(["entrada", "saida"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onType(t)}
              className={cn("rounded-lg py-2 text-sm transition", type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {t === "entrada" ? "Entrada" : "Saída"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="mv-qty">Quantidade ({p.unit})</Label>
            <Input id="mv-qty" type="number" inputMode="decimal" min={0} step="any" required value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mv-date">Data</Label>
            <Input id="mv-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {type === "entrada" && (
          <div className="grid gap-1.5">
            <Label htmlFor="mv-cost">Valor pago (R$)</Label>
            <Input id="mv-cost" type="number" inputMode="decimal" min={0} step="0.01" placeholder="Opcional" value={cost} onChange={(e) => setCost(e.target.value)} />
            <p className="text-xs text-muted-foreground">Com valor, a compra entra como despesa em "Material" no Financeiro.</p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="mv-note">Observação</Label>
          <Input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "entrada" ? "Ex.: fornecedor, lote" : "Ex.: usado em atendimentos"} />
        </div>
        <p className={cn("text-sm", after === null ? "text-destructive" : "text-muted-foreground")}>
          {after === null ? "Quantidade maior que o estoque disponível." : `Estoque após: ${fmtQty(after)} ${p.unit}`}
        </p>
        <Button type="submit" variant="gold" size="lg" disabled={saving || after === null}>{saving ? "Salvando…" : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Voltar</Button>
      </form>
    </>
  );
}

function ProductForm({ editing, onDone, onCancel }: { editing: Product | null; onDone: (id: string | null) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Outros");
  const [unit, setUnit] = useState("un");
  const [initial, setInitial] = useState("");
  const [min, setMin] = useState("");
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "Outros");
    setUnit(editing?.unit ?? "un");
    setInitial("");
    setMin(editing && Number(editing.min_quantity) > 0 ? String(editing.min_quantity) : "");
    setExpires(editing?.expires_on ?? "");
    setNotes(editing?.notes ?? "");
    setConfirmDelete(false);
  }, [editing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || "Outros",
        unit,
        min_quantity: Number(min.replace(",", ".")) || 0,
        expires_on: expires || null,
        notes: notes.trim() || null,
      };
      let id: string;
      if (editing) {
        check(await supabase.from("products").update(payload).eq("id", editing.id));
        id = editing.id;
      } else {
        const created = check(await supabase.from("products").insert(payload).select("id").single()) as { id: string };
        id = created.id;
        const start = Number(initial.replace(",", ".")) || 0;
        if (start > 0) {
          check(await supabase.from("stock_movements").insert({ product_id: id, type: "entrada", quantity: start, note: "Estoque inicial" }));
        }
      }
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto salvo");
      onDone(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      check(await supabase.from("products").delete().eq("id", editing.id));
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído");
      onDone(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="font-display text-2xl font-light">{editing ? "Editar produto" : "Novo produto"}</SheetTitle>
        <SheetDescription>
          Avisamos nos Lembretes quando chegar no mínimo e {EXPIRY_WARNING_DAYS} dias antes de vencer.
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="pd-name">Nome</Label>
          <Input id="pd-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fio 0.07 D 11mm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pd-cat">Categoria</Label>
            <Input id="pd-cat" list="product-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="product-categories">
              {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label>Unidade</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {editing ? (
            <div className="grid gap-1.5">
              <Label>Quantidade</Label>
              <p className="flex h-10 items-center rounded-md border bg-surface px-3 text-sm text-muted-foreground">
                {fmtQty(editing.quantity)} {editing.unit}
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="pd-qty">Quantidade atual</Label>
              <Input id="pd-qty" type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={initial} onChange={(e) => setInitial(e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pd-min">Estoque mínimo</Label>
            <Input id="pd-min" type="number" inputMode="decimal" min={0} step="any" placeholder="Ex.: 2" value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
        </div>
        {editing && <p className="-mt-2 text-xs text-muted-foreground">Para mudar a quantidade, registre uma entrada ou saída.</p>}
        <div className="grid gap-1.5">
          <Label htmlFor="pd-exp" className="flex items-center gap-1.5"><CalendarX className="h-3.5 w-3.5" /> Validade (se tiver)</Label>
          <Input id="pd-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pd-notes">Observações</Label>
          <Textarea id="pd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Marca, fornecedor, curvatura…" />
        </div>
        <Button type="submit" variant="gold" size="lg" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        {editing && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}>
            {confirmDelete ? "Toque de novo para excluir (apaga o histórico)" : "Excluir produto"}
          </Button>
        )}
      </form>
    </>
  );
}
