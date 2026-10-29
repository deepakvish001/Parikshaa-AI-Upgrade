import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Play,
  Plus,
  Type,
  RotateCcw,
  Eraser,
  Cpu,
  Globe,
  Zap,
  ChevronDown,
  CircleCheck,
  CircleX,
  CircleDashed,
  TriangleAlert,
  Lock,
  FileSpreadsheet,
  FileCode2,
  Variable,
  ListTree,
  Sparkles,
  Share2,
  Download,
  ExternalLink,
  Square,
  Check,
  PanelRight,
  Info,
} from "lucide-react";
import { useT, useToast } from "../lib/core";
import { useAi } from "../lib/state";
import { Badge, Code, LineChart, Menu, Meter, Modal, Tabs } from "../ui/kit";
import { FocusBar, useMedia } from "../ui/focus";
import { SahayakPanel } from "../ui/sahayak";

/* A learner's ML notebook. Runs in the browser by default (Python via Pyodide in the real product), on a Parikshaa
   CPU job for bigger data, or in Google Colab when a GPU is needed. Grading always happens on Parikshaa with data the
   learner never sees. Sample data throughout. */

type Runtime = "browser" | "cpu" | "colab";
type CellState = "idle" | "running" | "done" | "warn";

const PRICES = [24.1, 23.6, 24.8, 25.2, 26.0, 25.4, 26.8, 27.5, 27.1, 28.4, 29.0, 28.2, 27.6, 26.9, 27.8, 29.2, 30.1, 31.4, 30.6, 29.8, 30.9, 32.2, 31.5, 30.4, 29.7, 28.9, 29.6, 30.8, 31.9, 32.6];
const ROLL = PRICES.map((_, i) => {
  const w = PRICES.slice(Math.max(0, i - 6), i + 1);
  return w.reduce((a, b) => a + b, 0) / w.length;
});

function DataFrameOut() {
  const rows = [
    ["2026-09-01", 412, "24.1"],
    ["2026-09-02", 388, "23.6"],
    ["2026-09-03", 451, "24.8"],
    ["2026-09-04", 397, "25.2"],
    ["2026-09-05", 366, "26.0"],
  ];
  return (
    <div className="nb-df" tabIndex={0}>
      <table className="tbl dense">
        <thead>
          <tr>
            <th />
            <th>date</th>
            <th className="r">arrival_t</th>
            <th className="r">modal_price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="faint">{i}</td>
              <td className="mono">{r[0]}</td>
              <td className="mono r">{r[1]}</td>
              <td className="mono r">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="tiny faint">1,095 rows × 3 columns · sample data</span>
    </div>
  );
}

function Cell({
  n,
  kind = "code",
  code,
  out,
  state = "done",
  time,
  active,
  onRun,
}: {
  n?: number;
  kind?: "code" | "md";
  code: string;
  out?: ReactNode;
  state?: CellState;
  time?: string;
  active?: boolean;
  onRun?: () => void;
}) {
  const t = useT();
  if (kind === "md")
    return (
      <section className={`nb-cell md ${active ? "on" : ""}`}>
        <div className="nb-gut" />
        <div className="nb-md">{out}</div>
      </section>
    );
  return (
    <section className={`nb-cell ${active ? "on" : ""} ${state}`}>
      <div className="nb-gut">
        <button className="nb-run" onClick={onRun} aria-label={t("Run cell", "Cell chalao", "सेल चलाएँ")} disabled={state === "running"}>
          {state === "running" ? <span className="spinner" /> : <Play />}
        </button>
        <span className="nb-n mono">[{state === "running" ? "*" : n ?? " "}]</span>
      </div>
      <div className="nb-body">
        <div className="nb-code">
          <Code code={code} nonum />
        </div>
        {(out || time) && (
          <div className="nb-out">
            {time && state !== "running" && (
              <span className="nb-time tiny faint">
                {state === "warn" ? <TriangleAlert className="t-coin" /> : <Check className="t-tick" />} {time}
              </span>
            )}
            {out}
          </div>
        )}
      </div>
    </section>
  );
}

function ColabModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<Zap className="nb-modal-ic" />}
      title={t("Use a GPU in Google Colab", "Google Colab me GPU lo", "Google Colab में GPU")}
      sub={t("Free GPU from Google, your notebook comes back here, and the grade is still given here.", "Google ka free GPU; notebook wapas yahin aati hai, aur grade bhi yahin.", "ग्रेड यहीं मिलेगा।")}
      footer={
        <>
          <button className="btn ghost" onClick={() => toast(t("forecast.ipynb downloaded", "forecast.ipynb download hua", "डाउनलोड हुआ"))}>
            <Download /> .ipynb
          </button>
          <button className="btn pri" onClick={() => (onClose(), toast(t("Copied to your Drive · Colab opens in a new tab", "Drive me copy · Colab naye tab me khulega", "Drive में कॉपी")))}>
            <ExternalLink /> {t("Copy to Drive and open Colab", "Drive me copy karke Colab kholo", "Colab खोलें")}
          </button>
        </>
      }
    >
      <ol className="nb-steps">
        <li>
          <b>{t("Sign in with Google once", "Ek baar Google se sign in", "Google से साइन इन")}</b>
          <span>{t("We ask only to create and read this one file in your Drive, nothing else.", "Sirf ye ek file Drive me banane aur padhne ki permission, aur kuch nahi.", "सिर्फ़ यह फ़ाइल।")}</span>
        </li>
        <li>
          <b>{t("Train with a GPU in Colab", "Colab me GPU se train karo", "Colab में GPU")}</b>
          <span>{t("Runtime → Change runtime type → T4 GPU. Google sets the free limits.", "Runtime → Change runtime type → T4 GPU. Free ki seema Google tay karta hai.", "T4 GPU चुनें।")}</span>
        </li>
        <li>
          <b>{t("Bring it back", "Wapas lao", "वापस लाओ")}</b>
          <span>{t("Press “Sync from Drive” here (or upload the .ipynb). Then Check my work runs your model on the hidden test set.", "Yahan “Drive se sync” dabao (ya .ipynb upload karo). Phir Kaam jaancho chhupe test set par model chalata hai.", "Drive से सिंक करें।")}</span>
        </li>
      </ol>
      <div className="banner pen">
        <Lock />
        <span>{t("The hidden test data never leaves Parikshaa, so a model can't be tuned to it in Colab.", "Chhupa test data Parikshaa se bahar nahi jaata, isliye Colab me model ko us par set nahi kiya ja sakta.", "छिपा डेटा बाहर नहीं जाता।")}</span>
      </div>
    </Modal>
  );
}

