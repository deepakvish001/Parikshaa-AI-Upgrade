# H2c review: kya mila, kya kiya

Do reviewers ne H2c ke commits (`12970ab..f26652f`) padhe. Har finding code se jaanchi gayi. Fixes `WIP(H2c): review fixes`
(`254cf50`) me hain, har behaviour fix ke saath ek test jo fix se pehle fail hota.

- **S18: unverified company ki "moved" mail me round ka title** (R1 #1, R2 #1) → **fixed**. Unverified ho to mail round
  ko uske kind se bulati hai ("Interview", "Online test", …; `mailFacts` ab round `kind` deta hai); `asksForMoney` ab round
  titles bhi padhta hai, to aisi job hold hoti hai. Tests: `hire-messages.test.ts` (fee wala title verify se pehle mail
  me nahi), `hire-routes.test.ts` (round title par `asksForMoney`).
- **P14/F23: message mail "Reply to this mail" kehti thi, jab reply-to tha hi nahi** (R2 #2) → **fixed**. Job ka
  `contactEmail` na ho to mail reply nahi maangti aur saaf kehti hai ki reply company tak nahi pahunchega. Staff ka apna
  email fallback nahi banaya (uski privacy). Test: `hire-messages.test.ts`.
- **S15: typed reason aur audit reject ke transaction ke bahar** (R1 #2, R2 #3) → **fixed**. `HirePipelineStore.reject`
  ab `note` leta hai aur har `rejected` event ke turant baad private `note` event usi transaction me likhta hai; service
  ka per-id `note()` loop hata. Audit commit ke baad akela kadam (house pattern). Test: beech me fail ho to na rejection
  bachta hai na mail.
- **24 h ki rejection mail delay candidate se rejection nahi chhupati** (R1 #3, R2 #7) → **chal raha** (B12): portal
  company ki rejection 24 h tak "in progress" dikhaye, aur us window ke `rejected`/`restored` events na dikhaye.
- **Restore round ka pehle wala status kho deta tha** (R1 #4) → **fixed**. Reject current round ka status `rejected`
  event ke detail (`roundStatus`) me rakhta hai; Restore wahi wapas likhta hai (`failed` ya kuch na ho to `pending`).
  Test: `done` (score 72) → reject → restore → phir `done`, score bacha.
- **Move "next" idempotent nahi** (R1 #5) → **fixed**. Move ab optional `from` leta hai (route body, openapi); jo
  application us round me ab nahi hai wo `stale` (dusri baar move nahi, event/mail nahi). Test: store me retry.
- **Page ke paar `total` 0** (R1 #6, R2 #4) → **fixed**. Total apne CTE se aata hai, page se LEFT JOIN; khaali page par
  bhi sahi. Test: `offset: 10` par `total: 3` (aur `pastSla` ke saath 1).
- **Handoff §5 me "session 4" aur hata hua `thread()`** (R2 #5) → **fixed**. Steps "session 3" ke, `thread()`/
  `messageText()` kahan gaye ye likha.
- **Filler assertions aur badhkar bolta test title** (R2 #6) → **fixed**. `orgId` import aur `expect(asha)` hata;
  test ab "a job's rejection line / is kept with the job" (`sendOnMove` ki jaanch `hire-routes.test.ts` me pehle se).
