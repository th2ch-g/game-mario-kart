import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts/audit', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.addInitScript(() =>
  localStorage.setItem(
    'kartline.settings.v1',
    JSON.stringify({ quality: 'high', sound: false }),
  ),
);
await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4179/');
const layouts = [];
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [320, 740],
]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(350);
  layouts.push(
    await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      buttonsOutside: [...document.querySelectorAll('button')]
        .filter((button) => {
          const r = button.getBoundingClientRect();
          return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        })
        .map(
          (button) =>
            button.getAttribute('aria-label') || button.textContent.trim(),
        ),
    })),
  );
  await page.screenshot({
    path: `artifacts/audit/home-${width}.png`,
    fullPage: true,
  });
}
await page.setViewportSize({ width: 1280, height: 800 });
for (const course of ['01 / COAST', '02 / HIGHLAND', '03 / NIGHT']) {
  await page.getByRole('button', { name: new RegExp(course) }).click();
  await page
    .getByRole('button', { name: 'レースをはじめる', exact: true })
    .click();
  await page.waitForTimeout(6500);
  await page.screenshot({
    path: `artifacts/audit/race-${course.slice(0, 2)}.png`,
  });
  await page.getByRole('button', { name: '一時停止' }).click();
  await page.getByRole('button', { name: 'レースを終了してホームへ' }).click();
}
const report = { errors, layouts };
await fs.writeFile(
  'artifacts/audit/report.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
await browser.close();
if (
  errors.length ||
  layouts.some((layout) => layout.overflow || layout.buttonsOutside.length)
)
  process.exitCode = 1;
