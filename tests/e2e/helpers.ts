import { existsSync, readdirSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const ORIGIN = 'http://localhost:8788';

// E2E は広告・解析の環境変数なしでビルドした dist を対象にする
export function gameSlugs(): string[] {
  const dir = 'dist/games';
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function watchPage(page: Page) {
  const external: string[] = [];
  const cspViolations: string[] = [];
  const errors: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== ORIGIN) {
      external.push(req.url());
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) {
      cspViolations.push(msg.text());
    }
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return { external, cspViolations, errors };
}

export async function dataLayerEvents(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    (window.dataLayer ?? []).filter(
      (e) => typeof e === 'object' && e !== null && 'event' in e && String((e as { event: string }).event).startsWith('game_'),
    ),
  );
}
