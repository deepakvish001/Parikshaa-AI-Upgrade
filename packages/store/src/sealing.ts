import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ExamEvent } from "@parikshaa/core";

/**
 * Sealing the personal parts of a ledger (ROADMAP §11): crypto-shredding.
 *
 * The ledger is append-only and hash-chained, so nothing in it can be deleted
 * without breaking the chain — which is its whole point. What a candidate
 * wrote, what they were asked about it, and who they are, are nonetheless
 * personal data that the DPDP Act lets them have erased. So those fields are
 * stored encrypted, each attempt under its own data key, and the chain hashes
 * the ciphertext. Erasing an attempt's personal data is deleting its key: the
 * ciphertext stays, the chain still verifies, and nobody — including whoever
 * holds a backup taken after the erasure — can read what it said.
 *
 * What stays readable, deliberately: which questions were answered and when,
 * the scores, the verdict labels and the timings. They are not about who the
 * candidate is, and they keep a cohort's statistics — and the proof that the
 * record was never altered — intact after everyone in it is erased.
 *
 * Data keys are wrapped with a key-encryption key from the environment
 * (`PARIKSHAA_DATA_KEY`), never stored in the clear.
 */

const PREFIX = "enc:v1:";
export const ERASED = "[erased]";

/** The fields of each event that hold personal data, as paths into the event. */
const PERSONAL: Partial<Record<ExamEvent["type"], readonly (readonly string[])[]>> = {
  attempt_started: [["candidateId"]],
  answer_submitted: [["response", "answer"]],
  viva_probed: [["probe", "prompt"]],
  viva_replied: [["exchange", "reply"]],
  viva_assessed: [["assessment", "reasoning"]],
};

/** Whether an event carries anything personal, and so needs a key to write. */
export const isPersonal = (event: ExamEvent): boolean => PERSONAL[event.type] !== undefined;

function aesSeal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

function aesOpen(key: Buffer, sealed: string, aad: string): Buffer {
  const bytes = Buffer.from(sealed, "base64url");
  if (bytes.length < 28) throw new Error("A sealed value is too short");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(bytes.subarray(bytes.length - 16));
  return Buffer.concat([decipher.update(bytes.subarray(12, bytes.length - 16)), decipher.final()]);
}

/** Holds the key-encryption key; makes and unwraps attempts' data keys. */
export class DataKeys {
  readonly #kek: Buffer;

  /** `kek`: 32 bytes, as base64 (the form `PARIKSHAA_DATA_KEY` takes) or raw. */
  constructor(kek: string | Buffer) {
    const bytes = typeof kek === "string" ? Buffer.from(kek, "base64") : kek;
    if (bytes.length !== 32) throw new Error("The data key must be 32 bytes, base64-encoded (openssl rand -base64 32)");
    this.#kek = bytes;
  }

  /** A fresh data key for an attempt, wrapped for storage. Bound to its attempt: it will not unwrap as another's. */
  newWrapped(orgId: string, attemptId: string): string {
    return aesSeal(this.#kek, randomBytes(32), `${orgId}/${attemptId}`);
  }

  unwrap(orgId: string, attemptId: string, wrapped: string): Buffer {
    return aesOpen(this.#kek, wrapped, `${orgId}/${attemptId}`);
  }
}

type Json = { [key: string]: unknown };

/** A copy of `event` with `fn` applied to each personal field. */
function mapPersonal(event: ExamEvent, fn: (value: string, path: string) => string): ExamEvent {
  const paths = PERSONAL[event.type];
  if (paths === undefined) return event;
  const copy = structuredClone(event) as unknown as Json;
  for (const path of paths) {
    let node: Json = copy;
    for (const step of path.slice(0, -1)) node = node[step] as Json;
    const leaf = path.at(-1)!;
    const value = node[leaf];
    if (typeof value === "string") node[leaf] = fn(value, `${event.type}.${path.join(".")}`);
  }
  return copy as unknown as ExamEvent;
}

/** Encrypt an event's personal fields under the attempt's data key, bound to the attempt and the field. */
export function sealEvent(event: ExamEvent, key: Buffer): ExamEvent {
  return mapPersonal(event, (value, field) => `${PREFIX}${aesSeal(key, Buffer.from(value, "utf8"), `${event.attemptId}/${field}`)}`);
}

/**
 * Decrypt an event's personal fields. With no key — it was erased — they read
 * as `[erased]`. Values that were never sealed (ledgers from before sealing)
 * pass through unchanged.
 */
export function openEvent(event: ExamEvent, key: Buffer | null): ExamEvent {
  return mapPersonal(event, (value, field) => {
    if (!value.startsWith(PREFIX)) return value;
    if (key === null) return ERASED;
    return aesOpen(key, value.slice(PREFIX.length), `${event.attemptId}/${field}`).toString("utf8");
  });
}
