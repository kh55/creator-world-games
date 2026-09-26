import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('テトリス: Enter で開始して game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/tetris/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // プレイ中の Enter では送らない
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'tetris' }]);
});

test('テトリス: ハードドロップを続けるとゲームオーバーになり game_over を 1 回送る', async ({ page }) => {
  await page.goto('/games/tetris/');
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  for (let i = 0; i < 40; i++) {
    // ハードドロップは押した瞬間をフレームごとに検出するため、1 フレーム以上押し続ける
    await page.keyboard.down('Space');
    await page.waitForTimeout(50);
    await page.keyboard.up('Space');
    await page.waitForTimeout(20);
    const over = (await dataLayerEvents(page)).some((e) => (e as { event: string }).event === 'game_over');
    if (over) break;
  }
  const events = await dataLayerEvents(page);
  const overs = events.filter((e) => (e as { event: string }).event === 'game_over');
  expect(overs).toHaveLength(1);
  expect(overs[0]).toMatchObject({ game_id: 'tetris', score: expect.any(Number) });
});
