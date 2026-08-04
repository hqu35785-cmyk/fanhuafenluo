/**
 * Record or check content invariants from source + live page smoke.
 *   node scripts/record_invariants.mjs write
 *   node scripts/record_invariants.mjs check
 */
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "test-artifacts", "invariants-baseline.json");
const mode = process.argv[2] || "check";

function readSources() {
  const files = ["index.html", "src/app.js"].map((p) => path.join(root, p)).filter(fs.existsSync);
  return files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
}

function extractArrayBlock(source, name) {
  const re = new RegExp(`const ${name}=\\[`);
  const m = re.exec(source);
  if (!m) return null;
  let i = m.index + m[0].length - 1; // at '['
  let depth = 0;
  const start = i;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0 && c === "]") {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractStringField(objText, field) {
  const re = new RegExp(`${field}:"((?:\\\\.|[^"\\\\])*)"`);
  const m = objText.match(re);
  return m ? m[1].replace(/\\"/g, '"') : null;
}

function extractBoolField(objText, field) {
  const re = new RegExp(`${field}:(true|false)`);
  const m = objText.match(re);
  return m ? m[1] === "true" : null;
}

function splitTopLevelObjects(arrayText) {
  // arrayText includes surrounding [ ]
  const inner = arrayText.slice(1, -1);
  const objs = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        objs.push(inner.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objs;
}

function parseNamedAssets(source, arrayName) {
  const block = extractArrayBlock(source, arrayName);
  if (!block) return [];
  return splitTopLevelObjects(block).map((obj) => ({
    name: extractStringField(obj, "name"),
    image: extractStringField(obj, "image"),
    preview: extractStringField(obj, "preview"),
    sensitive: extractBoolField(obj, "sensitive"),
    code: extractStringField(obj, "code"),
  }));
}

function parseTavoNames(source) {
  // tavoAssets entries use image paths with names in filename Tavo_<name>_<code>.png
  const block = extractArrayBlock(source, "tavoAssets");
  if (!block) return [];
  const images = [...block.matchAll(/image:"([^"]+)"/g)].map((m) => m[1]);
  return images.map((image) => {
    const file = decodeURI(image.split("/").pop());
    const base = file.replace(/^Tavo_/, "").replace(/\.png$/i, "");
    const sep = base.lastIndexOf("_");
    const name = sep > 0 ? base.slice(0, sep) : base;
    return { name, image, preview: null, sensitive: true };
  });
}

function parseAuthorsModel(source) {
  // fanhua = wanwan + tavo
  const hasWanwan = /name:"丸丸"/.test(source);
  const tavo = parseTavoNames(source);
  const fanhuaNames = [];
  if (hasWanwan) fanhuaNames.push("丸丸");
  // pin-yunyun-first: 云韵 first among tavo, then rest
  const yunyun = tavo.find((t) => t.name === "云韵");
  const rest = tavo.filter((t) => t.name !== "云韵");
  const orderedTavo = yunyun ? [yunyun, ...rest] : tavo;
  for (const t of orderedTavo) fanhuaNames.push(t.name);

  const shark = parseNamedAssets(source, "sharkAssets");
  const wa = parseNamedAssets(source, "waAssets");

  // sensitive for fanhua: wanwan true, tavo true, plus any overrides in source
  const fanhuaSensitive = fanhuaNames.map((name) => {
    if (name === "丸丸") return true;
    return true; // tavo cards all sensitive:true in mapper
  });

  // author order from authors array
  const authorBlock = source.match(/const authors = \[([\s\S]*?)\n\];/);
  const order = [];
  if (authorBlock) {
    for (const m of authorBlock[1].matchAll(/id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?works:\s*(\w+)/g)) {
      order.push({ id: m[1], name: m[2], worksRef: m[3] });
    }
  }

  const byRef = {
    fanhuaWorks: {
      names: fanhuaNames,
      sensitive: fanhuaSensitive,
      images: [
        ...(hasWanwan ? ["assets/source/wanwan.png"] : []),
        ...orderedTavo.map((t) => t.image),
      ],
    },
    sharkWorks: {
      names: shark.map((s) => s.name),
      sensitive: shark.map((s) => Boolean(s.sensitive)),
      images: shark.map((s) => s.image),
      previews: shark.map((s) => s.preview),
    },
    waWorks: {
      names: wa.map((s) => s.name),
      sensitive: wa.map((s) => Boolean(s.sensitive)),
      images: wa.map((s) => s.image),
      previews: wa.map((s) => s.preview),
    },
  };

  // empty works array
  const authors = order.map((a) => {
    if (a.worksRef === "fanhuaWorks") {
      return {
        id: a.id,
        name: a.name,
        workCount: byRef.fanhuaWorks.names.length,
        workNames: byRef.fanhuaWorks.names,
        sensitiveFlags: byRef.fanhuaWorks.sensitive,
        images: byRef.fanhuaWorks.images,
      };
    }
    if (a.worksRef === "sharkWorks") {
      return {
        id: a.id,
        name: a.name,
        workCount: byRef.sharkWorks.names.length,
        workNames: byRef.sharkWorks.names,
        sensitiveFlags: byRef.sharkWorks.sensitive,
        images: byRef.sharkWorks.images,
        previews: byRef.sharkWorks.previews,
      };
    }
    if (a.worksRef === "waWorks") {
      return {
        id: a.id,
        name: a.name,
        workCount: byRef.waWorks.names.length,
        workNames: byRef.waWorks.names,
        sensitiveFlags: byRef.waWorks.sensitive,
        images: byRef.waWorks.images,
        previews: byRef.waWorks.previews,
      };
    }
    // works: [] empty
    return {
      id: a.id,
      name: a.name,
      workCount: 0,
      workNames: [],
      sensitiveFlags: [],
      images: [],
    };
  });

  return authors;
}

function collectAssetRefs(source) {
  const refs = new Set();
  for (const m of source.matchAll(/["'](assets\/[^"']+)["']/g)) {
    refs.add(m[1].split("?")[0]);
  }
  return [...refs];
}

function checkAssets(refs) {
  const missing = [];
  const existing = [];
  for (const ref of refs) {
    let rel = ref;
    try {
      rel = decodeURI(ref);
    } catch {}
    const full = path.join(root, rel);
    if (fs.existsSync(full)) existing.push(rel);
    else missing.push(rel);
  }
  return { existing, missing };
}

async function liveSmoke() {
  const server = await new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      let u = decodeURIComponent((req.url || "/").split("?")[0]);
      if (u === "/") u = "/index.html";
      const f = path.normalize(path.join(root, u));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        res.end("no");
        return;
      }
      const ext = path.extname(f).toLowerCase();
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
      };
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => document.querySelectorAll("#gallery .card").length > 0, null, {
    timeout: 30000,
  });
  const live = await page.evaluate(() => ({
    authorName: document.getElementById("authorName")?.textContent || "",
    cardCount: document.querySelectorAll("#gallery .card").length,
    title: document.title,
  }));
  await browser.close();
  server.close();
  return { pageErrors, live };
}

