import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BatteryCharging, CalendarClock, CalendarX2, Check, Copy, IdCard, Link2Off, Loader, TriangleAlert, Video, VolumeX, WifiOff } from "lucide-react";
import { ApiError, briefInvitation, redeemInvitation, type Briefing, type Notice } from "../api.ts";
import { BriefingScreen } from "./Instructions.tsx";
import { type Language, uiLocaleOf, usePreferences } from "../i18n.tsx";
import { GateShell, type GateWidth, type Steps } from "./Chrome.tsx";
import type { ProctoringPolicy } from "@parikshaa/core/browser";
import { CameraCheck } from "./CameraCheck.tsx";

interface Props {
  readonly code: string;
  readonly onOpened: (token: string) => void;
  /** Leave the invitation and enter a code by hand instead. */
  readonly onForget: () => void;
}

/** A step before the clock, in the order a candidate meets them. */
type Step = "notice" | "camera" | "instructions";

type Stage =
  | { readonly kind: "opening" }
  | { readonly kind: "steps"; readonly brief: Briefing; readonly at: number }
  // Asked for by opening itself, when the briefing could not say so first.
  | { readonly kind: "notice"; readonly notice: Notice }
  | { readonly kind: "camera"; readonly policy: ProctoringPolicy; readonly consent: { noticeVersion: number } | undefined }
  | { readonly kind: "early"; readonly opensAt: string; readonly brief?: Briefing }
  | { readonly kind: "closed"; readonly closesAt: string }
  | { readonly kind: "invalid" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "offline" };

/** Times as the candidate reads them: IST, spelled out. */
const ist = (iso: string, locale: Language = "en") =>
  `${new Intl.DateTimeFormat(`${locale}-IN`, { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }).format(new Date(iso))} IST`;

/** The steps a briefing asks for: agreement if there is a notice, the camera if the test uses one, then the instructions. */
const stepsOf = (brief: Briefing): readonly Step[] => [
  ...(brief.notice == null ? [] : (["notice"] as const)),
  ...(brief.proctoring == null ? [] : (["camera"] as const)),
  "instructions",
];

/**
 * Opening an invitation link.
 *
 * Before the clock, one step at a time and always in the same order: the
 * organisation's privacy notice, the camera if the test uses one, then the
 * instructions, whose last button starts the test. Early, the candidate is
 * told exactly when to come back, and the page lets them in by itself at that
 * moment. After the window, it says so plainly. An invalid link says only
 * that, and who to ask.
 */
