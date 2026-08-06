import { test, expect } from "@playwright/test";

async function load(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".card").first()).toBeVisible();
}

function displayedInteger(text) {
  const match = String(text || "").match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

async function currentSection(page) {
  const cards = page.locator(".card");
  const count = await cards.count();
  const name =
    (await page.locator("#authorName").textContent().catch(() => ""))?.trim() ||
    (await page.locator(".brand-name").textContent().catch(() => ""))?.trim() ||
    "unknown";
  const workCount = displayedInteger(await page.locator("#workCount").textContent());
  const workTotal = displayedInteger(await page.locator("#workTotal").textContent());
  return { name, count, workCount, workTotal };
}

async function cycleSections(page, visitor) {
  const switcher = page.locator("#authorSwitch");
  const hasSwitcher = await switcher.count();
  const seen = new Set();

  for (let step = 0; step < 12; step += 1) {
    const section = await currentSection(page);
    if (seen.has(section.name)) break;
    seen.add(section.name);
    await visitor(section, step);

    if (!hasSwitcher) break;
    await switcher.click();
    await expect(page.locator(".card").first()).toBeVisible();
  }
  return seen;
}

test("every author section renders a self-consistent card count", async ({ page }) => {
  await load(page);
  const seen = await cycleSections(page, async section => {
    expect(section.count).toBeGreaterThan(0);
    expect(section.workCount).toBe(section.count);
    expect(section.workTotal).toBe(section.count);
  });
  expect(seen.size).toBeGreaterThan(0);
});

test("image sensitivity and setting sensitivity are independent", async ({ page }) => {
  await load(page);
  let found = false;

  await cycleSections(page, async () => {
    if (found) return;
    const candidate = page.locator(".card.is-sensitive:not(.is-setting-sensitive)").first();
    if (!(await candidate.count())) return;

    found = true;
    await expect(candidate.locator(".front img")).toBeHidden();
    await candidate.locator(".card-flip").evaluate(element => element.click());
    await expect(candidate).toHaveClass(/flipped/);
    await expect(candidate.locator(".back-setting-content")).toBeVisible();
    await expect(candidate.locator(".back-setting-content")).not.toHaveText("");
    await expect(candidate.locator(".back-setting-privacy")).toBeHidden();

    await candidate.locator(".back-expand").click();
    await expect(page.locator("#archiveModal")).toHaveJSProperty("open", true);
    await expect(page.locator("#archiveSetting")).toBeVisible();
    await expect(page.locator("#archiveSetting")).not.toHaveText("");
    await expect(page.locator("#archiveSettingPrivacy")).toBeHidden();
    await page.keyboard.press("Escape");
  });

  expect(found).toBe(true);
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
]) {
  test(`no root overflow or card overlap at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await load(page);

    await cycleSections(page, async () => {
      const result = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".card-item:not([hidden])")];
        const rects = cards.map(card => card.getBoundingClientRect());
        const overlaps = [];
        for (let left = 0; left < rects.length; left += 1) {
          for (let right = left + 1; right < rects.length; right += 1) {
            const a = rects[left];
            const b = rects[right];
            const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapX > 1 && overlapY > 1) {
              overlaps.push([left, right, overlapX, overlapY]);
            }
          }
        }
        return {
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overlaps,
        };
      });
      expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
      expect(result.overlaps).toEqual([]);
    });
  });
}

test("archive dialog closes with Escape", async ({ page }) => {
  await load(page);
  const card = page.locator(".card").first();
  await card.locator(".card-flip").evaluate(element => element.click());
  await card.locator(".back-expand").click();
  await expect(page.locator("#archiveModal")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#archiveModal")).toHaveJSProperty("open", false);
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
});

test("external resources load without runtime or CSP errors", async ({ page }) => {
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));

  await load(page);
  await page.waitForTimeout(400);

  expect(
    errors.filter(message =>
      /Content Security Policy|Refused to|ReferenceError|SyntaxError|Failed to load resource/i.test(message)
    )
  ).toEqual([]);
});
