import { expect, test } from '@playwright/test';
import { gameSlugs, watchPage } from './helpers';

const slugs = gameSlugs();

test('トップページ: 外部通信・CSP 違反・JS エラーがない', async ({ page }) => {
  const w = watchPage(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creator World Games');
  expect(w.external).toEqual([]);
  expect(w.cspViolations).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('CSP などのセキュリティヘッダーが付く', async ({ page }) => {
  const res = await page.goto('/');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("connect-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
});

for (const path of ['/about/', '/privacy/', '/robots.txt', '/sitemap-index.xml', '/ads.txt']) {
  test(`${path} が 200 を返す`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(200);
  });
}

test('存在しないページは 404', async ({ request }) => {
  expect((await request.get('/no-such-page/')).status()).toBe(404);
});

test('トップにすべてのゲームのカードがあり、BEST を表示する', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.game-card')).toHaveCount(slugs.length);
  for (const slug of slugs) {
    await expect(page.locator(`.game-card[data-slug="${slug}"] [data-best]`)).toHaveText('BEST 0');
  }
});

test('サイトマップに全ゲームのページが含まれる', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  const child = /<loc>https:\/\/browser-games\.creator-world\.net\/([^<]+)<\/loc>/.exec(index)![1];
  const xml = await (await request.get(`/${child}`)).text();
  for (const slug of slugs) expect(xml).toContain(`/games/${slug}/`);
  expect(xml).toContain('/about/');
});

test('環境変数なしのビルドでは広告枠と GTM を出力しない', async ({ page }) => {
  test.skip(slugs.length === 0, 'ゲームがまだない');
  await page.goto(`/games/${slugs[0]}/`);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  await expect(page.locator('[data-gtm-id]')).toHaveCount(0);
});

test('各ページの title・description・canonical が一意', async ({ page }) => {
  const seen = new Set<string>();
  for (const path of ['/', '/about/', '/privacy/', ...slugs.map((s) => `/games/${s}/`)]) {
    await page.goto(path);
    const title = await page.title();
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`https://browser-games.creator-world.net${path}`);
    for (const v of [title, desc]) {
      expect(seen.has(v!), `${path}: 重複 ${v}`).toBe(false);
      seen.add(v!);
    }
  }
});

for (const slug of slugs) {
  test(`${slug}: ページ表示で外部通信・CSP 違反・JS エラーがない`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(`/games/${slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(`[data-game="${slug}"] [data-stage] > *`).first()).toBeVisible();
    expect(w.external).toEqual([]);
    expect(w.cspViolations).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test(`${slug}: パンくずのリンクにフォーカスして Enter でトップへ移動できる`, async ({ page }) => {
    await page.goto(`/games/${slug}/`);
    await page.locator('.breadcrumb a[href="/"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/');
  });

  test(`${slug}: 「戻る」で戻ってもゲームが表示され、JS エラーがない`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(`/games/${slug}/`);
    await page.goto('/about/');
    await page.goBack();
    await expect(page.locator(`[data-game="${slug}"] [data-stage] > *`).first()).toBeVisible();
    expect(w.errors).toEqual([]);
  });
}