export function InviteGate({ code, onOpened, onForget }: Props) {
  const { t, language } = usePreferences();
  const [stage, setStage] = useState<Stage>({ kind: "opening" });
  const [consent, setConsent] = useState<{ noticeVersion: number } | undefined>(undefined);
  const [cameraReady, setCameraReady] = useState(false);

  const open = useCallback(
    async (agreed?: { noticeVersion: number }, camera?: boolean) => {
      setStage({ kind: "opening" });
      try {
        onOpened((await redeemInvitation(code, "/api", agreed, camera)).token);
      } catch (error) {
        if (!(error instanceof ApiError)) return setStage({ kind: "offline" });
        // The organisation's account, not the candidate's doing: say so without the details.
        if (error.code === "out_of_credits") return setStage({ kind: "unavailable" });
        if (error.code === "camera_required") return setStage({ kind: "camera", policy: error.detail["proctoring"] as ProctoringPolicy, consent: agreed });
        if (error.code === "consent_required") return setStage({ kind: "notice", notice: error.detail["notice"] as Notice });
        if (error.code === "not_open_yet") return setStage({ kind: "early", opensAt: String(error.detail["opensAt"]) });
        if (error.code === "window_closed") return setStage({ kind: "closed", closesAt: String(error.detail["closesAt"]) });
        setStage({ kind: "invalid" });
      }
    },
    [code, onOpened],
  );

  /**
   * The steps first, when the test has not begun and its window is open:
   * none of them starts anything. Early, the page waits with the candidate.
   * Otherwise — resumed, closed, or the briefing unreadable — straight to
   * opening, which says what is wrong.
   */
  const enter = useCallback(async () => {
    try {
      const brief = await briefInvitation(code);
      const now = Date.now();
      if (!brief.started && now < Date.parse(brief.opensAt)) return setStage({ kind: "early", opensAt: brief.opensAt, brief });
      if (!brief.started && now >= Date.parse(brief.opensAt) && now < Date.parse(brief.closesAt)) return setStage({ kind: "steps", brief, at: 0 });
    } catch {
      // Opening explains an invalid or unreachable link better than this could.
    }
    await open();
  }, [code, open]);

  useEffect(() => {
    void enter();
  }, [enter]);

  // Early: try again at the moment the window opens, and at most every minute.
  useEffect(() => {
    if (stage.kind !== "early") return;
    const wait = Math.max(1_000, Math.min(Date.parse(stage.opensAt) - Date.now() + 1_000, 60_000));
    const timer = setTimeout(() => void enter(), wait);
    return () => clearTimeout(timer);
  }, [stage, enter]);

  const LABEL: Record<Step, string> = { notice: t("steps.data"), camera: t("steps.camera"), instructions: t("steps.instructions") };
  let body: ReactNode = null;
  let width: GateWidth = "narrow";
  let steps: Steps | undefined;

  if (stage.kind === "steps") {
    const { brief, at } = stage;
    const all = stepsOf(brief);
    const step = all[at]!;
    const next = () => setStage({ kind: "steps", brief, at: at + 1 });
    steps = { labels: [...all.map((s) => LABEL[s]), t("steps.begin")], current: at };
    width = step === "instructions" ? "full" : "reading";
    if (step === "notice") {
      body = (
        <PrivacyNotice
          notice={brief.notice!}
          onAgree={() => {
            setConsent({ noticeVersion: brief.notice!.version });
            next();
          }}
        />
      );
    } else if (step === "camera") {
      body = (
        <CameraCheck
          policy={brief.proctoring!}
          onReady={() => {
            setCameraReady(true);
            next();
          }}
        />
      );
    } else {
      body = <BriefingScreen brief={brief} cameraChecked={cameraReady} onBegin={() => void open(consent, cameraReady || undefined)} />;
    }
  } else if (stage.kind === "opening") {
    body = (
      <section className="gate-card status-card" aria-labelledby="opening-heading" aria-busy="true">
        <Loader className="status-icon spin" aria-hidden="true" />
        <h1 id="opening-heading">{t("invite.opening")}</h1>
      </section>
    );
  } else if (stage.kind === "notice") {
    width = "reading";
    body = <PrivacyNotice notice={stage.notice} onAgree={() => void open({ noticeVersion: stage.notice.version })} />;
  } else if (stage.kind === "camera") {
    width = "reading";
    body = <CameraCheck policy={stage.policy} onReady={() => void open(stage.consent, true)} />;
  } else if (stage.kind === "early") {
    body = <NotOpenYet opensAt={stage.opensAt} proctored={stage.brief?.proctored ?? false} title={stage.brief?.title} />;
  } else if (stage.kind === "closed") {
    body = (
      <StatusCard icon={CalendarX2} label={t("invite.closedRegion")} title={t("invite.closedOn", { when: ist(stage.closesAt, uiLocaleOf(language)) })}>
        <p className="notice">{t("invite.closedNote")}</p>
      </StatusCard>
    );
  } else if (stage.kind === "invalid") {
    body = (
      <StatusCard icon={Link2Off} label={t("invite.invalidRegion")} title={t("invite.invalid")}>
        <p className="notice">{t("invite.invalidNote")}</p>
        <button type="button" className="secondary" onClick={onForget}>
          {t("invite.haveCode")}
        </button>
      </StatusCard>
    );
  } else if (stage.kind === "unavailable") {
    body = (
      <StatusCard icon={TriangleAlert} label={t("invite.unavailableRegion")} title={t("invite.unavailable")}>
        <p className="notice">{t("invite.unavailableNote")}</p>
        <button type="button" onClick={() => void open()}>
          {t("invite.tryAgain")}
        </button>
      </StatusCard>
    );
  } else {
    body = (
      <StatusCard icon={WifiOff} label={t("invite.offlineRegion")} title={t("invite.offline")}>
        <button type="button" onClick={() => void enter()}>
          {t("invite.tryAgain")}
        </button>
      </StatusCard>
    );
  }

  return (
    <GateShell width={width} {...(steps === undefined ? {} : { steps })}>
      {body}
    </GateShell>
  );
}

/** A page that says one thing: an icon, a sentence, and what to do about it. */
function StatusCard({ icon: Icon, label, title, children }: { icon: typeof Loader; label: string; title: string; children?: ReactNode }) {
  return (
    <section className="gate-card status-card" aria-label={label}>
      <Icon className="status-icon" aria-hidden="true" />
      <h1>{title}</h1>
      {children}
    </section>
  );
}

