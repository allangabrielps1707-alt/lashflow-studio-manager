import { describe, expect, it } from "vitest";

import { toCsv } from "./backup";
import {
  applyMovement,
  balanceDue,
  birthdayWithin,
  confirmationDue,
  doneKey,
  findOverlap,
  isExpiringSoon,
  isLowStock,
  maintenanceDue,
  pendingReceivable,
  stockAlerts,
  thanksDue,
  todayDue,
} from "./business";
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

describe("A receber do mês", () => {
  const month = new Date(2026, 10, 1);
  const nextMonth = new Date(2026, 11, 1);
  const on = (day: number) => new Date(2026, 10, day, 13).toISOString();
  const rows = [
    { starts_at: on(10), status: "concluido", price: 180, amount_paid: 50 },
    { starts_at: on(12), status: "agendado", price: 220, amount_paid: 0 },
    { starts_at: on(15), status: "cancelado", price: 150, amount_paid: 0 },
    { starts_at: on(16), status: "falta", price: 100, amount_paid: 0 },
    { starts_at: on(18), status: "concluido", price: 100, amount_paid: 100 },
    { starts_at: new Date(2026, 11, 2, 13).toISOString(), status: "concluido", price: 300, amount_paid: 0 },
  ];
  it("sums only what is still open in the month", () => {
    expect(pendingReceivable(rows, month, nextMonth)).toEqual({ total: 350, count: 2 });
  });
  it("is zero when nothing in the month is open", () => {
    expect(pendingReceivable(rows.slice(4), month, nextMonth)).toEqual({ total: 0, count: 0 });
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

describe("Convite para manutenção", () => {
  const today = new Date(2026, 4, 21, 10);
  const visit = (id: string, starts: Date, status = "concluido") => ({
    id,
    client_id: "c1",
    starts_at: starts.toISOString(),
    status,
    procedure_id: "p1",
  });
  const fifteen = () => 15;
  it("is due 15 days after the last completed visit", () => {
    const due = maintenanceDue([visit("a1", new Date(2026, 4, 6, 10))], fifteen, today);
    expect(due.map((d) => d.daysUntil)).toEqual([0]);
  });
  it("is not due 14 days after the visit", () => {
    expect(maintenanceDue([visit("a1", new Date(2026, 4, 7, 10))], fifteen, today)).toHaveLength(0);
  });
  it("is not suggested when the client already has a future booking", () => {
    const due = maintenanceDue(
      [visit("a1", new Date(2026, 4, 6, 10)), visit("a2", new Date(2026, 4, 22, 10), "agendado")],
      fifteen,
      today,
    );
    expect(due).toHaveLength(0);
  });
  it("leaves the list once the invite was sent", () => {
    const due = maintenanceDue([visit("a1", new Date(2026, 4, 6, 10))], fifteen, today, new Set([doneKey("a1", "manutencao")]));
    expect(due).toHaveLength(0);
  });
});

describe("Lembretes de atendimento", () => {
  const now = new Date(2026, 4, 20, 9, 0);
  const appt = (id: string, starts: Date, status = "agendado") => ({ id, starts_at: starts.toISOString(), status });
  it("asks to confirm an appointment 2 days ahead", () => {
    expect(confirmationDue([appt("a", new Date(2026, 4, 22, 14))], now, new Set())).toHaveLength(1);
  });
  it("does not ask to confirm 3 days ahead", () => {
    expect(confirmationDue([appt("a", new Date(2026, 4, 23, 14))], now, new Set())).toHaveLength(0);
  });
  it("does not ask to confirm an already confirmed appointment", () => {
    expect(confirmationDue([appt("a", new Date(2026, 4, 22, 14), "confirmado")], now, new Set())).toHaveLength(0);
  });
  it("drops the confirmation once it was sent", () => {
    expect(confirmationDue([appt("a", new Date(2026, 4, 22, 14))], now, new Set([doneKey("a", "confirmacao")]))).toHaveLength(0);
  });
  it("reminds on the day of the appointment", () => {
    expect(todayDue([appt("a", new Date(2026, 4, 20, 14), "confirmado")], now, new Set())).toHaveLength(1);
  });
  it("does not remind on the day for tomorrow's appointment", () => {
    expect(todayDue([appt("a", new Date(2026, 4, 21, 14))], now, new Set())).toHaveLength(0);
  });
  it("asks to thank after a completed visit", () => {
    expect(thanksDue([appt("a", new Date(2026, 4, 19, 14), "concluido")], now, new Set())).toHaveLength(1);
  });
  it("does not ask to thank before the visit is completed", () => {
    expect(thanksDue([appt("a", new Date(2026, 4, 19, 14), "agendado")], now, new Set())).toHaveLength(0);
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

describe("Estoque", () => {
  const today = new Date(2026, 10, 22);
  it("warns when quantity reaches the minimum", () => {
    expect(isLowStock({ quantity: 2, min_quantity: 2 })).toBe(true);
  });
  it("does not warn above the minimum", () => {
    expect(isLowStock({ quantity: 3, min_quantity: 2 })).toBe(false);
  });
  it("does not watch products without a minimum", () => {
    expect(isLowStock({ quantity: 0, min_quantity: 0 })).toBe(false);
  });
  it("warns 30 days before expiry", () => {
    expect(isExpiringSoon({ quantity: 1, min_quantity: 0, expires_on: "2026-12-22" }, today)).toBe(true);
  });
  it("does not warn 31 days before expiry", () => {
    expect(isExpiringSoon({ quantity: 1, min_quantity: 0, expires_on: "2026-12-23" }, today)).toBe(false);
  });
  it("lists expired products first", () => {
    const { expiring } = stockAlerts(
      [
        { quantity: 1, min_quantity: 0, expires_on: "2026-12-01" },
        { quantity: 1, min_quantity: 0, expires_on: "2026-11-20" },
      ],
      today,
    );
    expect(expiring.map((e) => e.inDays)).toEqual([-2, 9]);
  });
  it("blocks an exit larger than the stock", () => {
    expect(applyMovement(3, "saida", 4)).toBeNull();
  });
  it("adds an entry to the stock", () => {
    expect(applyMovement(3, "entrada", 2)).toBe(5);
  });
});
