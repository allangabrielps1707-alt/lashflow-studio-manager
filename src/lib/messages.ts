import { fmt, money } from "@/lib/format";
import type { Profile } from "@/lib/queries";
import { firstName, renderTemplate } from "@/lib/whatsapp";

export type MessageKind = "confirmation" | "today" | "reminder" | "maintenance" | "thanks";

export function buildMessage(
  kind: MessageKind,
  profile: Profile | undefined,
  data: { clientName: string; startsAt?: string; procedure?: string; price?: number },
): string {
  const templates: Record<MessageKind, string> = {
    confirmation: profile?.msg_confirmation ?? "Olá {nome}! Confirmando seu horário no dia {data} às {hora}.",
    today: profile?.msg_today ?? "Bom dia, {nome}! Lembrete do seu horário hoje às {hora}.",
    reminder: profile?.msg_reminder ?? "Oi {nome}! Lembrete do seu horário {data} às {hora}.",
    maintenance: profile?.msg_maintenance ?? "Oi {nome}! Está na hora da manutenção dos seus cílios. Vamos agendar?",
    thanks: profile?.msg_thanks ?? "Obrigada pela visita, {nome}!",
  };
  return renderTemplate(templates[kind], {
    nome: firstName(data.clientName),
    data: data.startsAt ? fmt(data.startsAt, "dd/MM (EEEE)") : "",
    hora: data.startsAt ? fmt(data.startsAt, "HH:mm") : "",
    procedimento: data.procedure ?? "",
    valor: data.price != null ? money(data.price) : "",
    studio: profile?.business_name ?? "",
  });
}
