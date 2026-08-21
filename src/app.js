const CARD_VISIBILITY_MODE = "open";
document.documentElement.dataset.cardVisibility = CARD_VISIBILITY_MODE;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const gallery = $("#gallery");
const statusEl = $("#status");
const statusText = $("#status span");
const toast = $("#toast");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const AUTHOR_ENGLISH = {
  fanhuafenluo: "FANHUA · FENLUO",
  shark: "SHARK · CHARACTER ARCHIVE",
  wa: "WA · CHARACTER ARCHIVE",
};

const DETAIL_TABS = {
  intro: { index: "01 · CHARACTER DATA", title: "简介", type: "INTRO", field: "role" },
  opening: { index: "02 · CHARACTER DATA", title: "开场白", type: "OPENING", field: "opening" },
  personality: { index: "03 · CHARACTER DATA", title: "性格", type: "PERSONALITY", field: "personality" },
  setting: { index: "04 · CHARACTER DATA", title: "人物设定", type: "SETTING", field: "setting" },
};
const DETAIL_TAB_ORDER = Object.keys(DETAIL_TABS);

const runtimeByAuthor = new Map();
let currentAuthor = authors[0];
let currentWorks = currentAuthor?.works || [];
let renderGeneration = 0;
let previewObserver = null;
let activeDetail = null;
let detailGeneration = 0;
let currentDetailTab = "intro";
let detailOpener = null;
let saveOpener = null;

function runtimeFor(authorId) {
  if (!runtimeByAuthor.has(authorId)) {
    runtimeByAuthor.set(authorId, {
      states: new Map(),
      queue: [],
      queued: new Set(),
      active: 0,
      generation: 0,
    });
  }
  return runtimeByAuthor.get(authorId);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function splitDisplayName(name) {
  const raw = String(name || "");
  const match = raw.match(/^(.*?)(\s*[【\[][^】\]]+[】\]])\s*$/u);
  if (!match) return { main: raw, note: "" };
  return { main: match[1].replace(/\s+$/u, ""), note: match[2].replace(/^\s+/u, "") };
}

function displayNameHTML(name) {
  const { main, note } = splitDisplayName(name);
  return `${escapeHTML(main)}${note ? `<span class="name-note">${escapeHTML(note)}</span>` : ""}`;
}

function cardHTML(work, index) {
  const number = String(index + 1).padStart(2, "0");
  const pattern = (index % 4) + 1;
  const theme = index % 6;
  const label = work.cardLabel || work.tags?.[0] || "角色卡";
  const alias = work.alias || work.collectionLabel || "CHARACTER CARD";
  const eager = index < 2 ? ' loading="eager" fetchpriority="high"' : ' loading="lazy" fetchpriority="low"';
  return `
    <article class="archive-card pattern-${pattern} theme-${theme}" data-index="${index}" data-name="${escapeHTML(work.name)}">
      <div class="card-face">
        <img class="loaded-art" data-preview-src="${escapeHTML(work.preview || "")}" alt="${escapeHTML(work.name)}角色卡预览" width="360" height="500" decoding="async"${eager}>
        <div class="stripe-field" aria-hidden="true"></div>
        <div class="ghost-frame" aria-hidden="true"></div>
        <div class="corner-code"><span aria-hidden="true"></span><b>${escapeHTML(label)}</b></div>
        <div class="corner-index">${number}</div>
        <div class="loading-core" aria-live="polite">
          <div class="state-label state-label-loading">
            <div class="loading-title">ARCHIVE MATERIALIZING</div>
            <div class="loading-line"></div>
            <div class="loading-sub">WAITING FOR CARD FACE</div>
          </div>
          <div class="state-label state-label-ready">
            <div class="ready-name">${displayNameHTML(work.name)}</div>
            <div class="loading-line"></div>
            <div class="ready-meta">${escapeHTML(alias)}</div>
          </div>
          <div class="state-label state-label-error">
            <div class="loading-title">CARD FACE UNAVAILABLE</div>
            <button class="preview-retry" type="button" data-card-action="retry" data-index="${index}">重试图片</button>
          </div>
        </div>
        <div class="bottom-frame">
          <button class="detail-action" type="button" data-card-action="detail" data-index="${index}" aria-label="查看${escapeHTML(work.name)}档案">
            <span class="action-copy"><b>查看档案</b><small>PROFILE · SETTING · OPENING</small></span>
            <span class="action-arrow" aria-hidden="true">↗</span>
          </button>
          <button class="download-action" type="button" data-card-action="save" data-index="${index}" aria-label="下载${escapeHTML(work.name)}角色卡 PNG"><span class="download-icon" aria-hidden="true">⇩</span></button>
        </div>
      </div>
    </article>`;
}

