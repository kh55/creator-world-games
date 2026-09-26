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

// 「リトライ後の発射で game_start を再送する」（fresh フラグのリセット）は、
// ここでは検証しない。ブロック崩しはボールがパドル中央から真上に発射され、
// パドルを動かして避けても跳ね返ったブロックの反射でボールが左右にドリフトし、
// 静止したパドルの真上にたまたま戻ってきて拾われてしまうことがあり、GAME OVER
// まで確実に・高速に到達させる決定的な操作列を Playwright の実操作
// （keyboard/clock）だけで組むのは非現実的だった（実測: Playwright Clock の
// runFor で物理演算を進めても、左右どちらにパドルを固定してもスコアだけが
// 増え続け、ライフが一向に減らない試行を確認した）。そのため、この項目は
// src/games/breakout/game.test.ts で、api.loop に渡すコールバックと
// api.input.onStart/onPointer に登録されたコールバックを直接呼び出す
// ユニットレベルのテストとして検証する（新規の export は追加していない）。
