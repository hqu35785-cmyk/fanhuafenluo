import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INDEX = path.join(ROOT, "index.html");
const STYLE = path.join(ROOT, "src", "styles", "main.css");
const DATA = path.join(ROOT, "src", "data", "works.js");
const APP = path.join(ROOT, "src", "app.js");
const PACKAGE = path.join(ROOT, "package.json");
const GITIGNORE = path.join(ROOT, ".gitignore");
const RUNTIME_MARKER = 'const gallery=document.getElementById("gallery");';

function fail(message) {
  throw new Error(`[phase-a] ${message}`);
}

function readText(file) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(ROOT, file)}`);
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.phase-a.tmp`;
  fs.writeFileSync(temp, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  fs.renameSync(temp, file);
}

function normalizeHashInput(content) {
  return String(content)
    .replace(/\r\n?/g, "\n")
    .trim();
}

function hash12(content) {
  return crypto
    .createHash("sha256")
    .update(normalizeHashInput(content), "utf8")
    .digest("hex")
    .slice(0, 12);
}

function backupOnce(files) {
  const backupRoot = path.join(ROOT, ".refactor-backup", "before-phase-a");
  if (fs.existsSync(backupRoot)) return;
  fs.mkdirSync(backupRoot, { recursive: true });
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const destination = path.join(backupRoot, path.relative(ROOT, file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
}

function newlineVariants(text) {
  const lf = text.replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return [...new Set([text, lf, crlf])];
}

function replaceRequired(content, before, after, label) {
  // Idempotent if any newline form of the replacement is already present.
  if (newlineVariants(after).some(variant => content.includes(variant))) return content;

  // Match LF or CRLF sources without rewriting the whole file's endings.
  let actualBefore = null;
  for (const variant of newlineVariants(before)) {
    if (content.includes(variant)) {
      actualBefore = variant;
      break;
    }
  }
  if (!actualBefore) fail(`${label}: expected one match, found 0`);
  const count = content.split(actualBefore).length - 1;
  if (count !== 1) fail(`${label}: expected one match, found ${count}`);

  const useCrlf = actualBefore.includes("\r\n") || (!actualBefore.includes("\n") && content.includes("\r\n"));
  const actualAfter = useCrlf
    ? after.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")
    : after.replace(/\r\n/g, "\n");
  return content.replace(actualBefore, actualAfter);
}

function extractSources(indexHtml) {
  const inlineStyles = [...indexHtml.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)];
  const inlineScripts = [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];

  if (inlineStyles.length === 1 && inlineScripts.length === 1) {
    const source = inlineScripts[0][1].trim();
    const markerAt = source.indexOf(RUNTIME_MARKER);
    if (markerAt < 0) fail(`legacy runtime split marker not found: ${RUNTIME_MARKER}`);
    return {
      mode: "monolith",
      css: inlineStyles[0][1].trim(),
      data: source.slice(0, markerAt).trim(),
      app: source.slice(markerAt).trim(),
      styleTag: inlineStyles[0][0],
      scriptTag: inlineScripts[0][0],
      hadDataTag: false,
    };
  }

  if (inlineStyles.length || inlineScripts.length) {
    fail(`ambiguous inline resources: ${inlineStyles.length} style tag(s), ${inlineScripts.length} script tag(s)`);
  }
  if (!fs.existsSync(STYLE) || !fs.existsSync(APP)) {
    fail("Phase 1 external files src/styles/main.css and src/app.js are required");
  }

  let app = readText(APP).trim();
  let data;
  let hadDataTag = fs.existsSync(DATA);

  if (hadDataTag) {
    data = readText(DATA).trim();
  } else {
    const markerAt = app.indexOf(RUNTIME_MARKER);
    if (markerAt < 0) fail("src/app.js cannot be split at the runtime marker");
    data = app.slice(0, markerAt).trim();
    app = app.slice(markerAt).trim();
  }

  return {
    mode: "phase1-external",
    css: readText(STYLE).trim(),
    data,
    app,
    styleTag: null,
    scriptTag: null,
    hadDataTag,
  };
}

function patchPrivacy(app) {
  app = replaceRequired(
    app,
    "const settingSensitive=Boolean(work.sensitive);",
    "const settingSensitive=Boolean(work.sensitiveSetting);",
    "cardHTML setting sensitivity"
  );
  app = replaceRequired(
    app,
    `function isSettingLocked(index){\n  return isWorkLocked(index);\n}`,
    `function isSettingLocked(index){\n  return Boolean(works[index]?.sensitiveSetting) && !unlockedWorks.has(index);\n}`,
    "isSettingLocked"
  );
  app = replaceRequired(
    app,
    'card.classList.toggle("is-setting-unlocked",Boolean(work.sensitive) && !locked);',
    'card.classList.toggle("is-setting-unlocked",Boolean(work.sensitiveSetting) && !locked);',
    "setting unlocked class"
  );
  return app;
}

function patchPointerGlow(app) {
  if (app.includes("const glowPointerMedia=window.matchMedia(")) return app;
  const before = `let glowFrame=0;
let glowX=innerWidth*.68;
let glowY=innerHeight*.22;
window.addEventListener("pointermove",e=>{
  glowX=e.clientX;glowY=e.clientY;
  if(glowFrame) return;
  glowFrame=requestAnimationFrame(()=>{
    document.body.style.setProperty("--mx",\`\${glowX}px\`);
    document.body.style.setProperty("--my",\`\${glowY}px\`);
    glowFrame=0;
  });
},{passive:true});`;
  const after = `const glowPointerMedia=window.matchMedia(
  "(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)"
);
if(glowPointerMedia.matches){
  let glowFrame=0;
  let glowX=innerWidth*.68;
  let glowY=innerHeight*.22;
  window.addEventListener("pointermove",e=>{
    glowX=e.clientX;
    glowY=e.clientY;
    if(glowFrame) return;
    glowFrame=requestAnimationFrame(()=>{
      document.body.style.setProperty("--mx",\`\${glowX}px\`);
      document.body.style.setProperty("--my",\`\${glowY}px\`);
      glowFrame=0;
    });
  },{passive:true});
}`;
  return replaceRequired(app, before, after, "pointer glow");
}

function validateImage(bytes, extension) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  const webp =
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!((extension === "jpg" && jpeg) || (extension === "png" && png) || (extension === "webp" && webp))) {
    fail(`author avatar bytes do not match .${extension}`);
  }
}

