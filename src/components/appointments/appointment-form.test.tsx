import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentForm } from "./appointment-form";

const CLIENTS = [
  { id: "c1", name: "Maria Clara", phone: "11987654321" },
  { id: "c2", name: "Ana Beatriz", phone: null },
];

const PROCEDURES = [
  {
    id: "p1",
    name: "Volume russo",
    category: "aplicacao",
    lash_model: "Volume russo",
    price: 220,
    duration_minutes: 180,
    maintenance_days: 20,
    active: true,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const rows = table === "clients" ? CLIENTS : table === "procedures" ? PROCEDURES : [];
      const query = {} as Record<string, unknown> & {
        then: (resolve: (value: { data: unknown; error: null }) => void) => void;
      };
      for (const method of ["select", "order", "gte", "lt", "eq", "is", "insert", "update", "delete", "single", "maybeSingle"]) {
        query[method] = () => query;
      }
      query.then = (resolve) => resolve({ data: rows, error: null });
      return query;
    },
  },
}));

function renderForm(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <AppointmentForm open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

async function openWithClientsLoaded() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderForm(qc);
  const input = await screen.findByPlaceholderText("Buscar ou digitar nome da cliente");
  // the client list must be in memory before we assert nothing of it is on screen
  await waitFor(() => expect(qc.getQueryData(["clients"])).toBeDefined());
  return { qc, input };
}

describe("Busca de cliente no agendamento", () => {
  it("não lista as clientes enquanto nada foi digitado", async () => {
    await openWithClientsLoaded();
    expect(screen.queryByText("Maria Clara")).not.toBeInTheDocument();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
  });

  it("mostra a cliente a partir de duas letras digitadas", async () => {
    const { input } = await openWithClientsLoaded();
    fireEvent.change(input, { target: { value: "mar" } });
    expect(await screen.findByText("Maria Clara")).toBeInTheDocument();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
  });
});
