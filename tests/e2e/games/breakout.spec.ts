import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('ブロック崩し: canvas があり、発射するまで game_start を送らない', async ({ page }) => {
  await page.goto('/games/breakout/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('[data-stage] canvas').click();
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'breakout' }]);
});

test('ブロック崩し: Enter で発射できる', async ({ page }) => {
  await page.goto('/games/breakout/');
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'breakout' }]);
});
