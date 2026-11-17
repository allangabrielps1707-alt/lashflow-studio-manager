import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { toast } from "sonner";

import { Brand } from "@/components/app/brand";
import { GoogleLogo } from "@/components/auth/google-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Lash Studio" },
      { name: "description", content: "Acesse sua agenda e a gestão do seu estúdio de cílios." },
      { property: "og:title", content: "Entrar — Lash Studio" },
      { property: "og:description", content: "Acesse sua agenda e a gestão do seu estúdio de cílios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/painel", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível continuar";
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou senha incorretos" : msg.includes("already registered") ? "Este e-mail já tem conta" : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      toast.error("Não foi possível entrar. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/painel", replace: true });
  }

  const titles: Record<Mode, string> = {
    signin: "Bem-vinda de volta",
    signup: "Crie sua conta",
    forgot: "Recuperar senha",
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="mb-8">
        <Brand />
      </Link>
      <div className="animate-rise w-full max-w-sm rounded-3xl border bg-card-gradient p-6 shadow-soft">
        <h1 className="font-display text-2xl font-light">{titles[mode]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "forgot" ? "Informe seu e-mail para receber o link." : "Sua agenda sincronizada em qualquer aparelho."}
        </p>

        {mode !== "forgot" && (
          <div className="mt-6 grid gap-2.5">
            <Button type="button" className="btn-google h-11 rounded-full" onClick={() => social("google")}>
              <GoogleLogo />
              Continuar com Google
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => social("lovable")}>
              <LovableMark />
              Continuar com Lovable
            </Button>
            <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-2 grid gap-4">
          {mode === "signup" && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {mode !== "forgot" && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {mode === "signin" && (
                  <button type="button" className="text-xs text-primary" onClick={() => setMode("forgot")}>
                    Esqueci a senha
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}
          {notice && <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">{notice}</p>}
          <Button type="submit" variant="gold" className="h-11" disabled={loading}>
            {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Ainda não tem conta?{" "}
              <button className="text-primary" onClick={() => setMode("signup")}>Criar conta</button>
            </>
          ) : (
            <button className="text-primary" onClick={() => setMode("signin")}>Voltar para o login</button>
          )}
        </p>
      </div>
    </div>
  );
}
