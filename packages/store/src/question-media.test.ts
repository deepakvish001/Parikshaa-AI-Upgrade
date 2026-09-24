import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, orgId } from "@parikshaa/core";
import { candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { imageMimeOf, NotAnImage, QuestionMedia } from "./question-media.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Pictures in questions, stored once by hash (migration 0012). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("a diagram")]);

let db: PGlite;
let sql: SqlExecutor;
let media: QuestionMedia;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  media = new QuestionMedia(sql);
});

afterEach(async () => {
  await db.close();
});

describe("pictures in questions", () => {
  it("are kept once under the hash of their bytes, and served by that hash alone", async () => {
    const first = await media.add(staffScope(A), PNG);
    const again = await media.add(staffScope(A), PNG);
    expect(first).toEqual({ media: again.media, mime: "image/png" });
    expect(first.media).toMatch(/^[0-9a-f]{64}$/);

    const served = await media.byHash(first.media);
    expect(served?.mime).toBe("image/png");
    expect(Buffer.compare(served!.bytes, PNG)).toBe(0);
    expect(await media.byHash("0".repeat(64))).toBeNull();
    expect(await media.byHash("not a hash")).toBeNull();
  });

  it("accept only pictures, known by their bytes, and not SVG", async () => {
    await expect(media.add(staffScope(A), Buffer.from("<svg onload=alert(1)></svg>"))).rejects.toBeInstanceOf(NotAnImage);
    await expect(media.add(staffScope(A), Buffer.alloc(0))).rejects.toBeInstanceOf(NotAnImage);
    expect(imageMimeOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(imageMimeOf(Buffer.from("GIF89a"))).toBe("image/gif");
    expect(imageMimeOf(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("are added by staff only, and each organisation's rows stay its own", async () => {
    await expect(media.add(candidateScope(A, attemptId("x")), PNG)).rejects.toThrow();
    await media.add(staffScope(A), PNG);
    const seen = await sql.transaction((tx) => tx.query(`SELECT count(*)::int AS n FROM question_media`), {
      "parikshaa.org_id": B,
      "parikshaa.actor": "staff",
      "parikshaa.attempt_id": "",
    });
    expect(seen[0]).toEqual({ n: 0 });
  });
});
