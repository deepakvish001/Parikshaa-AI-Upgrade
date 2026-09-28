import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type ConsoleClient } from "../api.ts";
import { SettingsGroup, SkeletonRows } from "./kit.tsx";

/**
 * A second factor for one's own account, and — for an owner — how everyone
 * in the organisation signs in: its own provider, and whether owners must use
 * a second factor (ROADMAP §1).
 */

const failure = (error: unknown): string | null =>
  error === null || error === undefined
    ? null
    : error instanceof ConsoleError
      ? (error.detail ?? error.message)
      : error instanceof Error
        ? error.message
        : "That did not work.";

/** An `otpauth://` URI as a QR code, drawn as SVG squares: no image, nothing fetched. */
export function QrCode({ value, size = 184 }: { value: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 4;
  const cells: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) if (qr.isDark(r, c)) cells.push(`M${c + margin} ${r + margin}h1v1h-1z`);
  }
  const extent = count + margin * 2;
  return (
    <svg
      role="img"
      aria-label="QR code to scan with your authenticator app"
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className="qr"
    >
      <rect width={extent} height={extent} fill="#fff" />
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}

export function TwoFactorPanel({ client, onSignedOut, onEnrolled }: { client: ConsoleClient; onSignedOut: () => void; onEnrolled?: () => void }) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["2fa"], queryFn: () => client.twoFactor() });
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<readonly string[] | null>(null);
  const [password, setPassword] = useState("");
  const [offCode, setOffCode] = useState("");

  const begin = useMutation({ mutationFn: () => client.beginTwoFactor(), onSuccess: setSetup });
  const enable = useMutation({
    mutationFn: () => client.enableTwoFactor(code.trim()),
    onSuccess: async (codes) => {
      setRecovery(codes);
      setSetup(null);
      setCode("");
      await queryClient.invalidateQueries({ queryKey: ["2fa"] });
    },
  });
  // Every session ends when it is turned off, this one included.
  const disable = useMutation({ mutationFn: () => client.disableTwoFactor(password, offCode.trim()), onSuccess: onSignedOut });

  if (status.data === undefined) return <SkeletonRows rows={2} columns={2} label="Loading two-step sign-in…" />;
  const { enabled, recoveryCodesLeft, required } = status.data;

  return (
    <SettingsGroup
      id="two-step"
      title="Two-step sign-in"
      description={
        <>
          After your password, a six-digit code from an app on your phone — Google Authenticator, Microsoft Authenticator, or any
          password manager. Someone who learns your password still cannot sign in.
        </>
      }
    >
      {recovery !== null ? (
        <div className="callout" role="status">
          <p>
            <strong>Two-step sign-in is on.</strong> Keep these recovery codes somewhere safe — each signs you in once if you lose your
            phone. They are shown only now.
          </p>
          <ul className="recovery-codes">
            {recovery.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(recovery.join("\n"));
              }}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => {
                setRecovery(null);
                onEnrolled?.();
              }}
            >
              I've kept them
            </button>
          </div>
        </div>
      ) : enabled ? (
        <>
          <p>
            <span className="pill ok">on</span> {recoveryCodesLeft} recovery {recoveryCodesLeft === 1 ? "code" : "codes"} left.
          </p>
          {required ? (
            <p className="notice">Your organisation requires owners to use it, so it cannot be turned off.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                disable.mutate();
              }}
            >
              <p className="notice">To turn it off, confirm with your password and a current code. You will be signed out everywhere.</p>
              <div className="grid">
                <div className="field">
                  <label htmlFor="off-password">Password</label>
                  <input id="off-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="off-code">Code</label>
                  <input id="off-code" inputMode="numeric" autoComplete="one-time-code" value={offCode} onChange={(e) => setOffCode(e.target.value)} />
                </div>
              </div>
              {failure(disable.error) === null ? null : (
                <p className="error" role="alert">
                  {failure(disable.error)}
                </p>
              )}
              <div className="row">
                <button type="submit" className="secondary" disabled={disable.isPending || password === "" || offCode.trim() === ""}>
                  Turn off
                </button>
              </div>
            </form>
          )}
        </>
      ) : setup === null ? (
        <>
          {required ? <p className="notice">Your organisation requires owners to use it. Set it up to continue.</p> : null}
          {failure(begin.error) === null ? null : <p className="error">{failure(begin.error)}</p>}
          <div className="row">
            <button type="button" onClick={() => begin.mutate()} disabled={begin.isPending}>
              Set up two-step sign-in
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enable.mutate();
          }}
        >
          <div className="qr-row">
            <QrCode value={setup.uri} />
            <div>
              <p>1. Scan this with your authenticator app.</p>
              <p className="notice">
                Or type this key: <code className="secret">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              </p>
              <p>2. Enter the six digits it shows.</p>
              <div className="field">
                <label htmlFor="enrol-code">Code</label>
                <input id="enrol-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            </div>
          </div>
          {failure(enable.error) === null ? null : (
            <p className="error" role="alert">
              {failure(enable.error)}
            </p>
          )}
          <div className="row">
            <button type="submit" disabled={enable.isPending || code.trim().length < 6}>
              Turn on
            </button>
            <button type="button" className="secondary" onClick={() => setSetup(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </SettingsGroup>
  );
}

