import fs from "node:fs";
import { test, expect } from "@playwright/test";

const sections = [
  { id: "fanhuafenluo", name: "繁花·纷落", count: 70, first: ["刻律德菈", "云璃", "雾矢葵", "许知予", "八尺大姐姐", "康娜"] },
  { id: "shark", name: "鲨鱼", count: 14 },
  { id: "wa", name: "咓", count: 14 },
];

async function load(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#gallery .archive-card").first()).toBeVisible();
}

async function assertSection(page, section) {
  await expect(page.locator("#authorName")).toHaveText(section.name);
  await expect(page.locator("#gallery .archive-card")).toHaveCount(section.count);
  await expect(page.locator("#workCount")).toHaveText(String(section.count));
  await expect(page.locator(`[data-author="${section.id}"]`)).toHaveAttribute("aria-selected", "true");
  if (section.first) {
    const names = await page.locator("#gallery .archive-card").evaluateAll((cards) => cards.slice(0, 6).map((card) => card.dataset.name));
    expect(names).toEqual(section.first);
  }
}

async function switchTo(page, id) {
  await page.locator(`[data-author="${id}"]`).click();
  await expect(page.locator(`[data-author="${id}"]`)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#gallery .archive-card").first()).toBeVisible();
}

test("open mode renders all approved sections and latest-first order", async ({ page }) => {
  const pngRequests = [];
  page.on("request", (request) => {
    if (/\.png(?:[?#]|$)/i.test(request.url())) pngRequests.push(request.url());
  });
  await load(page);

  await expect(page.locator("html")).toHaveAttribute("data-card-visibility", "open");
  await expect(page.locator("#unlockAll, #unlockChoice, .preview-tools")).toHaveCount(0);
  await assertSection(page, sections[0]);
  await expect(page.locator("#gallery .loaded-art").first()).toHaveAttribute("data-preview-src", /\.webp$/i);
  await expect.poll(() => page.locator("#gallery .archive-card.is-loaded").count(), { timeout: 15000 }).toBeGreaterThan(0);

  for (let round = 0; round < 2; round += 1) {
    for (const section of sections) {
      await switchTo(page, section.id);
      await assertSection(page, section);
    }
  }
  expect(pngRequests).toEqual([]);
});

test("new card shell exposes real details with reliable modal focus behavior", async ({ page }) => {
  await load(page);
  const card = page.locator("#gallery .archive-card").first();
  const opener = card.locator('[data-card-action="detail"]');
  await opener.click();
  await expect(page.locator("#archiveModal")).toHaveJSProperty("open", true);
  await expect(page.locator("#archiveClose")).toBeFocused();
  await expect(page.locator("#detailName")).not.toHaveText("");
  await expect(page.locator("#archiveRole")).not.toHaveText("");

  for (const tab of ["intro", "opening", "personality", "setting"]) {
    await page.locator(`[data-detail-tab="${tab}"]`).click();
    await expect(page.locator("#detailPanelBody")).not.toHaveText("");
    await expect(page.locator(`[data-detail-tab="${tab}"]`)).toHaveAttribute("aria-selected", "true");
  }

  await page.keyboard.press("Escape");
  await expect(page.locator("#archiveModal")).toHaveJSProperty("open", false);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.locator("#archiveClose").click();
  await expect(page.locator("#archiveModal")).toHaveJSProperty("open", false);
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
});

test("PNG save panel downloads the original file as a Blob with a filename", async ({ page }) => {
  await load(page);
  const card = page.locator("#gallery .archive-card").first();
  await card.locator('[data-card-action="save"]').click();
  await expect(page.locator("#saveSheet")).toHaveJSProperty("open", true);
  await expect.poll(() => page.locator("#saveSheetLink").getAttribute("href"), { timeout: 20000 }).toMatch(/^blob:/);
  await expect(page.locator("#saveSheetLink")).toHaveAttribute("download", /-角色卡\.png$/);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#saveSheetLink").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-角色卡\.png$/);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const signature = fs.readFileSync(filePath).subarray(0, 8).toString("hex");
  expect(signature).toBe("89504e470d0a1a0a");
  await page.locator("#saveSheetClose").click();
  await expect(page.locator("#saveSheet")).toHaveJSProperty("open", false);
});

async function geometry(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll("#gallery .archive-card")];
    const rects = cards.map((card) => ({ card, rect: card.getBoundingClientRect() }));
    const overlaps = [];
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left].rect;
        const b = rects[right].rect;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) overlaps.push([left, right]);
      }
    }
    const controlsInside = cards.slice(0, 12).every((card) => {
      const cardRect = card.getBoundingClientRect();
      return [...card.querySelectorAll(".detail-action, .download-action")].every((button) => {
        const buttonRect = button.getBoundingClientRect();
        return buttonRect.left >= cardRect.left - 1 && buttonRect.right <= cardRect.right + 1 && buttonRect.top >= cardRect.top - 1 && buttonRect.bottom <= cardRect.bottom + 1;
      });
    });
    const loadedCards = cards.filter((card) => card.classList.contains("is-loaded"));
    const namesVisible = loadedCards.length > 0 && loadedCards.slice(0, 12).every((card) => {
      const rect = card.querySelector(".ready-name")?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.right <= card.getBoundingClientRect().right + 1);
    });
    const gallery = document.querySelector("#gallery");
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overlaps,
      controlsInside,
      namesVisible,
      galleryScrollWidth: gallery?.scrollWidth || 0,
      galleryClientWidth: gallery?.clientWidth || 0,
      cardAspect: cards[0] ? cards[0].getBoundingClientRect().width / cards[0].getBoundingClientRect().height : 0,
      compactLandscape: matchMedia("(max-height: 560px) and (orientation: landscape) and (max-width: 900px)").matches,
      snap: getComputedStyle(gallery).scrollSnapType,
    };
  });
}

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
]) {
  test(`new shell has no overflow, overlap, or off-card controls at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await load(page);
    await expect.poll(() => page.locator("#gallery .archive-card.is-loaded").count(), { timeout: 15000 }).toBeGreaterThan(0);
    const result = await geometry(page);
    expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.overlaps).toEqual([]);
    expect(result.controlsInside).toBe(true);
    expect(result.namesVisible).toBe(true);
    expect(Math.abs(result.cardAspect - .72)).toBeLessThan(.04);
    if (result.compactLandscape) {
      expect(result.snap).toContain("x");
      expect(result.galleryScrollWidth).toBeGreaterThan(result.galleryClientWidth);
    }
  });
}

test("runtime has no page errors and author switching remains stable", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await load(page);
  for (const section of sections) {
    await switchTo(page, section.id);
    await assertSection(page, section);
  }
  await switchTo(page, "fanhuafenluo");
  await page.waitForTimeout(500);
  expect(errors.filter((message) => !/favicon/i.test(message))).toEqual([]);
});
