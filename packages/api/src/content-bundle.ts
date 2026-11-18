import { createHash } from "node:crypto";
import { posix } from "node:path";
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { Unzip, UnzipInflate } from "fflate";
import { CONTENT_TYPES, type ContentType, type GateProblem } from "@parikshaa/store";
import { CONTENT_SCHEMAS } from "./content/schemas.js";

/**
 * Reading a content bundle (docs/content/CONTENT-FORMAT.md §3, tracker plan
 * row 141 part B): one JSON file with every item inline, or a ZIP of a folder
 * with `manifest.json` at its root and one item per `*.json` below it, where
 * any string may be `{"$file": "relative/path"}`.
 *
 * A bundle is untrusted. The ZIP is read as a stream and every inflated byte
 * counted, so one that lies about its sizes stops at the limit instead of
 * filling the memory; a path that climbs out of the bundle (`..`, an absolute
 * path) refuses the whole file. Items are checked against the format's JSON
 * Schemas (gate 1) here; what they mean (gate 2) is `content-rules.ts`.
 */

const MIB = 1024 * 1024;

export const BUNDLE_LIMITS = {
  /** The file as uploaded. */
  fileBytes: 20 * MIB,
  /** Everything in a ZIP, inflated. */
  inflatedBytes: 60 * MIB,
  /** Files in a ZIP. */
  entries: 2000,
  /** Items in one bundle. */
  items: 600,
} as const;

export class BundleRefused extends Error {
  constructor(
    readonly code: "too_large" | "unreadable" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "BundleRefused";
  }
}

export interface BundleItem {
  /** Where it came from: a path in the ZIP, or `items[n]` in a single file. */
  readonly file: string;
  readonly item: unknown;
  /** What went wrong reading it (a `$file` that is missing, or outside the bundle). */
  readonly problems: readonly GateProblem[];
}

export interface Bundle {
  /** The manifest document's `manifest`, as given; null when there is none. */
  readonly manifest: unknown;
  readonly items: readonly BundleItem[];
  /** What is wrong with the bundle as a whole: its manifest, a file that is not JSON. */
  readonly problems: readonly GateProblem[];
}

const BUNDLE_SCHEMA = "parikshaa.content/bundle@1";
const ITEM_SCHEMA = /^parikshaa\.content\/([a-z-]+)@1$/;

/** The content type an item's `schema` names, or null. */
export function contentTypeOf(item: unknown): ContentType | null {
  const schema = isObject(item) ? item.schema : undefined;
  const type = typeof schema === "string" ? (ITEM_SCHEMA.exec(schema)?.[1] ?? null) : null;
  return type !== null && (CONTENT_TYPES as readonly string[]).includes(type) ? (type as ContentType) : null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// --- reading ---------------------------------------------------------------------------------

/** A bundle from the bytes uploaded: a ZIP when it starts like one, else JSON. */
export function readBundle(bytes: Uint8Array): Bundle {
  if (bytes.length > BUNDLE_LIMITS.fileBytes) throw new BundleRefused("too_large", `The file is ${mib(bytes.length)}; a bundle may be at most ${mib(BUNDLE_LIMITS.fileBytes)}. Split it into smaller bundles.`);
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5) && (bytes[3] === 4 || bytes[3] === 6);
  return zip ? zipBundle(bytes) : jsonBundle(bytes);
}

const mib = (bytes: number) => `${(bytes / MIB).toFixed(bytes < MIB ? 2 : 1)} MiB`;

function text(bytes: Uint8Array, what: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    throw new BundleRefused("unreadable", `${what} is not UTF-8 text`);
  }
}

function jsonBundle(bytes: Uint8Array): Bundle {
  let doc: unknown;
  try {
    doc = JSON.parse(text(bytes, "The file"));
  } catch (error) {
    if (error instanceof BundleRefused) throw error;
    throw new BundleRefused("unreadable", `The file is neither a ZIP nor JSON (${(error as Error).message})`);
  }
  if (!isObject(doc) || doc.schema !== BUNDLE_SCHEMA) {
    throw new BundleRefused("invalid", `This is not a content bundle: a single-file bundle is {"schema": "${BUNDLE_SCHEMA}", "manifest": {...}, "items": [...]}`);
  }
  const items = Array.isArray(doc.items) ? doc.items : [];
  if (items.length > BUNDLE_LIMITS.items) throw new BundleRefused("too_large", `The bundle has ${items.length} items; at most ${BUNDLE_LIMITS.items} go in one upload`);
  const problems = manifestProblems(doc);
  return {
    manifest: doc.manifest ?? null,
    problems,
    items: items.map((item, i) => {
      const local: GateProblem[] = [];
      const resolved = resolveFiles(item, (path, where) => {
        local.push({ gate: "file", message: `${where}: $file ${path} needs a folder or ZIP bundle; a single JSON file has everything inline` });
        return "";
      });
      return { file: `items[${i}]`, item: resolved, problems: local };
    }),
  };
}

