(function setupFlipCompatibility(){
  const root=document.documentElement;
  root.classList.toggle("flip-3d",true);
})();
const ORIGINAL_AUTHOR_AVATAR = document.getElementById("authorAvatar")?.getAttribute("src") || "";
const fanhuaWorks = [
{"name":"刻律德菈","alias":"TAVO · 7B5E","collectionLabel":"TAVO ROLE CARD","image":"https://tmpfiles.org/dl/1787031197.d192f5d48ae92249/w4wPC8a6ddY9/kelude.jpg","preview":"https://tmpfiles.org/dl/1787031198.cdc95a85437c6002/wewbCKaZdy1S/kelude_prev.jpg","role":"逆徒冲师 · 嘴硬心软的白发弟子","tags":["逆徒冲师","白发"],"cardLabel":"逆徒冲师","creator":"繁花·纷落","sensitive":true,"sensitiveSetting":false,"sensitiveLabel":"敏感卡面","sensitiveSettingLabel":"敏感设定","_detailKey":"kelude"},
{"name":"云璃","alias":"TAVO · 0DAC","collectionLabel":"TAVO ROLE CARD","image":"https://tmpfiles.org/dl/1787031198.e30517c5531fb01b/wawJCWa0d6uO/yunli.jpg","preview":"https://tmpfiles.org/dl/1787031198.de676f05ec911c81/wJwNCfawda9P/yunli_prev.jpg","role":"逆徒冲师 · 坦荡要你目光的剑客弟子","tags":["逆徒冲师","金瞳"],"cardLabel":"逆徒冲师","creator":"繁花·纷落","sensitive":true,"sensitiveSetting":false,"sensitiveLabel":"敏感卡面","sensitiveSettingLabel":"敏感设定","_detailKey":"yunli"},
{"name":"雾矢葵","alias":"TAVO · 9813","collectionLabel":"TAVO ROLE CARD","image":"https://tmpfiles.org/dl/1787031199.41c0c7ce1a0b88d9/wPw7CGa9dNQD/wushi.jpg","preview":"https://tmpfiles.org/dl/1787031199.20edda945c6e22da/wNwkCQaDdXzZ/wushi_prev.jpg","role":"逆妹想上兄 · 不爱说话却黏人的妹妹","tags":["逆妹","水手服"],"cardLabel":"逆妹想上兄","creator":"繁花·纷落","sensitive":true,"sensitiveSetting":false,"sensitiveLabel":"敏感卡面","sensitiveSettingLabel":"敏感设定","_detailKey":"wushi"}
];
const sharkWorks = [];
const waWorks = [];
const authors = [
  {id:"fanhuafenluo",name:"繁花·纷落",avatar:ORIGINAL_AUTHOR_AVATAR,status:"半成品 · 点头像切换不同分区",works:fanhuaWorks,detailSrc:"src/data/details-fanhua.js",dataReady:true},
  {id:"shark",name:"鲨鱼",avatar:"assets/authors/shark.webp",status:"半成品 · 点头像切换不同分区",works:sharkWorks,detailSrc:"src/data/details-shark.js",dataReady:true},
  {id:"wa",name:"咓",avatar:"assets/authors/wa.webp",status:"半成品 · 点头像切换不同分区",works:waWorks,detailSrc:"src/data/details-wa.js",dataReady:true}
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
