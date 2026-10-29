# Visuals: sketch style aur dry-run sliders (19 Oct 2026)

**Owner ne kya diya:** 5 reference images (Git snapshots; Alice → Remote → Bob par commit C ka push; packet routers
se hote hue server tak; browser → remote website vs `localhost:3000`; internet ke upar web, email, video call,
games, messaging, updates) aur kaha: **"aise images ke dry run, DSA wale bhi, sabke rahenge slider me"**. Matlab har
DSA problem ka dry run isi style ki tasveeron ke slider me, aur lessons ke concept diagrams bhi isi style me.

Images repo me: [reference-visuals/](reference-visuals/). Saath ki docs: [EDITORIAL-STYLE.md](EDITORIAL-STYLE.md) (editorial me visuals kahan aate hain),
[../LEARN-V2.md](../LEARN-V2.md) §3d.

---

## 1. Reference images se nikle niyam

| Cheez | Reference me kya hai | Hamara niyam |
|---|---|---|
| Kaagaz | Saaf safed (`#FEFEFE`), bahut khaali jagah | Light: `#FEFEFE`; dark: `#141A2C` (hamara dark surface) |
| Syaahi | Kaali (`#111`), ~2.5 px (1536 px chaudi image par), halki kaanpti, gol sire | `--sketch-ink`: light `#111111`, dark `#E8EBF5`; stroke 2–2.5 px; roughness ~0.9 |
| Highlight | **Sirf ek** coral/salmon rang (`#F8A898` ke aas-paas), jo badal raha hai uspar (naya commit C) | `--sketch-accent` coral `#F6A496`: har frame me **ek hi** "abhi wala" cheez |
| Doosre rang | Nahi | `--sketch-done` pudina `#9FD8B8` sirf aakhri jawab/poora hua; `--sketch-muted` grey hatching jo hata diya |
| Chhaaya | Daayein side aur zameen par **tirchhi lakeerein** (hatching) | rough.js `hachure` fill, 45°, gap 4–5 px |
| Likhawat | Haath ki likhawat jaisa, sentence case, cheez ke neeche label | **Kalam** font (Latin + Devanagari, SIL OFL, app ke saath bundled); code/number ke liye JetBrains Mono ✅ |
| Arrows | Seedha (request, flow); dashed (response, wapas); dashed ghoomta arc ("yahan se wahan gaya") | Teen arrow: `solid`, `dashed`, `arc` |
| Banavat | Baayein → daayein, 3–6 cheezein, ek seedh me, label neeche beech me | Layout engine yahi karta hai |
| Icons | Laptop, server tower, database cylinder, cloud, router (puck + arrows), folder, document (mudha kona), envelope, gamepad, chat bubble, video grid, browser window | "Sketch icons" set (§5) |

**Dark mode:** wahi tasveer, ulte rang (gehra kaagaz, halki syaahi); coral wahi, contrast WCAG AA.

## 2. AI se image kyun nahi, code se kyun

Reference images AI se bani lagti hain. 5,000 problems ke dry run ke liye ye nahi chalega:

| | AI image | **Hamara code renderer** |
|---|---|---|
| Sahi number/text | Aksar galat (array ke number, labels) | **Hamesha sahi**: code chala kar banta hai |
| 50,000+ frames me ek jaisa | Nahi | Haan (ek hi engine, ek hi seed) |
| Dark mode, Hindi labels | Nahi | Haan |
| Size | ~300 KB PNG har ek (~16 GB) | ~5–20 KB SVG (~0.5 GB) |
| Kharch | Har image ka paisa | Lagbhag ₹0 (CPU) |
| Badlaav | Dobara banao | Spec badlo, dobara render |

AI image sirf marketing hero aur mascot ke draft ke liye (final insaan karega).

## 3. Renderer (`packages/sketch`, naya)

```
Visual spec (JSON)  ──┐
                      ├─▶ layout (array, tree, graph, grid, scene…) ─▶ rough.js (seed per element) ─▶ SVG frames
Trace (code chala ke) ┘                                                         │
                                                                  ├─▶ web player (slider)
                                                                  ├─▶ PNG (revision image, PDF notes) via sharp/librsvg
                                                                  └─▶ alt text (har frame)
```

- **Spec (DSL):** `{ kind, initial, steps[] }`. Har step: badlaav (cell set, pointer move, highlight, edge add, push/pop,
  annotate), caption (English + Hinglish), code line number, variables ki table.