/** Every file of a ZIP, inflated, by its path; refused past the limits. */
function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let entries = 0;
  let inflated = 0;
  let refused: BundleRefused | null = null;
  const reader = new Unzip();
  reader.register(UnzipInflate);
  reader.onfile = (file) => {
    if (refused !== null) return;
    entries++;
    if (entries > BUNDLE_LIMITS.entries) {
      refused = new BundleRefused("too_large", `The ZIP has more than ${BUNDLE_LIMITS.entries} files`);
      return;
    }
    const name = file.name;
    if (name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..")) {
      refused = new BundleRefused("invalid", `The ZIP has a file outside its folder (${name.slice(0, 120)}); no path may start with / or contain ..`);
      return;
    }
    if (name.endsWith("/")) return;
    const chunks: Uint8Array[] = [];
    file.ondata = (error, chunk, final) => {
      if (refused !== null) return;
      if (error !== null) {
        refused = new BundleRefused("unreadable", `The ZIP is damaged (${name.slice(0, 120)})`);
        return;
      }
      inflated += chunk.length;
      if (inflated > BUNDLE_LIMITS.inflatedBytes) {
        refused = new BundleRefused("too_large", `The ZIP holds more than ${mib(BUNDLE_LIMITS.inflatedBytes)} when unpacked`);
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) files.set(name, Buffer.concat(chunks));
    };
    file.start();
  };
  try {
    reader.push(bytes, true);
  } catch {
    refused ??= new BundleRefused("unreadable", "The ZIP is damaged or uses a compression it cannot be read with");
  }
  if (refused !== null) throw refused;
  return files;
}

const hidden = (path: string) => path.split("/").some((segment) => segment.startsWith(".") || segment === "__MACOSX");

function zipBundle(bytes: Uint8Array): Bundle {
  const files = unzip(bytes);
  const manifests = [...files.keys()].filter((p) => !hidden(p) && posix.basename(p) === "manifest.json").sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const top = manifests[0];
  if (top === undefined) throw new BundleRefused("invalid", "The ZIP has no manifest.json: put it at the root of the bundle's folder");
  if (manifests[1] !== undefined && manifests[1].split("/").length === top.split("/").length) {
    throw new BundleRefused("invalid", `The ZIP has two manifest.json at the same level (${top}, ${manifests[1]}): one bundle per upload`);
  }
  const root = posix.dirname(top) === "." ? "" : `${posix.dirname(top)}/`;
  const problems: GateProblem[] = [];
  const parse = (path: string): unknown => {
    try {
      return JSON.parse(text(files.get(path)!, path.slice(root.length)));
    } catch (error) {
      problems.push({ gate: "file", message: `${path.slice(root.length)}: not JSON (${(error as Error).message})` });
      return undefined;
    }
  };
  const manifestDoc = parse(top);
  if (manifestDoc !== undefined) problems.push(...manifestProblems(manifestDoc));
  const items: BundleItem[] = [];
  for (const path of [...files.keys()].sort()) {
    if (path === top || !path.startsWith(root) || hidden(path) || !path.endsWith(".json")) continue;
    const doc = parse(path);
    if (!isObject(doc) || typeof doc.schema !== "string" || !doc.schema.startsWith("parikshaa.content/") || doc.schema === BUNDLE_SCHEMA) continue;
    if (items.length >= BUNDLE_LIMITS.items) throw new BundleRefused("too_large", `The bundle has more than ${BUNDLE_LIMITS.items} items; at most ${BUNDLE_LIMITS.items} go in one upload`);
    const local: GateProblem[] = [];
    const dir = posix.dirname(path);
    const resolved = resolveFiles(doc, (relative, where) => {
      const target = posix.normalize(posix.join(dir, relative));
      if (relative.startsWith("/") || target === ".." || target.startsWith("../") || !target.startsWith(root) || hidden(target)) {
        local.push({ gate: "file", message: `${where}: $file ${relative} is outside the bundle` });
        return "";
      }
      const found = files.get(target);
      if (found === undefined) {
        local.push({ gate: "file", message: `${where}: $file ${relative} not found` });
        return "";
      }
      try {
        return text(found, relative);
      } catch (error) {
        local.push({ gate: "file", message: `${where}: ${(error as Error).message}` });
        return "";
      }
    });
    items.push({ file: path.slice(root.length), item: resolved, problems: local });
  }
  return { manifest: isObject(manifestDoc) ? (manifestDoc.manifest ?? null) : null, items, problems };
}

