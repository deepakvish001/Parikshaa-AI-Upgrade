# Live state at the last autosave (the time is in the autosave commit)

- Branch: `claude/keen-curie-5u1wgz`, on top of `a861b2b824e7ba8a63080fde74bb857ff382085c`
- Session: `ca0ade48-292a-5993-ada4-6cd2110c54a5`

## Uncommitted changes

```
(none)
```

## Task list (this session)

(none)

## Owner's latest message

https://github.com/Jakeschincariol/replica-skill

install it

## Claude's latest messages (newest last)

I'm reviewing the skill pack before installing it. The Python tools only use the standard library and make no network calls. Next I'll check which files they write to.

---

The scripts only read their input files and write to the `--out` path you give them. Installing the 11 skill folders now:

---

I installed the Replica skill pack. All 11 skills are now in `~/.claude/skills/`:

`/replica-recon` → `/replica-architect` → `/replica-design` → `/replica-build` → `/replica-backend` → `/replica-test` → `/replica-diff` → `/replica-entrepreneur` → `/replica-brand` → `/replica-launch` → `/replica-deploy`

They are meant to run in that order. Each one reads the files the one before it wrote into a `replica/` folder in your project. You can also run any one on its own, for example `/replica-entrepreneur` to read real user reviews of an app before you decide to clone it.

**Safety check before installing:**
- I read every skill file and every Python script.
- The six Python tools use only Python's built-in library and never connect to the internet. They read the files you point them at and write only to an output path you give them.
- Nothing needed installing, and the pack's own 57 tests pass here.
- The skills only rebuild an app's features and flows. They refuse to copy another app's code, logos or text, and won't deploy until the rebrand check passes.

**This install is temporary.** This cloud container is deleted when the session ends, and the skills go with it. I also can't confirm this session has picked them up yet. If `/replica-recon` doesn't show up, that's why.

To keep them, I can copy the 11 folders into this repo's `.claude/skills/` and open a draft PR. Every future session on this repo would then have them. Should I do that?

---

