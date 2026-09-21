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
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

// --- adapters --------------------------------------------------------------
// Typed structurally so this package does not depend on either driver.

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
    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(pgliteTransactionExecutor(tx)));
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
function pgliteTransactionExecutor(tx: PGliteQueryable): SqlExecutor {
  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      return (await tx.query<Row>(text, [...params])).rows;
    },
    async exec(text: string): Promise<void> {
      await tx.exec(text);
    },
    async transaction<T>(fn: (nested: SqlExecutor) => Promise<T>): Promise<T> {
      const name = `parikshaa_sp_${++savepointCounter}`;
      await tx.query(`SAVEPOINT ${name}`);
      try {
        const result = await fn(pgliteTransactionExecutor(tx));
        await tx.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (error) {
        await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw error;
      }
    },
  };
}

interface PostgresJsQueryable {
  unsafe(query: string, params?: unknown[]): PromiseLike<unknown>;
}

interface PostgresJsRoot extends PostgresJsQueryable {
  begin<T>(cb: (tx: PostgresJsTransaction) => T | Promise<T>): PromiseLike<unknown>;
}

interface PostgresJsTransaction extends PostgresJsQueryable {
  savepoint<T>(cb: (tx: PostgresJsTransaction) => T | Promise<T>): PromiseLike<unknown>;
}

async function unsafeRows<Row>(
  sql: PostgresJsQueryable,
  text: string,
  params: readonly unknown[],
): Promise<Row[]> {
  return (await sql.unsafe(text, [...params])) as Row[];
}

/**
 * Adapter for `postgres` (porsager), the production driver.
 *
 * A nested transaction becomes a savepoint, which is how that driver models
 * one — so a store method that opens a transaction stays correct when it is
 * called from inside another.
 */
export function postgresJsExecutor(sql: PostgresJsRoot): SqlExecutor {
  return {
    query: (text, params = []) => unsafeRows(sql, text, params),
    async exec(text: string): Promise<void> {
      // No parameters, so this runs on the simple protocol and may contain
      // several statements.
      await sql.unsafe(text);
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return (await sql.begin((tx) => fn(postgresJsTransactionExecutor(tx)))) as T;
    },
  };
}

function postgresJsTransactionExecutor(tx: PostgresJsTransaction): SqlExecutor {
  return {
    query: (text, params = []) => unsafeRows(tx, text, params),
    async exec(text: string): Promise<void> {
      await tx.unsafe(text);
    },
    async transaction<T>(fn: (nested: SqlExecutor) => Promise<T>): Promise<T> {
      return (await tx.savepoint((inner) => fn(postgresJsTransactionExecutor(inner)))) as T;
    },
  };
}
