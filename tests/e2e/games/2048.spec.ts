import { expect, type Page, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

const hasOver = async (page: Page) => (await dataLayerEvents(page)).some((e) => (e as { event: string }).event === 'game_over');

// 寄せる操作は押した瞬間をフレームごとに検出するため、1 フレーム以上押し続ける
async function press(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(40);
  await page.keyboard.up(key);
  await page.waitForTimeout(20);
}

test('2048: 最初にタイルを動かしたときに game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/2048/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter'); // プレイ中の Enter では何も送らない
  expect(await dataLayerEvents(page)).toEqual([]);
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) await press(page, key);
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: '2048' }]);
});

test('2048: スワイプでタイルを動かせる', async ({ page }) => {
  await page.goto('/games/2048/');
  const box = (await page.locator('[data-stage] canvas').boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  // 盤面の向きによっては動かないので、4 方向にスワイプする
  for (const [dx, dy] of [
    [-80, 0],
    [0, -80],
    [80, 0],
    [0, 80],
  ]) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
    await page.mouse.up();
  }
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: '2048' }]);
});

test('2048: 動かせなくなるとゲームオーバーになり game_over を 1 回送る', async ({ page }) => {
  test.setTimeout(90_000);
  // 新しいタイルを「左上から最初の空きマスに 4」に固定して、決まった手順で必ず詰むようにする
  await page.addInitScript(() => {
    Math.random = () => 0.05;
  });
  await page.goto('/games/2048/');
  await page.locator('h1').click();
  const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
  for (let i = 0; i < 400 && !(await hasOver(page)); i++) await press(page, keys[i % 4]);
  const overs = (await dataLayerEvents(page)).filter((e) => (e as { event: string }).event === 'game_over');
  expect(overs).toHaveLength(1);
  expect(overs[0]).toMatchObject({ game_id: '2048', score: expect.any(Number) });
  expect((overs[0] as { score: number }).score).toBeGreaterThan(0);

  // ゲームオーバー後は Enter で新しい盤面になり、次に動かしたときに game_start が送られる
  await page.keyboard.press('Enter');
  for (const key of keys) await press(page, key);
  const starts = (await dataLayerEvents(page)).filter((e) => (e as { event: string }).event === 'game_start');
  expect(starts).toHaveLength(2);
});
