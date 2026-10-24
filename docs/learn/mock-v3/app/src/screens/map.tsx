import { ArrowRight, Palette, Sparkles, ShieldCheck, CodeXml, Globe, Command, SunMoon, Languages, MousePointerClick, Keyboard } from "lucide-react";
import { Link, useT } from "../lib/core";
import { Logo, Hl, Badge } from "../ui/kit";
import { LangButton, ThemeButton, useTri } from "../ui/shell";
import { SCREENS, LEARN_GROUPS, ADMIN_GROUPS, FLOWS, byId } from "./registry";
import { READY } from "./ready";

function Card({ id }: { id: string }) {
  const tri = useTri();
  const t = useT();
  const s = byId(id)!;
  const I = s.icon;
  const ready = READY.has(id);
  return (
    <Link to={id} className={`map-card ${ready ? "" : "soon"}`}>
      <span className={`map-ic ${s.layout.startsWith("admin") ? "adm" : ""}`}>
        <I />
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <b className="ellipsis" style={{ display: "block" }}>
          {tri(s.title)}
        </b>
        <span className="tiny faint">{tri(s.desc)}</span>
      </span>
      {!ready && <span className="tiny faint">{t("soon", "jaldi", "जल्द")}</span>}
    </Link>
  );
}

export function MapBody() {
  const t = useT();
  const tri = useTri();
  const learner = SCREENS.filter((s) => !s.layout.startsWith("admin") && s.group !== "mock");
  const admin = SCREENS.filter((s) => s.layout.startsWith("admin"));
  const groups = [{ id: "entry", name: ["Entry", "Shuruaat", "शुरुआत"] as [string, string, string] }, ...LEARN_GROUPS.map((g) => (g.id === "today" ? { ...g, name: ["Today", "Aaj", "आज"] as [string, string, string] } : g))];
  return (
    <div className="map">
      <header className="map-top">
        <Logo size={28} tag="Mock v4.4" />
        <div className="row g4">
          <LangButton />
          <ThemeButton />
          <Link to="landing" className="btn sm ink">
            {t("Open the site", "Site kholo", "साइट खोलें")}
            <ArrowRight />
          </Link>
        </div>
      </header>

      <section className="map-hero paper-grid">
        <div className="map-hero-in">
          <div className="eyebrow">{t("Parikshaa · design v4.4 (in progress) · 24 Oct 2026", "Parikshaa · design v4.4 (chal raha) · 24 Oct 2026", "परीक्षा · डिज़ाइन v4.4")}</div>
          <h1 className="display map-h1">
            {t("Every screen, ", "Har screen, ", "हर स्क्रीन, ")}
            <Hl>{t("clickable.", "clickable.", "क्लिक करने लायक।")}</Hl>
          </h1>
          <p className="map-sub">
            {t(
              "The learner site, the admin panel and the brand system in one mock. Black by default, paper when you switch. Nothing here is real data.",
              "Learner site, admin panel aur brand system, ek mock me. Default kaala, switch karo to kaagaz. Yahan ka koi data asli nahi.",
              "शिक्षार्थी साइट, एडमिन पैनल और ब्रांड, एक मॉक में। यहाँ का कोई डेटा असली नहीं।",
            )}
          </p>
          <div className="row wrap g10 mt16">
            <Link to="landing" className="btn pri lg">
              <Globe />
              {t("Start at the home page", "Home page se shuru", "होम पेज से शुरू")}
            </Link>
            <Link to="problem" className="btn lg">
              <CodeXml />
              {t("Problem + Sahayak", "Problem + Sahayak", "प्रश्न + सहायक")}
            </Link>
            <Link to="admin" className="btn lg">
              <ShieldCheck />
              {t("Admin panel", "Admin panel", "एडमिन पैनल")}
            </Link>
            <Link to="brand" className="btn lg ghost">
              <Palette />
              {t("Brand system", "Brand system", "ब्रांड")}
            </Link>
          </div>
          <div className="map-tips">
            <span>
              <MousePointerClick /> {t("Every button works", "Har button chalta hai", "हर बटन चलता है")}
            </span>
            <span>
              <Command /> {t("Ctrl K to search", "Ctrl K se khojo", "Ctrl K से खोजें")}
            </span>
            <span>
              <Sparkles /> {t("Ctrl J opens Sahayak", "Ctrl J se Sahayak", "Ctrl J से सहायक")}
            </span>
            <span>
              <Keyboard /> {t("? for all shortcuts", "? se saare shortcuts", "? से शॉर्टकट")}
            </span>
            <span>
              <SunMoon /> {t("Black / paper theme", "Kaala / kaagaz theme", "काला / काग़ज़")}
            </span>
            <span>
              <Languages /> {t("English · Hinglish · हिंदी", "English · Hinglish · हिंदी", "English · Hinglish · हिंदी")}
            </span>
          </div>
        </div>
        <div className="map-count">
          <div>
            <b className="display">{learner.length}</b>
            <span>{t("learner screens", "learner screens", "शिक्षार्थी स्क्रीन")}</span>
          </div>
          <div>
            <b className="display">{admin.length}</b>
            <span>{t("admin screens", "admin screens", "एडमिन स्क्रीन")}</span>
          </div>
          <div>
            <b className="display">8</b>
            <span>{t("staff roles", "staff roles", "भूमिकाएँ")}</span>
          </div>
        </div>
      </section>

      <section className="map-sec">
        <div className="map-sec-h">
          <h2 className="display">{t("Flows", "Flows", "प्रवाह")}</h2>
          <p className="muted">{t("Walk a whole journey, step by step.", "Poora safar kadam-dar-kadam.", "पूरी यात्रा क्रम से।")}</p>
        </div>
        <div className="flows">
          {FLOWS.map((f) => (
            <div className="flow" key={f.name[0]}>
              <div className="flow-name">{tri(f.name)}</div>
              <div className="flow-steps">
                {f.ids.map((id, i) => {
                  const s = byId(id)!;
                  return (
                    <span key={id + i} className="row g4" style={{ minWidth: 0 }}>
                      {i > 0 && <ArrowRight className="flow-arrow" />}
                      <Link to={id} className={`flow-step ${READY.has(id) ? "" : "soon"}`}>
                        {tri(s.title)}
                      </Link>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="map-sec">
        <div className="map-sec-h">
          <h2 className="display">{t("Learner site", "Learner site", "शिक्षार्थी साइट")}</h2>
          <Badge tone="pen">{learner.length}</Badge>
        </div>
        <div className="map-groups">
          {groups.map((g) => {
            const items = learner.filter((s) => s.group === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id} className="map-group">
                <div className="eyebrow">{tri(g.name)}</div>
                <div className="map-grid">
                  {items.map((s) => (
                    <Card key={s.id} id={s.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="map-sec">
        <div className="map-sec-h">
          <h2 className="display">{t("Admin panel", "Admin panel", "एडमिन पैनल")}</h2>
          <Badge tone="ai">{admin.length}</Badge>
          <p className="muted">{t("Switch role from the top bar to see what each role can open.", "Upar se role badlo aur dekho kaun kya khol sakta hai.", "ऊपर से भूमिका बदलें।")}</p>
        </div>
        <div className="map-groups">
          {[{ id: "a-entry", name: ["Sign-in", "Sign-in", "साइन इन"] as [string, string, string] }, ...ADMIN_GROUPS.map((g) => (g.id === "a-home" ? { ...g, name: ["Overview", "Overview", "सारांश"] as [string, string, string] } : g))].map((g) => {
            const items = admin.filter((s) => s.group === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id} className="map-group">
                <div className="eyebrow">{tri(g.name)}</div>
                <div className="map-grid">
                  {items.map((s) => (
                    <Card key={s.id} id={s.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <footer className="map-foot">
        <span className="hand">{t("Made to be argued with. Tell us what to change.", "Behes ke liye bana hai. Batao kya badlein.", "बताइए क्या बदलें।")}</span>
      </footer>
    </div>
  );
}
