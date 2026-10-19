# Learn v2: clickable UI mock (19 Oct 2026)

> **Purana (v1), owner ne nakaara (20 Oct).** Naya mock v2: [../mock-v2/README.md](../mock-v2/README.md).

Owner ne maanga: "pura learn platform ko only mock complete UI de sakte ho with flow, phir code karenge baad me".
Ye wahi hai: **46 screens**, har screen ek file, links se juda flow. Data nakli hai, koi product code nahi.

**Dekhne ka link (private, sirf owner):** https://claude.ai/artifact/HkJuHsXgW1rDS5GjYoKsSr
Kisi screen par Play dabao; Landing se shuru karke click karte jao. Doosron ko dikhana ho to page ke Share menu se.

Files `.dc.html` (design canvas ka format) hain; `canvas.json` me har screen ki jagah aur kram. Code karte waqt har
screen ko [../USER-FLOWS.md](../USER-FLOWS.md) aur [../UX-BLUEPRINT.md](../UX-BLUEPRINT.md) ke saath padho.

## Screens

| Row | Screens | Kya dikhata hai (interactive) |
|---|---|---|
| 0 Shared | `TopBar`, `SideNav`, `AdminNav`, `PhoneTabs` | Har page me lagne wale hisse; `active` prop se highlight |
| 1 Pehli baar | `Main` (landing), `Signup`, `Onboarding`, `Home` | Signup/login tab; onboarding 4 kadam (goal, level, samay, bhasha) aur plan ka saar |
| 2 Seekho | `Explore`, `Roadmap`, `Course`, `Lesson` | Category filter; roadmap node chuno → drawer; syllabus accordion; lesson me **dry-run slider** + code tabs + quiz |
| 3 DSA | `Sheet`, `Problem`, `Verdict`, `Editorial` | Topic tabs; Run → samples; WA me **sabse chhota galat test** + hints ek-ek; "fix ke baad" AC + 2 sawaal; editorial 4 kadam + slider |
| 4 Aur practice | `Aptitude`, `Revision`, `Contests` | Sawaal jaancho + tez tareeka; revision card (yaad/mushkil/bhool); contest tabs + live standings |
| 5 Banao | `Studio`, `Arenas`, `HLD`, `Project` | Lab me tests chalao → step aage; 13 arenas + SQL problem; HLD me cache jodo → simulator numbers badlein; Ship it |
| 6 Saboot, career | `Pramaan`, `Career`, `Profile`, `Jobs` | System check; resume ATS score (bullet sudharo → score badhe); privacy chips; ek click apply |
| 7 Saath, account | `Sahayak`, `Community`, `Cohort`, `Progress`, `Plus`, `Settings` | AI ke **do mode** (seekhna/banana); thread chuno; cohort judo; samay range; mahina/saal; settings ke hisse |
| 8 Phone (390) | `PhoneHome`, `PhoneDaily`, `PhoneParsons`, `PhoneDryRun`, `PhoneProblem`, `PhoneSahayak`, `PhoneLeague` | Daily 10 (output batao, khaali jagah, bug), Parsons (upar/neeche), dry run me "agla kadam socho", code keyboard |
| 9 Admin | `AdminHome`, `AdminFactory`, `AdminPackage`, `AdminReview`, `AdminLearners`, `AdminContests` | Batch chuno → fail ki wajah; package tabs (tests, solutions, 10 gates); 4-eyes manzoori; AI kharcha; contest niyam toggle |

## Mukhya flow (click karke)

Landing → Signup → Onboarding → Home → Lesson (slider) → Problem → Submit → Verdict (WA, chhota test, hint, Sahayak)
→ "fix ke baad" → Editorial → Sheet. Home se Revision, Contests, Daily 10 (phone), Studio; side menu se baaki sab.
Admin: side menu me "Admin panel (staff)".

## Design ke faisle (mock me)

- Brand tokens [../../DESIGN.md](../../DESIGN.md) wale: indigo `#3346c4` primary, ek saffron `#f28c28` action har screen par,
  Noto Sans + JetBrains Mono; sketch visuals Kalam font, coral `#F6A496`, ink `#111` ([../VISUAL-STYLE.md](../VISUAL-STYLE.md)).
- Icons inline stroke SVG (Lucide jaise). Charts ek hi hue (indigo) ke shade, har bar par label.
- Daam `[PLUS PRICE]` jaise placeholder; company naam namune ke (Nimbu Labs, Patang Tech…), asli nahi.
- Abhi sirf light theme. Dark aur Hindi/Tamil screenshots code ke waqt (visual baselines ✅ pehle se).

## Kya baaki (code ke waqt)

Empty/loading/error states, dark theme, har bhasha, keyboard flow aur screen reader ki poori jaanch, asli data.