function cardAt(index) {
  return gallery?.querySelector(`.archive-card[data-index="${index}"]`) || null;
}

function imageAt(index) {
  return cardAt(index)?.querySelector(".loaded-art") || null;
}

function updateHeader(author) {
  const count = author?.works?.length || 0;
  const avatar = $("#authorAvatar");
  const name = $("#authorName");
  const english = $("#authorEnglish");
  const hint = $("#authorSwitchHint");
  const countEl = $("#workCount");
  const footer = $("#footerAuthor");
  if (avatar) {
    avatar.src = author.avatar;
    avatar.alt = `${author.name}头像`;
  }
  if (name) name.textContent = author.name;
  if (english) english.textContent = AUTHOR_ENGLISH[author.id] || `${author.name} · CHARACTER ARCHIVE`;
  if (hint) hint.textContent = `公开浏览 · ${count} 张角色卡`;
  if (countEl) countEl.textContent = String(count);
  if (footer) footer.textContent = author.name;
  document.title = `${author.name}｜角色档案`;
  $$(".author-filter").forEach((button) => {
    const active = button.dataset.author === author.id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

function closeTransientUI() {
  if ($("#archiveModal")?.open) closeArchive({ restoreFocus: false });
  if ($("#saveSheet")?.open) closeSaveSheet({ restoreFocus: false });
}

function renderAuthor(authorId, { announce = false, scrollToStart = true } = {}) {
  const next = authors.find((author) => author.id === authorId);
  if (!next) return;
  renderGeneration += 1;
  const generation = renderGeneration;
  closeTransientUI();
  if (previewObserver) previewObserver.disconnect();
  currentAuthor = next;
  currentWorks = next.works || [];
  const runtime = runtimeFor(next.id);
  runtime.generation += 1;
  runtime.states.clear();
  runtime.queue.length = 0;
  runtime.queued.clear();
  gallery.classList.add("is-author-switching");
  gallery.innerHTML = currentWorks.map(cardHTML).join("");
  updateHeader(next);
  if (scrollToStart) window.scrollTo({ top: 0, behavior: "auto" });
  observePreviews(generation);
  currentWorks.slice(0, 8).forEach((_, index) => queuePreview(index, { priority: index < 2 }));
  updateStatus();
  requestAnimationFrame(() => {
    if (generation !== renderGeneration) return;
    gallery.classList.remove("is-author-switching");
    gallery.classList.add("author-switch-in");
    window.setTimeout(() => gallery.classList.remove("author-switch-in"), prefersReducedMotion.matches ? 0 : 650);
  });
  if (typeof ensureWorkDetails === "function") ensureWorkDetails(next).catch(() => {});
  if (announce) showToast(`已切换至「${next.name}」`, `${currentWorks.length} 张角色卡已就绪`, "✓");
}

function updateStatus() {
  const runtime = runtimeFor(currentAuthor.id);
  const loaded = currentWorks.reduce((count, _, index) => count + (runtime.states.get(index) === "loaded" ? 1 : 0), 0);
  const failed = currentWorks.reduce((count, _, index) => count + (runtime.states.get(index) === "error" ? 1 : 0), 0);
  const label = failed ? `RETRY · ${failed}` : loaded === currentWorks.length ? `READY · ${loaded}` : `LOADING · ${loaded}/${currentWorks.length}`;
  if (statusText) statusText.textContent = label;
  statusEl?.classList.toggle("is-ready", loaded === currentWorks.length && currentWorks.length > 0);
  statusEl?.classList.toggle("is-error", failed > 0);
}

function setCardState(index, state) {
  const card = cardAt(index);
  if (!card) return;
  card.dataset.previewState = state;
  card.classList.toggle("is-loaded", state === "loaded");
  card.classList.toggle("is-loading-now", state === "loading" || state === "queued");
  card.classList.toggle("is-load-error", state === "error");
  const image = card.querySelector(".loaded-art");
  if (image) {
    image.toggleAttribute("aria-busy", state === "loading" || state === "queued");
    image.setAttribute("aria-hidden", state === "error" ? "true" : "false");
  }
}

function isNearViewport(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.bottom >= -220 && rect.top <= window.innerHeight + 320;
}

function previewAttemptUrl(source, attempt) {
  try {
    const url = new URL(source, window.location.href);
    url.searchParams.set("preview-retry", String(attempt));
    return url.href;
  } catch {
    return source;
  }
}

function waitForImage(image, source) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (success) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      resolve(success);
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);
    const timeout = window.setTimeout(() => finish(false), 20000);
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    image.src = source;
    if (image.complete) queueMicrotask(() => finish(image.naturalWidth > 0));
  });
}

