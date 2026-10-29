// W5 (session 1, resumed 13 Oct 2026): autosave overwrite fix, then H2c (pipeline) built step by step, reviewed, checked.
// Resumable: every agent first reads the H2c checklist in docs/HIRE-HANDOFF.md §5 and skips what is ticked [x];
// the autosave fix is skipped if scripts/autosave.sh already has STALE_GUARD. Re-run this same script to continue.
export const meta = {
  name: 'hire-w5-h2c',
  description: 'Fix autosave overwrite, then build, review and check H2c (Hire pipeline) step by step with pushes',
  phases: [
    { title: 'Autosave fix' },
    { title: 'Plan H2c' },
    { title: 'Build H2c' },
    { title: 'Review' },
    { title: 'Fix review' },
    { title: 'Final check' },
  ],
}

const BRANCH = 'claude/festive-maxwell-pb4k5v'
const RULES = `Repo: /home/user/Parikshaa-AI-Upgrade. Canonical branch ${BRANCH} (the owner allows pushing here). Rules:
- Never force-push, never push to main, never rewrite history. Before every push: git pull --rebase origin ${BRANCH}.
- Stage only the files you changed (git add <paths>); never git add -A / commit -a; never commit .claude/live/.
- Every commit message ends with these two lines exactly (blank line before them):
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B56n3byNkp5ns8fAHpGtC6
- Usage limit: before starting and between steps, load the claude-code-remote tools with ToolSearch ("select:mcp__claude-code-remote__get_session,mcp__claude-code-remote__list_events"), call get_session (no id) for the session id, then list_events(session_id, kinds:["rate_limit_event"], limit:100). If the newest event's unifiedWindows.five_hour.utilization or seven_day.utilization is >= 0.90, or status is not "allowed": commit and push what is done, write in docs/HIRE-HANDOFF.md §5 exactly where you stopped ([~] + one line), push, and return a result starting with "LIMIT". If the tools are missing, go on.
- Read before coding: docs/HIRE-HANDOFF.md (§5 and §6), docs/HIRE-V2.md §10 (binding: S#, P#, F#, B# items; F# and B# override older text), docs/hire/critique-fit.md (the "Splits" row for H2c and the F# items it names), and the H2a/H2b code you extend: packages/store/src/hire-store.ts, hire-application-store.ts, packages/api/src/hire.ts, hire-apply.ts, hire-routes.ts, hire-messages.ts and their tests. Match their conventions exactly (RLS + withScope/hireScoped, sealing, audit words in console Home.tsx ACTIONS, OpenAPI tags/refusals, wiring in server.ts + assemble.ts + testing/harness.ts + openapi.ts).
- Write in the repo's style; the tracker and handoff are Hinglish.`

phase('Autosave fix')
await agent(`${RULES}

Task: fix a real data-loss bug in scripts/autosave.sh (skip entirely and return "already done" if the script already contains the word STALE_GUARD).
What happened on 13 Oct: a session resumed in an old container whose HEAD was far behind origin/${BRANCH}. Its first tool call fired the autosave hook, which force-pushed a snapshot built on the OLD HEAD to refs/heads/autosave/${BRANCH}, overwriting the newer session's last snapshot (it was only recoverable from a local reflog). Two sessions on one branch also overwrite each other (docs/hire/handoff-verify.md, failure-modes #9).
Fix, keeping every existing behaviour and protection (read the whole script first):
1. STALE_GUARD: before pushing, run a quick git fetch of origin/${BRANCH} (timeout-protected like the push). If HEAD is a strict ancestor of origin/${BRANCH} (the checkout is behind), do not push; write "stale <time>" to "$gitdir/autosave-status" and exit 0. Mark the block with a comment containing STALE_GUARD.
2. Per-session ref: push to refs/heads/autosave/<branch>--<first 8 chars of session_id> (session id from the hook's stdin JSON; "nosession" if absent), so sessions never overwrite each other.
3. Write "ok <epoch> <commit>" or "fail <epoch>" to "$gitdir/autosave-status" after the push.
4. Test in a scratch clone with a local bare remote (never push tests to the real origin; never run the script against the real origin from the test): behind-HEAD case skips; normal case pushes to the per-session ref; two session ids give two refs.
5. Update docs/HIRE-HANDOFF.md §7 restore commands: fetch 'refs/heads/autosave/*', list origin/autosave/<branch>--* by date, take the newest whose parent equals HEAD (others: read their .claude/live/state.md only). Keep the rest of the restore rules. Add a Log line in §10 (Hinglish).
6. Commit "Autosave: never overwrite a newer session's snapshot (per-session refs, stale guard)" and push. Return a short summary.`, { label: 'autosave-fix', phase: 'Autosave fix' })

