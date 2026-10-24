import { useState, type ReactNode } from "react";
import { Backpack, Bot, BotOff, Building2, CircleHelp, EyeOff, History, MailCheck, Send, ShieldCheck } from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Badge, Seg } from "../ui/kit";

/* AE9 interview format guide (LEARN-V2 §4c), added to the mock on 24 Oct 2026: for each round of a company, whether AI
   is allowed, what is watched, what to bring, and next to every fact the source it came from and when it was checked.
   A fact with no source is not shown, only counted. Nimbu Labs is a made-up sample company. */

type Tri = [string, string, string];
type Rule = "off" | "on" | "unknown";
type SrcKind = "official" | "mail" | "exp";
type Src = { id: string; kind: SrcKind; title: Tri; short: Tri; checked: string; how: Tri; old?: boolean };
type Fact = { k: Tri; v: Tri; src: string[] };
type Round = { name: Tri; meta: Tri; rule: Rule; facts: Fact[]; prep: { to: string; label: Tri }[]; fresh?: Tri };

const SRCS: Src[] = [
  { id: "s1", kind: "official", title: ["Nimbu Labs careers page: interview FAQ", "Nimbu Labs careers page: interview FAQ", "निम्बू लैब्स करियर पेज"], short: ["Careers page", "Careers page", "करियर पेज"], checked: "12 Oct 2026", how: ["Read by our team; a dated copy is kept", "Hamari team ne padha; tareekh ke saath copy rakhi", "टीम ने पढ़ा, कॉपी रखी"] },
  { id: "s2", kind: "mail", title: ["Online test invite mails from 3 candidates", "3 candidates ke online test invite mail", "3 उम्मीदवारों के आमंत्रण मेल"], short: ["Invite mail ×3", "Invite mail ×3", "आमंत्रण मेल ×3"], checked: "Sep 2026", how: ["Sender domain and headers checked", "Bhejne wala domain aur header jaanche", "डोमेन और हेडर जाँचे"] },
  { id: "s3", kind: "exp", title: ["5 verified experiences of Technical 1", "Technical 1 ke 5 verified experiences", "टेक्निकल 1 के 5 अनुभव"], short: ["5 experiences", "5 experiences", "5 अनुभव"], checked: "Aug–Oct 2026", how: ["Each writer's offer or interview mail checked", "Har likhne wale ka offer ya interview mail jaancha", "ऑफ़र या मेल जाँचा"] },
  { id: "s4", kind: "mail", title: ["Recruiter's preparation mail for Technical 2", "Technical 2 ke liye recruiter ka taiyari mail", "रिक्रूटर का तैयारी मेल"], short: ["Recruiter mail", "Recruiter mail", "रिक्रूटर मेल"], checked: "15 Oct 2026", how: ["Shared by 2 candidates; sender checked", "2 candidates ne diya; bhejne wala jaancha", "2 ने दिया, जाँचा"] },
  { id: "s5", kind: "exp", title: ["2 verified experiences of Technical 2", "Technical 2 ke 2 verified experiences", "टेक्निकल 2 के 2 अनुभव"], short: ["2 experiences", "2 experiences", "2 अनुभव"], checked: "Oct 2026", how: ["Interview mail checked", "Interview mail jaancha", "मेल जाँचा"] },
  { id: "s6", kind: "mail", title: ["Intern online test invite, 2025 batch", "Intern online test invite, 2025 batch", "इंटर्न आमंत्रण, 2025"], short: ["Intern invite", "Intern invite", "इंटर्न आमंत्रण"], checked: "Jul 2025", how: ["Sender checked; more than 90 days old", "Bhejne wala jaancha; 90 din se purana", "90 दिन से पुराना"], old: true },
];

