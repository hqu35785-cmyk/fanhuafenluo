import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

const TARGET = process.env.TEST_URL || "http://127.0.0.1:4173/index.html";
const BROWSER_NAME = (process.env.TEST_BROWSER || "chromium").trim().toLowerCase();
const VIEWPORTS = [
  "320x568", "360x740", "375x667", "390x844", "412x915", "430x932", "500x900", "600x960", "768x1024",
  "568x320", "667x375", "740x360", "844x390", "915x412", "932x430", "1024x768", "1280x720", "1366x768", "1920x1080",
];
const LAUNCHERS = { chromium, firefox, webkit };
const launcher = LAUNCHERS[BROWSER_NAME];
if (!launcher) throw new Error(`Unknown TEST_BROWSER=${BROWSER_NAME}`);

const viewportName = process.env.TEST_VIEWPORT || "390x844";
if (!VIEWPORTS.includes(viewportName)) throw new Error(`Unknown TEST_VIEWPORT=${viewportName}`);
const [width, height] = viewportName.split("x").map(Number);
const round = process.env.TEST_ROUND || "1";
const artifactDir = path.join(process.cwd(), "artifacts", "round-" + round, BROWSER_NAME, viewportName);
fs.mkdirSync(artifactDir, { recursive: true });

const expectedTop = ["刻律德菈", "云璃", "雾矢葵", "许知予", "八尺大姐姐", "康娜"];

function addFailure(failures, check, expected, actual) {
  failures.push({ check, expected, actual });
}

async function inspectGeometry(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const gallery = document.getElementById("gallery");
    const cards = [...document.querySelectorAll("#gallery .archive-card")];
    const rects = cards.map((card) => ({ card, rect: card.getBoundingClientRect() }));
    const overlaps = [];
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left].rect;
        const b = rects[right].rect;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) overlaps.push([left, right, overlapX, overlapY]);
      }
    }
    const controlsInside = cards.slice(0, 18).every((card) => {
      const cardRect = card.getBoundingClientRect();
      return [...card.querySelectorAll(".detail-action, .download-action")].every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1 && rect.top >= cardRect.top - 1 && rect.bottom <= cardRect.bottom + 1;
      });
    });
    const visibleCards = cards.filter((card) => {
      const rect = card.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    });
    const visibleImages = visibleCards.map((card) => {
      const image = card.querySelector(".loaded-art");
      const cardRect = card.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      return {
        loaded: card.classList.contains("is-loaded"),
        naturalWidth: image?.naturalWidth || 0,
        inside: Boolean(imageRect && imageRect.left >= cardRect.left - 1 && imageRect.right <= cardRect.right + 1 && imageRect.top >= cardRect.top - 1 && imageRect.bottom <= cardRect.bottom + 1),
      };
    });
    return {
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      cards: cards.length,
      overlaps,
      controlsInside,
      visibleImages,
      galleryDisplay: gallery ? getComputedStyle(gallery).display : "",
      snap: gallery ? getComputedStyle(gallery).scrollSnapType : "",
      galleryScrollWidth: gallery?.scrollWidth || 0,
      galleryClientWidth: gallery?.clientWidth || 0,
      cardAspect: cards[0] ? cards[0].getBoundingClientRect().width / cards[0].getBoundingClientRect().height : 0,
      rootVisibility: root.dataset.cardVisibility || "",
      horizontalMedia: matchMedia("(max-height: 560px) and (orientation: landscape) and (max-width: 900px)").matches,
    };
  });
}

async function assertCardShell(page, failures) {
  const rootVisibility = await page.locator("html").getAttribute("data-card-visibility");
  if (rootVisibility !== "open") addFailure(failures, "open-mode", "open", rootVisibility);
  const cardCount = await page.locator("#gallery .archive-card").count();
  if (cardCount !== 70) addFailure(failures, "fanhua-count", 70, cardCount);
  const names = await page.locator("#gallery .archive-card").evaluateAll((cards) => cards.slice(0, 6).map((card) => card.dataset.name));
  if (JSON.stringify(names) !== JSON.stringify(expectedTop)) addFailure(failures, "top-order", expectedTop, names);
  if (await page.locator("#unlockAll, #unlockChoice, .preview-tools").count()) addFailure(failures, "hidden-controls", 0, await page.locator("#unlockAll, #unlockChoice, .preview-tools").count());
  await page.waitForTimeout(250);
  const geometry = await inspectGeometry(page);
  if (geometry.scrollWidth > geometry.viewportWidth + 1) addFailure(failures, "root-overflow", `<=${geometry.viewportWidth + 1}`, geometry.scrollWidth);
  if (geometry.overlaps.length) addFailure(failures, "card-overlap", [], geometry.overlaps);
  if (!geometry.controlsInside) addFailure(failures, "controls-inside-card", true, false);
  if (Math.abs(geometry.cardAspect - .72) > .05) addFailure(failures, "card-aspect", .72, geometry.cardAspect);
  if (geometry.horizontalMedia) {
    if (geometry.galleryDisplay !== "flex") addFailure(failures, "compact-landscape-display", "flex", geometry.galleryDisplay);
    if (!geometry.snap.includes("x")) addFailure(failures, "compact-landscape-snap", "x", geometry.snap);
    if (geometry.galleryScrollWidth <= geometry.galleryClientWidth) addFailure(failures, "compact-landscape-scroll", true, false);
  } else if (geometry.galleryDisplay !== "grid") {
    addFailure(failures, "grid-display", "grid", geometry.galleryDisplay);
  }
  if (geometry.visibleImages.some((image) => image.loaded && (!image.naturalWidth || !image.inside))) addFailure(failures, "visible-image-state", "decoded and inside card", geometry.visibleImages);
  return geometry;
}

