import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GENESIS_HASH, entryPreimage, webcryptoSha256, type LedgerEntry } from "@parikshaa/core/browser";
import { Receipt } from "./components/Receipt.tsx";
import type { CandidateLedger } from "./api.ts";

/** Build a genuinely valid chain, hashed the way the server would hash it. */
async function chain(count: number): Promise<LedgerEntry[]> {
  const entries: LedgerEntry[] = [];
  let prevHash = GENESIS_HASH;
  for (let seq = 0; seq < count; seq += 1) {
    const draft = {
      seq,
      timestamp: 1_700_000_000_000 + seq * 1000,
      event: { type: "attempt_submitted", attemptId: "a1" },
      prevHash,
    } as unknown as Omit<LedgerEntry, "hash">;
    const hash = await webcryptoSha256(entryPreimage(draft));
    entries.push({ ...draft, hash } as LedgerEntry);
    prevHash = hash;
  }
  return entries;
}

const sealed = (entries: LedgerEntry[]): CandidateLedger => ({
  head: entries.at(-1)?.hash ?? null,
  length: entries.length,
  sealed: true,
  entries,
});

describe("Receipt", () => {
  it("names each entry in words, with its question, folded until asked for", async () => {
    const entries = await chain(3);
    const named = entries.map((e, i) =>
      i === 1 ? ({ ...e, event: { type: "answer_submitted", attemptId: "a1", response: { questionId: "q-b", answer: "x" } } } as unknown as LedgerEntry) : e,
    );
    render(<Receipt ledger={sealed(named)} numberOf={(id) => (id === "q-b" ? 3 : null)} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show all 3 entries" }));
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("Answer saved · question 3");
    expect(table).toHaveTextContent("Test submitted");
    expect(table).not.toHaveTextContent("answer_submitted");
  });

  it("checks the record in the browser and says so", async () => {
    render(<Receipt ledger={sealed(await chain(4))} />);

    await userEvent.click(screen.getByRole("button", { name: "Check this record" }));

    // Computed here with WebCrypto, not taken from anything the server said —
    // a badge rendered from a server response would verify nothing.
    expect(await screen.findByRole("status")).toHaveTextContent(/4 entries, unbroken/);
  });

  it("reports which entry breaks a tampered record", async () => {
    const entries = await chain(4);
    entries[2] = { ...entries[2]!, timestamp: 0 };

    render(<Receipt ledger={sealed(entries)} />);
    await userEvent.click(screen.getByRole("button", { name: "Check this record" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/entry 2 shows hash mismatch/i);
    expect(status).toHaveTextContent(/raise it with your institution/i);
  });

  it("offers no check while the attempt is still open", async () => {
    render(<Receipt ledger={{ head: "a".repeat(64), length: 3, sealed: false, entries: null }} />);

    expect(screen.queryByRole("button", { name: "Check this record" })).not.toBeInTheDocument();
    expect(screen.getByText(/opens once your attempt is closed/i)).toBeInTheDocument();
    // The head is still shown: pinning it now is what makes checking later mean
    // anything.
    expect(screen.getByTestId("head-hash")).toHaveTextContent("a".repeat(64));
  });

  it("offers the candidate a readable copy of their data once the attempt has closed", async () => {
    const myData = vi.fn(async () => ({ answers: [] }) as never);
    const saved: string[] = [];
    // jsdom has no object URLs.
    const created = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: () => undefined }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });

    render(<Receipt ledger={sealed(await chain(2))} myData={myData} />);
    await userEvent.click(screen.getByRole("button", { name: "Download my data" }));

    expect(myData).toHaveBeenCalledOnce();
    expect(saved).toEqual(["parikshaa-my-data.json"]);
    expect(created).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("does not offer it while the attempt is open", () => {
    render(<Receipt ledger={{ head: "a".repeat(64), length: 2, sealed: false, entries: null }} myData={async () => ({}) as never} />);
    expect(screen.queryByRole("button", { name: "Download my data" })).toBeNull();
  });
});
