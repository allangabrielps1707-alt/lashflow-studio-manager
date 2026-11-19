/** Helpers for exporting the studio's data as files (backup / spreadsheets). */

/** Converts rows into CSV (semicolon-separated, which Excel in pt-BR opens correctly). */
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: { key: keyof T; label: string }[]): string {
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(";");
  const lines = rows.map((r) => columns.map((c) => esc(r[c.key])).join(";"));
  // BOM so Excel detects UTF-8 accents.
  return "\uFEFF" + [header, ...lines].join("\r\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