let activePreviewDecodes = 0;
const previewDecodeWaiters = [];
async function decodePreview(image) {
  if (activePreviewDecodes >= 1) await new Promise((resolve) => previewDecodeWaiters.push(resolve));
  activePreviewDecodes += 1;
  try {
    if (typeof image.decode === "function") await image.decode().catch(() => {});
  } finally {
    activePreviewDecodes = Math.max(0, activePreviewDecodes - 1);
    previewDecodeWaiters.shift()?.();
  }
}

async function loadPreview(index, authorId, generation) {
  const work = currentAuthor.id === authorId ? currentWorks[index] : authors.find((author) => author.id === authorId)?.works?.[index];
  const image = imageAt(index);
  if (!work || !image || !work.preview) return false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (generation !== renderGeneration || currentAuthor.id !== authorId) return false;
    const success = await waitForImage(image, previewAttemptUrl(work.preview, attempt));
    if (!success) continue;
    await decodePreview(image);
    return true;
  }
  return false;
}

function pumpPreviewLoads(authorId, generation) {
  const runtime = runtimeFor(authorId);
  while (runtime.active < PREVIEW_LOAD_CONCURRENCY && runtime.queue.length) {
    const index = runtime.queue.shift();
    runtime.queued.delete(index);
    if (runtime.states.get(index) !== "queued") continue;
    runtime.active += 1;
    runtime.states.set(index, "loading");
    if (authorId === currentAuthor.id) setCardState(index, "loading");
    loadPreview(index, authorId, generation).then((loaded) => {
      runtime.active = Math.max(0, runtime.active - 1);
      if (generation !== renderGeneration || currentAuthor.id !== authorId) return;
      runtime.states.set(index, loaded ? "loaded" : "error");
      setCardState(index, loaded ? "loaded" : "error");
      updateStatus();
      pumpPreviewLoads(authorId, generation);
    }).catch(() => {
      runtime.active = Math.max(0, runtime.active - 1);
      if (generation !== renderGeneration || currentAuthor.id !== authorId) return;
      runtime.states.set(index, "error");
      setCardState(index, "error");
      updateStatus();
      pumpPreviewLoads(authorId, generation);
    });
  }
}

