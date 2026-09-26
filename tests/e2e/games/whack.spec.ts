import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('もぐらたたき: 9 個の穴があり、開くとすぐ始まって game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/whack/');
  await expect(page.locator('[data-stage] .whack-hole')).toHaveCount(9);
  await expect(page.locator('.wtime')).not.toHaveText('30.0');
  expect(await dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'whack' }]);
});

test('もぐらたたき: 出てきたもぐらをクリックすると SCORE が増える', async ({ page }) => {
  await page.goto('/games/whack/');
  const mole = page.locator('.whack-hole', { hasText: '🐹' }).first();
  await mole.waitFor();
  await mole.click();
  await expect(page.locator('[data-score]')).not.toHaveText('0');
});
