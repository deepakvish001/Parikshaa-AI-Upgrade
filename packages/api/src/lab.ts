import { BlockList, isIP } from "node:net";
import { examId as toExamId, type OrgId } from "@parikshaa/core";
import { candidateScope, staffScope, type InvitationStore, type LabSettings, type LabStore, type LedgerStore } from "@parikshaa/store";
import type { AttemptId } from "@parikshaa/core";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Lab mode (docs/PILOT.md, "A sitting in a lab"). An exam can be limited to
 * the college's own network — its lab's IP addresses — so a candidate cannot
 * sit it from a hostel room, and its candidates can be held at the start
 * until an invigilator starts everyone together.
 *
 * The network is checked when a candidate opens their link and on every
 * request after, until the exam's window closes; after that a candidate can
 * read their own record from anywhere. It says only where a request came
 * from, which a VPN into the college network also satisfies: it keeps honest
 * people honest, as a lab door does, and is not proof of presence.
 */

export class OutsideNetwork extends Error {
  constructor() {
    super("This test can only be taken on your institution's network: open it from a computer in the exam room");
    this.name = "OutsideNetwork";
  }
}

export class WaitingForStart extends Error {
  constructor() {
    super("The invigilator has not started the test yet");
    this.name = "WaitingForStart";
  }
}

/** A network as staff write it: an address, or a CIDR range. Returns why it is not one, or null. */
export function networkProblem(entry: string): string | null {
  const [address, prefix, ...rest] = entry.trim().split("/");
  const family = isIP(address ?? "");
  if (family === 0 || rest.length > 0) return `"${entry}" is not an IP address or a range like 203.0.113.0/24`;
  if (prefix === undefined) return null;
  const bits = Number(prefix);
  const max = family === 4 ? 32 : 128;
  return /^\d+$/.test(prefix) && bits >= 0 && bits <= max ? null : `"${entry}" has a range size outside 0 to ${max}`;
}

/** An IPv4 address as Node reports it on a dual-stack socket, "::ffff:203.0.113.7", back to itself. */
const plain = (ip: string) => (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip);

export function admitted(networks: readonly string[], ip: string): boolean {
  if (networks.length === 0) return true;
  const list = new BlockList();
  for (const entry of networks) {
    const [address, prefix] = entry.trim().split("/");
    const type = isIP(address!) === 6 ? "ipv6" : "ipv4";
    if (prefix === undefined) list.addAddress(address!, type);
    else list.addSubnet(address!, Number(prefix), type);
  }
  const from = plain(ip);
  const family = isIP(from);
  return family !== 0 && list.check(from, family === 6 ? "ipv6" : "ipv4");
}

export interface LabView extends LabSettings {
  /** Where this request came from: what to write in `networks` for the room staff are sitting in. */
  readonly yourAddress: string;
}

/** How long a candidate request trusts what it last read: a change reaches everyone within this. */
const FRESH_MS = 10_000;

export class LabService {
  readonly #lab: LabStore;
  readonly #invitations: InvitationStore;
  readonly #store: LedgerStore;
  readonly #exams: ExamService;
  readonly #now: () => number;
  readonly #cache = new Map<string, { readonly at: number; readonly settings: LabSettings; readonly closesAt: number | null }>();

  constructor(options: { readonly lab: LabStore; readonly invitations: InvitationStore; readonly store: LedgerStore; readonly exams: ExamService; readonly now?: () => number }) {
    this.#lab = options.lab;
    this.#invitations = options.invitations;
    this.#store = options.store;
    this.#exams = options.exams;
    this.#now = options.now ?? (() => Date.now());
  }

  async get(actor: Actor, examId: string, ip: string): Promise<LabView> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    await this.#exists(actor.orgId, examId);
    return { ...(await this.#lab.get(staffScope(actor.orgId), examId)), yourAddress: plain(ip) };
  }

  async set(actor: Actor, examId: string, settings: { readonly networks: readonly string[]; readonly startTogether: boolean }, ip: string): Promise<LabView> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    await this.#exists(actor.orgId, examId);
    const networks = [...new Set(settings.networks.map((n) => n.trim()).filter((n) => n !== ""))];
    const problem = networks.map(networkProblem).find((p) => p !== null);
    if (problem !== undefined) throw new AttemptError("invalid_state", problem);
    // Locking out the room staff are in is almost always a mistake made while typing.
    if (networks.length > 0 && !admitted(networks, ip) && actor.kind === "user") {
      throw new AttemptError("invalid_state", `Your own address, ${plain(ip)}, is not in the list: add it if you are in the exam room, or candidates here will be turned away`);
    }
    const saved = await this.#lab.set(actor.orgId, examId, { networks, startTogether: settings.startTogether }, new Date(this.#now()));
    this.#cache.delete(`${actor.orgId}:${examId}`);
    await this.#exams.recordAudit(actor, "exam.lab_set", examId, { networks, startTogether: settings.startTogether });
    return { ...saved, yourAddress: plain(ip) };
  }

  /** Let everyone waiting begin. */
  async start(actor: Actor, examId: string): Promise<string> {
    if (!can(actor, "attempt:extend")) throw new Forbidden("attempt:extend");
    await this.#exists(actor.orgId, examId);
    const at = new Date(this.#now());
    if (!(await this.#lab.start(actor.orgId, examId, at))) {
      throw new AttemptError("invalid_state", "This exam is not waiting for a start: turn on “Candidates wait for the invigilator” first");
    }
    this.#cache.delete(`${actor.orgId}:${examId}`);
    await this.#exams.recordAudit(actor, "exam.lab_started", examId);
    return at.toISOString();
  }

  /**
   * Whether a candidate may open or carry on with an attempt from `ip`.
   * Throws OutsideNetwork if not; with `starting`, WaitingForStart while the
   * sitting waits for its invigilator.
   */
  async check(orgId: OrgId, examId: string, ip: string, options: { readonly starting?: boolean; readonly attemptId?: AttemptId } = {}): Promise<void> {
    const { settings, closesAt } = await this.#read(orgId, examId, options.attemptId);
    const open = closesAt === null || this.#now() < closesAt;
    if (open && !admitted(settings.networks, ip)) throw new OutsideNetwork();
    if (options.starting === true && settings.startTogether && settings.startedAt === null) throw new WaitingForStart();
  }

  async #read(orgId: OrgId, examId: string, attemptId: AttemptId | undefined) {
    const key = `${orgId}:${examId}`;
    const cached = this.#cache.get(key);
    if (cached !== undefined && this.#now() - cached.at < FRESH_MS) return cached;
    const scope = attemptId === undefined ? staffScope(orgId) : candidateScope(orgId, attemptId);
    const [settings, window] = await Promise.all([this.#lab.get(scope, examId), this.#invitations.getWindow(staffScope(orgId), examId)]);
    const entry = { at: this.#now(), settings, closesAt: window === null ? null : Date.parse(window.closesAt) };
    this.#cache.set(key, entry);
    return entry;
  }

  async #exists(orgId: OrgId, examId: string): Promise<void> {
    if ((await this.#store.loadExam(staffScope(orgId), toExamId(examId))) === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
  }
}
