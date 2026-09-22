import { SignJWT, jwtVerify } from "jose";
import {
  attemptId,
  candidateId,
  examId,
  orgId,
  type AttemptId,
  type CandidateId,
  type ExamId,
  type OrgId,
} from "@parikshaa/core";

/**
 * Candidate access is a short-lived token scoped to one attempt.
 *
 * Identity and enrolment are out of scope (SPEC §2), so Parikshaa does not keep
 * candidate accounts. The institution, which already knows who its candidates
 * are, asks for a token naming an attempt; that token grants exactly that
 * attempt and expires with the exam window.
 *
 * The token also names the organisation the attempt belongs to. Every read and
 * write runs scoped to it, so a token can only ever resolve an attempt inside
 * its own organisation — even one whose id happened to collide with another's.
 */
export interface AttemptClaims {
  readonly orgId: OrgId;
  readonly attemptId: AttemptId;
  readonly examId: ExamId;
  readonly candidateId: CandidateId;
}

const ISSUER = "parikshaa";
const AUDIENCE = "parikshaa-attempt";

export class AttemptTokens {
  readonly #key: Uint8Array;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new Error("The attempt token secret must be at least 32 characters");
    }
    this.#key = new TextEncoder().encode(secret);
  }

  async issue(claims: AttemptClaims, ttlSeconds: number): Promise<string> {
    return new SignJWT({
      orgId: claims.orgId,
      attemptId: claims.attemptId,
      examId: claims.examId,
      candidateId: claims.candidateId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.#key);
  }

  async verify(token: string): Promise<AttemptClaims> {
    const { payload } = await jwtVerify(token, this.#key, { issuer: ISSUER, audience: AUDIENCE });
    const { orgId: o, attemptId: a, examId: e, candidateId: c } = payload;
    // A token without an organisation predates tenancy and cannot be scoped,
    // so it is refused rather than guessed at.
    if (typeof o !== "string" || typeof a !== "string" || typeof e !== "string" || typeof c !== "string") {
      throw new Error("Malformed attempt token");
    }
    return { orgId: orgId(o), attemptId: attemptId(a), examId: examId(e), candidateId: candidateId(c) };
  }
}
