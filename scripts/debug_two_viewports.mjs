import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const TARGET = process.env.TEST_URL || "https://hqu35785-cmyk.github.io/fanhuafenluo/index.html";
const OUT = path.join(process.cwd(), "test-artifacts", "debug-two");
fs.mkdirSync(OUT, { recursive: true });

function rectsOverlap(a, b, tolerance = 1) {
  return (
    a.left < b.right - tolerance &&
    a.right > b.left + tolerance &&
    a.top < b.bottom - tolerance &&
    a.bottom > b.top + tolerance
  );
}

function visible(el) {
  if (!el || !el.isConnected) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function pack(r) {
  return {
    left: +r.left.toFixed(2),
    right: +r.right.toFixed(2),
    top: +r.top.toFixed(2),
    bottom: +r.bottom.toFixed(2),
    width: +r.width.toFixed(2),
    height: +r.height.toFixed(2),
  };
}

async function diagnose(page, label) {
  return page.evaluate(
    ({ label, tol }) => {
      function rectsOverlap(a, b, tolerance = 1) {
        return (
          a.left < b.right - tolerance &&
          a.right > b.left + tolerance &&
          a.top < b.bottom - tolerance &&
          a.bottom > b.top + tolerance
        );
      }
      function isVisible(el) {
        if (!el || !el.isConnected) return false;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }
      function pack(r) {
        return {
          left: +r.left.toFixed(2),
          right: +r.right.toFixed(2),
          top: +r.top.toFixed(2),
          bottom: +r.bottom.toFixed(2),
          width: +r.width.toFixed(2),
          height: +r.height.toFixed(2),
        };
      }

      const mqPhonePortrait = window.matchMedia("(max-width:620px) and (orientation:portrait)").matches;
      const mqNarrowBottom = window.matchMedia(
        "(max-width:620px), (max-height:520px) and (orientation:landscape)"
      ).matches;
      const mqLandscapeCompact = window.matchMedia(
        "(max-height:520px) and (orientation:landscape)"
      ).matches;

      const failures = [];
      const notes = [];

      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      if (scrollWidth > clientWidth + 1) {
        failures.push({
          check: "horizontal-overflow",
          expected: `scrollWidth <= clientWidth + 1`,
          actual: `${scrollWidth} > ${clientWidth}`,
          selectors: ["html", "body"],
        });
      } else {
        notes.push(`horizontal-overflow OK: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`);
      }

      const cards = [...document.querySelectorAll(".card")].slice(0, 6);
      for (const [i, card] of cards.entries()) {
        const flipped = card.classList.contains("flipped");
        const title = card.querySelector(".card-name b");
        const alias = card.querySelector(".card-name > span:not(.card-meta)");
        const meta = card.querySelector(".card-meta");
        const metaLast = card.querySelector(".card-meta span:last-child");
        const btn = card.querySelector(".privacy-unlock");
        const name = card.querySelector(".card-name");

        const exists = {
          title: !!title,
          alias: !!alias,
          meta: !!meta,
          metaLast: !!metaLast,
          btn: !!btn,
          name: !!name,
        };

        const vis = {
          title: isVisible(title),
          alias: isVisible(alias),
          meta: isVisible(meta),
          metaLast: isVisible(metaLast),
          btn: isVisible(btn),
          name: isVisible(name),
        };

        if (flipped) {
          notes.push(`card-${i} flipped — skip front overlap`);
          continue;
        }

        const cr = card.getBoundingClientRect();
        const br = vis.btn ? btn.getBoundingClientRect() : null;
        const tr = vis.title ? title.getBoundingClientRect() : null;
        const ar = vis.alias ? alias.getBoundingClientRect() : null;
        const mr = vis.metaLast && vis.meta ? metaLast.getBoundingClientRect() : null;
        const nr = vis.name ? name.getBoundingClientRect() : null;

        // Only assert narrow-layout overlaps when that layout is active
        if (mqNarrowBottom) {
          if (tr && br && rectsOverlap(tr, br, tol)) {
            failures.push({
              check: "title-button-overlap",
              card: i,
              expected: "title and button do not intersect (tolerance=1)",
              actual: "rects overlap",
              selectors: [".card-name b", ".privacy-unlock"],
              exists,
              visible: vis,
              titleRect: pack(tr),
              buttonRect: pack(br),
              cardClass: card.className,
            });
          }
          if (ar && br && rectsOverlap(ar, br, tol)) {
            failures.push({
              check: "alias-button-overlap",
              card: i,
              expected: "alias and button do not intersect",
              actual: "rects overlap",
              selectors: [".card-name > span:not(.card-meta)", ".privacy-unlock"],
              aliasRect: pack(ar),
              buttonRect: pack(br),
              cardClass: card.className,
            });
          }
          if (mr && br && rectsOverlap(mr, br, tol)) {
            failures.push({
              check: "meta-button-overlap",
              card: i,
              expected: "点按翻转 and button do not intersect",
              actual: "rects overlap",
              selectors: [".card-meta span:last-child", ".privacy-unlock"],
              metaRect: pack(mr),
              buttonRect: pack(br),
              cardClass: card.className,
            });
          }
        } else {
          // Desktop/tablet: still check title vs button if both visible, but report as desktop-layout
          if (tr && br && rectsOverlap(tr, br, tol)) {
            failures.push({
              check: "title-button-overlap-desktop-layout",
              card: i,
              expected: "title and button do not intersect",
              actual: "rects overlap",
              selectors: [".card-name b", ".privacy-unlock"],
              titleRect: pack(tr),
              buttonRect: pack(br),
              cardClass: card.className,
              note: "narrow-bottom-layout media query is FALSE at this viewport",
            });
          }
          if (mr && br && rectsOverlap(mr, br, tol)) {
            failures.push({
              check: "meta-button-overlap-desktop-layout",
              card: i,
              expected: "meta and button do not intersect under desktop layout",
              actual: "rects overlap",
              selectors: [".card-meta span:last-child", ".privacy-unlock"],
              metaRect: pack(mr),
              buttonRect: pack(br),
              nameRect: nr ? pack(nr) : null,
              nameRightCSS: name ? getComputedStyle(name).right : null,
              btnRightCSS: btn ? getComputedStyle(btn).right : null,
              cardClass: card.className,
              note: "narrow-bottom-layout media query is FALSE — do not apply phone grid assertions",
            });
          }
        }

        if (br) {
          if (br.right > cr.right + 1.5 || br.bottom > cr.bottom + 1.5 || br.left < cr.left - 1.5) {
            failures.push({
              check: "button-outside-card",
              card: i,
              expected: "button inside card bounds",
              actual: "button extends outside card",
              buttonRect: pack(br),
              cardRect: pack(cr),
            });
          }
        }

        // Off-screen cards: only fail if NOT in intentional horizontal carousel
        const landscapeSnap =
          getComputedStyle(document.getElementById("gallery")).scrollSnapType.includes("x") &&
          getComputedStyle(document.getElementById("gallery")).gridAutoFlow.includes("column");
        if (!landscapeSnap && (cr.right > window.innerWidth + 2 || cr.left < -2)) {
          failures.push({
            check: "card-outside-viewport-x",
            card: i,
            expected: "card within viewport x (non-carousel layout)",
            actual: `card left=${cr.left.toFixed(1)} right=${cr.right.toFixed(1)} vw=${window.innerWidth}`,
            cardRect: pack(cr),
          });
        } else if (landscapeSnap && (cr.right > window.innerWidth + 2 || cr.left < -2)) {
          notes.push(
            `card-${i} off-screen-x in landscape carousel (EXPECTED, not a failure): left=${cr.left.toFixed(1)} right=${cr.right.toFixed(1)}`
          );
        }
      }

      const gallery = document.getElementById("gallery");
      const cols = getComputedStyle(gallery).gridTemplateColumns;
      const colCount = cols && cols !== "none" ? cols.trim().split(/\s+/).length : 0;

      // Phone portrait column assertions only when media matches
      if (mqPhonePortrait) {
        const w = window.innerWidth;
        if (w >= 500 && w <= 620 && colCount !== 3) {
          failures.push({
            check: "three-column-portrait",
            expected: 3,
            actual: colCount,
            media: "(max-width:620px) and (orientation:portrait) && width 500-620",
          });
        }
        if (w < 500 && colCount !== 2) {
          failures.push({
            check: "two-column-portrait",
            expected: 2,
            actual: colCount,
            media: "(max-width:620px) and (orientation:portrait) && width < 500",
          });
        }
      } else {
        notes.push(`skip phone column asserts (phonePortrait=false), colCount=${colCount}`);
      }

      return {
        label,
        media: { mqPhonePortrait, mqNarrowBottom, mqLandscapeCompact },
        scrollWidth,
        clientWidth,
        colCount,
        cols,
        aspect: document.querySelector(".card")
          ? getComputedStyle(document.querySelector(".card")).aspectRatio
          : null,
        flipCompat: document.documentElement.classList.contains("flip-compat"),
        flip3d: document.documentElement.classList.contains("flip-3d"),
        htmlHasFlipCompatClass: document.documentElement.className,
        portraitCardHeightStyle:
          document.documentElement.style.getPropertyValue("--portrait-card-height") || "",
        failures,
        notes,
        sampleCard0: (() => {
          const c = document.querySelector(".card");
          if (!c) return null;
          return {
            className: c.className,
            btnText: c.querySelector(".privacy-unlock")?.textContent || null,
            title: c.querySelector(".card-name b")?.textContent || null,
          };
        })(),
      };
    },
    { label, tol: 1 }
  );
}

async function runOne(width, height) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e && e.stack ? e.stack : e)));

  console.log("\n==========", `${width}x${height}`, "==========");
  console.log("URL:", TARGET);

  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".card", { timeout: 30000 });
  await page.waitForTimeout(800);

  const deployment = await page.evaluate(() => {
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules];
      } catch {
        return [];
      }
    });
    return {
      hasAspectRatio: rules.some((rule) => rule.cssText?.includes("aspect-ratio: 18 / 25") || rule.cssText?.includes("aspect-ratio:18 / 25")),
      hasThreeColumns: document.documentElement.innerHTML.includes("repeat(3,minmax(0,1fr))"),
      portraitCardHeight: getComputedStyle(document.documentElement).getPropertyValue("--portrait-card-height"),
      url: location.href,
      title: document.title,
    };
  });
  console.log("deployment:", JSON.stringify(deployment, null, 2));

  // locked
  let result = await diagnose(page, "locked-front");
  printResult(width, height, "locked-front", result, consoleErrors, pageErrors);
  await page.screenshot({ path: path.join(OUT, `${width}x${height}_locked.png`), fullPage: true });

  // unlocked
  await page.locator("#unlockAll").click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  // close unlock choice sheet if present
  await page.evaluate(() => {
    const el = document.getElementById("unlockChoice");
    if (el) el.hidden = true;
  });
  result = await diagnose(page, "unlocked-front");
  printResult(width, height, "unlocked-front", result, consoleErrors, pageErrors);
  await page.screenshot({ path: path.join(OUT, `${width}x${height}_unlocked.png`), fullPage: true });

  // orientation switch experiment (only report, classify carefully)
  if (height >= width) {
    await page.setViewportSize({ width: height, height: Math.min(width, 520) });
    await page.waitForTimeout(600);
    result = await diagnose(page, "after-orientation-to-landscape");
    printResult(width, height, "after-orientation-to-landscape", result, consoleErrors, pageErrors);
    await page.screenshot({
      path: path.join(OUT, `${width}x${height}_orient.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
  }

  const tracePath = path.join(OUT, `trace_${width}x${height}.zip`);
  await context.tracing.stop({ path: tracePath });
  console.log("trace:", tracePath);

  await browser.close();
  return { width, height, deployment };
}

function printResult(w, h, state, result, consoleErrors, pageErrors) {
  console.log(`\n--- ${w}x${h} / ${state} ---`);
  console.log("浏览器：chromium");
  console.log("视口：", `${w}x${h}`);
  console.log("测试状态：", state);
  console.log("media:", JSON.stringify(result.media));
  console.log("scrollWidth:", result.scrollWidth, "clientWidth:", result.clientWidth);
  console.log("colCount:", result.colCount, "aspect:", result.aspect);
  console.log("flip3d:", result.flip3d, "flipCompat:", result.flipCompat);
  console.log("portraitCardHeightStyle:", JSON.stringify(result.portraitCardHeightStyle));
  console.log("sampleCard0:", JSON.stringify(result.sampleCard0));
  if (result.notes?.length) {
    console.log("notes:");
    for (const n of result.notes) console.log("  -", n);
  }
  if (!result.failures.length) {
    console.log("失败检查：无");
  } else {
    for (const f of result.failures) {
      console.log("\nFAIL:", f.check);
      console.log("  期望值：", f.expected);
      console.log("  实际值：", f.actual);
      if (f.selectors) console.log("  相关选择器：", f.selectors);
      if (f.exists) console.log("  元素是否存在：", f.exists);
      if (f.visible) console.log("  元素是否可见：", f.visible);
      if (f.titleRect) console.log("  titleRect：", f.titleRect);
      if (f.aliasRect) console.log("  aliasRect：", f.aliasRect);
      if (f.metaRect) console.log("  metaRect：", f.metaRect);
      if (f.buttonRect) console.log("  buttonRect：", f.buttonRect);
      if (f.cardRect) console.log("  cardRect：", f.cardRect);
      if (f.nameRect) console.log("  nameRect：", f.nameRect);
      if (f.nameRightCSS) console.log("  nameRightCSS：", f.nameRightCSS);
      if (f.btnRightCSS) console.log("  btnRightCSS：", f.btnRightCSS);
      if (f.cardClass) console.log("  卡片 class：", f.cardClass);
      if (f.note) console.log("  note：", f.note);
      if (f.media) console.log("  media：", f.media);
    }
  }
  if (consoleErrors.length) console.log("控制台错误：", consoleErrors);
  else console.log("控制台错误：无");
  if (pageErrors.length) console.log("异常堆栈：", pageErrors);
  else console.log("异常堆栈：无");
  console.log("HTML flip-compat class on <html>：", result.htmlHasFlipCompatClass);
}

await runOne(390, 844);
await runOne(1280, 720);

console.log("\nArtifacts in", OUT);
