import fs from "fs";
import vm from "vm";

const code = fs.readFileSync(
  // Prefer original full source if we still have it in git
  process.argv[2] || "src/data/works.js",
  "utf8"
);

// If already split, re-hydrate from catalogs + details + slim is hard.
// Require original from git when re-running.
const context = {
  console,
  location: { search: "", href: "http://127.0.0.1/index.html" },
  CSS: { supports: () => true },
  document: {
    documentElement: {
      classList: {
        toggle() {},
        add() {},
        remove() {},
        contains() {
          return false;
        },
      },
    },
    getElementById: (id) =>
      id === "authorAvatar"
        ? { getAttribute: () => "assets/authors/fanhuafenluo-avatar.webp" }
        : null,
  },
  window: {},
};
vm.createContext(context);

if (!code.includes("const tavoAssets") && !code.includes("const sharkAssets")) {
  console.error("Need full original works.js with tavoAssets/sharkAssets");
  process.exit(1);
}

vm.runInContext(
  `${code}; this.__fanhua = fanhuaWorks; this.__shark = sharkWorks; this.__wa = waWorks;`,
  context
);

const fanhua = context.__fanhua;
const shark = context.__shark;
const wa = context.__wa;

function slimWork(w) {
  return {
    name: w.name,
    alias: w.alias,
    collectionLabel: w.collectionLabel,
    image: w.image,
    preview: w.preview,
    role: w.role,
    tags: w.tags,
    cardLabel: w.cardLabel,
    creator: w.creator,
    sensitive: w.sensitive,
    sensitiveSetting: w.sensitiveSetting,
    sensitiveLabel: w.sensitiveLabel,
    sensitiveSettingLabel: w.sensitiveSettingLabel,
    _detailKey: w.image,
  };
}

function detailOf(w) {
  return {
    opening: w.opening,
    personality: w.personality,
    setting: w.setting,
  };
}

const fanhuaSlim = fanhua.map(slimWork);
const sharkSlim = shark.map(slimWork);
const waSlim = wa.map(slimWork);
const fanhuaDetails = Object.fromEntries(fanhua.map((w) => [w.image, detailOf(w)]));
const sharkDetails = Object.fromEntries(shark.map((w) => [w.image, detailOf(w)]));
const waDetails = Object.fromEntries(wa.map((w) => [w.image, detailOf(w)]));