/** The time until `at`, as a clock: `1:02:03`, or `02:03` under an hour. */
function untilClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

/**
 * Early: when the test opens, counting down, and what to get ready meanwhile.
 * The page lets the candidate in by itself at that moment ({@link InviteGate}).
 */
function NotOpenYet({ opensAt, proctored, title }: { opensAt: string; proctored: boolean; title: string | undefined }) {
  const { t, language } = usePreferences();
  const ui = uiLocaleOf(language);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  const left = Date.parse(opensAt) - now;
  const days = Math.floor(left / 86_400_000);
  const countdown = days >= 1 ? new Intl.NumberFormat(`${ui}-IN`, { style: "unit", unit: "day", unitDisplay: "long" }).format(days) : untilClock(left);
  const prep = [
    { icon: IdCard, text: t("invite.prepId") },
    { icon: VolumeX, text: t("invite.prepRoom") },
    { icon: BatteryCharging, text: t("invite.prepPower") },
    ...(proctored ? [{ icon: Video, text: t("invite.prepCamera") }] : []),
  ];
  return (
    <section className="gate-card status-card early" aria-label={t("invite.earlyRegion")}>
      <CalendarClock className="status-icon" aria-hidden="true" />
      <h1>{title ?? t("invite.earlyRegion")}</h1>
      <p className="opens-label">{t("invite.opensOn")}</p>
      <p className="when">{ist(opensAt, ui)}</p>
      <p className="early-count" role="timer" aria-label={t("invite.opensIn", { time: countdown })}>
        <span className="early-count-label" aria-hidden="true">
          {t("invite.opensInLabel")}
        </span>
        <span className="early-count-time" aria-hidden="true">
          {countdown}
        </span>
      </p>
      <p className="notice">{t("invite.earlyNote")}</p>
      <div className="prep">
        <h2>{t("invite.prepare")}</h2>
        <ul>
          {prep.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Icon aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The organisation's privacy notice, before anything starts (DPDP Act, s.5–6).
 * Reading it costs no test time: the clock starts only once every step is
 * done. The short version first, then the whole notice, then agreement.
 */
function PrivacyNotice({ notice, onAgree }: { notice: Notice; onAgree: () => void }) {
  const { t, language } = usePreferences();
  const [agreed, setAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  // The standing parts of the notice, in the candidate's language where Parikshaa has them.
  const own = uiLocaleOf(language) === "hi" ? notice.translations?.hi : undefined;
  const collected = own?.collected ?? notice.collected;
  const rights = own?.rights ?? notice.rights;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notice.grievance.email);
      setCopied(true);
    } catch {
      // The address is selectable text too.
    }
  };
  return (
    <section className="gate-card notice-card" aria-labelledby="privacy-heading">
      <h1 id="privacy-heading">{t("notice.heading")}</h1>
      <p className="lede">{t("notice.lede")}</p>

      <dl className="glance" aria-label={t("notice.glance")}>
        <div>
          <dt>{t("notice.glanceWho")}</dt>
          <dd>{notice.controllerName}</dd>
        </div>
        <div>
          <dt>{t("notice.why")}</dt>
          <dd>{notice.purpose}</dd>
        </div>
        <div>
          <dt>{t("notice.kept")}</dt>
          <dd>{t("notice.glanceDays", { days: notice.retentionDays })}</dd>
        </div>
        <div>
          <dt>{t("notice.rights")}</dt>
          <dd>{t("notice.glanceRights")}</dd>
        </div>
      </dl>

      <h2>{t("notice.collected")}</h2>
      <ul>
        {collected.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>{t("notice.kept")}</h2>
      <p>{t("notice.keptFor", { days: notice.retentionDays })}</p>
      <h2>{t("notice.rights")}</h2>
      <ul>
        {rights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>{t("notice.grievance")}</h2>
      <p className="grievance">
        <span>{notice.grievance.name}</span>
        <a href={`mailto:${notice.grievance.email}`}>{notice.grievance.email}</a>
        {typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function" ? (
          <button type="button" className="quiet small" onClick={() => void copy()} aria-label={t("notice.copyEmail")}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t("notice.copied") : t("notice.copy")}
          </button>
        ) : null}
      </p>

      <div className="agree-bar">
        <label className="inline">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> {t("notice.agree")}
        </label>
        <button type="button" disabled={!agreed} onClick={onAgree}>
          {t("notice.start")}
        </button>
      </div>
      <p className="notice-version">{t("notice.version", { version: notice.version })}</p>
    </section>
  );
}