export function NotebookScreen() {
  const t = useT();
  const toast = useToast();
  const ai = useAi();
  const phone = useMedia("(max-width: 760px)");
  const [rt, setRt] = useState<Runtime>("browser");
  const [colab, setColab] = useState(false);
  const [side, setSide] = useState<"files" | "data" | "vars">("data");
  const [states, setStates] = useState<CellState[]>(["done", "done", "done", "warn", "running"]);
  const [checked, setChecked] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);
  const shots = () => document.documentElement.classList.contains("shots");

  const runOne = (i: number) => {
    setStates((s) => s.map((x, j) => (j === i ? "running" : x)));
    timers.current.push(window.setTimeout(() => setStates((s) => s.map((x, j) => (j === i ? (i === 3 ? "warn" : "done") : x))), shots() ? 0 : 700));
  };
  const runAll = () => {
    setStates(["running", "idle", "idle", "idle", "idle"]);
    [0, 1, 2, 3, 4].forEach((i) => {
      timers.current.push(
        window.setTimeout(
          () => setStates((s) => s.map((x, j) => (j === i ? (i === 3 ? "warn" : "done") : j === i + 1 ? "running" : x))),
          shots() ? 0 : (i + 1) * 520,
        ),
      );
    });
  };

  const RT: Record<Runtime, { icon: ReactNode; name: string; sub: string }> = {
    browser: { icon: <Globe />, name: t("Browser · Python", "Browser · Python", "ब्राउज़र · Python"), sub: t("Free, no limit · numpy, pandas, scikit-learn", "Free, koi seema nahi · numpy, pandas, scikit-learn", "मुफ़्त") },
    cpu: { icon: <Cpu />, name: t("Parikshaa CPU · 2 vCPU, 4 GB", "Parikshaa CPU · 2 vCPU, 4 GB", "Parikshaa CPU"), sub: t("For bigger data · 7 of 10 jobs left today", "Bade data ke liye · aaj 10 me se 7 jobs bache", "आज 7 / 10 बचे") },
    colab: { icon: <Zap />, name: t("GPU · open in Colab", "GPU · Colab me kholo", "GPU · Colab"), sub: t("Google's free GPU; the grade stays here", "Google ka free GPU; grade yahin", "ग्रेड यहीं") },
  };

  const runtime = (
    <Menu
      width={330}
      trigger={(_, toggle) => (
        <button className="nb-rt" onClick={toggle} aria-label={`${t("Runtime", "Runtime", "रनटाइम")}: ${RT[rt].name}`}>
          <i className={`nb-dot ${rt}`} />
          {RT[rt].icon}
          <span className="hide-phone">{RT[rt].name}</span>
          <ChevronDown />
        </button>
      )}
    >
      {(close) =>
        (Object.keys(RT) as Runtime[]).map((k) => (
          <button
            key={k}
            className={`menu-item nb-rt-item ${rt === k ? "on" : ""}`}
            onClick={() => {
              close();
              if (k === "colab") setColab(true);
              else {
                setRt(k);
                toast(k === "cpu" ? t("Connected to a CPU job", "CPU job se jude", "CPU से जुड़े") : t("Back on browser Python", "Browser Python par wapas", "ब्राउज़र पर"));
              }
            }}
          >
            {RT[k].icon}
            <span className="col">
              <b>{RT[k].name}</b>
              <span className="tiny faint">{RT[k].sub}</span>
            </span>
            {rt === k && <Check className="t-tick" />}
          </button>
        ))
      }
    </Menu>
  );

  const sidebar = (
    <aside className="nb-side">
      <Tabs
        value={side}
        onChange={setSide}
        items={[
          { id: "files", label: t("Files", "Files", "फ़ाइलें") },
          { id: "data", label: t("Data", "Data", "डेटा") },
          { id: "vars", label: t("Variables", "Variables", "वेरिएबल") },
        ]}
      />
      {side === "files" && (
        <div className="nb-list">
          {[
            [<FileCode2 key="a" />, "forecast.ipynb", t("open", "khuli", "खुली")],
            [<FileCode2 key="b" />, "features.py", "1.2 KB"],
            [<FileSpreadsheet key="c" />, "data/indore_onion.csv", "38 KB"],
            [<FileSpreadsheet key="d" />, "data/mandi_codes.csv", "4 KB"],
          ].map(([ic, n, m]) => (
            <div key={n as string} className="nb-li">
              {ic}
              <span className="grow ellipsis mono">{n as string}</span>
              <span className="tiny faint">{m as string}</span>
            </div>
          ))}
          <div className="nb-toc">
            <span className="eyebrow">
              <ListTree /> {t("Contents", "Andar kya hai", "सूची")}
            </span>
            {["1 · Load", "2 · Features", "3 · Look at it", "4 · Train", "5 · Tune"].map((h) => (
              <span key={h} className="tiny">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
      {side === "data" && (
        <div className="nb-list">
          <div className="nb-ds">
            <div className="row between">
              <b className="small mono">indore_onion.csv</b>
              <Badge sq>CC-BY</Badge>
            </div>
            <span className="tiny faint">{t("1,095 days of arrivals and modal price (sample)", "1,095 din ki aamad aur modal bhav (sample)", "1,095 दिन (नमूना)")}</span>
            <div className="nb-cols mono tiny">
              <span>date</span>
              <span>arrival_t</span>
              <span>modal_price</span>
            </div>
          </div>
          <div className="nb-ds">
            <div className="row between">
              <b className="small mono">mandi_codes.csv</b>
              <Badge sq>{t("own", "apna", "अपना")}</Badge>
            </div>
            <span className="tiny faint">{t("42 mandis of Madhya Pradesh", "MP ki 42 mandiyan", "42 मंडियाँ")}</span>
          </div>
          <div className="nb-ds locked">
            <div className="row between">
              <b className="small mono">test.csv</b>
              <Lock />
            </div>
            <span className="tiny faint">{t("Hidden. Check my work scores your model on it.", "Chhupa. Kaam jaancho isi par model ko score karta hai.", "छिपा।")}</span>
          </div>
        </div>
      )}
      {side === "vars" && (
        <div className="nb-list">
          {[
            ["df", "DataFrame", "1,088 × 5"],
            ["X_train", "ndarray", "(870, 3)"],
            ["model", "Ridge", "alpha=1.0"],
            ["rmse", "float", "1.12"],
          ].map(([n, ty, v]) => (
            <div key={n} className="nb-li">
              <Variable />
              <span className="mono grow">{n}</span>
              <span className="tiny faint mono">{ty}</span>
              <span className="tiny mono">{v}</span>
            </div>
          ))}
        </div>
      )}
      <div className="nb-mem">
        <div className="row between tiny">
          <span className="faint">RAM</span>
          <span className="mono">312 MB / 2 GB</span>
        </div>
        <Meter v={16} size="thin" />
      </div>
    </aside>
  );

  return (
    <>
      <FocusBar
        back="build"
        title={t("Mandi price forecast", "Mandi bhav forecast", "मंडी भाव पूर्वानुमान")}
        sub={t("Data & AI · Milestone 2 of 4 · forecast.ipynb", "Data & AI · Milestone 2 / 4 · forecast.ipynb", "डेटा और AI · माइलस्टोन 2 / 4")}
        center={runtime}
        right={
          <>
            <button className="btn sm hide-phone" onClick={() => setColab(true)}>
              <Zap /> {t("GPU in Colab", "Colab me GPU", "Colab GPU")}
            </button>
            <button className="btn sm pri" onClick={() => (setChecked(true), toast(t("2 of 3 checks pass", "3 me se 2 check pass", "3 में से 2")))} aria-label={t("Check my work", "Kaam jaancho", "जाँचें")}>
              <CircleCheck /> <span className="hide-phone">{t("Check my work", "Kaam jaancho", "जाँचें")}</span>
            </button>
            <button className={`icon-btn ${ai.open ? "on" : ""}`} onClick={ai.toggle} aria-label="Sahayak (Ctrl+J)" data-tip="Sahayak (Ctrl+J)" data-tip-pos="bottom">
              <PanelRight />
            </button>
          </>
        }
      />
      <div className={`nb ${ai.open ? "ai-on" : ""}`}>
        {!phone && sidebar}
        <main className="nb-main">
          <div className="nb-tool">
            {phone && runtime}
            <button className="btn sm ghost">
              <Plus /> Code
            </button>
            <button className="btn sm ghost hide-phone">
              <Type /> {t("Text", "Text", "टेक्स्ट")}
            </button>
            <span className="vsep hide-phone" />
            <button className="btn sm ghost" onClick={runAll}>
              <Play /> {t("Run all", "Sab chalao", "सब चलाएँ")}
            </button>
            <button className="btn sm ghost hide-phone">
              <RotateCcw /> {t("Restart", "Restart", "रीस्टार्ट")}
            </button>
            <button className="btn sm ghost hide-phone">
              <Eraser /> {t("Clear outputs", "Output saaf", "आउटपुट साफ़")}
            </button>
            <span className="grow" />
            <span className="tiny faint hide-phone">{t("Saved · autosave on", "Saved · autosave on", "सहेजा")}</span>
            <button className="icon-btn sm" aria-label="Share" onClick={() => toast(t("Read-only link copied", "Sirf padhne ka link copy", "लिंक कॉपी"))}>
              <Share2 />
            </button>
          </div>

          {(
            <div className={`nb-check ${checked ? "fresh" : ""}`}>
              <div className="row between wrap g8">
                <b className="small">
                  {t("Milestone 2 checks", "Milestone 2 ke check", "माइलस्टोन 2 जाँच")} · <span className="t-coin">2 / 3</span>
                </b>
                <span className="tiny faint">{checked ? t("just now", "abhi", "अभी") : t("last run 12 min ago", "12 min pehle", "12 मिनट पहले")}</span>
              </div>
              <div className="nb-check-list">
                <span>
                  <CircleCheck className="t-tick" /> {t("Data loads, no missing dates", "Data load, koi date chhooti nahi", "डेटा लोड")}
                </span>
                <span>
                  <CircleX className="t-red" /> {t("No future data in features (leakage)", "Features me aage ka data nahi (leakage)", "लीकेज नहीं")}
                </span>
                <span>
                  <CircleDashed className="faint" /> {t("RMSE ≤ 3.5 ₹/kg on the hidden test set", "Chhupe test set par RMSE ≤ 3.5 ₹/kg", "RMSE ≤ 3.5")}
                </span>
              </div>
            </div>
          )}

          <div className="nb-cells">
            <Cell
              kind="md"
              code=""
              out={
                <>
                  <h2>{t("Mandi price forecast", "Mandi bhav forecast", "मंडी भाव पूर्वानुमान")}</h2>
                  <p>{t("Predict tomorrow's onion price at Indore mandi from the last 30 days. Beat a naive “same as today” guess.", "Pichhle 30 din se Indore mandi me pyaaz ka kal ka bhav batao. “Kal bhi aaj jaisa” wale andaaze se behtar karo.", "कल का भाव बताओ।")}</p>
                </>
              }
            />
            <Cell
              n={1}
              state={states[0]}
              time="0.4 s"
              onRun={() => runOne(0)}
              code={`import pandas as pd
df = pd.read_csv("data/indore_onion.csv", parse_dates=["date"])
df.head()`}
              out={states[0] === "done" ? <DataFrameOut /> : null}
            />
            <Cell
              n={2}
              state={states[1]}
              time="0.03 s"
              active
              onRun={() => runOne(1)}
              code={`df["lag1"] = df["modal_price"].shift(1)
df["roll7"] = df["modal_price"].rolling(7).mean()
df = df.dropna()`}
            />
            <Cell
              n={3}
              state={states[2]}
              time="0.2 s"
              onRun={() => runOne(2)}
              code={`df.tail(30).plot(x="date", y=["modal_price", "roll7"])`}
              out={
                states[2] === "done" ? (
                  <div className="nb-chart">
                    <LineChart
                      h={170}
                      labels={PRICES.map((_, i) => (i % 5 === 0 ? `${i + 1} Sep` : ""))}
                      series={[
                        { name: "modal_price", data: PRICES, c: "var(--pen)" },
                        { name: "roll7", data: ROLL, c: "var(--coin)", dash: true },
                      ]}
                      fmt={(n) => `₹${Math.round(n)}`}
                    />
                  </div>
                ) : null
              }
            />
            <Cell
              n={4}
              state={states[3]}
              time="0.9 s"
              onRun={() => runOne(3)}
              code={`from sklearn.linear_model import Ridge
from sklearn.metrics import root_mean_squared_error
X, y = df[["lag1", "roll7", "arrival_t"]], df["modal_price"]
split = int(len(df) * 0.8)            # time order, no shuffle
model = Ridge(alpha=1.0).fit(X[:split], y[:split])
rmse = root_mean_squared_error(y[split:], model.predict(X[split:]))
print(f"validation RMSE: {rmse:.2f}")`}
              out={
                states[3] === "warn" ? (
                  <>
                    <pre className="nb-print mono">validation RMSE: 1.12</pre>
                    <div className="nb-warn">
                      <TriangleAlert />
                      <span>
                        {t(
                          "Suspiciously good. roll7 on a day includes that day's own price, the value you are predicting.",
                          "Shak jitna achha. Kisi din ka roll7 usi din ka bhav shaamil karta hai, jo aap predict kar rahe ho.",
                          "रोल7 में उसी दिन का भाव है।",
                        )}{" "}
                        <span className="faint">parikshaa-check · leakage</span>
                      </span>
                      <button className="link tiny" onClick={() => ai.setOpen(true)}>
                        <Sparkles /> {t("Ask Sahayak", "Sahayak se poochho", "सहायक से पूछें")}
                      </button>
                    </div>
                  </>
                ) : null
              }
            />
            <Cell
              n={5}
              state={states[4]}
              time="1 m 08 s · CPU job"
              onRun={() => runOne(4)}
              code={`from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
search = GridSearchCV(Ridge(), {"alpha": [0.1, 1, 10]}, cv=TimeSeriesSplit(5))
search.fit(X[:split], y[:split])`}
              out={
                states[4] === "running" ? (
                  <div className="nb-job">
                    <Cpu />
                    <span className="grow">
                      <b className="small">{t("Running on a Parikshaa CPU job", "Parikshaa CPU job par chal raha", "CPU जॉब पर")}</b>
                      <span className="tiny faint" style={{ display: "block" }}>
                        0:42 / {t("2:00 limit · fold 3 of 5", "2:00 seema · fold 3 / 5", "2:00 सीमा")}
                      </span>
                    </span>
                    <span className="nb-job-bar">
                      <i style={{ width: "60%" }} />
                    </span>
                    <button className="btn sm ghost" onClick={() => setStates((s) => s.map((x, j) => (j === 4 ? "idle" : x)))}>
                      <Square /> {t("Stop", "Roko", "रोकें")}
                    </button>
                  </div>
                ) : states[4] === "done" ? (
                  <pre className="nb-print mono">{`GridSearchCV(cv=TimeSeriesSplit(n_splits=5), estimator=Ridge(), param_grid={'alpha': [0.1, 1, 10]})
best alpha: 10`}</pre>
                ) : null
              }
            />
            <div className="nb-add">
              <button className="btn sm ghost">
                <Plus /> Code
              </button>
              <button className="btn sm ghost">
                <Type /> {t("Text", "Text", "टेक्स्ट")}
              </button>
            </div>
            <p className="tiny faint nb-foot">
              <Info /> {t("Sample notebook and data. In the product, browser Python is Pyodide; CPU jobs run in a sandbox with no internet.", "Sample notebook aur data. Asli product me browser Python = Pyodide; CPU jobs bina internet ke sandbox me.", "नमूना नोटबुक।")}
            </p>
          </div>
        </main>
        {ai.open && (
          <aside className="nb-aux">
            <SahayakPanel context="notebook" onClose={() => ai.setOpen(false)} onMinimize={() => ai.setOpen(false)} />
          </aside>
        )}
      </div>
      <ColabModal open={colab} onClose={() => setColab(false)} />
    </>
  );
}

/** Tiny notebook look for the Build gallery card. */
export function NotebookPrev() {
  return (
    <div className="mini-app nb-prev">
      <span className="np-c">
        <i>[1]</i>
        <b />
      </span>
      <span className="np-chart">
        <svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,30 15,28 30,24 45,26 60,18 75,20 90,12 105,14 120,8" fill="none" stroke="var(--pen)" strokeWidth="2" />
          <polyline points="0,32 15,30 30,27 45,26 60,22 75,21 90,17 105,15 120,12" fill="none" stroke="var(--coin)" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      </span>
      <span className="np-c">
        <i>[2]</i>
        <b className="short" />
      </span>
    </div>
  );
}
