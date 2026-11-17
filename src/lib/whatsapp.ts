/**
 * WhatsApp click-to-chat helpers (wa.me links with a prefilled message).
 */

/** Normalizes a Brazilian phone to digits with country code (55). Returns null when unusable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) return null;
  return digits;
}

export type TemplateVars = Partial<
  Record<"nome" | "data" | "hora" | "procedimento" | "valor" | "studio", string>
>;

/** Replaces {placeholders} with values; unknown placeholders are left empty. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? "";
  });
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return message ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/${n}`;
}

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}
