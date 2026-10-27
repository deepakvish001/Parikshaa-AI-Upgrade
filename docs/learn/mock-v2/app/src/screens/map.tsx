import { ArrowRight, Keyboard, MousePointerClick, Palette, Languages } from "lucide-react";
import { Link, useT } from "../lib/core";
import { Diya, HandUnderline, LogoMark } from "../ui/kit";
import { LangSwitch, ThemeButton } from "../ui/shell";
import { FLOWS, SCREENS } from "./registry";

export function MapScreen() {
  const t = useT();
  const total = SCREENS.filter((s) => s.id !== "map").length;
  return (
    <div className="map">
      <div className="row between wrap">
        <span className="brand">
          <LogoMark size={30} />
          <span>
            Parikshaa <small>Learn · mock v2</small>
          </span>
        </span>
        <div className="row" style={{ display: "flex" }}>
          <div style={{ display: "inline-flex" }} className="map-lang">
            <LangSwitch />
          </div>
          <ThemeButton />
        </div>
      </div>

      <section className="map-hero">
        <div>
          <span className="eyebrow">{t("Clickable mock · v2 · 20 Oct 2026", "Clickable mock · v2 · 20 Oct 2026", "क्लिक करने वाला मॉक · v2")}</span>
          <h1 style={{ marginTop: 10 }}>
            {t("Every screen of Parikshaa Learn, ", "Parikshaa Learn ki har screen, ", "परीक्षा लर्न की हर स्क्रीन, ")}
            <HandUnderline>{t("clickable", "click karke", "क्लिक करके")}</HandUnderline>
            {t(".", " dekho.", " देखें।")}
          </h1>
          <p>
            {t(
              `${total} screens in one app, in the real colours, fonts and icons. Start from the landing page or jump to any screen below. When you like it, this same React code becomes the product.`,
              `${total} screens ek app me, asli rang, font aur icons ke saath. Landing page se shuru karo ya neeche kisi bhi screen par jao. Pasand aaye to yahi React code product banega.`,
              `${total} स्क्रीन एक ऐप में, असली रंग, फ़ॉन्ट और आइकन के साथ। लैंडिंग पेज से शुरू करें या नीचे किसी भी स्क्रीन पर जाएँ।`,
            )}
          </p>
          <div className="row wrap" style={{ marginTop: 20, gap: 10 }}>
            <Link to="landing" className="btn primary lg">
              {t("Start from the landing page", "Landing page se shuru karo", "लैंडिंग पेज से शुरू करें")} <ArrowRight size={16} />
            </Link>
            <Link to="aaj" className="btn secondary lg">
              {t("Open the app", "App kholo", "ऐप खोलें")}
            </Link>
          </div>
          <div className="map-tips">
            <span>
              <MousePointerClick size={15} /> {t("Everything with a hover state is clickable", "Jis par hover ho, wo clickable hai", "जिस पर होवर हो, वह क्लिक होता है")}
            </span>
            <span>
              <Keyboard size={15} /> {t("Ctrl K searches all screens", "Ctrl K se saari screens dhoondho", "Ctrl K से सभी स्क्रीन खोजें")}
            </span>
            <span>
              <Palette size={15} /> {t("Dark and light in the top bar", "Dark aur light top bar me", "डार्क और लाइट ऊपर")}
            </span>
            <span>
              <Languages size={15} /> {t("English, Hinglish, Hindi", "English, Hinglish, Hindi", "अंग्रेज़ी, हिंग्लिश, हिंदी")}
            </span>
          </div>
        </div>
        <div className="map-diya">
          <Diya size={150} mood="happy" className="bob" />
          <span className="faint" style={{ fontSize: "var(--fs-12)", textAlign: "center" }}>
            {t("Mascot concept: Diya. Final art by an illustrator.", "Mascot ka idea: Diya. Final art illustrator banayega.", "शुभंकर का विचार: दीया।")}
          </span>
        </div>
      </section>

      {FLOWS.map((f) => (
        <section key={f.name[0]} className="flow" aria-label={t(...f.name)}>
          <div className="flow-head">
            <h2>{t(...f.name)}</h2>
            <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {f.ids.length} {t("screens", "screens", "स्क्रीन")}
            </span>
          </div>
          <div className="flow-row">
            {f.ids.map((id, i) => {
              const s = SCREENS.find((x) => x.id === id);
              if (!s) return null;
              const Icon = s.icon;
              return (
                <Link key={id} to={id} className="flow-card">
                  <span className="step">{i + 1}</span>
                  <span className="ico">
                    <Icon size={17} />
                  </span>
                  <b>{t(...s.title)}</b>
                  <span>{t(...s.desc)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
