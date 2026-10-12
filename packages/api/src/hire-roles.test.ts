import { describe, expect, it } from "vitest";
import { orgId, type OrgId } from "@parikshaa/core";
import type { ApiKeyRole, StaffRole } from "@parikshaa/store";
import { can, permissionsOf, type Actor, type Permission } from "./staff-auth.js";

/** Who may do what in Hire (docs/HIRE-V2.md §1 "Permissions", §10 S7, P3, F6). */

const ORG: OrgId = orgId("acme");
const user = (role: StaffRole, extra: Partial<Extract<Actor, { kind: "user" }>> = {}): Actor => ({
  kind: "user",
  id: `u-${role}`,
  orgId: ORG,
  role,
  name: role,
  email: `${role}@acme.test`,
  ...extra,
});
const key = (role: ApiKeyRole): Actor => ({ kind: "api_key", id: `k-${role}`, orgId: ORG, role, name: "ATS" });

const HIRE: readonly Permission[] = ["hire:manage", "hire:review", "hire:decide", "hire:offer"];
const hireOf = (actor: Actor) => HIRE.filter((p) => can(actor, p));

describe("Hire's permissions", () => {
  it("go to each role as the design gives them", () => {
    expect(hireOf(user("owner"))).toEqual(HIRE);
    expect(hireOf(user("author"))).toEqual(HIRE);
    expect(hireOf(user("recruiter"))).toEqual(HIRE);
    expect(hireOf(user("reviewer"))).toEqual(["hire:review", "hire:decide"]);
    expect(hireOf(user("hiring_manager"))).toEqual(["hire:review", "hire:decide"]);
    expect(hireOf(user("viewer"))).toEqual(["hire:review"]);
    expect(hireOf(user("invigilator"))).toEqual([]);
  });

  it("give a hiring manager nothing of the organisation's exams (F6)", () => {
    expect(permissionsOf(user("hiring_manager"))).toEqual(["hire:review", "hire:decide"]);
  });

  it("let a recruiter send and watch the tests a job needs (P3)", () => {
    for (const p of ["exam:read", "exam:write", "attempt:start", "attempt:read", "attempt:review", "attempt:extend"] as const) {
      expect(can(user("recruiter"), p), p).toBe(true);
    }
    for (const p of ["attempt:void", "attempt:grade", "staff:manage", "org:manage", "apikey:manage"] as const) {
      expect(can(user("recruiter"), p), p).toBe(false);
    }
  });

  it("keep deciding on people and making offers to people, never to an integration (S7)", () => {
    expect(hireOf(key("recruiter"))).toEqual(["hire:manage", "hire:review"]);
    expect(hireOf(key("author"))).toEqual(["hire:manage", "hire:review"]);
    expect(hireOf(key("reviewer"))).toEqual(["hire:review"]);
  });

  it("wait, for publishing and offers, until an owner's address is confirmed (S7)", () => {
    expect(hireOf(user("owner", { emailUnverified: true }))).toEqual(["hire:review", "hire:decide"]);
  });
});
