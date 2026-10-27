# Project skills

Claude Code loads every `<name>/SKILL.md` in this folder for anyone who opens this repo, from any account.

## 21st.dev skills (installed 23 Oct 2026)

Seven skills from [21st-dev/skill](https://github.com/21st-dev/skill), commit `15c7436c41dc88c54094f1be93ce53bda456b114`,
copied unchanged. Licence: Apache-2.0 ([21st-dev-LICENSE](21st-dev-LICENSE)). The Codex-only `agents/openai.yaml` files were
left out.

| Skill | What it does |
|---|---|
| `21st-cli-use` | Search the 21st.dev catalogue, print a component's code or a theme's CSS, install a component |
| `21st-ai` | Sketch UI with hosted 21st AI, edit a variant, take its code (paid credits) |
| `21st-ui-build` | Build UI from the project's design context and 21st references |
| `21st-ui-explore` | Three different UI directions to compare |
| `21st-ui-review` | UI audit (`21st review`) and safe fixes |
| `21st-registry` | Publish components, themes and templates to 21st.dev, edit or remove them |
| `21st-design-sync` | Publish the project's colour tokens as a public 21st theme |

They drive the `21st` CLI (`npx @21st-dev/cli`, MIT). What each needs:

- **Network:** the cloud environment must allow `21st.dev` (environment settings → Network access → Allowed domains).
  npm is already allowed.
- **Key:** a 21st API key from https://21st.dev/settings/api-keys, stored as the environment variable
  `TWENTYFIRST_TOKEN` in the environment settings. Never in chat, never in the repo. Even `21st search` refuses without it
  ("Not signed in", checked 23 Oct 2026). Auth details: `21st-cli-use` → Auth.

The rules for using them in this repo are in `CLAUDE.md` ("21st.dev skills").

**Update:** clone the repo again, copy `skills/<name>/SKILL.md` over these files, and change the commit above.
