import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function prepare(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('kartline.settings.v1'))
      localStorage.setItem(
        'kartline.settings.v1',
        JSON.stringify({ quality: 'low', sound: false, name: 'Racer' }),
      );
  });
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.render-error')).toHaveCount(0);
}
async function oneLap(page: Page) {
  await page.getByLabel('周回数', { exact: true }).selectOption('1');
  await page
    .getByRole('button', { name: 'レースをはじめる', exact: true })
    .click();
  await expect(page.getByTestId('speed')).not.toHaveText('0', {
    timeout: 15000,
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test('home, garage, course choices, settings persistence and accessible dialogs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await prepare(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '小さなカート',
  );
  await page.getByRole('button', { name: 'ミント', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'ミント', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /02 \/ HIGHLAND/ }).click();
  await expect(page.locator('.scene-label')).toContainText('MAPLE HIGHLAND');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('自動アクセル').uncheck();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByLabel('自動アクセル')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '遊び方', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.keyboard.press('Escape');
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('a complete race uses keyboard controls, pauses, finishes and restarts', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await prepare(page);
  await oneLap(page);
  await expect
    .poll(async () => Number(await page.getByTestId('speed').textContent()))
    .toBeGreaterThan(65);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ShiftLeft');
  await expect(page.locator('.drift-meter')).toContainText('RELEASE TO BOOST');
  await page.keyboard.up('ShiftLeft');
  await expect(page.locator('.boost-indicator')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'ひとやすみ。' }),
  ).toBeVisible();
  const time = await page.getByTestId('race-time').textContent();
  await page.waitForTimeout(600);
  expect(await page.getByTestId('race-time').textContent()).toBe(time);
  await page.getByRole('button', { name: 'レースに戻る', exact: true }).click();
  await expect(page.getByTestId('held-item')).not.toHaveText('アイテム', {
    timeout: 20000,
  });
  await page.keyboard.press('Space');
  await expect(page.getByTestId('held-item')).toHaveText('アイテム');
  await expect(page.locator('.results-panel')).toBeVisible({ timeout: 75000 });
  await expect(page.locator('.results-list li')).toHaveCount(8);
  await expect(page.locator('.result-summary')).not.toContainText('DNF');
  await page.getByRole('button', { name: 'もう一度走る' }).click();
  await expect(page.locator('.countdown')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'レースを終了してホームへ' }).click();
  await expect(page.locator('.site-header')).toBeVisible();
  expect(errors).toEqual([]);
});

test('grand prix runs all three courses and awards a final cup', async ({
  page,
}) => {
  test.setTimeout(210000);
  await prepare(page);
  await page.getByRole('button', { name: /GRAND PRIX/ }).click();
  await oneLap(page);
  for (let round = 0; round < 3; round++) {
    await expect(page.locator('.results-panel')).toBeVisible({
      timeout: 65000,
    });
    if (round < 2) {
      await expect(page.locator('.result-heading')).toContainText(
        `ROUND ${round + 1} / 3`,
      );
      await page.getByRole('button', { name: '次のコースへ' }).click();
    }
  }
  await expect(page.locator('.result-heading')).toContainText(
    'GRAND PRIX COMPLETE',
  );
  await expect(page.locator('.results-list li').first()).toContainText('pts');
});

test('time attack stores a real completed three-lap ghost and reloads it', async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole('button', { name: /TIME ATTACK/ }).click();
  await page
    .getByRole('button', { name: 'レースをはじめる', exact: true })
    .click();
  await expect(page.locator('.results-panel')).toBeVisible({ timeout: 100000 });
  await expect(
    page.getByRole('heading', { name: '自己ベスト更新！' }),
  ).toBeVisible();
  await expect(page.locator('.lap-times>span')).toHaveCount(3);
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kartline.records.v1') || '[]'),
  );
  expect(records[0].ghost.length).toBeGreaterThan(100);
  expect(records[0].time).toBeGreaterThan(20);
  await page.reload();
  await page.getByRole('button', { name: 'レコード', exact: true }).click();
  await expect(page.locator('.records-list article').first()).not.toContainText(
    'まだ記録',
  );
  await page
    .getByRole('button', { name: 'サンシャイン・コーストに挑戦' })
    .click();
  await expect(page.getByTestId('speed')).not.toHaveText('0');
});

test('split screen drives two independent karts through a complete race', async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole('button', { name: /画面分割で2人プレイ/ }).click();
  await page.getByLabel('周回数', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: '2人でレースをはじめる' }).click();
  await expect(page.locator('.split-divider')).toBeVisible();
  await expect(page.getByTestId('speed')).not.toHaveText('0');
  await page.keyboard.down('KeyA');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('.results-panel')).toBeVisible({ timeout: 80000 });
  await expect(page.locator('.results-list li.you')).toHaveCount(2);
  await expect(page.locator('.results-list')).toContainText('Player 2');
});

test('phone and landscape layouts support simultaneous touch steering and drifting', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await prepare(page);
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/mobile-home.png', fullPage: true });
  await page
    .getByRole('button', { name: 'レースをはじめる', exact: true })
    .click();
  await expect(page.getByTestId('speed')).not.toHaveText('0');
  await page.waitForTimeout(1800);
  const right = page.getByRole('button', { name: '右に曲がる', exact: true }),
    drift = page.getByRole('button', { name: 'DRIFT', exact: true });
  if (test.info().project.name === 'chromium') {
    const cdp = await context.newCDPSession(page),
      r = (await right.boundingBox())!,
      d = (await drift.boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 1 },
        { x: d.x + d.width / 2, y: d.y + d.height / 2, id: 2 },
      ],
    });
    await page.waitForTimeout(900);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } else {
    await right.dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    });
    await drift.dispatchEvent('pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
    });
    await page.waitForTimeout(900);
    await right.dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
    });
    await drift.dispatchEvent('pointerup', {
      pointerId: 2,
      pointerType: 'touch',
    });
  }
  await expect(page.locator('.boost-indicator')).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-race.png' });
  await noOverflow(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(right).toBeVisible();
  await noOverflow(page);
  const box = (await drift.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/mobile-landscape.png' });
  await page.getByRole('button', { name: '一時停止' }).tap();
  await expect(
    page.getByRole('button', { name: 'レースに戻る', exact: true }),
  ).toBeVisible();
  await context.close();
});