/** For an owner: the organisation's sign-in provider, and whether owners must use a second factor. */
export function OrgSignInPanel({ client, orgId }: { client: ConsoleClient; orgId: string }) {
  const queryClient = useQueryClient();
  const sso = useQuery({ queryKey: ["sso"], queryFn: () => client.sso() });
  const mine = useQuery({ queryKey: ["2fa"], queryFn: () => client.twoFactor() });
  const [draft, setDraft] = useState({ issuer: "", clientId: "", clientSecret: "", domains: "", enforced: false, enabled: true });

  useEffect(() => {
    const s = sso.data;
    if (s === undefined || !s.configured) return;
    setDraft((d) => ({ ...d, issuer: s.issuer ?? "", clientId: s.clientId ?? "", domains: s.emailDomains.join(", "), enforced: s.enforced, enabled: s.enabled }));
  }, [sso.data]);

  const save = useMutation({
    mutationFn: () =>
      client.saveSso({
        issuer: draft.issuer.trim(),
        clientId: draft.clientId.trim(),
        ...(draft.clientSecret === "" ? {} : { clientSecret: draft.clientSecret }),
        emailDomains: draft.domains.split(/[,\s]+/).filter((d) => d !== ""),
        enforced: draft.enforced,
        enabled: draft.enabled,
      }),
    onSuccess: async () => {
      setDraft((d) => ({ ...d, clientSecret: "" }));
      await queryClient.invalidateQueries({ queryKey: ["sso"] });
    },
  });

  const [requireOwners, setRequireOwners] = useState<boolean | null>(null);
  const setRequirement = useMutation({
    mutationFn: (required: boolean) => client.requireOwner2fa(required),
    onSuccess: (_, required) => setRequireOwners(required),
  });

  return (
    <>
      <SettingsGroup
        id="sso"
        title="Single sign-on"
        description={
          <>
            Let staff sign in with their institution account — Google Workspace, Microsoft Entra ID, Okta, Keycloak or any OpenID Connect
            provider. Only people already on the Staff page can sign in this way; nobody is added automatically.
          </>
        }
      >
        {sso.data === undefined ? null : (
          <p className="notice">
            Register this as the redirect URI with your provider: <code>{sso.data.redirectUri}</code>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="sso-issuer">Issuer URL</label>
              <input
                id="sso-issuer"
                placeholder="https://accounts.google.com"
                value={draft.issuer}
                onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sso-client">Client ID</label>
              <input id="sso-client" value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="sso-secret">Client secret</label>
              <input
                id="sso-secret"
                type="password"
                autoComplete="off"
                placeholder={sso.data?.configured === true ? "Unchanged" : ""}
                value={draft.clientSecret}
                onChange={(e) => setDraft({ ...draft, clientSecret: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sso-domains">Email domains</label>
              <input
                id="sso-domains"
                placeholder="college.ac.in"
                value={draft.domains}
                onChange={(e) => setDraft({ ...draft, domains: e.target.value })}
              />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> On
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.enforced} onChange={(e) => setDraft({ ...draft, enforced: e.target.checked })} /> Staff other
            than owners must sign in this way (owners keep their password, so a provider outage cannot lock everyone out)
          </label>
          {failure(save.error) === null ? null : (
            <p className="error" role="alert">
              {failure(save.error)}
            </p>
          )}
          {save.isSuccess ? (
            <p className="notice" role="status">
              Saved. Staff choose “Sign in with your organisation” and enter <code>{orgId}</code>.
            </p>
          ) : null}
          <div className="row">
            <button
              type="submit"
              disabled={save.isPending || draft.issuer.trim() === "" || draft.clientId.trim() === "" || (sso.data?.configured !== true && draft.clientSecret === "")}
            >
              {save.isPending ? "Checking the provider…" : "Save"}
            </button>
          </div>
        </form>
      </SettingsGroup>

      <SettingsGroup
        id="owners-2fa"
        title="Owners' two-step sign-in"
        label="Owners' second factor"
        description={
          <>
            Owners can change anything, erase data and buy credits. Require them to use two-step sign-in; an owner without it will be asked
            to set it up before anything else.
          </>
        }
      >
        {mine.data?.enabled === false ? (
          <p className="notice">Set up your own two-step sign-in first, on the Account page.</p>
        ) : null}
        {failure(setRequirement.error) === null ? null : <p className="error">{failure(setRequirement.error)}</p>}
        {requireOwners === null ? null : (
          <p className="notice" role="status">
            {requireOwners ? "Owners must now use two-step sign-in." : "Owners may choose."}
          </p>
        )}
        <div className="row">
          <button type="button" disabled={setRequirement.isPending || mine.data?.enabled !== true} onClick={() => setRequirement.mutate(true)}>
            Require it
          </button>
          <button type="button" className="secondary" disabled={setRequirement.isPending} onClick={() => setRequirement.mutate(false)}>
            Leave it to each owner
          </button>
        </div>
      </SettingsGroup>
    </>
  );
}
