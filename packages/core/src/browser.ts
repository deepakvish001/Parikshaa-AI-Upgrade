/**
 * The part of the domain that runs anywhere.
 *
 * `index.ts` re-exports the ledger, which hashes with `node:crypto` and so
 * cannot be bundled for a browser. That is not an accident of packaging: a
 * client has no business holding the hashing code, because it has no business
 * producing ledger entries. Only the server appends.
 *
 * What a client does need is the vocabulary, the candidate projection, exam
 * validation and deterministic scoring — all pure.
 *
 * (A candidate verifying their own receipt in the browser would need a hash,
 * and would have to use WebCrypto's async digest. That is a real feature and
 * not this one.)
 */
export * from "./domain.js";
export * from "./candidate-view.js";
export * from "./validate.js";
export * from "./scoring.js";
