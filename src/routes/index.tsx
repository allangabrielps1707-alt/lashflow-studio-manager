import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarHeart, Images, MessageCircle, Sparkles, Users, Wallet } from "lucide-react";

import heroImg from "@/assets/hero-lash.jpg";
import { Brand } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lash Studio — A agenda elegante da Lash Designer" },
      {
        name: "description",
        content:
          "Agenda, clientes, fotos, procedimentos, financeiro e lembretes pelo WhatsApp. Feito para Lash Designers.",
      },
      { property: "og:title", content: "Lash Studio — A agenda elegante da Lash Designer" },
      {
        property: "og:description",
        content: "Substitua a agenda de papel e as planilhas: tudo do seu estúdio de cílios em um só app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: CalendarHeart, title: "Agenda inteligente", text: "Dia, semana e mês, com sinal e remarcações." },
  { icon: Users, title: "Fichas de clientes", text: "Histórico completo, alergias e preferências." },
  { icon: Images, title: "Galeria antes & depois", text: "Fotos privadas ligadas a cada cliente." },
  { icon: Wallet, title: "Financeiro claro", text: "Receitas, despesas, pendências e relatórios." },
  { icon: MessageCircle, title: "WhatsApp em 1 toque", text: "Confirmações e lembretes com mensagem pronta." },
  { icon: Sparkles, title: "Lembretes de manutenção", text: "Saiba quem está na hora de voltar." },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="safe-top mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <Button asChild variant="glass" size="sm">
          <Link to={signedIn ? "/painel" : "/auth"}>{signedIn ? "Abrir app" : "Entrar"}</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-4 md:grid-cols-2 md:pt-10">
        <section className="animate-rise order-2 md:order-1">
          <p className="eyebrow mb-4">Para Lash Designers</p>
          <h1 className="font-display text-4xl font-light leading-[1.05] md:text-6xl">
            Seu estúdio, <span className="text-gold font-normal">impecável</span> como seus cílios.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground md:text-lg">
            Agenda, clientes, fotos, procedimentos e financeiro em um só lugar — pensado para o celular,
            sincronizado e seguro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg">
              <Link to={signedIn ? "/painel" : "/auth"}>
                {signedIn ? "Abrir minha agenda" : "Começar agora"}
              </Link>
            </Button>
          </div>

          <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="order-1 md:order-2">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[2rem] border border-primary/20 shadow-gold">
            <img
              src={heroImg}
              alt="Close de cílios com extensão volume em luz dourada"
              width={1024}
              height={1280}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-6">
              <p className="eyebrow">Hoje</p>
              <p className="font-display text-2xl">4 atendimentos · R$ 760</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
