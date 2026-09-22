#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { specDocument } from "./openapi.js";

/** Write the contract artifact that `openapi.test.ts` checks for drift. */
const target = fileURLToPath(new URL("../../../docs/openapi.json", import.meta.url));
await writeFile(target, `${JSON.stringify(await specDocument(), null, 2)}\n`, "utf8");
process.stdout.write(`wrote ${target}\n`);
