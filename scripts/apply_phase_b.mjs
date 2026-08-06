import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INDEX = path.join(ROOT, "index.html");
const STYLE = path.join(ROOT, "src", "styles", "main.css");
const DATA = path.join(ROOT, "src", "data", "works.js");
const APP = path.join(ROOT, "src", "app.js");

function fail(message) {
  throw new Error(`[phase-b] ${message}`);
}

function readText(file) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(ROOT, file)}; apply Phase A first`);
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function writeAtomic(file, content) {
  const temp = `${file}.phase-b.tmp`;
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
  const backupRoot = path.join(ROOT, ".refactor-backup", "before-phase-b");
  if (fs.existsSync(backupRoot)) return;
  fs.mkdirSync(backupRoot, { recursive: true });
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const destination = path.join(backupRoot, path.relative(ROOT, file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
}

function replaceLayoutRuntime(app) {
  if (app.includes("function syncCompactLandscapeMode()")) return app;

  const startMarker = "const DISPLAY_SLOTS=works.length;";
  const endMarker = "document.fonts?.ready.then(scheduleGalleryFit);";
  const start = app.indexOf(startMarker);
  const endStart = app.indexOf(endMarker, start);
  if (start < 0 || endStart < 0) {
    fail("legacy placeholder/gallery-fit runtime block was not found exactly once");
  }
  if (app.indexOf(startMarker, start + startMarker.length) >= 0) {
    fail("multiple DISPLAY_SLOTS blocks found");
  }
  const end = endStart + endMarker.length;

  const replacement = `gallery.innerHTML=works.map(cardHTML).join("");
document.getElementById("workCount").textContent=String(works.length).padStart(2,"0");
document.getElementById("workTotal").textContent="/ "+works.length;

const layoutRoot=document.documentElement;
let viewportModeFrame=0;
function syncCompactLandscapeMode(){
  viewportModeFrame=0;
  const viewportHeight=Math.round(window.visualViewport?.height || window.innerHeight);
  const compactLandscape=window.innerWidth>viewportHeight && viewportHeight<=520;
  layoutRoot.classList.toggle("compact-landscape",compactLandscape);
}
function scheduleCompactLandscapeMode(){
  if(viewportModeFrame) cancelAnimationFrame(viewportModeFrame);
  viewportModeFrame=requestAnimationFrame(syncCompactLandscapeMode);
}
syncCompactLandscapeMode();
window.addEventListener("resize",scheduleCompactLandscapeMode,{passive:true});
window.addEventListener("orientationchange",scheduleCompactLandscapeMode,{passive:true});
window.visualViewport?.addEventListener("resize",scheduleCompactLandscapeMode,{passive:true});`;

  return `${app.slice(0, start)}${replacement}${app.slice(end)}`;
}

function removeSimpleRules(css, token) {
  let previous;
  do {
    previous = css;
    const pattern = new RegExp(`[^{}]*${token}[^{}]*\\{[^{}]*\\}\\s*`, "g");
    css = css.replace(pattern, "\n");
  } while (css !== previous);
  return css;
}

function removeKeyframes(css, name) {
  const marker = `@keyframes ${name}`;
  const start = css.indexOf(marker);
  if (start < 0) return css;
  const open = css.indexOf("{", start);
  if (open < 0) fail(`malformed @keyframes ${name}`);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return `${css.slice(0, start)}${css.slice(index + 1)}`;
    }
  }
  fail(`unterminated @keyframes ${name}`);
}

function cleanLayoutCss(css) {
  // Remove the custom property even when it lives in a shared :root rule.
  css = css.replace(/\s*--gallery-row-height\s*:[^;}]+;?/g, "");
  for (const token of [
    "gallery-fit",
    "placeholder-item",
    "placeholder-card",
    "slot-number",
    "slot-label",
    "slot-cross",
  ]) {
    css = removeSimpleRules(css, token);
  }
  css = removeKeyframes(css, "slotShine");
  return css.replace(/\n{3,}/g, "\n\n").trim();
}

function versionReference(indexHtml, relativePath, hash) {
  const escaped = relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(["'])((?:\\./)?${escaped})(?:\\?v=[a-f0-9]+)?\\1`, "g");
  let count = 0;
  const updated = indexHtml.replace(pattern, (_, quote, file) => {
    count += 1;
    return `${quote}${file}?v=${hash}${quote}`;
  });
  if (count !== 1) fail(`expected one ${relativePath} reference, found ${count}`);
  return updated;
}

function main() {
  backupOnce([INDEX, STYLE, DATA, APP]);

  let indexHtml = readText(INDEX);
  let css = readText(STYLE).trim();
  const data = readText(DATA).trim();
  let app = readText(APP).trim();

  app = replaceLayoutRuntime(app);
  css = cleanLayoutCss(css);

  const hashes = {
    css: hash12(css),
    data: hash12(data),
    app: hash12(app),
  };
  indexHtml = versionReference(indexHtml, "src/styles/main.css", hashes.css);
  indexHtml = versionReference(indexHtml, "src/data/works.js", hashes.data);
  indexHtml = versionReference(indexHtml, "src/app.js", hashes.app);

  writeAtomic(STYLE, css);
  writeAtomic(APP, app);
  writeAtomic(INDEX, indexHtml.trim());

  console.log(JSON.stringify({
    ok: true,
    removed: [
      "dead placeholder generation",
      "JS-computed grid row heights",
      "gallery-fit runtime and CSS overrides",
      "unused placeholder presentation",
    ],
    hashes,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
}
