import { expect, test } from '@playwright/test';

test('real WebRTC synchronizes a race, host pause, guest reconnect and rematch', async ({
  browser,
}) => {
  test.setTimeout(180000);
  const hostContext = await browser.newContext({
      viewport: { width: 900, height: 650 },
    }),
    guestContext = await browser.newContext({
      viewport: { width: 800, height: 600 },
    });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest])
    page.on('pageerror', (e) => errors.push(e.message));
  await host.addInitScript(() =>
    localStorage.setItem(
      'kartline.settings.v1',
      JSON.stringify({ name: 'Host', quality: 'low', sound: false }),
    ),
  );
  await guest.addInitScript(() =>
    localStorage.setItem(
      'kartline.settings.v1',
      JSON.stringify({ name: 'Guest', kart: 2, quality: 'low', sound: false }),
    ),
  );
  await host.goto('./');
  await host.getByRole('button', { name: /PLAY WITH FRIENDS/ }).click();
  await host.getByLabel('周回数', { exact: true }).selectOption('1');
  await host.getByRole('button', { name: '友だちと走る', exact: true }).click();
  await host
    .getByRole('button', { name: 'ルームをつくる', exact: true })
    .click();
  await expect(host.locator('.connection-badge')).toHaveText('ONLINE', {
    timeout: 30000,
  });
  const code = (await host.getByTestId('room-code').textContent())!;
  await guest.goto(`./?room=${code}`);
  await guest.getByRole('button', { name: '参加する', exact: true }).click();
  await expect(host.locator('.member')).toContainText(['Host', 'Guest'], {
    timeout: 30000,
  });
  await guest.getByRole('button', { name: '準備OK', exact: true }).click();
  await expect(
    host.getByRole('button', { name: 'みんなでスタート' }),
  ).toBeEnabled();
  await host.getByRole('button', { name: 'みんなでスタート' }).click();
  await expect(guest.getByTestId('speed')).not.toHaveText('0', {
    timeout: 30000,
  });
  await expect(host.getByTestId('speed')).not.toHaveText('0');
  await guest.keyboard.down('ArrowRight');
  await guest.waitForTimeout(350);
  await guest.keyboard.up('ArrowRight');
  await host.getByRole('button', { name: '一時停止' }).click();
  await expect(
    guest.getByRole('heading', { name: 'ホストを待っています' }),
  ).toBeVisible();
  const time = await guest.getByTestId('race-time').textContent();
  await guest.waitForTimeout(500);
  expect(await guest.getByTestId('race-time').textContent()).toBe(time);
  await host.getByRole('button', { name: 'レースに戻る', exact: true }).click();
  await expect(guest.locator('.pause-panel')).toHaveCount(0);
  await guest.reload();
  await guest.getByRole('button', { name: '前のルームに再接続' }).click();
  await expect(guest.getByTestId('race-time')).toBeVisible({ timeout: 30000 });
  await expect(host.locator('.results-panel')).toBeVisible({ timeout: 90000 });
  await expect(guest.locator('.results-panel')).toBeVisible({ timeout: 20000 });
  const hostResults = await host.locator('.results-list').innerText(),
    guestResults = await guest.locator('.results-list').innerText();
  expect(hostResults.replaceAll('YOU', 'PLAYER')).toBe(
    guestResults.replaceAll('YOU', 'PLAYER'),
  );
  await host.getByRole('button', { name: 'ルームに戻る' }).click();
  await expect(
    guest.getByRole('button', { name: '準備OK', exact: true }),
  ).toBeVisible();
  await guest.getByRole('button', { name: '準備OK', exact: true }).click();
  await host.getByRole('button', { name: 'みんなでスタート' }).click();
  await expect(guest.locator('.countdown')).toBeVisible();
  await host.getByRole('button', { name: '一時停止' }).click();
  await host.getByRole('button', { name: 'レースを終了してホームへ' }).click();
  await expect(
    guest.getByRole('heading', { name: '接続が切れました' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await hostContext.close();
  await guestContext.close();
});
