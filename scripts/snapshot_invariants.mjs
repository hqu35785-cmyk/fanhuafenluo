import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const INDEX = path.join(ROOT, "index.html");
const APP = path.join(ROOT, "src", "app.js");
const DATA = path.join(ROOT, "src", "data", "works.js");
const SNAPSHOT = path.join(ROOT, ".refactor-invariants.json");
const RUNTIME_MARKER = 'const gallery=document.getElementById("gallery");';

function fail(message) {
  throw new Error(`[invariants] ${message}`);
}

function cleanText(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function dataPrefix(source, label) {
  const markerAt = source.indexOf(RUNTIME_MARKER);
  if (markerAt < 0) fail(`${label}: runtime marker not found`);
  return source.slice(0, markerAt);
}

function readDataSource() {
  if (fs.existsSync(DATA)) return cleanText(DATA);

  // Phase 1 baseline: CSS/JS are external, but all data still lives at the
  // beginning of src/app.js.
  if (fs.existsSync(APP)) return dataPrefix(cleanText(APP), "src/app.js");

  // Legacy fallback: original monolithic index.html.
  if (!fs.existsSync(INDEX)) fail("index.html is missing");
  const html = cleanText(INDEX);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1) {
    fail(`expected one inline script in legacy index.html, found ${scripts.length}`);
  }
  return dataPrefix(scripts[0][1], "index.html inline script");
}

function makeContext() {
  // Data prefix in Phase-1 app.js (and later works.js) begins with the flip
  // compatibility IIFE, which reads location/CSS/document.documentElement.
  const avatarElement = {
    getAttribute(name) {
      return name === "src" ? "__AUTHOR_AVATAR__" : null;
    },
  };
  const classList = {
    toggle() {
      return false;
    },
    add() {},
    remove() {},
    contains() {
      return false;
    },
  };
  return {
    console,
    location: { search: "", href: "http://127.0.0.1:4173/index.html" },
    CSS: {
      supports() {
        return true;
      },
    },
    document: {
      documentElement: { classList },
      getElementById(id) {
        return id === "authorAvatar" ? avatarElement : null;
      },
    },
    window: {},
  };
}

function loadCatalog() {
  const source = readDataSource();
  const context = makeContext();
  vm.createContext(context);
  vm.runInContext(
    `${source}
;globalThis.__REFRACTOR_AUTHORS__ =
  typeof authors !== "undefined" && Array.isArray(authors) ? authors : null;
;globalThis.__REFRACTOR_WORKS__ =
  typeof works !== "undefined" && Array.isArray(works) ? works : null;`,
    context,
    { filename: "catalog-snapshot.js", timeout: 10_000 }
  );

  if (Array.isArray(context.__REFRACTOR_AUTHORS__) && context.__REFRACTOR_AUTHORS__.length) {
    return context.__REFRACTOR_AUTHORS__.map((author, authorIndex) => ({
      authorIndex,
      id: String(author?.id || ""),
      name: String(author?.name || ""),
      status: String(author?.status || ""),
      works: Array.isArray(author?.works) ? author.works : [],
    }));
  }

  if (Array.isArray(context.__REFRACTOR_WORKS__) && context.__REFRACTOR_WORKS__.length) {
    return [{
      authorIndex: 0,
      id: "legacy",
      name: "legacy",
      status: "",
      works: context.__REFRACTOR_WORKS__,
    }];
  }

  fail("neither authors nor works catalog could be loaded");
}

function normalizeWork(work, index) {
  return {
    index,
    name: String(work?.name || ""),
    alias: String(work?.alias || ""),
    image: String(work?.image || ""),
    preview: String(work?.preview || ""),
    cardLabel: String(work?.cardLabel || ""),
    tags: Array.isArray(work?.tags) ? work.tags.map(String) : [],
    sensitive: Boolean(work?.sensitive),
    sensitiveSetting: Boolean(work?.sensitiveSetting),
  };
}

function normalizeCatalog(catalog) {
  return catalog.map(author => ({
    authorIndex: author.authorIndex,
    id: author.id,
    name: author.name,
    status: author.status,
    works: author.works.map(normalizeWork),
  }));
}

function main() {
  const command = process.argv[2];
  if (!new Set(["record", "check", "print"]).has(command)) {
    fail("usage: node scripts/snapshot_invariants.mjs record|check|print");
  }

  const current = normalizeCatalog(loadCatalog());

  if (command === "print") {
    console.log(JSON.stringify(current, null, 2));
    return;
  }

  if (command === "record") {
    fs.writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    const total = current.reduce((sum, author) => sum + author.works.length, 0);
    console.log(`recorded ${current.length} author section(s), ${total} works`);
    return;
  }

  if (!fs.existsSync(SNAPSHOT)) fail("snapshot missing; run record before applying changes");
  const expected = JSON.parse(cleanText(SNAPSHOT));
  if (JSON.stringify(expected) === JSON.stringify(current)) {
    const total = current.reduce((sum, author) => sum + author.works.length, 0);
    console.log(`invariants preserved for ${current.length} author section(s), ${total} works`);
    return;
  }

  const differences = [];
  const maxAuthors = Math.max(expected.length, current.length);
  for (let authorIndex = 0; authorIndex < maxAuthors; authorIndex += 1) {
    const beforeAuthor = expected[authorIndex] ?? null;
    const afterAuthor = current[authorIndex] ?? null;
    if (!beforeAuthor || !afterAuthor) {
      differences.push({ authorIndex, before: beforeAuthor, after: afterAuthor });
      continue;
    }
    if (
      beforeAuthor.id !== afterAuthor.id ||
      beforeAuthor.name !== afterAuthor.name ||
      beforeAuthor.status !== afterAuthor.status
    ) {
      differences.push({
        authorIndex,
        before: {
          id: beforeAuthor.id,
          name: beforeAuthor.name,
          status: beforeAuthor.status,
        },
        after: {
          id: afterAuthor.id,
          name: afterAuthor.name,
          status: afterAuthor.status,
        },
      });
    }
    const maxWorks = Math.max(beforeAuthor.works.length, afterAuthor.works.length);
    for (let workIndex = 0; workIndex < maxWorks; workIndex += 1) {
      if (
        JSON.stringify(beforeAuthor.works[workIndex] ?? null) !==
        JSON.stringify(afterAuthor.works[workIndex] ?? null)
      ) {
        differences.push({
          authorIndex,
          workIndex,
          before: beforeAuthor.works[workIndex] ?? null,
          after: afterAuthor.works[workIndex] ?? null,
        });
      }
      if (differences.length >= 12) break;
    }
    if (differences.length >= 12) break;
  }

  console.error(JSON.stringify({ ok: false, differences }, null, 2));
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
}
