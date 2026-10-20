import { useState, type ReactNode } from "react";
import { Search, Bell, Lock, ChevronDown, ShieldCheck, Eye, Clock, Check, ExternalLink, ChevronRight, LogOut, KeyRound, Menu as MenuIcon, Send } from "lucide-react";
import { Link, useT, useStopwatch, hms, useToast } from "../lib/core";
import { useRole, ROLES, MATRIX, type Role } from "../lib/state";
import { SCREENS, ADMIN_GROUPS, byId, type ScreenDef } from "../screens/registry";
import { Logo, Avatar, Kbd, Menu, Badge, Modal } from "./kit";
import { useTri, ThemeButton, LangButton, CommandPalette, useCmdK } from "./shell";

function activeAdmin(route: string) {
  let s = byId(route);
  while (s && !s.nav && s.parent) s = byId(s.parent);
  return s?.id ?? route;
}

function AdminSide({ route, onSearch, open, onClose }: { route: string; onSearch: () => void; open: boolean; onClose: () => void }) {
  const tri = useTri();
  const t = useT();
  const { can, role } = useRole();
  const active = activeAdmin(route);
  const roleName = ROLES.find((r) => r.id === role)!;
  return (
    <>
      {open && <div className="adm-scrim" onClick={onClose} />}
      <aside className={`adm-side ${open ? "open" : ""}`} aria-label="Admin">
        <div className="adm-side-top">
          <Link to="admin" style={{ display: "inline-flex" }}>
            <Logo size={26} tag="Admin" />
          </Link>
        </div>
        <button className="adm-env">
          <span className="env-dot" />
          <span className="grow">
            <b>Production</b>
            <span className="tiny faint">{tri(roleName.name)}</span>
          </span>
          <ChevronDown />
        </button>
        <button className="side-search" onClick={onSearch}>
          <Search />
          <span className="grow">{t("Search", "Khojo", "खोजें")}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        <nav className="side-nav">
          {ADMIN_GROUPS.map((g) => {
            const items = SCREENS.filter((s) => s.group === g.id && s.nav);
            return (
              <div className="side-group" key={g.id}>
                {g.name[0] && <div className="side-label">{tri(g.name)}</div>}
                {items.map((s) => {
                  const I = s.icon;
                  const ok = !s.mod || can(s.mod);
                  return (
                    <Link
                      key={s.id}
                      to={s.id}
                      className={`side-item ${ok ? "" : "locked"}`}
                      current={active === s.id}
                      data-tip={ok ? undefined : t("Not in your role", "Aapke role me nahi", "आपकी भूमिका में नहीं")}
                    >
                      <I />
                      <span className="grow ellipsis">{tri(s.title)}</span>
                      {!ok ? <Lock className="lock" /> : s.badge && <span className="side-count">{s.badge}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <Link to="aaj" className="side-item">
            <ExternalLink />
            <span className="grow">{t("Open learner site", "Learner site kholo", "शिक्षार्थी साइट")}</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

function RoleSwitch() {
  const { role, setRole } = useRole();
  const tri = useTri();
  const t = useT();
  const toast = useToast();
  const cur = ROLES.find((r) => r.id === role)!;
  return (
    <Menu
      width={300}
      trigger={(_, toggle) => (
        <button className="role-btn" onClick={toggle} data-tip={t("Preview the panel as another role", "Doosre role ki nazar se dekho", "दूसरी भूमिका से देखें")} data-tip-pos="bottom">
          <Eye />
          <span className="hide-phone tiny faint">{t("Viewing as", "Role", "भूमिका")}</span>
          <b>{tri(cur.name)}</b>
          <ChevronDown />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="eyebrow" style={{ padding: "6px 10px" }}>
            {t("Preview as role (mock)", "Role badal kar dekho (mock)", "भूमिका बदलकर देखें")}
          </div>
          {ROLES.map((r) => (
            <button
              key={r.id}
              className="menu-item"
              onClick={() => {
                setRole(r.id as Role);
                toast(t(`Now viewing as ${r.name[0]}`, `Ab ${r.name[1]} ki nazar se`, `अब ${r.name[2]} के रूप में`));
                close();
              }}
            >
              <span className="grow">
                <b style={{ fontWeight: 560 }}>{tri(r.name)}</b>
                <span className="tiny faint" style={{ display: "block" }}>
                  {r.desc}
                </span>
              </span>
              {role === r.id && <Check />}
            </button>
          ))}
        </>
      )}
    </Menu>
  );
}

function SessionTimer() {
  const [s] = useStopwatch(0);
  const left = Math.max(0, 30 * 60 - 74 - s);
  const t = useT();
  return (
    <span className="sess hide-phone" data-tip={t("Signs out after 30 minutes idle", "30 minute idle par logout", "30 मिनट निष्क्रिय पर लॉगआउट")} data-tip-pos="bottom">
      <Clock />
      <span className="num">{hms(left, false)}</span>
    </span>
  );
}

function AdminTop({ route, onMenu }: { route: string; onMenu: () => void }) {
  const t = useT();
  const tri = useTri();
  const chain: ScreenDef[] = [];
  let s = byId(route);
  while (s) {
    chain.unshift(s);
    s = s.parent ? byId(s.parent) : undefined;
  }
  return (
    <header className="topbar adm-top">
      <button className="icon-btn adm-burger" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </button>
      <nav className="crumbs">
        <span className="faint">Admin</span>
        {chain.map((c, i) => (
          <span key={c.id} className="row g6" style={{ minWidth: 0 }}>
            <ChevronRight className="crumb-sep" />
            {i < chain.length - 1 ? (
              <Link to={c.id} className="crumb-link">
                {tri(c.title)}
              </Link>
            ) : (
              <span className="crumb-now ellipsis">{tri(c.title)}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="grow" />
      <span className="audit-chip hide-phone" data-tip={t("Every change you make is written to the audit log", "Aapka har badlaav audit log me jaata hai", "हर बदलाव ऑडिट लॉग में")} data-tip-pos="bottom">
        <ShieldCheck />
        {t("Logged", "Log ho raha", "लॉग")}
      </span>
      <SessionTimer />
      <RoleSwitch />
      <span className="hide-phone">
        <LangButton compact />
      </span>
      <ThemeButton />
      <button className="icon-btn hide-phone" aria-label="Notifications">
        <Bell />
        <span className="dot-badge" />
      </button>
      <Menu
        width={220}
        trigger={(_, toggle) => (
          <button onClick={toggle} aria-label="Account" style={{ display: "inline-flex", marginLeft: 4 }}>
            <Avatar name="Meera Iyer" size={30} tone={3} />
          </button>
        )}
      >
        {(close) => (
          <>
            <div style={{ padding: "6px 10px 8px" }}>
              <b>Meera Iyer</b>
              <div className="tiny faint">meera@parikshaa.example · 2FA on</div>
            </div>
            <div className="menu-sep" />
            <Link to="adm-security" className="menu-item" onClick={close}>
              <KeyRound /> {t("Security & 2FA", "Security aur 2FA", "सुरक्षा और 2FA")}
            </Link>
            <Link to="admin-login" className="menu-item dang" onClick={close}>
              <LogOut /> {t("Sign out", "Sign out", "साइन आउट")}
            </Link>
          </>
        )}
      </Menu>
    </header>
  );
}

/** What a staff member sees on a page their role cannot open. */
export function NoAccess({ mod }: { mod: string }) {
  const t = useT();
  const tri = useTri();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const who = ROLES.filter((r) => (MATRIX[mod]?.[r.id] ?? "none") !== "none");
  return (
    <div className="no-access paper-grid">
      <span className="na-ic">
        <Lock />
      </span>
      <h1 className="h1" style={{ fontSize: 28 }}>
        {t("This page is not in your role", "Ye page aapke role me nahi hai", "यह पेज आपकी भूमिका में नहीं है")}
      </h1>
      <p className="muted" style={{ maxWidth: 440 }}>
        {t(
          "Roles keep learner data and money safe. Ask a super admin if you need it; the request and the answer are both logged.",
          "Roles learner ka data aur paisa surakshit rakhte hain. Zaroorat ho to super admin se maango; maang aur jawab dono log hote hain.",
          "भूमिकाएँ शिक्षार्थी डेटा और पैसे को सुरक्षित रखती हैं।",
        )}
      </p>
      {who.length > 0 && (
        <div className="row wrap g6" style={{ justifyContent: "center" }}>
          {who.map((r) => (
            <Badge key={r.id}>{tri(r.name)}</Badge>
          ))}
        </div>
      )}
      <button className="btn pri" onClick={() => setAsk(true)}>
        <Send />
        {t("Request access", "Access maango", "पहुँच माँगें")}
      </button>
      <Modal
        open={ask}
        onClose={() => setAsk(false)}
        title={t("Request access", "Access maango", "पहुँच माँगें")}
        sub={t("A super admin approves it. Access ends on the date you pick.", "Super admin manzoor karega. Chuni tareekh par access khatam.", "सुपर एडमिन मंज़ूर करेगा।")}
        footer={
          <>
            <button className="btn ghost" onClick={() => setAsk(false)}>
              {t("Cancel", "Raho", "रद्द")}
            </button>
            <button
              className="btn pri"
              onClick={() => {
                setAsk(false);
                toast(t("Request sent to super admins", "Request super admins ko gayi", "अनुरोध भेजा गया"));
              }}
            >
              {t("Send request", "Bhejo", "भेजें")}
            </button>
          </>
        }
      >
        <div className="col g12">
          <div className="field">
            <label>{t("Why do you need it?", "Kyun chahiye?", "क्यों चाहिए?")}</label>
            <textarea className="textarea" defaultValue="Fixing a refund ticket for learner #48213" />
          </div>
          <div className="field">
            <label>{t("Until", "Kab tak", "कब तक")}</label>
            <select className="select" defaultValue="7">
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function AdminShell({ route, children }: { route: string; children: ReactNode }) {
  const [cmd, setCmd] = useCmdK();
  const [open, setOpen] = useState(false);
  return (
    <div className="adm">
      <AdminSide route={route} onSearch={() => setCmd(true)} open={open} onClose={() => setOpen(false)} />
      <div className="main-col">
        <AdminTop route={route} onMenu={() => setOpen(true)} />
        <main className="adm-main" key={route}>
          <div className="rise">{children}</div>
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} admin />
    </div>
  );
}

