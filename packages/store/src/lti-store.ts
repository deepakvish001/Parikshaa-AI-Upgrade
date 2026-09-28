import type { OrgId } from "@parikshaa/core";
import { withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * LTI 1.3 platforms and launches (ROADMAP §7; migration 0017).
 *
 * Platforms are looked up by issuer and client id before any organisation is
 * known, so they are outside row-level security, and every staff query names
 * the organisation. Launches are tenant data.
 */

export interface LtiPlatform {
  readonly id: string;
  readonly orgId: OrgId;
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly deploymentIds: readonly string[];
  readonly authLoginUrl: string;
  readonly authTokenUrl: string;
  readonly jwksUrl: string;
  readonly toolKid: string;
  /** Sealed by the caller. */
  readonly toolPrivateKey: string;
  readonly enabled: boolean;
}

export interface LtiLaunch {
  readonly invitationId: string;
  readonly platformId: string;
  readonly subject: string;
  readonly resourceLink: string;
  readonly lineitem: string | null;
}

interface PlatformRow {
  id: string;
  org_id: string;
  name: string;
  issuer: string;
  client_id: string;
  deployment_ids: string[];
  auth_login_url: string;
  auth_token_url: string;
  jwks_url: string;
  tool_kid: string;
  tool_private_key: string;
  enabled: boolean;
}

const COLUMNS = "id, org_id, name, issuer, client_id, deployment_ids, auth_login_url, auth_token_url, jwks_url, tool_kid, tool_private_key, enabled";

const toPlatform = (r: PlatformRow): LtiPlatform => ({
  id: r.id,
  orgId: r.org_id as OrgId,
  name: r.name,
  issuer: r.issuer,
  clientId: r.client_id,
  deploymentIds: r.deployment_ids ?? [],
  authLoginUrl: r.auth_login_url,
  authTokenUrl: r.auth_token_url,
  jwksUrl: r.jwks_url,
  toolKid: r.tool_kid,
  toolPrivateKey: r.tool_private_key,
  enabled: r.enabled,
});

export class LtiStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async addPlatform(platform: LtiPlatform): Promise<LtiPlatform> {
    await this.#sql.query(
      `INSERT INTO lti_platforms (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        platform.id,
        platform.orgId,
        platform.name,
        platform.issuer,
        platform.clientId,
        JSON.stringify(platform.deploymentIds),
        platform.authLoginUrl,
        platform.authTokenUrl,
        platform.jwksUrl,
        platform.toolKid,
        platform.toolPrivateKey,
        platform.enabled,
      ],
    );
    return platform;
  }

  async updatePlatform(
    orgId: OrgId,
    id: string,
    patch: Pick<LtiPlatform, "name" | "issuer" | "clientId" | "deploymentIds" | "authLoginUrl" | "authTokenUrl" | "jwksUrl" | "enabled">,
  ): Promise<LtiPlatform | null> {
    const rows = await this.#sql.query<PlatformRow>(
      `UPDATE lti_platforms SET name = $3, issuer = $4, client_id = $5, deployment_ids = $6, auth_login_url = $7, auth_token_url = $8, jwks_url = $9, enabled = $10
        WHERE org_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
      [orgId, id, patch.name, patch.issuer, patch.clientId, JSON.stringify(patch.deploymentIds), patch.authLoginUrl, patch.authTokenUrl, patch.jwksUrl, patch.enabled],
    );
    return rows[0] === undefined ? null : toPlatform(rows[0]);
  }

  async platforms(orgId: OrgId): Promise<readonly LtiPlatform[]> {
    return (await this.#sql.query<PlatformRow>(`SELECT ${COLUMNS} FROM lti_platforms WHERE org_id = $1 ORDER BY created_at`, [orgId])).map(toPlatform);
  }

  async platform(id: string): Promise<LtiPlatform | null> {
    const rows = await this.#sql.query<PlatformRow>(`SELECT ${COLUMNS} FROM lti_platforms WHERE id = $1`, [id]);
    return rows[0] === undefined ? null : toPlatform(rows[0]);
  }

  /** The platform a launch comes from. Issuers are compared without a trailing slash. */
  async platformFor(issuer: string, clientId: string | null): Promise<LtiPlatform | null> {
    const rows = await this.#sql.query<PlatformRow>(
      `SELECT ${COLUMNS} FROM lti_platforms
        WHERE rtrim(issuer, '/') = rtrim($1, '/') AND ($2::text IS NULL OR client_id = $2) AND enabled
        ORDER BY created_at LIMIT 2`,
      [issuer, clientId],
    );
    // Without a client id, only an unambiguous issuer will do.
    return rows.length === 1 || (clientId !== null && rows[0] !== undefined) ? toPlatform(rows[0]!) : null;
  }

  async recordLaunch(scope: Scope, launch: LtiLaunch): Promise<void> {
    await withScope(this.#sql, scope, (tx) =>
      tx.query(
        `INSERT INTO lti_launches (org_id, invitation_id, platform_id, subject, resource_link, lineitem) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, invitation_id) DO UPDATE SET lineitem = coalesce(EXCLUDED.lineitem, lti_launches.lineitem), updated_at = now()`,
        [scope.orgId, launch.invitationId, launch.platformId, launch.subject, launch.resourceLink, launch.lineitem],
      ),
    );
  }

  async launch(scope: Scope, invitationId: string): Promise<LtiLaunch | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ invitation_id: string; platform_id: string; subject: string; resource_link: string; lineitem: string | null }>(
        `SELECT invitation_id, platform_id, subject, resource_link, lineitem FROM lti_launches WHERE org_id = $1 AND invitation_id = $2`,
        [scope.orgId, invitationId],
      );
      const r = rows[0];
      return r === undefined ? null : { invitationId: r.invitation_id, platformId: r.platform_id, subject: r.subject, resourceLink: r.resource_link, lineitem: r.lineitem };
    });
  }
}