function queuePreview(index, { priority = false, force = false } = {}) {
  if (currentAuthor.id === undefined || !currentWorks[index]) return;
  const runtime = runtimeFor(currentAuthor.id);
  const state = runtime.states.get(index) || "idle";
  if (state === "loaded" || state === "loading" || state === "queued") return;
  if (state === "error" && !force) return;
  runtime.states.set(index, "queued");
  if (priority) runtime.queue.unshift(index);
  else runtime.queue.push(index);
  runtime.queued.add(index);
  setCardState(index, "queued");
  pumpPreviewLoads(currentAuthor.id, renderGeneration);
  updateStatus();
}

function observePreviews(generation) {
  if ("IntersectionObserver" in window) {
    previewObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        previewObserver?.unobserve(card);
        const index = Number(card.dataset.index);
        if (Number.isInteger(index) && generation === renderGeneration) queuePreview(index);
      });
    }, { rootMargin: "180px 0px 320px", threshold: 0.02 });
    $$(".archive-card", gallery).forEach((card) => previewObserver.observe(card));
  } else {
    currentWorks.forEach((_, index) => queuePreview(index));
  }
}

function retryVisibleErrors() {
  const runtime = runtimeFor(currentAuthor.id);
  currentWorks.forEach((_, index) => {
    if (runtime.states.get(index) === "error" && isNearViewport(cardAt(index))) queuePreview(index, { force: true });
  });
}

function showToast(title, message, mark = "✓") {
  if (!toast) return;
  toast.innerHTML = `<span class="toast-mark">${escapeHTML(mark)}</span><span class="toast-copy"><b>${escapeHTML(title)}</b><small>${escapeHTML(message)}</small></span>`;
  toast.classList.remove("is-show");
  void toast.offsetWidth;
  toast.classList.add("is-show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-show"), 2600);
}

function cardForWork(work) {
  return currentWorks.findIndex((candidate) => candidate === work);
}

function detailCopy(work) {
  return {
    intro: work.role || "暂无角色简介。",
    opening: work.opening || "暂无开场白。",
    personality: work.personality || "暂无性格简介。",
    setting: work.setting || "暂无人物设定。",
  };
}

function fillArchiveFields(work) {
  const image = $("#archiveImage");
  if (image) {
    image.src = work.preview || "";
    image.alt = `${work.name}角色卡预览`;
  }
  $("#archiveFile").textContent = work.cardLabel || work.tags?.[0] || "角色卡";
  $("#archiveAlias").textContent = work.alias || work.collectionLabel || "CHARACTER CARD";
  $("#archiveCreator").textContent = work.creator || currentAuthor.name;
  $("#detailName").textContent = work.name;
  $("#archiveRole").textContent = work.role || "暂无角色简介。";
  $("#archiveTags").innerHTML = (work.tags || []).map((tag) => `<span>${escapeHTML(tag)}</span>`).join("") || `<span>角色卡</span>`;
}

