import type { RedactedAnswer } from "./redact.js";

/**
 * Prompt construction, arranged for prompt caching.
 *
 * Caching is a prefix match over `tools` -> `system` -> `messages`, so anything
 * that varies per candidate must come *after* everything that does not. The
 * question and its rubric are identical for every candidate sitting the same
 * exam; only the answer differs. Putting the question in a cached system block
 * and the answer in the user message means one cache write per question instead
 * of one per candidate — the difference between 500 full-price calls and 1.
 *
 * Nothing in the cached prefix may vary: no timestamps, no ids, no counters.
 * A single changed byte invalidates it, and the symptom is silent — spend goes
 * up and `usage.cache_read_input_tokens` quietly reads zero.
 */

export const PROBE_SYSTEM = `You write micro-vivas for an assessment system.

A micro-viva is ONE short follow-up question put to a candidate about an answer
they have already submitted. Its purpose is to find out whether they can account
for their own answer — not to re-test the topic, and not to trap them.

A good probe does exactly one of these:
- asks them to justify a specific step or choice they actually made
- asks them to extend their result to a neighbouring case
- asks what would change, or break, if a stated premise moved

Rules:
- The probe MUST depend on the candidate's specific answer. If it could be
  answered by someone who had only read the question, it is a bad probe.
- Ask ONE thing. No multi-part questions, no "and also".
- Two sentences at most. Plain language.
- Never imply suspicion, never accuse, never mention cheating or provenance.
- Never reveal whether their answer was right or wrong.

Reply with the probe text and nothing else. No preamble, no quotation marks.`;

export const ASSESS_SYSTEM = `You assess micro-viva replies for an assessment system.

You are given a question, a candidate's original answer, a follow-up probe, and
their reply to that probe. Judge ONE thing: is the reply consistent with someone
who produced that original answer themselves?

Verdicts:
- "consistent"   — the reply engages the specific reasoning of their answer in a
                   way that someone who did the work could, and someone who only
                   had the answer could not.
- "shallow"      — the reply restates the answer or offers generic reasoning
                   without engaging the specifics the probe asked about.
- "inconsistent" — the reply contradicts their own answer, or misunderstands
                   what they themselves wrote.
- "inconclusive" — the probe was weak, the reply was too short to judge, or the
                   evidence genuinely does not separate the cases.

"inconclusive" is a real verdict and you are expected to use it. Do not reach for
a decisive verdict you cannot support; a wrong confident verdict is far more
costly here than an honest "inconclusive".

You are assessing PROVENANCE, not correctness. A wrong answer defended coherently
is "consistent". A correct answer that the candidate cannot engage with is not.

Your reasoning will be shown to the candidate on appeal. Write it so it stands up
to being read by the person it is about: cite what they said, state what it did
or did not show, no speculation about their conduct.`;

export const GRADE_SYSTEM = `You grade exam answers against a rubric.

Award marks strictly against the rubric criteria given. For each criterion,
decide whether the answer meets it, and sum the weights of those it meets,
scaled to the maximum score.

- Grade only what the answer says, never what you assume the candidate meant.
- Do not award marks for correct statements that no criterion asks for.
- Do not deduct marks for style, length or spelling unless a criterion says to.
- Your reasoning is shown to the candidate. Cite the answer, name the criteria.`;

/** The cacheable half: everything that is the same for every candidate. */
export function questionContext(answer: RedactedAnswer): string {
  const rubric =
    answer.rubric.length === 0
      ? "(no rubric criteria)"
      : answer.rubric.map((c) => `- [weight ${c.weight}] ${c.description}`).join("\n");

  return `QUESTION (type: ${answer.questionKind}, max score: ${answer.maxScore})
${answer.stem}

RUBRIC
${rubric}`;
}

/** The volatile half: this candidate's answer, and nothing identifying them. */
export function answerBlock(answer: RedactedAnswer): string {
  return `CANDIDATE'S ANSWER\n${answer.answer}`;
}

export function replyBlock(probePrompt: string, reply: string, latencyMs: number): string {
  return `PROBE PUT TO THE CANDIDATE
${probePrompt}

THEIR REPLY
${reply}

REPLY LATENCY: ${Math.round(latencyMs / 1000)}s (measured server-side, probe sent to reply received)`;
}
