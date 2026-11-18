import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { addMonths, startOfMonth } from "date-fns";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, HandCoins, Plus, Trash2, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, StatCard } from "@/components/app/page";
import { useAppointments } from "@/components/appointments/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { balanceDue, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/business";
import { capitalize, fmt, fmtDate, isoDay, money } from "@/lib/format";
import { check, pendingPaymentsQuery, refreshData, transactionsRangeQuery, type Transaction } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Kind = "receita" | "despesa";

export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: (s: Record<string, unknown>): { mes?: string | undefined; lancar?: Kind | undefined } => {
    const mes = s["mes"];
    const lancar = s["lancar"];
    return {
      mes: typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : undefined,
      lancar: lancar === "receita" || lancar === "despesa" ? lancar : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Financeiro — Lash Studio" },
      { name: "description", content: "Receitas, despesas e pagamentos pendentes do estúdio." },
      { property: "og:title", content: "Financeiro — Lash Studio" },
      { property: "og:description", content: "Receitas, despesas e pagamentos pendentes do estúdio." },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(pendingPaymentsQuery),
  component: FinancePage,
});

function FinancePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/financeiro" });
  const { openDetail } = useAppointments();
  const qc = useQueryClient();
  const month = search.mes ? new Date(`${search.mes}-01T00:00:00`) : startOfMonth(new Date());
  const next = addMonths(month, 1);
  const { data: txs = [], isFetching } = useQuery({ ...transactionsRangeQuery(month, next), placeholderData: keepPreviousData });
  const { data: pending } = useSuspenseQuery(pendingPaymentsQuery);
  const [formKind, setFormKind] = useState<Kind | null>(search.lancar ?? null);
  const [filter, setFilter] = useState<"todos" | Kind>("todos");

  const income = txs.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const receivable = pending.reduce((s, a) => s + balanceDue(a), 0);
  const list = filter === "todos" ? txs : txs.filter((t) => t.type === filter);

  const goMonth = (d: Date) => navigate({ search: { mes: fmt(d, "yyyy-MM"), lancar: undefined } });

  async function remove(t: Transaction) {
    try {
      check(await supabase.from("transactions").delete().eq("id", t.id));
      await refreshData(qc);
      toast.success("Lançamento excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Financeiro"
        title={capitalize(fmt(month, "MMMM yyyy"))}
        actions={
          <>
            <Button variant="glass" size="icon-sm" onClick={() => goMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft /></Button>
            <Button variant="glass" size="icon-sm" onClick={() => goMonth(next)} aria-label="Próximo mês"><ChevronRight /></Button>
          </>
        }
      />

      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", isFetching && "opacity-70")}>
        <StatCard label="Receitas" value={money(income)} icon={ArrowUpRight} />
        <StatCard label="Despesas" value={money(expense)} icon={ArrowDownRight} />
        <StatCard label="Lucro" value={money(income - expense)} tone="gold" icon={Wallet} />
        <StatCard label="A receber" value={money(receivable)} hint={`${pending.length} atendimento(s)`} icon={HandCoins} />
      </div>

      <div className="my-5 grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => setFormKind("receita")}><Plus /> Receita</Button>
        <Button variant="glass" onClick={() => setFormKind("despesa")}><Plus /> Despesa</Button>
      </div>

      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="pendentes">A receber ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="mt-4">
          <div className="mb-3 flex gap-1.5">
            {(["todos", "receita", "despesa"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "soft" : "ghost"} onClick={() => setFilter(f)}>
                {f === "todos" ? "Todos" : f === "receita" ? "Receitas" : "Despesas"}
              </Button>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState icon={Wallet} title="Sem lançamentos neste mês" text="Sinais e pagamentos de atendimentos entram aqui automaticamente." />
          ) : (
            <ul className="grid gap-2">
              {list.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", t.type === "receita" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                    {t.type === "receita" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.description || t.category}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.category} · {fmtDate(t.occurred_on)}{t.payment_method ? ` · ${t.payment_method}` : ""}
                    </p>
                  </div>
                  <p className={cn("font-display", t.type === "receita" ? "text-success" : "text-destructive")}>
                    {t.type === "receita" ? "+" : "−"}{money(t.amount)}
                  </p>
                  <Button variant="ghost" size="icon-sm" aria-label="Excluir lançamento" onClick={() => remove(t)}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="pendentes" className="mt-4">
          {pending.length === 0 ? (
            <EmptyState icon={HandCoins} title="Tudo recebido" text="Nenhum atendimento concluído com valor em aberto." />
          ) : (
            <ul className="grid gap-2">
              {pending.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card-gradient p-3.5 shadow-soft">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.client?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDate(a.starts_at)} · {a.procedure_name} · pago {money(a.amount_paid)}</p>
                  </div>
                  <p className="font-display text-gold">{money(balanceDue(a))}</p>
                  <Button size="sm" variant="soft" onClick={() => openDetail(a.id)}>Receber</Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <TransactionForm
        kind={formKind}
        onClose={() => {
          setFormKind(null);
          if (search.lancar) navigate({ search: { mes: search.mes, lancar: undefined }, replace: true });
        }}
      />
    </div>
  );
}

function TransactionForm({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [method, setMethod] = useState("Pix");
  const [saving, setSaving] = useState(false);
  const categories = kind === "despesa" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  useEffect(() => {
    if (!kind) return;
    setCategory(kind === "despesa" ? "Material" : "Venda de produtos");
    setDescription("");
    setAmount("");
    setDate(isoDay(new Date()));
    setMethod("Pix");
  }, [kind]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!kind) return;
    const v = Number(amount);
    if (!v || v <= 0) {
      toast.error("Informe um valor");
      return;
    }
    setSaving(true);
    try {
      check(
        await supabase.from("transactions").insert({
          type: kind,
          category,
          description: description.trim() || null,
          amount: v,
          occurred_on: date,
          payment_method: method,
        }),
      );
      await refreshData(qc);
      toast.success(kind === "despesa" ? "Despesa lançada" : "Receita lançada");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl font-light">{kind === "despesa" ? "Nova despesa" : "Nova receita"}</SheetTitle>
          <SheetDescription>Pagamentos de atendimentos são registrados no próprio atendimento.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Valor (R$)</Label>
              <Input id="tx-amount" type="number" inputMode="decimal" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Forma</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tx-desc">Descrição</Label>
            <Input id="tx-desc" placeholder={kind === "despesa" ? "Ex.: Cola, fios, pinças" : "Ex.: Venda de sérum"} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" variant="gold" size="lg" disabled={saving}>{saving ? "Salvando…" : "Lançar"}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