const ROUNDS: Record<"sde" | "intern", Round[]> = {
  sde: [
    {
      name: ["Online test", "Online test", "ऑनलाइन टेस्ट"],
      meta: ["90 min · from home · 2 coding + 20 MCQ", "90 min · ghar se · 2 coding + 20 MCQ", "90 मिनट · घर से"],
      rule: "off",
      facts: [
        { k: ["What you may use", "Kya chalega", "क्या चलेगा"], v: ["Only the test's own editor. No docs, no AI tools, no other tab.", "Sirf test ka apna editor. Docs, AI tool, doosra tab nahi.", "सिर्फ़ टेस्ट का एडिटर।"], src: ["s1", "s2"] },
        { k: ["What is watched", "Nigrani", "निगरानी"], v: ["Camera and screen share; leaving the tab is noted.", "Camera aur screen share; tab chhoda to note hota.", "कैमरा और स्क्रीन शेयर।"], src: ["s2"] },
      ],
      prep: [{ to: "apt-mock", label: ["Timed mock like the online test", "Online test jaisa timed mock", "टाइम्ड मॉक"] }],
    },
    {
      name: ["Technical 1", "Technical 1", "टेक्निकल 1"],
      meta: ["60 min · video call · DSA, 2 problems", "60 min · video call · DSA, 2 problems", "60 मिनट · वीडियो कॉल"],
      rule: "off",
      facts: [
        { k: ["What you may use", "Kya chalega", "क्या चलेगा"], v: ["The interviewer's shared editor, paper and pen. Your own IDE and AI tools are off.", "Interviewer ka shared editor, kaagaz-pen. Apna IDE aur AI tool band.", "शेयर एडिटर, कागज़-पेन।"], src: ["s1", "s3"] },
        { k: ["What they look for", "Kya dekhte", "क्या देखते"], v: ["Talking through the approach before coding; edge cases.", "Code se pehle tareeka bol kar samjhana; edge cases.", "पहले तरीका समझाना।"], src: ["s3"] },
      ],
      prep: [{ to: "interview", label: ["Mock interview without AI", "Bina AI mock interview", "बिना AI मॉक इंटरव्यू"] }],
    },
    {
      name: ["Technical 2", "Technical 2", "टेक्निकल 2"],
      meta: ["60 min · video call · a small repo", "60 min · video call · chhota repo", "60 मिनट · छोटा रिपो"],
      rule: "on",
      fresh: ["New since Oct 2026", "Oct 2026 se naya", "अक्टूबर 2026 से नया"],
      facts: [
        { k: ["What you may use", "Kya chalega", "क्या चलेगा"], v: ["The AI chat built into their editor. Your own tools (Copilot, ChatGPT) are not allowed.", "Unke editor me bana AI chat. Apne tool (Copilot, ChatGPT) nahi.", "उनके एडिटर का AI चैट।"], src: ["s4"] },
        { k: ["What they look for", "Kya dekhte", "क्या देखते"], v: ["They see your prompts and ask why you kept or threw away each AI change; tests must pass.", "Wo aapke prompts dekhte aur har AI badlav par poochhte kyun rakha ya hataya; tests pass hone chahiye.", "प्रॉम्प्ट देखते, 'क्यों' पूछते।"], src: ["s4", "s5"] },
      ],
      prep: [
        { to: "ticket-lab", label: ["Ticket lab: repo + AI + tests", "Ticket lab: repo + AI + tests", "टिकट लैब"] },
        { to: "code-read", label: ["Read unfamiliar code", "Anjaan code padhna", "अनजान कोड पढ़ना"] },
      ],
    },
    {
      name: ["HR", "HR", "HR"],
      meta: ["30 min · Bengaluru office or video", "30 min · Bengaluru office ya video", "30 मिनट"],
      rule: "off",
      facts: [{ k: ["What to bring", "Kya laayein", "क्या लाएँ"], v: ["Office: a photo ID and two copies of your resume.", "Office me: photo ID aur resume ki do copy.", "फ़ोटो ID, रिज़्यूमे की दो कॉपी।"], src: ["s1"] }],
      prep: [{ to: "profile", label: ["Your proof sheet to talk through", "Apna saboot ka kaagaz", "सबूत का कागज़"] }],
    },
  ],
  intern: [
    {
      name: ["Online test", "Online test", "ऑनलाइन टेस्ट"],
      meta: ["75 min · from home · 2 coding", "75 min · ghar se · 2 coding", "75 मिनट · घर से"],
      rule: "off",
      facts: [{ k: ["What you may use", "Kya chalega", "क्या चलेगा"], v: ["Only the test's own editor; camera on.", "Sirf test ka editor; camera chalu.", "सिर्फ़ टेस्ट का एडिटर।"], src: ["s6"] }],
      prep: [{ to: "apt-mock", label: ["Timed mock like the online test", "Online test jaisa timed mock", "टाइम्ड मॉक"] }],
    },
    {
      name: ["Technical", "Technical", "टेक्निकल"],
      meta: ["45 min · video call", "45 min · video call", "45 मिनट · वीडियो कॉल"],
      rule: "unknown",
      facts: [],
      prep: [{ to: "interview", label: ["Prepare without AI to be safe", "Pakka rehne ke liye bina AI taiyari", "बिना AI तैयारी"] }],
    },
    {
      name: ["HR", "HR", "HR"],
      meta: ["20 min · video", "20 min · video", "20 मिनट"],
      rule: "off",
      facts: [{ k: ["What to bring", "Kya laayein", "क्या लाएँ"], v: ["College ID on camera.", "Camera par college ID.", "कॉलेज ID।"], src: ["s1"] }],
      prep: [],
    },
  ],
};