const source = readSources();
const authors = parseAuthorsModel(source);
const assetRefs = collectAssetRefs(source);
const { existing, missing } = checkAssets(assetRefs);
const { pageErrors, live } = await liveSmoke();

const report = {
  generatedAt: new Date().toISOString(),
  authorCount: authors.length,
  authors: authors.map((a) => ({
    id: a.id,
    name: a.name,
    workCount: a.workCount,
    workNames: a.workNames,
    sensitiveFlags: a.sensitiveFlags,
    images: a.images,
    previews: a.previews || [],
  })),
  assetRefCount: assetRefs.length,
  existingAssetCount: existing.length,
  missingAssets: missing,
  pageErrors,
  live,
};

fs.mkdirSync(path.dirname(baselinePath), { recursive: true });

if (mode === "write") {
  fs.writeFileSync(baselinePath, JSON.stringify(report, null, 2));
  console.log("Wrote", baselinePath);
  console.log(
    JSON.stringify(
      {
        authorCount: report.authorCount,
        authors: report.authors.map((a) => ({
          id: a.id,
          name: a.name,
          workCount: a.workCount,
          sensitiveOpen: a.sensitiveFlags.filter((s) => !s).length,
        })),
        missingAssets: report.missingAssets,
        pageErrors: report.pageErrors,
        live: report.live,
      },
      null,
      2
    )
  );
  process.exit(report.missingAssets.length || report.pageErrors.length ? 1 : 0);
}

if (!fs.existsSync(baselinePath)) {
  console.error("No baseline; run write first");
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const failures = [];

const stripVolatile = (r) => ({
  authorCount: r.authorCount,
  authors: r.authors.map((a) => ({
    id: a.id,
    name: a.name,
    workCount: a.workCount,
    workNames: a.workNames,
    sensitiveFlags: a.sensitiveFlags,
    images: a.images,
    previews: a.previews || [],
  })),
  missingAssets: r.missingAssets,
});

const b = stripVolatile(baseline);
const a = stripVolatile(report);
if (JSON.stringify(b) !== JSON.stringify(a)) {
  if (b.authorCount !== a.authorCount) {
    failures.push({ check: "authorCount", expected: b.authorCount, actual: a.authorCount });
  }
  for (let i = 0; i < Math.max(b.authors.length, a.authors.length); i++) {
    const be = b.authors[i];
    const ae = a.authors[i];
    if (JSON.stringify(be) !== JSON.stringify(ae)) {
      failures.push({ check: "author", index: i, expected: be, actual: ae });
    }
  }
  if (JSON.stringify(b.missingAssets) !== JSON.stringify(a.missingAssets)) {
    failures.push({ check: "missingAssets", expected: b.missingAssets, actual: a.missingAssets });
  }
}
if (report.pageErrors.length) failures.push({ check: "pageErrors", actual: report.pageErrors });
if (report.missingAssets.length) failures.push({ check: "missingNow", actual: report.missingAssets });

fs.writeFileSync(
  path.join(root, "test-artifacts", "invariants-check.json"),
  JSON.stringify({ failures, report }, null, 2)
);
console.log(JSON.stringify({ ok: failures.length === 0, failureCount: failures.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
