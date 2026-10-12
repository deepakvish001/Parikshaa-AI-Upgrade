# Naye account me kaam aage badhane ka prompt (hamesha yahi, kabhi nahi badalta)

Jab ek Claude account ki limit khatam ho:
1. Doosre account se Claude Code kholo.
2. GitHub connect karo. Us account ko repo `deepakvish001/Parikshaa-AI-Upgrade` ka access chahiye.
3. Ye repo chuno.
4. Neeche ka prompt jaisa hai waisa paste karo.

Is prompt me koi branch, PR ya status nahi likha, isliye ye kabhi purana nahi hota. Ye sab repo ki files me rehta hai,
jise har session update karta hai:
- [HANDOFF.md](HANDOFF.md): kaunsa kaam, kis branch par
- us kaam ki handoff file, jaise [HIRE-HANDOFF.md](HIRE-HANDOFF.md): tasks, workflows, checklist, sessions

```text
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
```

**Tokens bachane hon** to pehli line `ultracode` hata do: tab Claude workflows ke kadam ek-ek karke khud karega.
