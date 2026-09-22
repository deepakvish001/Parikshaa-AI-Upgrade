import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
