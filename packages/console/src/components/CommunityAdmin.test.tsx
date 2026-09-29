import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, StaffExperience, StoreItem, StoreOrder } from "../api.ts";
import { CoinStore, Companies, Experiences, StarterPacks } from "./CommunityAdmin.tsx";

/** Companies, experiences and the coin store in the console (ROADMAP §16), against a stub of its client. */

function show(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("companies", () => {
  it("adds a company and reports the problems it asked on a day", async () => {
    const client = {
      companies: vi.fn(async () => [{ id: "c1", slug: "acme", name: "Acme", about: "", reports: [] }]),
      practiceProblems: vi.fn(async () => [
        { id: "p1", title: "Two sum", published: true },
        { id: "p2", title: "LRU cache", published: true },
      ]),
      saveCompany: vi.fn(async () => ({ id: "c2", slug: "globex", name: "Globex", about: "" })),
      reportProblems: vi.fn(async () => 2),
      deleteReport: vi.fn(async () => undefined),
    };
    const user = userEvent.setup();
    show(<Companies client={client as unknown as ConsoleClient} canWrite />);
    const form = await screen.findByRole("form", { name: "New company" });
    await user.type(within(form).getByLabelText("Company name"), "Globex");
    await user.click(within(form).getByRole("button", { name: "Add company" }));
    await waitFor(() => expect(client.saveCompany).toHaveBeenCalledWith(null, { name: "Globex", about: "" }));

    await user.click(await screen.findByRole("button", { name: "Reports" }));
    const reports = await screen.findByRole("form", { name: "Report problems" });
    await waitFor(() => expect(within(reports).getByRole("option", { name: "LRU cache" })).toBeTruthy());
    await user.selectOptions(within(reports).getByLabelText("Problems asked"), ["p1", "p2"]);
    const day = within(reports).getByLabelText("Asked on");
    await user.clear(day);
    await user.type(day, "2026-09-15");
    await user.click(within(reports).getByRole("button", { name: /Add 2 reports/ }));
    await waitFor(() => expect(client.reportProblems).toHaveBeenCalledWith("c1", ["p1", "p2"], "2026-09-15"));
  });

  it("offers no editing without the right to write", async () => {
    const client = { companies: vi.fn(async () => []), practiceProblems: vi.fn(async () => []) };
    show(<Companies client={client as unknown as ConsoleClient} canWrite={false} />);
    expect(await screen.findByText("No companies yet.")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "New company" })).toBeNull();
  });
});

describe("experiences", () => {
  it("publishes one that is waiting", async () => {
    const waiting: StaffExperience = {
      id: "e1",
      learnerId: "l1",
      company: { slug: "acme", name: "Acme" },
      role: "SDE 1",
      interviewed: "2026-08",
      verdict: "offer",
      rounds: [{ kind: "DSA", asked: "Two sum", problemSlugs: ["two-sum"], problems: [{ slug: "two-sum", title: "Two Sum" }] }],
      tips: "",
      author: "Asha",
      status: "pending",
      votes: 0,
      at: "2026-09-01T00:00:00Z",
    };
    const client = { experiences: vi.fn(async () => [waiting]), decideExperience: vi.fn(async () => undefined) };
    const user = userEvent.setup();
    show(<Experiences client={client as unknown as ConsoleClient} canWrite />);
    const item = await screen.findByRole("article", { name: "Acme, SDE 1, by Asha" });
    expect(within(item).getByText("(Two Sum)")).toBeTruthy();
    await user.click(within(item).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(client.decideExperience).toHaveBeenCalledWith("e1", "published"));
    expect(client.experiences).toHaveBeenCalledWith("pending");
  });
});

describe("starter packs", () => {
  it("adds a pack once, and says so", async () => {
    let imported = false;
    const client = {
      starterPacks: vi.fn(async () => [
        { name: "cs-fundamentals", title: "CS fundamentals", description: "OS, DBMS, CN.", lessons: 36, problems: 80, imported: true },
        { name: "sql-starter", title: "SQL", description: "Queries that run.", lessons: 0, problems: 8, imported },
      ]),
      importStarterPack: vi.fn(async () => {
        imported = true;
        return { track: "sql-starter", lessons: 0, problems: 8 };
      }),
    };
    const user = userEvent.setup();
    show(<StarterPacks client={client as unknown as ConsoleClient} canWrite />);
    expect(await screen.findByText("(36 lessons, 80 problems)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add CS fundamentals" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add SQL" }));
    await waitFor(() => expect(client.importStarterPack).toHaveBeenCalledWith("sql-starter"));
    expect(await screen.findByText("Added 8 problems, and the track.")).toBeTruthy();
  });
});

describe("the coin store", () => {
  it("adds a Plus item, and marks an order sent", async () => {
    const items: StoreItem[] = [];
    const order: StoreOrder = {
      id: "o1",
      itemId: "i9",
      title: "T-shirt",
      priceCoins: 400,
      address: "12 MG Road, Pune",
      status: "placed",
      note: "",
      createdAt: "2026-09-01T00:00:00Z",
      closedAt: null,
      learnerId: "l1",
      learnerName: "Asha",
      learnerEmail: "asha@example.com",
    };
    const client = {
      storeItems: vi.fn(async () => [...items]),
      storeOrders: vi.fn(async () => [order]),
      saveStoreItem: vi.fn(async (_id: string | null, draft: Omit<StoreItem, "id">) => {
        const saved = { ...draft, id: "i1" };
        items.push(saved);
        return saved;
      }),
      closeStoreOrder: vi.fn(async () => undefined),
    };
    const user = userEvent.setup();
    show(<CoinStore client={client as unknown as ConsoleClient} canManage />);
    const form = await screen.findByRole("form", { name: "New item" });
    await user.type(within(form).getByLabelText("Item"), "Plus, a month");
    await user.selectOptions(within(form).getByLabelText("Kind"), "plus");
    await user.clear(within(form).getByLabelText("Days of Plus"));
    await user.type(within(form).getByLabelText("Days of Plus"), "30");
    await user.clear(within(form).getByLabelText("Price in coins"));
    await user.type(within(form).getByLabelText("Price in coins"), "2000");
    await user.click(within(form).getByRole("button", { name: "Add item" }));
    await waitFor(() =>
      expect(client.saveStoreItem).toHaveBeenCalledWith(null, { title: "Plus, a month", description: "", kind: "plus", plusDays: 30, priceCoins: 2000, stock: null, perLearner: 1, active: true }),
    );
    expect(await screen.findByText("(30 days of Plus)")).toBeTruthy();

    const orders = screen.getByRole("region", { name: "Store orders" });
    expect(within(orders).getByText("12 MG Road, Pune")).toBeTruthy();
    await user.click(within(orders).getByRole("button", { name: "Mark sent" }));
    await waitFor(() => expect(client.closeStoreOrder).toHaveBeenCalledWith("o1", "fulfilled", ""));
  });
});