function setDetailTab(tab, { instant = false } = {}) {
  if (!DETAIL_TABS[tab]) tab = "intro";
  currentDetailTab = tab;
  const meta = DETAIL_TABS[tab];
  $$("[data-detail-tab]").forEach((button) => {
    const active = button.dataset.detailTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $("#detailPanelIndex").textContent = meta.index;
  $("#detailPanelTitle").textContent = meta.title;
  $("#detailPanelType").textContent = meta.type;
  $("#detailPanelBody").textContent = activeDetail ? detailCopy(activeDetail)[tab] : "暂无内容。";
  if (!instant && !prefersReducedMotion.matches) {
    const panel = $("#detailPanel");
    panel.classList.remove("is-refreshing");
    void panel.offsetWidth;
    panel.classList.add("is-refreshing");
  }
  $("#detailPanel")?.focus({ preventScroll: true });
}

function focusables(root) {
  return $$('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])', root).filter((element) => !element.hidden && element.getClientRects().length);
}

function trapDialogKeydown(event, dialog) {
  if (event.key !== "Tab") return;
  const items = focusables(dialog);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function openArchive(index, opener) {
  const work = currentWorks[index];
  if (!work) return;
  activeDetail = work;
  detailOpener = opener || null;
  const generation = ++detailGeneration;
  fillArchiveFields(work);
  setDetailTab("intro", { instant: true });
  const dialog = $("#archiveModal");
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  window.setTimeout(() => $("#archiveClose")?.focus({ preventScroll: true }), prefersReducedMotion.matches ? 0 : 120);
  if (typeof ensureWorkDetails === "function") {
    await ensureWorkDetails(currentAuthor).catch(() => {});
    if (generation === detailGeneration && activeDetail === work) {
      fillArchiveFields(work);
      setDetailTab(currentDetailTab, { instant: true });
    }
  }
}

function closeArchive({ restoreFocus = true } = {}) {
  const dialog = $("#archiveModal");
  if (dialog?.open) dialog.close();
  activeDetail = null;
  detailGeneration += 1;
  if (!$("#saveSheet")?.open) document.body.classList.remove("modal-open");
  if (restoreFocus && detailOpener && document.contains(detailOpener)) detailOpener.focus({ preventScroll: true });
  detailOpener = null;
}

const SHARE_PNG_CACHE_LIMIT = 1;
const sharePngFileCache = new Map();
const pngFailCache = new Map();
const pngInflight = new Map();
const PNG_FAIL_TTL_MS = 60000;
const PNG_FETCH_TIMEOUT_MS = 12000;
let saveSheetActiveWork = null;
let saveSheetLastFocus = null;
let saveSheetShareFile = null;
let saveSheetPrepareVersion = 0;
let saveSheetPrepareController = null;
let saveSheetDownloadObjectUrl = null;
let webSharePending = false;

const REPO_MAIN_REF = "hqu35785-cmyk/fanhuafenluo@main";
const RAW_MAIN_BASE = "https://raw.githubusercontent.com/hqu35785-cmyk/fanhuafenluo/main/";
const JSDELIVR_MAIN_BASE = `https://cdn.jsdelivr.net/gh/${REPO_MAIN_REF}/`;

function normalizeAssetPath(path) {
  return String(path || "").replace(/^\.\//, "").replace(/^\//, "");
}

function sourcePngCandidateUrls(path) {
  const rel = normalizeAssetPath(path);
  const urls = [];
  try { urls.push(new URL(rel, window.location.href).href); } catch {}
  urls.push(JSDELIVR_MAIN_BASE + rel);
  urls.push(RAW_MAIN_BASE + rel);
  return [...new Set(urls)];
}

function safePngFilename(name) {
  const safeName = String(name || "角色卡").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_").replace(/[. ]+$/g, "").trim().slice(0, 100);
  return `${safeName || "角色卡"}-角色卡.png`;
}

function markPngFailure(url) { pngFailCache.set(url, Date.now() + PNG_FAIL_TTL_MS); }
function recentlyFailed(url) {
  const expiry = pngFailCache.get(url);
  if (!expiry) return false;
  if (Date.now() > expiry) { pngFailCache.delete(url); return false; }
  return true;
}

async function fetchValidatedPngBlob(url, signal) {
  if (recentlyFailed(url)) throw new Error("PNG recently failed");
  if (pngInflight.has(url)) return pngInflight.get(url);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    signal.addEventListener("abort", abort, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort(), PNG_FETCH_TIMEOUT_MS);
  const task = (async () => {
    try {
      const response = await fetch(url, { credentials: "omit", mode: "cors", cache: "force-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`PNG request failed: ${response.status}`);
      const blob = await response.blob();
      if (!blob.size) throw new Error("PNG response is empty");
      const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (header.length !== signature.length || !signature.every((byte, index) => header[index] === byte)) throw new Error("Downloaded asset is not a valid PNG");
      pngFailCache.delete(url);
      return blob;
    } catch (error) {
      if (error?.name !== "AbortError") markPngFailure(url);
      throw error;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      pngInflight.delete(url);
    }
  })();
  pngInflight.set(url, task);
  return task;
}

function rememberShareFile(url, file) {
  sharePngFileCache.delete(url);
  sharePngFileCache.set(url, file);
  while (sharePngFileCache.size > SHARE_PNG_CACHE_LIMIT) sharePngFileCache.delete(sharePngFileCache.keys().next().value);
}

async function fetchOriginalPngResource(work, signal) {
  const candidates = sourcePngCandidateUrls(work.image).filter((url) => !recentlyFailed(url));
  for (const url of candidates) {
    const cached = sharePngFileCache.get(url);
    if (cached instanceof File) return { url, blob: cached };
  }
  let lastError = null;
  for (const url of candidates) {
    try { return { url, blob: await fetchValidatedPngBlob(url, signal) }; }
    catch (error) { if (error?.name === "AbortError") throw error; lastError = error; }
  }
  throw lastError || new Error("PNG unavailable");
}

function hasFileShareApi() {
  return Boolean(window.isSecureContext && typeof File === "function" && typeof navigator.share === "function" && typeof navigator.canShare === "function");
}

function canSharePngFile(file) {
  if (!file || !hasFileShareApi()) return false;
  try { return navigator.canShare({ files: [file] }); } catch { return false; }
}

function revokeSaveSheetDownloadUrl() {
  if (!saveSheetDownloadObjectUrl) return;
  try { URL.revokeObjectURL(saveSheetDownloadObjectUrl); } catch {}
  saveSheetDownloadObjectUrl = null;
}

function setSaveSheetNote(text) { $("#saveSheetNote").textContent = text; }

function setDownloadReady(href, filename, label = "下载 PNG 原图") {
  const link = $("#saveSheetLink");
  link.href = href;
  link.download = filename;
  link.removeAttribute("aria-disabled");
  link.removeAttribute("aria-busy");
  link.removeAttribute("tabindex");
  link.querySelector(".save-choice-copy b").textContent = label;
}

function setDownloadUnavailable(label = "重试 PNG 原图") {
  const link = $("#saveSheetLink");
  if (!link) return;
  link.href = "#";
  link.removeAttribute("download");
  link.setAttribute("aria-disabled", "true");
  link.removeAttribute("aria-busy");
  link.tabIndex = 0;
  link.querySelector(".save-choice-copy b").textContent = label;
}

async function prepareSaveResources(work, version, controller) {
  const link = $("#saveSheetLink");
  const filename = safePngFilename(work.name);
  try {
    const { url, blob } = await fetchOriginalPngResource(work, controller.signal);
    if (version !== saveSheetPrepareVersion || saveSheetActiveWork !== work || !$("#saveSheet")?.open) return;
    revokeSaveSheetDownloadUrl();
    saveSheetDownloadObjectUrl = URL.createObjectURL(blob);
    setDownloadReady(saveSheetDownloadObjectUrl, filename);
    const file = new File([blob], filename, { type: "image/png", lastModified: Date.now() });
    rememberShareFile(url, file);
    saveSheetShareFile = file;
    if (canSharePngFile(file)) {
      $("#saveSheetPhoto").disabled = false;
      $("#saveSheetPhoto .save-choice-copy b").textContent = "保存到相册";
      setSaveSheetNote("PNG 原图已准备完成。相册入口由系统菜单处理；需要导入角色卡时请使用“下载 PNG 原图”。");
    } else {
      $("#saveSheetPhoto").disabled = true;
      $("#saveSheetPhoto .save-choice-copy b").textContent = "当前浏览器不支持保存到相册";
      setSaveSheetNote("PNG 原图已准备完成。当前浏览器不能打开相册系统菜单，请使用文件下载。");
    }
  } catch (error) {
    if (error?.name === "AbortError" || version !== saveSheetPrepareVersion || saveSheetActiveWork !== work) return;
    setDownloadUnavailable();
    setSaveSheetNote("文件下载准备失败。请检查网络后重试；若浏览器仍拦截下载，可长按原图保存。");
    $("#saveSheetPhoto").disabled = true;
    $("#saveSheetPhoto .save-choice-copy b").textContent = "相册保存不可用";
  }
  link?.focus({ preventScroll: true });
}

function retrySaveSheetPreparation() {
  if (!saveSheetActiveWork || !$("#saveSheet")?.open) return;
  pngFailCache.clear();
  saveSheetPrepareVersion += 1;
  const version = saveSheetPrepareVersion;
  saveSheetPrepareController?.abort();
  saveSheetPrepareController = new AbortController();
  const link = $("#saveSheetLink");
  link?.setAttribute("aria-disabled", "true");
  link?.setAttribute("aria-busy", "true");
  if (link) link.tabIndex = -1;
  const label = link?.querySelector(".save-choice-copy b");
  if (label) label.textContent = "正在重试 PNG 原图…";
  $("#saveSheetPhoto").disabled = true;
  $("#saveSheetPhoto .save-choice-copy b").textContent = "正在准备相册保存…";
  setSaveSheetNote("正在重试原始 PNG 文件候选链。");
  prepareSaveResources(saveSheetActiveWork, version, saveSheetPrepareController).catch(() => {});
}

function closeSaveSheet({ restoreFocus = true } = {}) {
  const dialog = $("#saveSheet");
  if (!dialog?.open) return;
  saveSheetPrepareVersion += 1;
  saveSheetPrepareController?.abort();
  saveSheetPrepareController = null;
  saveSheetActiveWork = null;
  saveSheetShareFile = null;
  revokeSaveSheetDownloadUrl();
  dialog.close();
  if (!$("#archiveModal")?.open) document.body.classList.remove("modal-open");
  const opener = saveSheetLastFocus;
  saveSheetLastFocus = null;
  if (restoreFocus && opener && document.contains(opener)) opener.focus({ preventScroll: true });
}

function openSaveSheet(work, opener) {
  if (!work) return;
  closeArchive({ restoreFocus: false });
  const dialog = $("#saveSheet");
  saveSheetLastFocus = opener || document.activeElement;
  saveSheetActiveWork = work;
  saveSheetPrepareVersion += 1;
  const version = saveSheetPrepareVersion;
  saveSheetPrepareController?.abort();
  saveSheetPrepareController = new AbortController();
  saveSheetShareFile = null;
  revokeSaveSheetDownloadUrl();
  $("#savePreviewName").textContent = work.name;
  $("#savePreviewAlias").textContent = work.alias || work.collectionLabel || "CHARACTER CARD";
  $("#saveSheetImage").src = work.preview || "";
  $("#saveSheetImage").alt = `${work.name}角色卡原图预览`;
  const link = $("#saveSheetLink");
  link.removeAttribute("href");
  link.removeAttribute("download");
  link.setAttribute("aria-disabled", "true");
  link.setAttribute("aria-busy", "true");
  link.tabIndex = -1;
  link.querySelector(".save-choice-copy b").textContent = "正在准备 PNG 原图…";
  $("#saveSheetPhoto").disabled = true;
  $("#saveSheetPhoto .save-choice-copy b").textContent = "正在准备相册保存…";
  setSaveSheetNote("正在读取当前角色卡的原始 PNG 文件。文件下载会保留角色卡内嵌数据。");
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  window.setTimeout(() => $("#saveSheetClose")?.focus({ preventScroll: true }), prefersReducedMotion.matches ? 0 : 120);
  prepareSaveResources(work, version, saveSheetPrepareController).catch(() => {});
}

function saveEnvironment() {
  const ua = navigator.userAgent || "";
  if (/MicroMessenger/i.test(ua)) return "wechat";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function directDownloadFallback(work) {
  const env = saveEnvironment();
  if (env === "wechat") showToast("请用系统浏览器下载", "微信可能拦截文件下载，请点击保存面板里的 PNG 原图", "!");
  openSaveSheet(work, document.activeElement);
}

function bindEvents() {
  $$(".author-filter").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.author !== currentAuthor.id) renderAuthor(button.dataset.author, { announce: true });
  }));
  gallery.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-card-action]") : null;
    if (!target || !gallery.contains(target)) return;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;
    if (target.dataset.cardAction === "detail") openArchive(index, target);
    if (target.dataset.cardAction === "save") openSaveSheet(currentWorks[index], target);
    if (target.dataset.cardAction === "retry") queuePreview(index, { force: true, priority: true });
  });
  $("#archiveClose")?.addEventListener("click", () => closeArchive());
  $$("[data-close-archive]").forEach((element) => element.addEventListener("click", () => closeArchive()));
  $("#saveSheetClose")?.addEventListener("click", () => closeSaveSheet());
  $$("[data-close-save]").forEach((element) => element.addEventListener("click", () => closeSaveSheet()));
  $$("[data-detail-tab]").forEach((button) => button.addEventListener("click", () => setDetailTab(button.dataset.detailTab)));
  $("#downloadCard")?.addEventListener("click", () => openSaveSheet(activeDetail, $("#downloadCard")));
  $("#saveSheetPhoto")?.addEventListener("click", async () => {
    const file = saveSheetShareFile;
    if (!file || webSharePending || !canSharePngFile(file)) return;
    webSharePending = true;
    const button = $("#saveSheetPhoto");
    button.disabled = true;
    button.querySelector(".save-choice-copy b").textContent = "正在打开系统菜单…";
    try {
      await navigator.share({ files: [file], title: "保存 TAVO 角色卡" });
      setSaveSheetNote("文件已交给系统菜单处理。需要导入角色卡时仍请保留 PNG 原图文件。");
      showToast("已交给系统处理", "是否进入相册由你选择的系统应用决定", "✓");
    } catch (error) {
      if (error?.name === "AbortError") setSaveSheetNote("已取消系统保存菜单，你仍可以下载 PNG 原图文件。");
      else setSaveSheetNote("系统保存菜单没有成功打开，请直接下载 PNG 原图文件。");
    } finally {
      webSharePending = false;
      if ($("#saveSheet")?.open) {
        button.disabled = false;
        button.querySelector(".save-choice-copy b").textContent = "保存到相册";
      }
    }
  });
  $("#saveSheetLink")?.addEventListener("click", (event) => {
    if ($("#saveSheetLink").getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      retrySaveSheetPreparation();
      return;
    }
    showToast("PNG 文件下载已开始", "浏览器正在保存当前角色卡原始文件", "↓");
  });
  $("#archiveModal")?.addEventListener("keydown", (event) => trapDialogKeydown(event, $("#archiveModal")));
  $("#saveSheet")?.addEventListener("keydown", (event) => trapDialogKeydown(event, $("#saveSheet")));
  $("#archiveModal")?.addEventListener("cancel", (event) => { event.preventDefault(); closeArchive(); });
  $("#saveSheet")?.addEventListener("cancel", (event) => { event.preventDefault(); closeSaveSheet(); });
  $("#archiveModal")?.addEventListener("close", () => {
    if (!$("#saveSheet")?.open) document.body.classList.remove("modal-open");
  });
  $("#saveSheet")?.addEventListener("close", () => {
    if (!$("#archiveModal")?.open) document.body.classList.remove("modal-open");
  });
  window.addEventListener("online", retryVisibleErrors, { passive: true });
  window.addEventListener("resize", retryVisibleErrors, { passive: true });
}

const PREVIEW_LOAD_CONCURRENCY = 3;

bindEvents();
renderAuthor(currentAuthor.id, { scrollToStart: false });
if (typeof scheduleIdleCatalogPrefetch === "function") scheduleIdleCatalogPrefetch();
