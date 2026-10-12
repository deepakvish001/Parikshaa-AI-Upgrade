// Ran 12 Oct 2026 (session 1). Checks the cross-account resume flow; results go to docs/hire/handoff-verify.md.
export const meta = {
  name: 'handoff-flow-verify',
  description: 'Verify the cross-account resume flow: cold-start simulation, autosave test harness, failure-mode review',
  phases: [{ title: 'Verify', detail: 'three independent checks of the resume flow' }],
}

const REPO = '/home/user/Parikshaa-AI-Upgrade'
const FILES = `The flow lives in: docs/RESUME-PROMPT.md (the one prompt the owner pastes), docs/HANDOFF.md (entry point: work, canonical branch, PR, handoff file), docs/HIRE-HANDOFF.md (the handoff: section 1 start steps, tasks, workflows, checklist, autosave restore, sessions), CLAUDE.md, .claude/settings.json (hooks), scripts/autosave.sh, scripts/limit-watch.sh, docs/hire/workflows/*.js. Canonical branch today: claude/festive-maxwell-pb4k5v (remote origin). Autosave snapshots: refs/heads/autosave/<branch>.`
const SAFETY = `HARD RULES: never run git push, never delete or rewrite any remote ref, never run scripts/autosave.sh or scripts/limit-watch.sh against the real origin, never commit to claude/festive-maxwell-pb4k5v or main. Never use the branch name claude/festive-maxwell-pb4k5v for a local branch in a worktree (it is checked out elsewhere); use a detached HEAD. Read-only on the real remote except git fetch.`
const REPORT = `Return markdown: (1) what worked, (2) numbered problems, each with severity (blocker | important | nice), the evidence (command + output, or file:line), and the exact fix (text to change in which file, or a code change). Be concrete; no praise.`

const CHECKS = [
  {
    key: 'cold-start',
    opts: { isolation: 'worktree' },
    prompt: `You are a FRESH Claude Code session on a different account. You know nothing about this project except what is in the repo. Your working directory is a fresh git worktree created from the default branch (main), exactly like a new account's session. ${SAFETY}
The owner pasted the prompt in the code block of docs/RESUME-PROMPT.md. Read that prompt from origin (it is not on main: find it with git log --all as the prompt itself says, or git show origin/claude/festive-maxwell-pb4k5v:docs/RESUME-PROMPT.md) and FOLLOW IT as a dry run, step by step, using only what the repo tells you:
- do the branch discovery commands exactly as written and check they lead to the right branch;
- check out the canonical branch as a DETACHED HEAD (git checkout --detach origin/<branch>);
- follow section 1 of the handoff: try the autosave restore (fetch autosave refs, read .claude/live/state.md, cherry-pick --no-commit into your worktree to see it applies), build the task list from the Tasks table, find the next workflow/step;
- STOP before building anything. Do not push. Do not add your Sessions row to the real branch (just say what you would write).
Then report as the new session would: at each step, did the instructions work as written? Where did you hesitate, guess, or need knowledge that was not in the repo? What would you have redone or wasted tokens on? Is the next action unambiguous (which workflow/step, which files to read first)? Also check: after checkout, would the hooks in .claude/settings.json be active for a session that started on main (reason from how Claude Code loads project settings; say if uncertain)? ${REPORT}`,
  },
  {
    key: 'autosave-harness',
    opts: {},
    prompt: `Test scripts/autosave.sh and scripts/limit-watch.sh from ${REPO} WITHOUT touching the real remote. ${SAFETY}
Set up: mkdir a temp dir; git init --bare remote.git; git clone ${REPO} into work/ (a plain local clone); in work/ set origin to the bare remote (git remote set-url origin <bare path>); create and check out a branch feat/x; push it to the bare remote; copy the two scripts from the real repo into work/scripts if missing.
Then test, checking the bare remote's refs/heads/autosave/feat/x after each step:
1. modified, untracked, deleted and renamed files are all in the snapshot, parent = HEAD; restoring with git cherry-pick --no-commit on a fresh clone at the same HEAD reproduces the working tree exactly (including deletions);
2. .env, .env.local, sub/.env, a *.pem and a *.key are excluded; an untracked 6 MB file is excluded; a tracked file is still included;
3. "edit" mode throttles (second call within 30 s does nothing) and "stop" does not;
4. no change since the last autosave = no new push; a change = new push;
5. on main, and on a detached HEAD, nothing is pushed;
6. remote unreachable (set origin to a missing path): exits 0 quickly, nothing breaks;
7. hook JSON on stdin with a fake session_id (create ~/.claude/tasks/<fake-id>/1.json in a temp HOME) and a fake transcript_path (a few jsonl lines with user/assistant text): .claude/live/state.md in the snapshot lists the task and the messages; the file is not in the branch's real index and is git-ignored after restore;
8. the restore when the branch has moved on (one more commit on feat/x after the autosave): what does cherry-pick do, and is the handoff's guidance right?
9. portability: the scripts use timeout, mktemp, wc, python3, bash arrays, process substitution: which of these break on macOS (BSD) or Git Bash on Windows, and what is the fallback? (Reason it through; test what you can.)
10. limit-watch: a transcript line with rate_limit_info {status:"allowed_warning", utilization:0.9, resetsAt: <future>} fires once and only once; resetsAt in the past never fires; a status "allowed" with utilization 0.5 never fires; the output is valid JSON with hookSpecificOutput.additionalContext.
Use HOME=<temp> where needed so the real ~/.claude is not touched. ${REPORT}`,
  },
  {
    key: 'failure-modes',
    opts: {},
    prompt: `Adversarially review the cross-account resume flow in ${REPO}. ${FILES} ${SAFETY}
Read every file listed. Then, for each scenario below, trace exactly what happens with the current files and scripts, and say whether work or context is lost, duplicated or corrupted, and the fix:
- the limit hits in the middle of a turn (mid-edit), in the middle of a long Bash command (tests running), and while a multi-agent workflow is running (some agents done, some not; agents' outputs only in the main session's memory vs written to repo files);
- the StopFailure / SessionEnd hooks do not fire when the limit hits (assume the worst);
- two accounts' sessions run at the same time on the canonical branch;
- the canonical branch's PR is merged to main and the work continues on a new branch; the branch is renamed;
- the new session's harness forces it to develop on its own designated branch name (claude/xyz) and refuses pushes elsewhere unless the owner allows: is the prompt's permission sentence enough and unambiguous?
- the new session started on main: .claude/settings.json is not on main, so are the hooks loaded after it checks out the canonical branch? What should the handoff tell the new session to do to make sure autosave is active (e.g. verify .git/autosave-at updates after an edit, or ask the owner to open /hooks or restart)?
- autosave snapshots of half-written code that does not compile: does the restore guidance prevent the next session from trusting it blindly?
- privacy: .claude/live/state.md carries the owner's messages and Claude's messages to a private repo's branch; anything else sensitive that could leak (tokens in transcript text, emails)? Should it redact?
- token waste: does the next session have to read too much before acting (list what is essential vs optional), and is there a single clear "next action" line?
- the task list: the Tasks table vs the live state's task list, which wins if they disagree?
- the workflow resume rules: do w1/w2/w3 scripts follow them (outputs written by agents, complete markers)? Would a future build workflow following the rules really resume without redoing work?
${REPORT}`,
  },
]

phase('Verify')
const out = await parallel(CHECKS.map(c => () =>
  agent(c.prompt, { label: `verify:${c.key}`, phase: 'Verify', ...c.opts }).then(r => ({ key: c.key, report: r }))))
return out.filter(Boolean)
