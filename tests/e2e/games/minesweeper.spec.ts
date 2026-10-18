import { expect, type Page, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

const cells = '[data-stage] .ms-cell';
const cell = (name: string) => `${cells}[data-name="${name}"]`;
const hidden = `${cells}[data-state="hidden"]`;

type Ev = { event: string; score?: number };

// 乱数 0 では地雷が「避ける範囲以外の先頭 15 マス」に並ぶ。
// j10 から開くと a1〜j1・a2〜e2 が地雷になり、1 手で全部開いてクリアになる。
// a1 から開くと c1〜j1・c2〜i2 が地雷になり、j2 が隠れたまま残る。
async function fixRandom(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
}

test('マインスイーパー: 100 マスがすべて隠れた状態で表示される', async ({ page }) => {
  await page.goto('/games/minesweeper/');
  await expect(page.locator(cells)).toHaveCount(100);
  await expect(page.locator(hidden)).toHaveCount(100);
  await expect(page.locator('.ms-info')).toHaveText('💣 残り 15　⏱ 0 秒');
  expect(await dataLayerEvents(page)).toEqual([]);
});

test('マインスイーパー: 最初に開いたマスは安全で周りまで広がり、game_start を送る', async ({ page }) => {
  await page.goto('/games/minesweeper/');
  await page.locator(cell('e5')).click();
  await expect(page.locator(cell('e5'))).toHaveAttribute('data-state', 'open');
  expect(await page.locator(`${cells}[data-state="open"]`).count()).toBeGreaterThanOrEqual(9);
  expect(await dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'minesweeper' }]);
  await expect(page.locator('.ms-status')).toHaveText('数字をヒントに地雷を避けよう');
  // タイマーは最初に開いた瞬間から進む
  await expect(page.locator('.ms-info')).toHaveText(/⏱ [1-9]\d* 秒/);
});

test('マインスイーパー: 右クリックと旗モードで旗を立てて外せる（game_start は送らない）', async ({ page }) => {
  await page.goto('/games/minesweeper/');
  await page.locator(cell('c3')).click({ button: 'right' });
  await expect(page.locator(cell('c3'))).toHaveAttribute('data-state', 'flag');
  await expect(page.locator('.ms-info')).toHaveText('💣 残り 14　⏱ 0 秒');
  // 旗のマスはクリックしても開かない
  await page.locator(cell('c3')).click();
  await expect(page.locator(cell('c3'))).toHaveAttribute('data-state', 'flag');
  await page.locator(cell('c3')).click({ button: 'right' });
  await expect(page.locator(cell('c3'))).toHaveAttribute('data-state', 'hidden');

  await page.locator('.ms-flag-mode').click();
  await expect(page.locator('.ms-flag-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.locator(cell('h8')).click();
  await expect(page.locator(cell('h8'))).toHaveAttribute('data-state', 'flag');
  await page.locator(cell('h8')).click();
  await expect(page.locator(cell('h8'))).toHaveAttribute('data-state', 'hidden');
  expect(await dataLayerEvents(page)).toEqual([]);
});

test('マインスイーパー: 方向キーで移動し、F で旗、Enter で開ける', async ({ page }) => {
  await page.goto('/games/minesweeper/');
  await page.locator(cell('a1')).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(cell('b2'))).toBeFocused();
  await page.keyboard.press('f');
  await expect(page.locator(cell('b2'))).toHaveAttribute('data-state', 'flag');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator(cell('c2'))).toHaveAttribute('data-state', 'open');
  expect(await dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'minesweeper' }]);
});

test('マインスイーパー: クリアすると game_over を 1 回送り、盤面のタップでマスを開かずに次のゲームを始める', async ({ page }) => {
  await fixRandom(page);
  await page.goto('/games/minesweeper/');
  await page.locator(cell('j10')).click();
  await expect(page.locator('.ms-status')).toHaveText('クリア！ 0 秒');
  await expect(page.locator('.ms-again')).toBeVisible();
  await expect(page.locator(cell('a1'))).toHaveAttribute('data-state', 'flag');
  const events = (await dataLayerEvents(page)) as Ev[];
  expect(events).toEqual([
    { event: 'game_start', game_id: 'minesweeper' },
    { event: 'game_over', game_id: 'minesweeper', score: 1000 },
  ]);
  await expect(page.locator('[data-best]')).toHaveText('1000');

  await page.locator(cell('e8')).click();
  await expect(page.locator(hidden)).toHaveCount(100);
  await expect(page.locator('.ms-again')).toBeHidden();
  expect(((await dataLayerEvents(page)) as Ev[]).filter((e) => e.event === 'game_start')).toHaveLength(1);
});

test('マインスイーパー: 地雷を踏むと 0 点で終わり、キーリピートでは結果を消さず Enter で次のゲーム', async ({ page }) => {
  await fixRandom(page);
  await page.goto('/games/minesweeper/');
  await page.locator(cell('a1')).click();
  await expect(page.locator(cell('j2'))).toHaveAttribute('data-state', 'hidden');
  await page.locator(cell('c1')).click();
  await expect(page.locator('.ms-status')).toHaveText('ドカン！ 地雷を踏みました');
  await expect(page.locator(cell('c1'))).toHaveAttribute('data-state', 'exploded');
  await expect(page.locator(`${cells}[data-state="mine"]`)).toHaveCount(14);
  const overs = ((await dataLayerEvents(page)) as Ev[]).filter((e) => e.event === 'game_over');
  expect(overs).toEqual([{ event: 'game_over', game_id: 'minesweeper', score: 0 }]);

  await page.locator(cell('c1')).dispatchEvent('keydown', { key: 'Enter', repeat: true, bubbles: true });
  await expect(page.locator('.ms-again')).toBeVisible();

  await page.locator(cell('c1')).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(hidden)).toHaveCount(100);
  await expect(page.locator('.ms-again')).toBeHidden();
});