/** Every `{"$file": path}` replaced by what `read` gives for it. */
function resolveFiles(value: unknown, read: (path: string, where: string) => string, where = ""): unknown {
  if (Array.isArray(value)) return value.map((v, i) => resolveFiles(v, read, `${where}[${i}]`));
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$file") {
      const path = value.$file;
      return typeof path === "string" ? read(path, where || "(item)") : value;
    }
    return Object.fromEntries(keys.map((k) => [k, resolveFiles(value[k], read, where === "" ? k : `${where}.${k}`)]));
  }
  return value;
}

// --- hashing ----------------------------------------------------------------------------------

/** JSON with every object's keys sorted and no spaces: the same content always gives the same text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** SHA-256 of an item's canonical JSON, `$file` references resolved (CONTENT-FORMAT §2a). */
export const contentHash = (item: unknown): string => createHash("sha256").update(canonicalJson(item)).digest("hex");

// --- gate 1: the schemas ---------------------------------------------------------------------

let compiled: { readonly bundle: ValidateFunction; readonly types: ReadonlyMap<ContentType, ValidateFunction> } | null = null;

function validators() {
  if (compiled !== null) return compiled;
  // strict off: the schemas carry notes for the importer (x-db, x-needs-platform) that are not keywords.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const [name, schema] of Object.entries(CONTENT_SCHEMAS)) ajv.addSchema(schema, name);
  const get = (name: string) => {
    const fn = ajv.getSchema(name);
    if (fn === undefined) throw new Error(`The content schema ${name} is missing`);
    return fn;
  };
  compiled = { bundle: get("bundle.schema.json"), types: new Map(CONTENT_TYPES.map((t) => [t, get(`${t}.schema.json`)])) };
  return compiled;
}

const MAX_SCHEMA_MESSAGES = 15;

/** Ajv's errors in plain words, a path to each: `tags.topics: must have at least 1 item`. */
function messages(errors: readonly ErrorObject[] | null | undefined): string[] {
  const out: string[] = [];
  for (const e of errors ?? []) {
    const at = e.instancePath === "" ? "(item)" : e.instancePath.slice(1).replace(/\/(\d+)(?=\/|$)/g, "[$1]").replace(/\//g, ".");
    const params = e.params as Record<string, unknown>;
    const message =
      e.keyword === "additionalProperties"
        ? `unknown field "${String(params.additionalProperty)}"`
        : e.keyword === "required"
          ? `missing "${String(params.missingProperty)}"`
          : e.keyword === "enum"
            ? `must be one of ${(params.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(", ")}`
            : e.keyword === "const"
              ? `must be ${JSON.stringify(params.allowedValue)}`
              : (e.message ?? e.keyword);
    const line = `${at}: ${message}`;
    if (!out.includes(line)) out.push(line);
  }
  if (out.length > MAX_SCHEMA_MESSAGES) return [...out.slice(0, MAX_SCHEMA_MESSAGES), `… and ${out.length - MAX_SCHEMA_MESSAGES} more`];
  return out;
}

/** What the item's schema finds wrong with it; empty when it passes. */
export function schemaProblems(type: ContentType, item: unknown): string[] {
  const validate = validators().types.get(type)!;
  return validate(item) ? [] : messages(validate.errors);
}

/** What the bundle schema finds wrong with a manifest document (`{schema, manifest, items?}`). */
function manifestProblems(doc: unknown): GateProblem[] {
  const validate = validators().bundle;
  if (validate(doc)) return [];
  return messages(validate.errors).map((message) => ({ gate: "manifest", message: `manifest: ${message}` }));
}
