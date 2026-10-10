import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('スネーク: Enter で開始して game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/snake/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // プレイ中の Enter では送らない
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'snake' }]);
});

test('スネーク: 壁にぶつかるとゲームオーバーになり game_over を 1 回送る', async ({ page }) => {
  await page.goto('/games/snake/');
  await page.locator('h1').click();
  await page.keyboard.press('Enter');
  // 何もしなければ右の壁まで進んでぶつかる（中央から 10 マス × 0.15 秒）
  await expect
    .poll(async () => (await dataLayerEvents(page)).filter((e) => (e as { event: string }).event === 'game_over'), {
      timeout: 10_000,
    })
    .toEqual([{ event: 'game_over', game_id: 'snake', score: 0 }]);
  await page.waitForTimeout(500);
  const overs = (await dataLayerEvents(page)).filter((e) => (e as { event: string }).event === 'game_over');
  expect(overs).toHaveLength(1);
});

test('スネーク: 方向キーで曲がれる', async ({ page }) => {
  const overs = async () =>
    (await dataLayerEvents(page)).filter((e) => (e as { event: string }).event === 'game_over');
  // 向きを変える操作は押した瞬間をフレームごとに検出するため、1 フレーム以上押し続ける
  const tap = async (key: string) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(50);
    await page.keyboard.up(key);
  };
  await page.goto('/games/snake/');
  await page.locator('h1').click();
  await page.keyboard.press('Enter');
  // 上へ数マス進んでから左へ曲がると、左の壁（10 マス以上先）まで進む
  await tap('ArrowUp');
  await page.waitForTimeout(500);
  await tap('ArrowLeft');
  // 右へ進み続けた場合にぶつかる時間（約 1.5 秒）を過ぎてもまだ生きている
  await page.waitForTimeout(1200);
  expect(await overs()).toEqual([]);
  await expect.poll(overs, { timeout: 10_000 }).toEqual([{ event: 'game_over', game_id: 'snake', score: 0 }]);
});
