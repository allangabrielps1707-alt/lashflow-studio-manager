import { describe, expect, it } from "vitest";

import { toCsv } from "./backup";
import { balanceDue, birthdayWithin, findOverlap, maintenanceDue } from "./business";
import { normalizePhone, renderTemplate, whatsappLink } from "./whatsapp";

describe("WhatsApp", () => {
  it("adds Brazil's 55 code to a phone with DDD", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("5511987654321");
  });
  it("rejects a phone without DDD", () => {
    expect(normalizePhone("98765-4321")).toBeNull();
  });
  it("builds a wa.me link with the prefilled message", () => {
    expect(whatsappLink("11987654321", "Oi Ana")).toBe("https://wa.me/5511987654321?text=Oi%20Ana");
  });
  it("fills message placeholders", () => {
    expect(renderTemplate("Oi {nome}, {hora}", { nome: "Ana", hora: "14:00" })).toBe("Oi Ana, 14:00");
  });
});

describe("Saldo", () => {
  it("is price minus what was paid (deposit included)", () => {
    expect(balanceDue({ price: 180, amount_paid: 50 })).toBe(130);
  });
  it("never goes negative", () => {
    expect(balanceDue({ price: 100, amount_paid: 120 })).toBe(0);
  });
});

describe("Conflito de horário", () => {
  const appts = [
    { id: "a", starts_at: "2026-05-10T13:00:00.000Z", duration_minutes: 120, status: "agendado" },
    { id: "b", starts_at: "2026-05-10T17:00:00.000Z", duration_minutes: 60, status: "cancelado" },
  ];
  it("flags a slot that overlaps an active appointment", () => {
    expect(findOverlap(appts, new Date("2026-05-10T14:00:00.000Z"), 60)?.id).toBe("a");
  });
  it("allows a slot starting exactly when the previous one ends", () => {
    expect(findOverlap(appts, new Date("2026-05-10T15:00:00.000Z"), 60)).toBeUndefined();
  });
  it("ignores cancelled appointments", () => {
    expect(findOverlap(appts, new Date("2026-05-10T17:00:00.000Z"), 60)).toBeUndefined();
  });
});

describe("Manutenção", () => {
  const today = new Date(2026, 4, 20, 10);
  const visit = (starts: Date, status = "concluido") => ({
    client_id: "c1",
    starts_at: starts.toISOString(),
    status,
    procedure_id: "p1",
  });
  it("is due 15 days after the last completed visit", () => {
    const due = maintenanceDue([visit(new Date(2026, 4, 6, 10))], { p1: 15 }, today);
    expect(due).toHaveLength(1);
    expect(due[0]!.daysUntil).toBe(1);
  });
  it("is not suggested when the client already has a future booking", () => {
    const due = maintenanceDue(
      [visit(new Date(2026, 4, 6, 10)), visit(new Date(2026, 4, 22, 10), "agendado")],
      { p1: 15 },
      today,
    );
    expect(due).toHaveLength(0);
  });
});

describe("Aniversário", () => {
  it("counts days until this year's birthday", () => {
    expect(birthdayWithin("1990-05-23", new Date(2026, 4, 20), 7)).toBe(3);
  });
});

describe("Backup CSV", () => {
  it("separates with semicolons and quotes values containing them", () => {
    const csv = toCsv([{ a: "x;y", b: 1 }], [{ key: "a", label: "A" }, { key: "b", label: "B" }]);
    expect(csv).toBe('\uFEFFA;B\r\n"x;y";1');
  });
});
