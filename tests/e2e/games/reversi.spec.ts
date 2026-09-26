import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

const cells = '[data-stage] .reversi-cell';
const legal = '[data-stage] .reversi-cell[data-legal]';

test('リバーシ: 64 マスと置けるマス 4 つが表示される', async ({ page }) => {
  await page.goto('/games/reversi/');
  await expect(page.locator(cells)).toHaveCount(64);
  await expect(page.locator(legal)).toHaveCount(4);
  await expect(page.locator('.reversi-counts')).toHaveText('黒 2 / 白 2');
  expect(await dataLayerEvents(page)).toEqual([]);
});

test('リバーシ: 置けるマスを押すと game_start を送り、CPU が打ち返す', async ({ page }) => {
  await page.goto('/games/reversi/');
  await page.locator(legal).first().click();
  await expect(page.locator('.reversi-counts')).toHaveText('黒 4 / 白 1');
  await expect(page.locator('.reversi-counts')).toHaveText('黒 3 / 白 3');
  await expect(page.locator('.reversi-status')).toHaveText('あなたの番（黒）');
  expect(await dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'reversi' }]);
});

test('リバーシ: CPU の番に続けて押しても 1 手しか打てない', async ({ page }) => {
  await page.goto('/games/reversi/');
  await page.locator(legal).first().click();
  // CPU の番（0.5 秒）の間に、黒が置けそうなマスを続けて押す
  for (const name of ['c4', 'f5', 'e6', 'c3']) await page.locator(`${cells}[data-name="${name}"]`).click();
  await expect(page.locator('.reversi-counts')).toHaveText('黒 3 / 白 3');
});

test('リバーシ: Tab でマスに移動し Enter で置ける', async ({ page }) => {
  await page.goto('/games/reversi/');
  await page.locator(legal).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.reversi-counts')).toHaveText('黒 4 / 白 1');
  expect(await dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'reversi' }]);
});

test('リバーシ: 終局まで打つと game_over を 1 回送り、盤面のタップで石を置かずに新しい局を始める', async ({ page }) => {
  test.setTimeout(120_000);
  // CPU の手の乱数を固定して、毎回同じ手順で終局させる
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/games/reversi/');
  const again = page.locator('.reversi-again');
  while (!(await again.isVisible())) {
    const hint = page.locator(legal).first();
    if (await hint.count()) await hint.click();
    else await page.waitForTimeout(200); // CPU の番
  }
  const events = (await dataLayerEvents(page)) as { event: string; score?: number }[];
  const overs = events.filter((e) => e.event === 'game_over');
  expect(overs).toHaveLength(1);
  expect(events.filter((e) => e.event === 'game_start')).toHaveLength(1);
  const status = await page.locator('.reversi-status').innerText();
  const m = /(\d+) 対 (\d+)/.exec(status)!;
  const [black, white] = [Number(m[1]), Number(m[2])];
  expect(overs[0].score).toBe(black > white ? black : 0);

  // 終局後に盤面のマスをタップ → 新しい局。タップしたマスに石は置かれない
  await page.locator(`${cells}[data-name="d3"]`).click();
  await expect(page.locator('.reversi-counts')).toHaveText('黒 2 / 白 2');
  await expect(page.locator(legal)).toHaveCount(4);
  await expect(again).toBeHidden();
  expect(((await dataLayerEvents(page)) as { event: string }[]).filter((e) => e.event === 'game_start')).toHaveLength(1);
});