async function checkSectionSwitching(page, failures) {
  for (const section of [
    { id: "shark", name: "鲨鱼", count: 14 },
    { id: "wa", name: "咓", count: 14 },
    { id: "fanhuafenluo", name: "繁花·纷落", count: 70 },
  ]) {
    await page.locator(`[data-author="${section.id}"]`).click();
    await page.waitForSelector("#gallery .archive-card", { state: "attached" });
    const author = (await page.locator("#authorName").textContent()).trim();
    const count = await page.locator("#gallery .archive-card").count();
    if (author !== section.name) addFailure(failures, `switch-${section.id}-name`, section.name, author);
    if (count !== section.count) addFailure(failures, `switch-${section.id}-count`, section.count, count);
  }
}

async function checkDetails(page, failures) {
  await page.locator("#gallery .archive-card").first().locator('[data-card-action="detail"]').click();
  await page.waitForSelector("#archiveModal[open]", { timeout: 10000 });
  if (!(await page.locator("#detailName").textContent()).trim()) addFailure(failures, "detail-name", "non-empty", "");
  for (const tab of ["intro", "opening", "personality", "setting"]) {
    await page.locator(`[data-detail-tab="${tab}"]`).click();
    const body = (await page.locator("#detailPanelBody").textContent()).trim();
    if (!body) addFailure(failures, `detail-${tab}`, "non-empty", body);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  if (await page.locator("#archiveModal").evaluate((dialog) => dialog.open)) addFailure(failures, "detail-escape", false, true);
}

async function checkDownload(page, failures) {
  await page.locator("#gallery .archive-card").first().locator('[data-card-action="save"]').click();
  await page.waitForSelector("#saveSheet[open]", { timeout: 10000 });
  try {
    await page.waitForFunction(() => /^blob:/.test(document.getElementById("saveSheetLink")?.getAttribute("href") || ""), null, { timeout: 20000 });
    const filename = await page.locator("#saveSheetLink").getAttribute("download");
    if (!/-角色卡\.png$/.test(filename || "")) addFailure(failures, "download-filename", "*-角色卡.png", filename);
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#saveSheetLink").click()]);
    const filePath = await download.path();
    const signature = filePath ? fs.readFileSync(filePath).subarray(0, 8).toString("hex") : "";
    if (signature !== "89504e470d0a1a0a") addFailure(failures, "download-png-signature", "89504e470d0a1a0a", signature);
  } catch (error) {
    addFailure(failures, "download-blob", "blob URL and valid PNG", error?.message || String(error));
  } finally {
    await page.locator("#saveSheetClose").click().catch(() => {});
  }
}

async function main() {
  const browser = await launcher.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const failures = [];
  const consoleErrors = [];
  const requestFailures = [];
  const pngRequestsBeforeSave = [];
  let saveStarted = false;
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));
  page.on("request", (request) => {
    if (!saveStarted && /\.png(?:[?#]|$)/i.test(request.url())) pngRequestsBeforeSave.push(request.url());
  });
  try {
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("#gallery .archive-card", { timeout: 30000 });
    const initialGeometry = await assertCardShell(page, failures);
    await checkSectionSwitching(page, failures);
    const finalGeometry = await assertCardShell(page, failures);
    if (pngRequestsBeforeSave.length) addFailure(failures, "no-initial-png-request", [], pngRequestsBeforeSave);
    if (round === "1" && viewportName === "390x844") {
      await checkDetails(page, failures);
      saveStarted = true;
      await checkDownload(page, failures);
    }
    if (consoleErrors.length) addFailure(failures, "console-errors", [], consoleErrors);
    if (requestFailures.length) addFailure(failures, "request-failures", [], requestFailures);

    const report = { ok: failures.length === 0, target: TARGET, browser: BROWSER_NAME, viewport: viewportName, round, initialGeometry, finalGeometry, consoleErrors, requestFailures, pngRequestsBeforeSave, failures };
    fs.writeFileSync(path.join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (failures.length) {
      await page.screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: false }).catch(() => {});
      console.error(JSON.stringify(report, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ ok: true, browser: BROWSER_NAME, viewport: viewportName, round, target: TARGET, initial: { cards: initialGeometry.cards, display: initialGeometry.galleryDisplay, aspect: initialGeometry.cardAspect, overflow: initialGeometry.scrollWidth > initialGeometry.viewportWidth + 1 }, final: { cards: finalGeometry.cards, display: finalGeometry.galleryDisplay, aspect: finalGeometry.cardAspect, overflow: finalGeometry.scrollWidth > finalGeometry.viewportWidth + 1 }, pngRequestsBeforeSave: pngRequestsBeforeSave.length, failures: [] }));
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
