# Chal raha kaam (sab accounts aur sessions ke liye entry point)

Is repo ka bada kaam kai Claude sessions aur accounts me chalta hai. Ye file batati hai ki abhi kaunsa kaam chal raha
hai, kis branch par, aur uski handoff file kahan hai. Naya session [RESUME-PROMPT.md](RESUME-PROMPT.md) wale prompt se
yahan aata hai.

| Kaam | Status | Canonical branch | PR | Handoff (yahan se shuru karo) |
|---|---|---|---|---|
| **Learn v2 (poora platform + content), PEHLI PRIORITY** (owner, 19 Oct 2026: "Learn pehle karo") | Chal raha | `claude/learn-v2` (`claude/festive-maxwell-pb4k5v` se nikli) | [#67](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/67) **merged** 27 Oct (Kadam 0 + Kadam 1) `claude/festive-maxwell-pb4k5v` me, `main` me nahi; `main` tak [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66) se jayega. [#68](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/68) (docs) bhi 27 Oct ko usi branch me merge. [#69](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/69) (K2-0 + K2-1) bhi 27 Oct ko usi branch me merge. **Kadam 2 ab draft [#70](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/70) me** (K2-2 se, 27 Oct khola), base `claude/festive-maxwell-pb4k5v` jab tak #66 merge na ho, phir `main` | [LEARN-HANDOFF.md](LEARN-HANDOFF.md) |
| Hire v2 (job post se offer tak) | **Ruka** (19 Oct 2026: owner ne Learn pehle kaha; agla H2d kadam 2) | `claude/festive-maxwell-pb4k5v` (ab `main` ke upar; #65 ke baad ka kaam isi par) | [#65](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/65) merge ho chuka (12 Oct, H0–H2a ke 2 kadam tak). Ab [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66) (lockfile fix + H2a + aage ka kaam) | [HIRE-HANDOFF.md](HIRE-HANDOFF.md) |

**Niyam:**
- Branch ya PR badle (jaise PR merge hokar kaam nayi branch par shift ho), to **sabse pehle is table ko update karke
  push karo**. Agla session isi se rasta dhoondhta hai.
- Naya bada kaam shuru ho (jaise Learn, TPO, scholarship), to yahan nayi row aur uski apni handoff file banao, usi
  shakal me jaise HIRE-HANDOFF.md hai.
- Kaam poora ho jaaye to Status "Poora" karo. Row mat hatao.