function setAttribute(tag, name, value) {
  const pattern = new RegExp(`\\s${name}=(['"])[^'"]*\\1`, "i");
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${value}"`);
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function externalizeAuthorAvatar(indexHtml) {
  const tagPattern = /<img\b(?=[^>]*\bid=(['"])authorAvatar\1)[^>]*>/i;
  const match = indexHtml.match(tagPattern);
  if (!match) fail('could not find <img id="authorAvatar">');

  const originalTag = match[0];
  let tag = originalTag;
  let asset = null;
  let bytes = 0;

  const data = tag.match(/\ssrc=(['"])data:image\/(jpeg|jpg|png|webp);base64,([^'"]+)\1/i);
  if (data) {
    const extension = data[2].toLowerCase() === "jpeg" ? "jpg" : data[2].toLowerCase();
    const decoded = Buffer.from(data[3].replace(/\s+/g, ""), "base64");
    validateImage(decoded, extension);
    asset = `assets/authors/fanhuafenluo-avatar.${extension}`;
    const destination = path.join(ROOT, asset);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(decoded)) {
      fail(`${asset} already exists with different bytes`);
    }
    if (!fs.existsSync(destination)) fs.writeFileSync(destination, decoded);
    bytes = decoded.length;
    tag = tag.replace(data[0], ` src="${asset}"`);
  } else {
    const src = tag.match(/\ssrc=(['"])([^'"]+)\1/i)?.[2] || "";
    if (!/^assets\/authors\/fanhuafenluo-avatar\.(?:jpg|png|webp)$/i.test(src)) {
      fail("authorAvatar is not an expected inline or external asset");
    }
    asset = src;
    const destination = path.join(ROOT, asset);
    if (!fs.existsSync(destination)) fail(`missing ${asset}`);
    bytes = fs.statSync(destination).size;
  }

  tag = setAttribute(tag, "width", "38");
  tag = setAttribute(tag, "height", "38");
  tag = setAttribute(tag, "decoding", "async");
  tag = setAttribute(tag, "fetchpriority", "high");
  return { html: indexHtml.replace(originalTag, tag), asset, bytes };
}

function removeDevelopmentCacheMeta(indexHtml) {
  return indexHtml
    .replace(/\s*<meta\s+http-equiv=(['"])Cache-Control\1[^>]*>\s*/i, "\n")
    .replace(/\s*<meta\s+http-equiv=(['"])Pragma\1[^>]*>\s*/i, "\n")
    .replace(/\s*<meta\s+http-equiv=(['"])Expires\1[^>]*>\s*/i, "\n");
}

function ensureHeadMetadata(indexHtml) {
  const additions = [];
  if (!/name=(['"])referrer\1/i.test(indexHtml)) {
    additions.push('<meta name="referrer" content="no-referrer">');
  }
  if (!/name=(['"])description\1/i.test(indexHtml)) {
    additions.push('<meta name="description" content="繁花·纷落角色卡作品档案">');
  }
  if (!/name=(['"])theme-color\1/i.test(indexHtml)) {
    additions.push('<meta name="theme-color" content="#070811">');
  }
  if (!additions.length) return indexHtml;
  const viewport = /<meta\s+name=(['"])viewport\1[^>]*>/i;
  return viewport.test(indexHtml)
    ? indexHtml.replace(viewport, match => `${match}\n${additions.join("\n")}`)
    : indexHtml.replace(/<head>/i, `<head>\n${additions.join("\n")}`);
}

function externalizeIndex(indexHtml, sources, hashes) {
  const styleTag = `<link rel="stylesheet" href="src/styles/main.css?v=${hashes.css}">`;
  const dataTag = `<script src="src/data/works.js?v=${hashes.data}" defer></script>`;
  const appTag = `<script src="src/app.js?v=${hashes.app}" defer></script>`;

  if (sources.mode === "monolith") {
    indexHtml = indexHtml.replace(sources.styleTag, styleTag);
    return indexHtml.replace(sources.scriptTag, `${dataTag}\n${appTag}`);
  }

  const stylePattern = /<link\b(?=[^>]*\brel=(['"])stylesheet\1)(?=[^>]*\bhref=(['"])(?:\.\/)?src\/styles\/main\.css(?:\?v=[a-f0-9]+)?\2)[^>]*>/i;
  const dataPattern = /<script\b(?=[^>]*\bsrc=(['"])(?:\.\/)?src\/data\/works\.js(?:\?v=[a-f0-9]+)?\1)[^>]*><\/script>/i;
  const appPattern = /<script\b(?=[^>]*\bsrc=(['"])(?:\.\/)?src\/app\.js(?:\?v=[a-f0-9]+)?\1)[^>]*><\/script>/i;

  if (!stylePattern.test(indexHtml)) fail("Phase 1 stylesheet tag not found");
  if (!appPattern.test(indexHtml)) fail("Phase 1 app script tag not found");

  indexHtml = indexHtml.replace(stylePattern, styleTag);

  // Current 0aa9021 baseline has no works.js tag. Insert it immediately before
  // app.js. On repeated runs, update the existing data tag instead.
  if (dataPattern.test(indexHtml)) {
    indexHtml = indexHtml.replace(dataPattern, dataTag);
    indexHtml = indexHtml.replace(appPattern, appTag);
  } else {
    indexHtml = indexHtml.replace(appPattern, `${dataTag}\n${appTag}`);
  }
  return indexHtml;
}

function updatePackageJson() {
  let pkg = {};
  if (fs.existsSync(PACKAGE)) {
    try {
      pkg = JSON.parse(readText(PACKAGE));
    } catch (error) {
      fail(`invalid package.json: ${error.message}`);
    }
  }

  pkg.name ||= "fanhuafenluo";
  pkg.private = true;
  pkg.type = "module";
  pkg.scripts = {
    ...(pkg.scripts || {}),
    "apply:phase-a": "node scripts/apply_phase_a.mjs",
    "apply:phase-b": "node scripts/apply_phase_b.mjs",
    "verify:phase-a": "node scripts/verify_refactor.mjs",
    "verify:phase-b": "node scripts/verify_refactor.mjs --phase-b",
    "test:refactor": "playwright test tests/refactor-regression.spec.mjs",
    "test:matrix:twice": "node scripts/run_test_matrix_twice.mjs"
  };

  pkg.devDependencies ||= {};
  const existingVersion =
    pkg.devDependencies["@playwright/test"] ||
    pkg.devDependencies.playwright ||
    pkg.dependencies?.playwright ||
    "1.62.0";
  pkg.devDependencies["@playwright/test"] = existingVersion;
  pkg.devDependencies.playwright ||= existingVersion;

  writeAtomic(PACKAGE, `${JSON.stringify(pkg, null, 2)}\n`);
}

function updateGitignore() {
  const current = fs.existsSync(GITIGNORE) ? readText(GITIGNORE).split(/\r?\n/) : [];
  const forbidden = new Set(["package.json", "package-lock.json"]);
  const required = [
    "node_modules/",
    "test-artifacts/",
    "test-results/",
    "playwright-report/",
    ".refactor-backup/",
    ".refactor-invariants.json",
  ];
  const output = [];
  const seen = new Set();

  for (const raw of current) {
    const line = raw.trim();
    if (forbidden.has(line)) continue;
    if (line && seen.has(line)) continue;
    if (line) seen.add(line);
    output.push(raw);
  }
  for (const line of required) {
    if (!seen.has(line)) output.push(line);
  }
  writeAtomic(GITIGNORE, `${output.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`);
}

function main() {
  if (!fs.existsSync(INDEX)) fail("run this script from the repository root");
  backupOnce([INDEX, STYLE, DATA, APP, PACKAGE, GITIGNORE]);

  let indexHtml = readText(INDEX);
  const sources = extractSources(indexHtml);
  const css = sources.css.trim();
  const data = sources.data.trim();
  let app = sources.app.trim();

  app = patchPrivacy(app);
  app = patchPointerGlow(app);

  const hashes = {
    css: hash12(css),
    data: hash12(data),
    app: hash12(app),
  };

  indexHtml = removeDevelopmentCacheMeta(indexHtml);
  indexHtml = ensureHeadMetadata(indexHtml);
  indexHtml = externalizeIndex(indexHtml, sources, hashes);
  const avatar = externalizeAuthorAvatar(indexHtml);
  indexHtml = avatar.html;

  writeAtomic(STYLE, css);
  writeAtomic(DATA, data);
  writeAtomic(APP, app);
  writeAtomic(INDEX, indexHtml.trim());
  updatePackageJson();
  updateGitignore();

  console.log(JSON.stringify({
    ok: true,
    baselineMode: sources.mode,
    avatar: { path: avatar.asset, bytes: avatar.bytes },
    hashes,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
}
