import pg from "pg";
/**
 * A minimal SQL surface.
 *
 * The store speaks plain SQL rather than going through a query builder: the
 * schema's value is in constraints, triggers and row-level security, and those
 * are written and reviewed as SQL anyway. This interface exists so the same
 * store runs against a production pool and against an in-process Postgres in
 * tests, which is what lets the integrity constraints actually be tested.
 */
export interface SqlExecutor {
  query<Row = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<Row[]>;
  /**
   * Run a script that may contain several statements.
   *
   * Separate from {@link SqlExecutor.query} because a parameterized query goes
   * through the extended protocol, which accepts exactly one statement — a
   * migration file has many. This is the simple-protocol path, and it takes no
   * parameters, so nothing reaches it that a caller could interpolate into.
   */
  exec(text: string): Promise<void>;
  /**
   * Run `fn` in a transaction. `settings` are applied transaction-locally
   * before it runs (`set_config(name, value, true)`) — in the same round trip
   * as BEGIN where the driver allows, since every tenant query pays for it.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>, settings?: TransactionSettings): Promise<T>;
}

/** Transaction-local settings: names are fixed by the caller's code, values may come from input. */
export type TransactionSettings = Readonly<Record<string, string>>;

/**
 * A step asked for another scope inside a transaction that already has one
 * (docs/HIRE-V2.md §10, S24). Settings are transaction-local, so a nested
 * transaction that changed `parikshaa.org_id` or `parikshaa.actor` would run,
 * and leave the rest of the outer transaction, as someone else. Such a step
 * needs a transaction of its own.
 */
export class ScopeConflict extends Error {
  constructor(readonly setting: string) {
    super(`A transaction in one scope cannot run a step in another (${setting}): give that step its own transaction`);
    this.name = "ScopeConflict";
  }
}

/** The settings in force in one transaction, shared by its savepoints. */
interface InForce {
  current: Readonly<Record<string, string>>;
}

/** A nested transaction may add a setting, never change one already in force. */
function assertSameScope(inForce: InForce, settings: TransactionSettings): void {
  for (const [name, value] of Object.entries(settings)) {
    const now = inForce.current[name];
    if (now !== undefined && now !== value) throw new ScopeConflict(name);
  }
}

const settingsParams = (settings: TransactionSettings) => Object.entries(settings).flat();
const settingsSql = (settings: TransactionSettings) =>
  `SELECT ${Object.keys(settings)
    .map((_, i) => `set_config($${2 * i + 1}, $${2 * i + 2}, true)`)
    .join(", ")}`;

// --- adapters --------------------------------------------------------------
// PGlite is typed structurally, so only the tests depend on it.

interface PGliteQueryable {
  query<Row>(query: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  exec(query: string): Promise<unknown>;
}

interface PGliteRoot extends PGliteQueryable {
  transaction<T>(fn: (tx: PGliteQueryable) => Promise<T>): Promise<T>;
}

/** Monotonic suffix for savepoint names. Never derived from input. */
let savepointCounter = 0;

/** Adapter for `@electric-sql/pglite` — Postgres in-process, used by the tests. */
export function pgliteExecutor(db: PGliteRoot): SqlExecutor {
  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      return (await db.query<Row>(text, [...params])).rows;
    },
    async exec(text: string): Promise<void> {
      await db.exec(text);
    },
    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>, settings?: TransactionSettings): Promise<T> {
      return db.transaction(async (tx) => {
        if (settings !== undefined) await tx.query(settingsSql(settings), settingsParams(settings));
        return fn(pgliteTransactionExecutor(tx, { current: { ...settings } }));
      });
    },
  };
}

/**
 * Inside a transaction, a nested transaction becomes a savepoint.
 *
 * The driver's transaction handle has no nested-transaction method of its own,
 * so this issues the SQL directly — which keeps a store method that opens a
 * transaction correct when it is called from inside another one.
 */
