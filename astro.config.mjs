import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://browser-games.creator-world.net',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  // CSP で inline script を禁止しているため、小さなスクリプトもインライン化させない
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap()],
});
