import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const files = {
  index: path.join(ROOT, "index.html"),
  css: path.join(ROOT, "src", "styles", "main.css"),
  data: path.join(ROOT, "src", "data", "works.js"),
  app: path.join(ROOT, "src", "app.js"),
  package: path.join(ROOT, "package.json"),
  gitignore: path.join(ROOT, ".gitignore"),
};
const requirePhaseB = process.argv.includes("--phase-b");

function fail(message) {
  throw new Error(`[verify] ${message}`);
}

function read(label, file) {
  if (!fs.existsSync(file)) fail(`missing ${label}`);
  const bytes = fs.readFileSync(file);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fail(`${label} has a UTF-8 BOM`);
  }
  return bytes.toString("utf8");
}

function hash12(content) {
  return crypto.createHash("sha256").update(content.trim()).digest("hex").slice(0, 12);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function checkSyntax(file) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`syntax check failed for ${path.relative(ROOT, file)}\n${result.stderr}`);
  }
}

function loadCatalog(data) {
  // works.js still begins with the flip-compat IIFE that touches browser globals.
  const avatarElement = { getAttribute: name => name === "src" ? "__AUTHOR_AVATAR__" : null };
  const classList = {
    toggle() { return false; },
    add() {},
    remove() {},
    contains() { return false; },
  };
  const context = {
    console,
    location: { search: "", href: "http://127.0.0.1:4173/index.html" },
    CSS: { supports() { return true; } },
    document: {
      documentElement: { classList },
      getElementById: id => id === "authorAvatar" ? avatarElement : null,
    },
    window: {},
  };
  vm.createContext(context);
  vm.runInContext(
    `${data}
;globalThis.__AUTHORS__ =
  typeof authors !== "undefined" && Array.isArray(authors) ? authors : null;
;globalThis.__WORKS__ =
  typeof works !== "undefined" && Array.isArray(works) ? works : null;`,
    context,
    { filename: "src/data/works.js", timeout: 10_000 }
  );

  if (Array.isArray(context.__AUTHORS__) && context.__AUTHORS__.length) {
    return context.__AUTHORS__.map(author => ({
      name: String(author?.name || ""),
      works: Array.isArray(author?.works) ? author.works : [],
    }));
  }
  if (Array.isArray(context.__WORKS__) && context.__WORKS__.length) {
    return [{ name: "legacy", works: context.__WORKS__ }];
  }
  fail("catalog is empty");
}

function main() {
  const index = read("index.html", files.index);
  const css = read("src/styles/main.css", files.css);
  const data = read("src/data/works.js", files.data);
  const app = read("src/app.js", files.app);
  const packageText = read("package.json", files.package);
  const gitignore = read(".gitignore", files.gitignore);

  assert(!/<style(?:\s[^>]*)?>/i.test(index), "inline <style> remains");
  assert(!/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>/i.test(index), "inline <script> remains");
  assert(!/http-equiv=(['"])(?:Cache-Control|Pragma|Expires)\1/i.test(index), "development no-cache meta remains");

  const cssHash = hash12(css);
  const dataHash = hash12(data);
  const appHash = hash12(app);
  assert(index.includes(`src/styles/main.css?v=${cssHash}`), "CSS hash mismatch");
  assert(index.includes(`src/data/works.js?v=${dataHash}`), "data hash mismatch");
  assert(index.includes(`src/app.js?v=${appHash}`), "app hash mismatch");
  assert(index.indexOf("src/data/works.js") < index.indexOf("src/app.js"), "data must load before app");

  assert(!app.includes("const settingSensitive=Boolean(work.sensitive);"), "old setting-sensitivity source remains");
  assert(app.includes("const settingSensitive=Boolean(work.sensitiveSetting);"), "cardHTML does not use sensitiveSetting");
  assert(app.includes("return Boolean(works[index]?.sensitiveSetting) && !unlockedWorks.has(index);"), "isSettingLocked is incorrect");
  assert(app.includes('Boolean(work.sensitiveSetting) && !locked'), "setting unlock class is incorrect");
  assert(app.includes("const glowPointerMedia=window.matchMedia("), "pointer glow is not gated");

  const avatarTag = index.match(/<img\b(?=[^>]*\bid=(['"])authorAvatar\1)[^>]*>/i)?.[0] || "";
  assert(avatarTag, "authorAvatar tag missing");
  assert(!/data:image\//i.test(avatarTag), "authorAvatar still uses data URL");
  assert(/width=(['"])38\1/i.test(avatarTag), "authorAvatar width missing");
  assert(/height=(['"])38\1/i.test(avatarTag), "authorAvatar height missing");

  const catalog = loadCatalog(data);
  assert(catalog.length >= 1, "no author sections");
  let totalWorks = 0;
  for (const [authorIndex, author] of catalog.entries()) {
    assert(author.name, `author ${authorIndex} has no name`);
    assert(author.works.length > 0, `author ${authorIndex} has no works`);
    for (const [workIndex, work] of author.works.entries()) {
      assert(typeof work?.name === "string" && work.name.trim(), `author ${authorIndex} work ${workIndex} has no name`);
      assert(typeof work?.image === "string" && work.image.trim(), `author ${authorIndex} work ${workIndex} has no image`);
    }
    totalWorks += author.works.length;
  }

  const pkg = JSON.parse(packageText);
  assert(pkg.private === true, "package.json must be private");
  assert(pkg.scripts?.["test:matrix:twice"] === "node scripts/run_test_matrix_twice.mjs", "test matrix script missing");
  assert(pkg.devDependencies?.["@playwright/test"], "@playwright/test dependency missing");
  assert(
    !gitignore.split(/\r?\n/).some(line => ["package.json", "package-lock.json"].includes(line.trim())),
    "package files are ignored"
  );

  checkSyntax(files.data);
  checkSyntax(files.app);

  const phaseBSignals = [
    "DISPLAY_SLOTS=works.length",
    "placeholderNodes",
    "fitGalleryToViewport",
    "scheduleGalleryFit",
    "--gallery-row-height",
    "gallery-fit",
  ];
  if (requirePhaseB) {
    for (const signal of phaseBSignals) {
      assert(!app.includes(signal) && !css.includes(signal), `Phase B signal remains: ${signal}`);
    }
    assert(app.includes("function syncCompactLandscapeMode()"), "compact landscape replacement missing");
  }

  console.log(JSON.stringify({
    ok: true,
    phaseB: requirePhaseB,
    authors: catalog.length,
    totalWorks,
    bytes: {
      index: Buffer.byteLength(index),
      css: Buffer.byteLength(css),
      data: Buffer.byteLength(data),
      app: Buffer.byteLength(app),
    },
    hashes: { css: cssHash, data: dataHash, app: appHash },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
}