const HIDDEN: Record<"sde" | "intern", number> = { sde: 2, intern: 1 };

function RuleBadge({ rule }: { rule: Rule }) {
  const t = useT();
  if (rule === "on") return <Badge tone="ai" icon={<Bot />}>{t("With AI", "AI ke saath", "AI के साथ")}</Badge>;
  if (rule === "off") return <Badge tone="pen" icon={<BotOff />}>{t("No AI", "Bina AI", "बिना AI")}</Badge>;
  return <Badge icon={<CircleHelp />}>{t("Not known", "Pata nahi", "पता नहीं")}</Badge>;
}

const KIND_ICON: Record<SrcKind, ReactNode> = { official: <Building2 />, mail: <MailCheck />, exp: <ShieldCheck /> };

function SrcChip({ id }: { id: string }) {
  const t = useT();
  const s = SRCS.find((x) => x.id === id)!;
  return (
    <span className={`fmt-src ${s.old ? "old" : ""}`}>
      {KIND_ICON[s.kind]}
      {t(...s.short)} · {s.checked}
      {s.old && <b> · {t("may be old", "purana ho sakta", "पुराना हो सकता")}</b>}
    </span>
  );
}

export function InterviewFormat() {
  const t = useT();
  const toast = useToast();
  const [role, setRole] = useState<"sde" | "intern">("sde");
  const rounds = ROUNDS[role];
  const used = new Set(rounds.flatMap((r) => r.facts.flatMap((f) => f.src)));
  const count = (k: Rule) => rounds.filter((r) => r.rule === k).length;
  const parts = [
    count("on") && t(`${count("on")} with AI`, `${count("on")} AI ke saath`, `${count("on")} AI के साथ`),
    count("off") && t(`${count("off")} without AI`, `${count("off")} bina AI`, `${count("off")} बिना AI`),
    count("unknown") && t(`${count("unknown")} not known yet`, `${count("unknown")} abhi pata nahi`, `${count("unknown")} पता नहीं`),
  ].filter(Boolean);

  return (
    <div className="col g16 fmt">
      <section className="card pad fmt-sum">
        <div className="col g6 grow" style={{ minWidth: 0 }}>
          <span className="eyebrow">{t("Interview format", "Interview ka format", "इंटरव्यू का फ़ॉर्मेट")}</span>
          <h2 className="h2">
            {t(`${rounds.length} rounds: `, `${rounds.length} round: `, `${rounds.length} राउंड: `)}
            {parts.join(", ")}
          </h2>
          <p className="small muted">{t("Where AI is allowed, what is watched and what to bring. Every fact shows where it came from and when we checked it; a fact without a source is not shown.", "AI kahan chalega, kya dekha jaata, kya laana hai. Har baat ke saath uska source aur jaanch ki tareekh; jiska source nahi, wo yahan nahi dikhta.", "हर बात के साथ स्रोत और तारीख।")}</p>
        </div>
        <Seg
          value={role}
          onChange={(v) => setRole(v as "sde" | "intern")}
          items={[
            { id: "sde", label: "SDE 1" },
            { id: "intern", label: "SDE intern" },
          ]}
        />
      </section>

      <ol className="fmt-rounds">
        {rounds.map((r, i) => (
          <li key={r.name[0]} className={`card fmt-round ${r.rule}`}>
            <div className="fmt-rh">
              <span className={`rn ${r.rule === "on" ? "ai" : r.rule === "off" ? "pen" : "unk"}`}>{i + 1}</span>
              <div className="col g2 grow" style={{ minWidth: 0 }}>
                <b className="h3">{t(...r.name)}</b>
                <span className="tiny faint">{t(...r.meta)}</span>
              </div>
              <div className="row wrap g6 fmt-badges">
                {r.fresh && <Badge tone="coin">{t(...r.fresh)}</Badge>}
                <RuleBadge rule={r.rule} />
              </div>
            </div>
            {r.facts.length > 0 ? (
              <dl className="fmt-dl">
                {r.facts.map((f) => (
                  <div key={f.k[0]} className="fmt-fact">
                    <dt className="tiny faint">{t(...f.k)}</dt>
                    <dd className="col g6">
                      <span className="small">{t(...f.v)}</span>
                      <span className="row wrap g6">
                        {f.src.map((id) => (
                          <SrcChip key={id} id={id} />
                        ))}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="small muted fmt-none">{t("No source for this round this year yet. Until there is one, prepare as if AI is not allowed.", "Is saal is round ka koi source abhi nahi. Jab tak na mile, maan kar chalo ki AI nahi chalega.", "अभी कोई स्रोत नहीं; बिना AI मानो।")}</p>
            )}
            {r.prep.length > 0 && (
              <div className="row wrap g8 fmt-prep">
                <span className="tiny faint">{t("Prepare:", "Taiyari:", "तैयारी:")}</span>
                {r.prep.map((p) => (
                  <Link key={p.to} to={p.to} className="btn sm ghost">
                    {t(...p.label)}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="banner">
        <EyeOff />
        <span className="small grow">{t(`${HIDDEN[role]} more claims about this company are not shown: we found no source we could check.`, `Is company ke baare me ${HIDDEN[role]} aur baatein nahi dikha rahe: unka koi jaanchne layak source nahi mila.`, `${HIDDEN[role]} बातें नहीं दिखा रहे: स्रोत नहीं।`)}</span>
        <button className="btn sm" onClick={() => toast(t("Thanks. Our team checks it before it shows here.", "Shukriya. Team jaanch kar hi yahan dikhayegi.", "धन्यवाद।"))}>
          <Send /> {t("Send a source", "Source bhejo", "स्रोत भेजो")}
        </button>
      </div>

      <section className="card pad col g12" aria-labelledby="fmt-src-h">
        <h3 className="h3 row g8" id="fmt-src-h">
          <Backpack className="ic" /> {t("Sources for this page", "Is page ke source", "इस पेज के स्रोत")}
        </h3>
        <ul className="fmt-srcs">
          {SRCS.filter((s) => used.has(s.id)).map((s) => (
            <li key={s.id} className={s.old ? "old" : ""}>
              <span className="fmt-sic">{KIND_ICON[s.kind]}</span>
              <span className="col g2 grow" style={{ minWidth: 0 }}>
                <b className="small">{t(...s.title)}</b>
                <span className="tiny faint">{t(...s.how)}</span>
              </span>
              <span className="tiny num fmt-when">
                {s.old && <History />}
                {s.checked}
              </span>
            </li>
          ))}
        </ul>
        <p className="tiny faint">{t("Order of trust: the company's own page or mail, then verified experiences (offer or interview mail checked). A source older than 90 days says so. Something wrong? Tell us and we recheck.", "Bharose ka kram: company ka apna page ya mail, phir verified experiences (offer ya interview mail jaancha). 90 din se purana source khud batata hai. Kuch galat lage to batao, hum dobara jaanchenge.", "भरोसे का क्रम: कंपनी, फिर सत्यापित अनुभव।")}</p>
      </section>
    </div>
  );
}

/** One line for the companies list: how many rounds allow AI, from the same checked facts. */
export function AiRuleLine({ rule }: { rule: Tri }) {
  const t = useT();
  return (
    <span className="tiny row g4 co-ai">
      <Bot /> {t(...rule)}
    </span>
  );
}