// All catalogs stay in critical works.js so static verify + instant switch work.
// Only long-form details are deferred.
const core = `(function setupFlipCompatibility(){
  const root=document.documentElement;
  const supportsCSS=typeof CSS!=="undefined" && typeof CSS.supports==="function";
  const supportsTransformStyle=supportsCSS && (
    CSS.supports("transform-style","preserve-3d") ||
    CSS.supports("-webkit-transform-style","preserve-3d")
  );
  const supportsPerspective=supportsCSS && (
    CSS.supports("perspective","1px") ||
    CSS.supports("-webkit-perspective","1px")
  );
  const supportsBackface=supportsCSS && (
    CSS.supports("backface-visibility","hidden") ||
    CSS.supports("-webkit-backface-visibility","hidden")
  );
  const forceCompatibility=/(?:^|[?&])flip=compat(?:&|$)/.test(location.search);
  const useCompatibilityFlip=
    forceCompatibility ||
    !supportsTransformStyle ||
    !supportsPerspective ||
    !supportsBackface;
  root.classList.toggle("flip-compat",useCompatibilityFlip);
  root.classList.toggle("flip-3d",!useCompatibilityFlip);
})();

const ORIGINAL_AUTHOR_AVATAR = document.getElementById("authorAvatar")?.getAttribute("src") || "";
const fanhuaWorks = ${JSON.stringify(fanhuaSlim)};
const sharkWorks = ${JSON.stringify(sharkSlim)};
const waWorks = ${JSON.stringify(waSlim)};
const authors = [
  {
    id: "fanhuafenluo",
    name: "繁花·纷落",
    avatar: ORIGINAL_AUTHOR_AVATAR,
    status: "半成品 · 点头像切换不同分区",
    works: fanhuaWorks,
    detailSrc: "src/data/details-fanhua.js",
    dataReady: true
  },
  {
    id: "shark",
    name: "鲨鱼",
    avatar: "assets/authors/shark.webp",
    status: "半成品 · 点头像切换不同分区",
    works: sharkWorks,
    detailSrc: "src/data/details-shark.js",
    dataReady: true
  },
  {
    id: "wa",
    name: "咓",
    avatar: "assets/authors/wa.webp",
    status: "半成品 · 点头像切换不同分区",
    works: waWorks,
    detailSrc: "src/data/details-wa.js",
    dataReady: true
  }
];
let activeAuthorIndex = 0;
let activeAuthor = authors[activeAuthorIndex];
let works = activeAuthor.works;
let authorRenderVersion = 0;
const authorRuntimeStates = new Map();
const workDetailStore = new Map();
const workDetailLoadState = new Map();

function getAuthorRuntime(authorId){
  if(!authorRuntimeStates.has(authorId)){
    authorRuntimeStates.set(authorId,{
      unlockedWorks:new Set(),
      previewLoadStates:new Map(),
      previewLoadQueue:[],
      queuedPreviewIndexes:new Set(),
      activePreviewLoads:0,
      decodeGeneration:0
    });
  }
  return authorRuntimeStates.get(authorId);
}
function getActiveRuntime(){
  return getAuthorRuntime(activeAuthor.id);
}

function loadScriptOnce(src){
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lazy-src="'+src+'"]');
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("load failed "+src)), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src + (src.includes("?") ? "&" : "?") + "v=v3lazy";
    s.async = true;
    s.dataset.lazySrc = src;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = () => reject(new Error("load failed "+src));
    document.head.appendChild(s);
  });
}

function mergeDetails(map){
  if (!map) return;
  for (const [key, detail] of Object.entries(map)) {
    workDetailStore.set(key, detail);
  }
}

function applyDetailsToWorks(list){
  if (!Array.isArray(list)) return;
  for (const w of list) {
    const d = workDetailStore.get(w._detailKey || w.image);
    if (d) {
      w.opening = d.opening;
      w.personality = d.personality;
      w.setting = d.setting;
      w._detailsReady = true;
    }
  }
}

async function ensureAuthorCatalog(author){
  // Catalogs ship in works.js; kept for API symmetry with app.js switch path.
  return author.works || [];
}

async function ensureWorkDetails(author){
  const src = author.detailSrc;
  if (!src) return;
  if (workDetailLoadState.get(src) === "ready") {
    applyDetailsToWorks(author.works);
    return;
  }
  if (workDetailLoadState.get(src) === "loading") {
    await workDetailLoadState.get(src + ":p");
    applyDetailsToWorks(author.works);
    return;
  }
  let resolveP;
  const p = new Promise((r) => { resolveP = r; });
  workDetailLoadState.set(src, "loading");
  workDetailLoadState.set(src + ":p", p);
  try {
    await loadScriptOnce(src);
    const payload = window.__LAZY_DETAILS__ && window.__LAZY_DETAILS__[author.id];
    mergeDetails(payload);
    applyDetailsToWorks(author.works);
    workDetailLoadState.set(src, "ready");
  } catch (e) {
    workDetailLoadState.set(src, "error");
  } finally {
    resolveP();
  }
}

function scheduleIdleCatalogPrefetch(){
  const run = () => {
    authors.forEach((author) => {
      ensureWorkDetails(author).catch(()=>{});
    });
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1800 });
  else setTimeout(run, 600);
}
`;

fs.writeFileSync("src/data/works.js", core);
fs.writeFileSync(
  "src/data/details-fanhua.js",
  `window.__LAZY_DETAILS__=window.__LAZY_DETAILS__||{};window.__LAZY_DETAILS__.fanhuafenluo=${JSON.stringify(fanhuaDetails)};\n`
);
fs.writeFileSync(
  "src/data/details-shark.js",
  `window.__LAZY_DETAILS__=window.__LAZY_DETAILS__||{};window.__LAZY_DETAILS__.shark=${JSON.stringify(sharkDetails)};\n`
);
fs.writeFileSync(
  "src/data/details-wa.js",
  `window.__LAZY_DETAILS__=window.__LAZY_DETAILS__||{};window.__LAZY_DETAILS__.wa=${JSON.stringify(waDetails)};\n`
);

// Remove unused catalog files if present
for (const f of ["src/data/catalog-shark.js", "src/data/catalog-wa.js"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

console.log({
  works: fs.statSync("src/data/works.js").size,
  detailsFanhua: fs.statSync("src/data/details-fanhua.js").size,
  detailsShark: fs.statSync("src/data/details-shark.js").size,
  detailsWa: fs.statSync("src/data/details-wa.js").size,
  counts: { fanhua: fanhuaSlim.length, shark: sharkSlim.length, wa: waSlim.length },
});