- **Trace se frames (DSA dry run):** reference solution ek **instrumented harness** me chalta hai (Python me
  `viz.step(...)` calls, ya `sys.settrace`), jo har kadam ki state likhta hai. AI sirf instrumentation aur caption ka
  template likhta hai. Isliye frame me jo number hai wo **code ne nikala**, AI ne nahi.
- **Stable wobble:** har element ka seed uske id se. Slider aage-peeche karne par lakeer nahi hilti.
- **Layouts:** array/string (cells + index), pointers (arrow upar/neeche), window (band), hash map (buckets), linked
  list (node + arrow), stack/queue, tree (Reingold–Tilford), graph (dagre, MIT), grid/matrix, DP table, recursion tree,
  intervals timeline, number line, bits, segment tree, trie, DSU; scene (icons + arrows, CS concepts jaise reference);
  UML/ER/sequence/architecture (Mermaid ya D2 se layout, phir sketch style me).
- **Libraries:** rough.js (MIT), dagre (MIT), Kalam font (OFL), sharp (Apache-2.0). Sab bundled; runtime par bahar se
  kuch nahi aata ([DESIGN.md](../DESIGN.md) ka niyam).
- **Build time par render:** frames versioned URL par CDN se, hamesha cache. Player sirf SVG dikhata hai; "agla kadam
  batao" mode me spec client par bhi chal sakta hai.

## 4. Dry-run slider (player)

| Hissa | Kaise |
|---|---|
| Frame | Upar sketch SVG; neeche caption (1–2 line), "4 / 12" |
| Chalana | ← → buttons, keyboard arrows, phone par swipe, autoplay (0.5×, 1×, 2×), shuru/aakhir |
| Code ke saath | Baaju me code; **abhi chal rahi line highlight**; neeche variables ki table (jo badla wo coral) |
| "Agla kadam batao" | Agla frame chhupa; learner state bharta hai (pointer kahan, value kya), phir dekhta hai |
| Fullscreen, zoom | Haan; phone par landscape |
| Download | Frame ya poora set PNG/PDF (Plus; learner ka halka watermark) |
| Bhasha | Caption English/Hinglish toggle |
| Accessibility | Har frame ka alt text (state shabdon me); screen reader "frame 4 / 12: i = 2, j = 5, sum = 7, target se bada"; reduced motion par koi animation nahi |
| Speed | Pehla frame turant (inline), baaki lazy; 12 frames ~60–150 KB |

**Kahan-kahan:**
- Problem statement ka example (1 frame).
- Editorial kadam 2: "index 0 se shuru" (3–6 frames), har approach ka pehle/baad (2 frames).
- Editorial kadam 4: **poora dry run slider (5–12 frames, max 20)**, **har DSA problem me**.
- Lessons: concept scenes (Git, network, OS, DBMS) reference jaisi.
- Aptitude: Venn, DI chart, clock, dice, seating, family tree.
- Revision image: ek frame ka saar (revision card ke saath), notes PDF me.

## 5. Sketch icons

- **UI ke icons** (nav, buttons) **saaf** rehte hain (Lucide ✅, pehle se app me): padhne aur click karne ke liye.
- **Content ke icons** (visuals, lessons, marketing) **sketch** me: Lucide (ISC licence) ke paths rough.js se, plus
  apne bane hue: laptop, server tower, database cylinder (3D), cloud, router, switch, packet, folder, document, browser
  window, phone, user, team, lock/key, envelope, gamepad, chat, video grid, gear, cpu, memory chip, disk, process,
  thread, queue, cache, load balancer, CDN, firewall, git commit/branch, container, k8s pod. Shuru me ~80.

## 6. Quality ki jaanch (CI)

- **Golden frames:** har layout ke sample frames ka visual regression.
- **Lint:** ek frame me ek hi coral; label ek doosre par na chadhe (bounding box); contrast dono theme me; alt text
  khaali nahi; frames 5–20.
- **Sach ki jaanch:** dry-run ki aakhri state = reference solution ka output.
- **Insaan:** A2Z ke 100% visuals reviewer dekhta hai; baaki 10%.

## 7. Size aur kharch

5,000 problems × (~1 example + ~8 dry run + ~2 approach) ≈ **55,000 frames**; render ~20 ms har ek ≈ 20 minute CPU;
storage ~0.5 GB SVG (+ PNG sirf maangne par). Kharch lagbhag ₹0; asli kaam renderer banana (LV-F5, LV-F6) aur har
problem ka instrumentation (factory).
