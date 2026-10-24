# Live state at the last autosave (the time is in the autosave commit)

- Branch: `claude/ultracode-learn-v2-opx8f5`, on top of `a861b2b824e7ba8a63080fde74bb857ff382085c`
- Session: `eb426b80-ab54-56ea-8823-565e77e2f8d9`

## Uncommitted changes

```
(none)
```

## Task list (this session)

(none)

## Owner's latest message

ultracode

Main is repo ka owner hoon. Is repo ka bada kaam kai Claude sessions aur accounts me chal raha
hai, aur pichhla session (kisi doosre account par) limit ki wajah se ruka hai. Tum wahi se aage
badhao. Jo ho chuka hai use dobara mat banana. Ultracode (workflows) se hi kaam karo.

1. Kaam kis branch par chal raha hai, ye khud pata karo. Default branch par mat maan lena:
     git fetch origin '+refs/heads/*:refs/remotes/origin/*'
     git log --all --exclude='refs/remotes/origin/autosave/*' -1 --format='%H %ci' -- docs/HANDOFF.md
     git branch -r --contains <commit>
   Us commit ki docs/HANDOFF.md padho (git show <commit>:docs/HANDOFF.md). Usme kaam, canonical
   branch, PR aur handoff file ka naam likha hai.
2. Main tumhe saaf permission deta hoon ki HANDOFF.md me likhi canonical branch par kaam aur push
   karo, chahe is session ne tumhe koi aur branch di ho. Force-push mat karna. Default branch
   (main) par push mat karna.
3. Us branch ko checkout karo aur us kaam ki handoff file ka section 1 ("Naya session") kram se
   karo:
   - autosave branch se adhoora kaam aur .claude/live/state.md (pichhle session ki task list,
     mera aakhri sandesh, uske aakhri sandesh) wapas lao;
   - Sessions table me apni row jodo;
   - Tasks table se apni task list banao;
   - koi workflow adhoora ho to use wahi se dobara chalao;
   - phir agla kadam uthao.
4. Har kadam ke baad commit + push karo, aur handoff update karke push karo. Limit kabhi bhi
   khatam ho sakti hai, isliye koi bhi kaam ya faisla sirf apne paas mat rakhna. Har kadam se
   pehle apni limit dekho (handoff me tareeka: list_events rate_limit_event). 90% se upar ho to
   turant sab save karke mujhe bata do ki doosre account se shuru karun.
5. Repo ke niyam CLAUDE.md me hain. Mujhe Hinglish me chhote updates dete raho.

Abhi tak (24 Oct 2026): Learn v2 chal raha hai, branch claude/learn-v2.
- Mock v4.4 me 76 screens hain (preview Version 13). Aaj ka roop A aur Profile ka roop B final.
- AI ke daur ke AE1, AE2, AE3, AE4, AE5, AE7, AE8 mock me ban chuke.
- Build ka kram tay hai: contract-first frontend, Kadam 0–5 (docs/learn/CODE-READINESS.md §4b,
  tracker plan row 138).
  - Jahan backend pehle se hai, wahan naya screen seedha asli API se judega.
  - Jahan backend nahi hai, wahan pehle API contract (types + OpenAPI) likho aur nakli data us
    par chalao.
  - Naya UI feature flag ke peeche rahega.
- Accounts ki aaj ki haalat CODE-READINESS §0 me hai:
  - GitHub Actions budget ki wajah se band;
  - Supabase parikshaa-mumbai paused;
  - Vercel par project nahi;
  - Anthropic key nahi.
Pehle docs/LEARN-HANDOFF.md §1 ka kadam 2b karo: §5 ka "Sabse taaza" aur "Agla", §7 ka log aur
git log -10 padho, taaki pata chale pichhle session ne kya kiya.

Mere faisle (jo yahan nahi likha, us par ruk kar mujhse poochna; jo likha hai use tracker ke
"Faisle" me darj karna):
F1 = <haan, shuru karo / abhi nahi>
F2 = <brand sab jagah / sirf Learn>
F5 = <main har PR merge karunga / CI hara ho to tum merge karo …

## Claude's latest messages (newest last)

Shuru karta hoon: pehle pata karta hoon kaam kis branch par chal raha hai.

---

