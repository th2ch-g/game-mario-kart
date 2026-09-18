import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
await page.addInitScript(() =>
  localStorage.setItem(
    'kartline.settings.v1',
    JSON.stringify({ quality: 'low', sound: false }),
  ),
);
await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4179/');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'artifacts/desktop-home.png', fullPage: true });
await page.getByLabel('周回数', { exact: true }).selectOption('1');
await page
  .getByRole('button', { name: 'レースをはじめる', exact: true })
  .click();
await page.waitForTimeout(8000);
await page.screenshot({ path: 'artifacts/desktop-race.png' });
console.log(
  JSON.stringify({
    errors,
    canvas: await page.locator('canvas').count(),
    speed: await page.getByTestId('speed').textContent(),
    time: await page.getByTestId('race-time').textContent(),
  }),
);
await browser.close();
