(function setupFlipCompatibility(){
  const root=document.documentElement;
  root.classList.toggle("flip-3d",true);
})();
const ORIGINAL_AUTHOR_AVATAR = document.getElementById("authorAvatar")?.getAttribute("src") || "";
const NEW_FANHUA_CARDS = [
{"name":"刻律德菈","alias":"TAVO · 7B5E","collectionLabel":"TAVO ROLE CARD","image":"assets/tavo/new/Tavo_刻律德菈_7B5E.png","preview":"assets/tavo/new/Tavo_刻律德菈_7B5E.jpg","role":"逆徒冲师 · 嘴硬心软的白发弟子","tags":["逆徒冲师","白发"],"cardLabel":"逆徒冲师","creator":"繁花·纷落","sensitive":false,"sensitiveSetting":false,"sensitiveLabel":"敏感卡面","sensitiveSettingLabel":"敏感设定","_detailKey":"kelude"},
{"name":"云璃","alias":"TAVO · 0DAC","collectionLabel":"TAVO ROLE CARD","image":"assets/tavo/new/Tavo_云璃_0DAC.png","preview":"assets/tavo/new/Tavo_云璃_0DAC.jpg","role":"逆徒冲师 · 坦荡要你目光的剑客弟子","tags":["逆徒冲师","金瞳"],"cardLabel":"逆徒冲师","creator":"繁花·纷落","sensitive":false,"sensitiveSetting":false,"sensitiveLabel":"敏感卡面","sensitiveSettingLabel":"敏感设定","_detailKey":"yunli"},
{"name":"雾矢葵","alias":"TAVO · 9813","collectionLabel":"TAVO ROLE CARD","image":"assets/tavo/new/Tavo_雾矢葵_9813.png","preview":"assets/tavo/new/Tavo_雾矢葵_9813.jpg","role":"逆妹想上兄 · 不爱说话却黏人的妹妹","tags":["逆妹","水手服"],"cardLabel":"逆妹想上兄","creator":"繁花·纷落","sensitive":false,"sensitiveSetting":false,"sensitiveLabel":"敏感卡面","sensitiveSettingLabel":"敏感设定","_detailKey":"wushi"}
];
let fanhuaWorks = NEW_FANHUA_CARDS.slice();
let sharkWorks = [];
let waWorks = [];
const authors = [
  {id:"fanhuafenluo",name:"繁花·纷落",avatar:ORIGINAL_AUTHOR_AVATAR,status:"半成品 · 点头像切换不同分区",works:fanhuaWorks,detailSrc:"src/data/details-fanhua.js",dataReady:false},
  {id:"shark",name:"鲨鱼",avatar:"assets/authors/shark.webp",status:"半成品 · 点头像切换不同分区",works:sharkWorks,detailSrc:"src/data/details-shark.js",dataReady:false},
  {id:"wa",name:"咓",avatar:"assets/authors/wa.webp",status:"半成品 · 点头像切换不同分区",works:waWorks,detailSrc:"src/data/details-wa.js",dataReady:false}
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
    authorRuntimeStates.set(authorId,{unlockedWorks:new Set(),previewLoadStates:new Map(),previewLoadQueue:[],queuedPreviewIndexes:new Set(),activePreviewLoads:0,decodeGeneration:0});
  }
  return authorRuntimeStates.get(authorId);
}
function getActiveRuntime(){ return getAuthorRuntime(activeAuthor.id); }
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
  for (const [key, detail] of Object.entries(map)) workDetailStore.set(key, detail);
}
function applyDetailsToWorks(list){
  if (!Array.isArray(list)) return;
  for (const w of list) {
    const d = workDetailStore.get(w._detailKey || w.image);
    if (d) { w.opening = d.opening; w.personality = d.personality; w.setting = d.setting; w._detailsReady = true; }
  }
}
async function ensureAuthorCatalog(author){ return author.works || []; }
async function ensureWorkDetails(author){
  const src = author.detailSrc;
  if (!src) return;
  if (workDetailLoadState.get(src) === "ready") { applyDetailsToWorks(author.works); return; }
  if (workDetailLoadState.get(src) === "loading") { await workDetailLoadState.get(src + ":p"); applyDetailsToWorks(author.works); return; }
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
  } finally { resolveP(); }
}
function scheduleIdleCatalogPrefetch(){
  const run = () => { authors.forEach((author) => { ensureWorkDetails(author).catch(()=>{}); }); };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1800 });
  else setTimeout(run, 600);
}
(function loadFullCatalog(){
  const url = "https://cdn.jsdelivr.net/gh/hqu35785-cmyk/fanhuafenluo@d602c92bfcb73fe6fc27e4b4dfa10122cfaaede6/src/data/works.js";
  fetch(url).then(r=>r.text()).then(code=>{
    const fanhuaMatch = code.match(/const fanhuaWorks\s*=\s*(\[[\s\S]*?\]);\s*const sharkWorks/);
    const sharkMatch = code.match(/const sharkWorks\s*=\s*(\[[\s\S]*?\]);\s*const waWorks/);
    const waMatch = code.match(/const waWorks\s*=\s*(\[[\s\S]*?\]);\s*const authors/);
    if(!fanhuaMatch || !sharkMatch || !waMatch) throw new Error("catalog sections not found");
    try {
      const oldFanhua = (0, eval)("(" + fanhuaMatch[1] + ")");
      const oldShark = (0, eval)("(" + sharkMatch[1] + ")");
      const oldWa = (0, eval)("(" + waMatch[1] + ")");
      fanhuaWorks = NEW_FANHUA_CARDS.concat(oldFanhua);
      sharkWorks = oldShark;
      waWorks = oldWa;
      authors[0].works = fanhuaWorks;
      authors[1].works = sharkWorks;
      authors[2].works = waWorks;
      authors.forEach(author=>{
        author.dataReady = true;
        if (Array.isArray(author.works)) {
          author.works.forEach(w=>{ if (!w) return; w.sensitive = false; w.sensitiveSetting = false; });
        }
        applyDetailsToWorks(author.works);
      });
      if (activeAuthor) {
        works = activeAuthor.works || [];
        try {
          if (typeof authorDomCache !== "undefined" && authorDomCache && typeof authorDomCache.delete === "function") authorDomCache.delete(activeAuthor.id);
          if (typeof mountedAuthorId !== "undefined") mountedAuthorId = null;
          if (typeof gallery !== "undefined" && gallery) gallery.innerHTML = "";
        } catch (_) {}
        if (typeof renderActiveAuthor === "function") renderActiveAuthor({announce:false,scrollToStart:false});
        else {
          authorRenderVersion++;
          document.dispatchEvent(new CustomEvent("catalog-ready"));
          if (activeAuthor.id === "fanhuafenluo") document.dispatchEvent(new CustomEvent("fanhua-catalog-ready"));
        }
      }
    } catch(e) { console.error("catalog merge failed", e); }
  }).catch(e=>console.error("catalog load failed", e));
})();
