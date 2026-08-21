import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

const TARGET = process.env.TEST_URL || "http://127.0.0.1:4173/index.html";
const BROWSER_NAME = (process.env.TEST_BROWSER || "chromium").trim().toLowerCase();
const LAUNCHERS = { chromium, firefox, webkit };
const launcher = LAUNCHERS[BROWSER_NAME];
if (!launcher) throw new Error(`Unknown TEST_BROWSER=${BROWSER_NAME}`);

const artifactDir = path.join(process.cwd(), "artifacts", "dynamic", BROWSER_NAME);
fs.mkdirSync(artifactDir, { recursive: true });

async function inspect(page) {
  return page.evaluate(() => {
    const gallery = document.getElementById("gallery");
    const card = document.querySelector(".archive-card");
    const cardRect = card?.getBoundingClientRect();
    const style = gallery ? getComputedStyle(gallery) : null;
    const root = document.documentElement;
    return {
      width: innerWidth,
      height: innerHeight,
      visibility: root.dataset.cardVisibility || "",
      author: document.getElementById("authorName")?.textContent?.trim() || "",
      cards: document.querySelectorAll(".archive-card").length,
      rootOverflow: root.scrollWidth > root.clientWidth + 1,
      galleryScrollLeft: gallery?.scrollLeft || 0,
      galleryScrollWidth: gallery?.scrollWidth || 0,
      galleryClientWidth: gallery?.clientWidth || 0,
      display: style?.display || "",
      snap: style?.scrollSnapType || "",
      cardAspect: cardRect?.height ? cardRect.width / cardRect.height : 0,
      firstVisible: Boolean(cardRect && cardRect.right > 0 && cardRect.left < innerWidth && cardRect.bottom > 0),
    };
  });
}

function check(state, value) {
  const failures = [];
  if (value.visibility !== "open") failures.push({ check: `${state}-open-mode`, expected: "open", actual: value.visibility });
  if (value.author !== "繁花·纷落") failures.push({ check: `${state}-author`, expected: "繁花·纷落", actual: value.author });
  if (value.cards !== 70) failures.push({ check: `${state}-count`, expected: 70, actual: value.cards });
  if (value.rootOverflow) failures.push({ check: `${state}-root-overflow`, expected: false, actual: true });
  if (!value.firstVisible) failures.push({ check: `${state}-first-card-visible`, expected: true, actual: false });
  if (Math.abs(value.cardAspect - .72) > .04) failures.push({ check: `${state}-card-aspect`, expected: .72, actual: value.cardAspect });
  return failures;
}

async function main() {
  const browser = await launcher.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const failures = [];
  try {
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(".archive-card", { timeout: 30000 });
    await page.waitForTimeout(400);
    const portraitBefore = await inspect(page);
    failures.push(...check("portrait-before", portraitBefore));

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(500);
    const landscape = await inspect(page);
    failures.push(...check("landscape", landscape));
    if (landscape.display !== "flex") failures.push({ check: "landscape-gallery-display", expected: "flex", actual: landscape.display });
    if (!String(landscape.snap).includes("x")) failures.push({ check: "landscape-scroll-snap", expected: "x", actual: landscape.snap });
    if (landscape.galleryScrollWidth <= landscape.galleryClientWidth) failures.push({ check: "landscape-horizontal-scroll", expected: true, actual: false });

    await page.evaluate(() => { document.getElementById("gallery").scrollLeft = 320; });
    await page.waitForTimeout(150);
    const scrolledLandscape = await inspect(page);
    if (scrolledLandscape.galleryScrollLeft <= 0) failures.push({ check: "landscape-scroll-position", expected: ">0", actual: scrolledLandscape.galleryScrollLeft });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const portraitAfter = await inspect(page);
    failures.push(...check("portrait-after", portraitAfter));
    if (portraitAfter.display !== "grid") failures.push({ check: "portrait-gallery-display", expected: "grid", actual: portraitAfter.display });
    if (portraitAfter.galleryScrollLeft !== 0) failures.push({ check: "portrait-scroll-reset", expected: 0, actual: portraitAfter.galleryScrollLeft });
    if (consoleErrors.length) failures.push({ check: "console-errors", expected: [], actual: consoleErrors });

    const report = { ok: failures.length === 0, target: TARGET, browser: BROWSER_NAME, portraitBefore, landscape, scrolledLandscape, portraitAfter, consoleErrors, failures };
    fs.writeFileSync(path.join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (failures.length) {
      await page.screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: false }).catch(() => {});
      console.error(JSON.stringify(report, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(report, null, 2));
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
