import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('インベーダー: canvas があり、Enter で開始して game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/invader/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'invader' }]);
});

test('インベーダー: スマホ幅でも FIRE ボタンが表示される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/games/invader/');
  await expect(page.getByRole('button', { name: '発射' })).toBeVisible();
});
