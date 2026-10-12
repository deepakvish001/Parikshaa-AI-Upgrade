# Naye account me kaam aage badhane ka prompt

Jab ek Claude account ki limit khatam ho, to doosre account se Claude Code kholo:
1. GitHub connect karo. Us account ko repo `deepakvish001/Parikshaa-AI-Upgrade` ka access chahiye.
2. Ye repo chuno.
3. Neeche ka prompt jaisa hai waisa paste karo.

Prompt hamesha ek hi rahega. Kaam kahan tak pahuncha, ye prompt me nahi likha jaata: wo
[HIRE-HANDOFF.md](HIRE-HANDOFF.md) me hai, jise har session update karta hai.

```text
Main is repo (deepakvish001/Parikshaa-AI-Upgrade) ka owner hoon. Hire v2 ka kaam pichhle Claude
session(s) me, doosre account(s) se, chal raha tha aur limit ki wajah se ruka. Tum wahi kaam
aage badhao. Jo ho chuka hai use dobara mat banana.

1. Canonical branch claude/festive-maxwell-pb4k5v hai (PR #65). Main tumhe saaf permission deta
   hoon ki isi branch par kaam aur push karo, chahe is session ne tumhe koi aur branch di ho.
   Force-push mat karna. main par push mat karna.
2. Sabse pehle docs/HIRE-HANDOFF.md poora padho aur uske section 1 ("Naya session") ke kadam
   bilkul usi kram me karo:
   - autosave branch se adhoora kaam wapas lao;
   - Sessions table me apni row jodo;
   - Tasks table se apni task list banao;
   - Workflows table me koi workflow adhoora ho to use wahi se dobara chalao;
   - phir "Abhi chal raha" ka agla kadam uthao.
3. Har kadam ke baad commit + push karo, aur handoff (tasks, workflows, checklist, sessions,
   log) update karke push karo. Meri limit kabhi bhi khatam ho sakti hai aur main phir naya
   account kholunga, isliye koi bhi kaam ya faisla sirf apne paas mat rakhna, sab GitHub par ho.
4. Repo ke niyam CLAUDE.md me hain: tracker update, checks. Unhe follow karo.
5. Mujhe Hinglish me chhote updates dete raho: kya ho chuka tha, tum kya kar rahe ho, aage kya.
```

**Optional:** agar multi-agent workflows chahiye (tez aur gehra kaam, par tokens zyada), to prompt ke aakhir me
`ultracode` likh do. Token bachane hain to mat likho: tab Claude workflows ke kadam ek-ek karke khud karega.
