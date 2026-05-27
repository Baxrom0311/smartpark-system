// i18n parity + hardcoded-string scanner (M61).
//
// Two complementary guards run from a single test file:
//
//   1. Parity - every key path that exists in uz.json must also exist
//      in ru.json (and vice versa). Missing translations are easy to
//      introduce by editing only one resource file, and the result is
//      a key string leaking into the UI in the other language. This
//      guard catches that on CI before merge.
//
//   2. Hardcoded strings - any JSX text node in app tsx files that
//      isn't a t(...) call, an expression, or an allow-listed brand
//      token. Anchoring the regex to ">...<" JSX text content (and
//      stripping comments first) keeps false-positive noise out while
//      still catching real violations like <Text>Hello</Text>.
//
//      If a legitimate non-translated literal is needed (brand names,
//      single punctuation, language toggle codes), add it to
//      STRING_ALLOWLIST below - never silence the regex.

import { promises as fs } from "fs";
import { join, relative, resolve } from "path";

import ru from "@/i18n/ru.json";
import uz from "@/i18n/uz.json";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// Recursively walk a translation resource and emit every leaf key
// path joined with dots. Arrays are flattened by index.
function flatKeys(value: Json, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    value.forEach((item, idx) => {
      out.push(...flatKeys(item as Json, `${prefix}[${idx}]`));
    });
    return out;
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, Json>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...flatKeys(v, next));
  }
  return out;
}

const PROJECT_ROOT = resolve(__dirname, "..");
const APP_DIR = join(PROJECT_ROOT, "app");

// Brand tokens, status codes, and other intentionally untranslated
// literals that may legally appear as JSX text.
//
// The list is short on purpose - every entry here is a deliberate
// design choice and should be reviewable in PR.
const STRING_ALLOWLIST: readonly string[] = ["SADO", "OK", "AI"];

// Recursively collect every .tsx file under `dir`, returning paths
// relative to the project root. Stops at non-existent dirs.
async function collectTsx(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectTsx(full)));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

// Strip block and line comments from a TS source so the JSX-text
// regex never matches operators inside doc comments (e.g. a line
// comment with "returns >0").
//
// String-literal contents are NOT stripped - JSX text isn't
// delimited by quotes, so the regex anchor on ">...<" already keeps
// us out of those.
function stripComments(source: string): string {
  // Block comments first so a line-comment marker inside a block
  // comment doesn't trigger the line-comment branch.
  let cleaned = source.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/(^|[^:\\])\/\/[^\n]*/g, (_m, lead: string) => lead);
  return cleaned;
}

// Find hardcoded JSX text in a source string.
//
// The regex matches a ">", optional whitespace, then text that does
// NOT contain JSX-meta or TS/JS punctuation, then "<". Anything
// with TS/JS punctuation can't be JSX text in practice and is
// almost certainly an operator (arrow, generic, comparisons).
//
// The captured text is whitespace-collapsed, then we keep it iff:
//   - it has 3+ consecutive Latin or Cyrillic letters (real word)
//   - it isn't in the allowlist
function findHardcodedJsxText(source: string): string[] {
  const cleaned = stripComments(source);
  const out: string[] = [];
  const re = />[\t ]*([\p{L}][^<>{}();=\[\]\\:,]*?)[\t ]*</gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const raw = m[1] ?? "";
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length === 0) continue;
    if (!/\p{L}{3,}/u.test(text)) continue;
    if (STRING_ALLOWLIST.includes(text)) continue;
    out.push(text);
  }
  return out;
}

describe("i18n parity (uz vs ru)", () => {
  it("has at least one common namespace and non-zero key counts", () => {
    const uzKeys = flatKeys(uz as Json);
    const ruKeys = flatKeys(ru as Json);
    expect(uzKeys.length).toBeGreaterThan(50);
    expect(ruKeys.length).toBeGreaterThan(50);
  });

  it("uz.json and ru.json define the same key set", () => {
    const uzKeys = new Set(flatKeys(uz as Json));
    const ruKeys = new Set(flatKeys(ru as Json));

    const missingFromRu = [...uzKeys].filter((k) => !ruKeys.has(k)).sort();
    const missingFromUz = [...ruKeys].filter((k) => !uzKeys.has(k)).sort();

    expect({ missingFromRu, missingFromUz }).toEqual({
      missingFromRu: [],
      missingFromUz: [],
    });
  });

  it("every translation value is a non-empty string", () => {
    function* leafEntries(
      value: Json,
      prefix = "",
    ): Generator<{ key: string; value: Json }> {
      if (value === null || typeof value !== "object") {
        yield { key: prefix, value };
        return;
      }
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          yield* leafEntries(value[i] as Json, `${prefix}[${i}]`);
        }
        return;
      }
      for (const [k, v] of Object.entries(value as Record<string, Json>)) {
        yield* leafEntries(v, prefix ? `${prefix}.${k}` : k);
      }
    }

    const offenders: string[] = [];
    for (const lang of [
      { name: "uz", data: uz as Json },
      { name: "ru", data: ru as Json },
    ]) {
      for (const { key, value } of leafEntries(lang.data)) {
        if (typeof value !== "string" || value.trim().length === 0) {
          offenders.push(`${lang.name}:${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("hardcoded-string guard (app tsx files)", () => {
  it("no JSX text node contains a hardcoded translatable string", async () => {
    const files = await collectTsx(APP_DIR);
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; text: string }[] = [];
    for (const file of files) {
      const source = await fs.readFile(file, "utf-8");
      for (const text of findHardcodedJsxText(source)) {
        violations.push({
          file: relative(PROJECT_ROOT, file),
          text,
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