function pgliteTransactionExecutor(tx: PGliteQueryable, inForce: InForce): SqlExecutor {
  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      return (await tx.query<Row>(text, [...params])).rows;
    },
    async exec(text: string): Promise<void> {
      await tx.exec(text);
    },
    async transaction<T>(fn: (nested: SqlExecutor) => Promise<T>, settings?: TransactionSettings): Promise<T> {
      if (settings !== undefined) assertSameScope(inForce, settings);
      const before = inForce.current;
      const name = `parikshaa_sp_${++savepointCounter}`;
      await tx.query(`SAVEPOINT ${name}`);
      try {
        if (settings !== undefined) {
          await tx.query(settingsSql(settings), settingsParams(settings));
          inForce.current = { ...before, ...settings };
        }
        const result = await fn(pgliteTransactionExecutor(tx, inForce));
        await tx.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (error) {
        await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
        inForce.current = before;
        throw error;
      }
    },
  };
}

/**
 * A pool of connections to a real Postgres, with the production driver,
 * node-postgres. `end` closes it.
 */
export interface Database extends SqlExecutor {
  end(): Promise<void>;
}

/**
 * Open a pool with node-postgres.
 *
 * Chosen over postgres.js, which this code used first, after the chaos run
 * (ROADMAP §13) terminated the database's connections under a running server:
 * postgres.js 3.4.9 threw from inside its socket handling, outside any promise,
 * and took the whole process down with it — so a failover would have taken
 * every API instance down at once. It also serialized jsonb parameters a second
 * time, storing every exam as a JSON string. node-postgres sends JSON text as
 * it is, as PGlite does, and reports a lost connection as a failed query.
 *
 * A connection lost while idle, or while checked out for a transaction, is an
 * `error` event rather than a rejected promise; unhandled, Node treats it as
 * fatal. Both are handled here, and passed to `onError` to be logged.
 */
export function connect(
  url: string,
  options: {
    readonly max?: number;
    readonly idleTimeoutMs?: number;
    readonly connectTimeoutMs?: number;
    readonly onError?: (error: Error) => void;
  } = {},
): Database {
  const pool = new pg.Pool({
    connectionString: url,
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    connectionTimeoutMillis: options.connectTimeoutMs ?? 10_000,
  });
  const onError = options.onError ?? (() => undefined);
  pool.on("error", onError);

  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      return (await pool.query(text, [...params])).rows as Row[];
    },
    async exec(text: string): Promise<void> {
      // No parameters: the simple protocol, which accepts several statements.
      await pool.query(text);
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>, settings?: TransactionSettings): Promise<T> {
      const client = await pool.connect();
      client.on("error", onError);
      let broken: Error | undefined;
      try {
        // One round trip for BEGIN and the settings. A multi-statement query
        // cannot take parameters, so values are quoted by the driver's own
        // escapeLiteral; names come from this code, never from input.
        await client.query(
          settings === undefined
            ? "BEGIN"
            : `BEGIN; SELECT ${Object.entries(settings)
                .map(([name, value]) => `set_config(${client.escapeLiteral(name)}, ${client.escapeLiteral(value)}, true)`)
                .join(", ")}`,
        );
        const result = await fn(pgTransactionExecutor(client, { current: { ...settings } }));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackFailed) {
          // The connection itself is gone: do not return it to the pool.
          broken = rollbackFailed instanceof Error ? rollbackFailed : new Error(String(rollbackFailed));
        }
        throw error;
      } finally {
        client.removeListener("error", onError);
        client.release(broken);
      }
    },
    end: () => pool.end(),
  };
}

function pgTransactionExecutor(client: pg.PoolClient, inForce: InForce): SqlExecutor {
  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      return (await client.query(text, [...params])).rows as Row[];
    },
    async exec(text: string): Promise<void> {
      await client.query(text);
    },
    async transaction<T>(fn: (nested: SqlExecutor) => Promise<T>, settings?: TransactionSettings): Promise<T> {
      if (settings !== undefined) assertSameScope(inForce, settings);
      const before = inForce.current;
      const name = `parikshaa_sp_${++savepointCounter}`;
      await client.query(`SAVEPOINT ${name}`);
      try {
        if (settings !== undefined) {
          await client.query(settingsSql(settings), settingsParams(settings));
          inForce.current = { ...before, ...settings };
        }
        const result = await fn(pgTransactionExecutor(client, inForce));
        await client.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        inForce.current = before;
        throw error;
      }
    },
  };
}