phase('Plan H2c')
const plan = await agent(`${RULES}

Task: write the H2c (Pipeline) checklist into docs/HIRE-HANDOFF.md §5, if it is not already there (if it is, return its steps as they are).
Base it on the critique-fit.md "Splits" row for H2c, the "AB AGLA: H2c" notes in §5 (pipeline table, move/reject/restore with the override rule and B9, notes, events, bulk with counts, reject_reason P20, P14 message thread + note to candidates + rejection mail sent 24 h later and cancelled on Restore, reply-to/sender F23 EmailMessage.replyTo + fromName, S21/S22: a viewer never sees contact details), and HIRE-V2 §10. Use the same shape as the H2b checklist: 4 to 7 numbered steps, each one shippable with its own tests: migration (next free number after 0072, never edit 0071/0072) → store + tests → service + tests → routes + wiring + openapi → mails/outbox → check + tracker + handoff. Name the files. The last step is: full npm run check EXIT 0, npm run openapi, tracker row for H2c (find the Hire rows 110-120 in docs/PREP-TRACKER.md; H2 is row 112), §6 table, §10 Log, push.
Commit "WIP(H2c): checklist" and push. Return the steps.`,
  { label: 'plan-h2c', phase: 'Plan H2c', schema: { type: 'object', properties: { steps: { type: 'array', items: { type: 'string' } } }, required: ['steps'] } })
log(`H2c steps: ${(plan?.steps || []).length}`)

phase('Build H2c')
let done = false
for (let round = 1; round <= 4 && !done; round++) {
  const r = await agent(`${RULES}

Task: build H2c (Pipeline) from its checklist in docs/HIRE-HANDOFF.md §5. Start at the first step that is not [x] (a [~] step: read its note and the uncommitted/partial code; git log and the files tell you what landed). For EACH step, in order:
- implement it fully with tests (the touched package's vitest files) and typecheck (npm run typecheck -w <package> or tsc for that package; the root typecheck builds api/verify/runner);
- commit "WIP(H2c): <step>" (only your files), git pull --rebase origin ${BRANCH}, push;
- tick it [x] in §5 (add a one-line note: files, test counts), commit, push;
- check the usage limit (rules above) before the next step.
Do not do the final full-check step if earlier steps are not all [x]. When every step except the final one is [x], stop and return "BUILT". If you stop early, leave a [~] note and return "PARTIAL: <where>". Never mark a step [x] with failing tests.`, { label: `build-h2c-${round}`, phase: 'Build H2c' })
  log(`build round ${round}: ${String(r).slice(0, 120)}`)
  if (r && String(r).startsWith('LIMIT')) return { stopped: 'LIMIT during build', last: r }
  done = r && String(r).includes('BUILT')
}
if (!done) return { stopped: 'build did not finish in 4 rounds; checklist in HIRE-HANDOFF.md §5 says where' }

phase('Review')
const LENSES = [
  'correctness and security: tenancy (RLS, withScope/hireScoped, org fences), applicant never sees scores/integrity/notes (S4), viewer never sees contact details (S21/S22), override rule for high integrity, B9 restore rule, bulk actions audited with counts, rejection mail delayed 24 h and cancelled on restore, outbox carries ids only, sealed PII, idempotency and races',
  'conventions and completeness: every H2c checklist item really built and tested; tests prove behaviour (two orgs, roles, refusals); OpenAPI regenerated and tags/refusals right; audit words in ACTIONS; wiring in server/assemble/harness/openapi; no TODOs; handoff §5 accurate; matches HIRE-V2 §10 (S#, P#, F#, B#)',
]
const reviews = await parallel(LENSES.map((lens, i) => () => agent(`${RULES}

Review the H2c code: git diff 12970ab..HEAD (only the H2c commits: the WIP(H2c) ones). Lens: ${lens}.
Find real defects only. For each: file:line, what is wrong, a concrete failing scenario, and the fix. Verify each claim against the code before reporting it (no speculation). Do not edit files. Return markdown, most severe first, at most 15 items; "none" if clean.`, { label: `review-${i + 1}`, phase: 'Review' })))

phase('Fix review')
await agent(`${RULES}

Two reviewers looked at the H2c commits (git diff 12970ab..HEAD). Their findings:

${reviews.filter(Boolean).map((r, i) => `--- Reviewer ${i + 1} ---\n${r}`).join('\n\n')}

For each finding: verify it against the code yourself. Fix the real ones (with a test that fails before and passes after where it is behaviour); skip false ones and say why in one line. Run the touched packages' tests + typecheck. Commit "WIP(H2c): review fixes", pull --rebase, push. Write the outcome (fixed / not a defect) as a short list in docs/hire/h2c-review.md ending with <!-- complete -->, commit and push. Return the list.`, { label: 'fix-review', phase: 'Fix review' })

phase('Final check')
const fin = await agent(`${RULES}

Finish H2c: do the checklist's final step in docs/HIRE-HANDOFF.md §5. Run npm run check (all typecheck + tests; about 12 minutes; run it in the background and wait for it) until EXIT 0, fixing anything H2c broke. Run npm run openapi and commit docs/openapi.json if it changed. If console or web changed, npm run build:clients and npm run budget. Update docs/PREP-TRACKER.md (the H2 row: H2c status, Kahan paths; "Ek nazar me" counts if the rows changed), docs/HIRE-HANDOFF.md (§5: tick the final step, then write "AB AGLA: H2d" with what H2d covers from critique-fit.md "Splits"; §6 H2 row; §10 Log line), docs/HANDOFF.md only if branch/PR changed. Commit "H2c: the pipeline (check passes)", pull --rebase, push. Return: check result (test counts), commits, and what is next.`, { label: 'final-check', phase: 'Final check' })
return { done: true, final: fin }
