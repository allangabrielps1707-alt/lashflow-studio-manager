import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Lash Studio" },
      { name: "description", content: "Crie uma nova senha para acessar o Lash Studio." },
      { property: "og:title", content: "Nova senha — Lash Studio" },
      { property: "og:description", content: "Crie uma nova senha para acessar o Lash Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session || isRecovery) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/painel", replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5">
      <Brand className="mb-8" />
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-3xl border bg-card-gradient p-6 shadow-soft">
        <h1 className="font-display text-2xl font-light">Criar nova senha</h1>
        {ready ? (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pw">Nova senha</Label>
              <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading ? "Salvando…" : "Salvar senha"}
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Abra esta página pelo link enviado ao seu e-mail.
          </p>
        )}
      </form>
    </div>
  );
}
