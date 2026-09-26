// ビルド後に dist/_headers（Cloudflare Pages のレスポンスヘッダー）と dist/ads.txt を生成する。
// 環境変数で広告・解析の有無が変わるため、public/ に固定ファイルとして置かずにここで作る。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CF_ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const CF_ANALYTICS_BEACON = 'https://cloudflareinsights.com';

/** @param {Record<string, string | undefined>} env */
export function buildCsp(env) {
  const script = ["'self'"];
  const connect = ["'self'"];
  const img = ["'self'", 'data:', 'blob:'];
  let frame = ["'none'"];

  if (env.PUBLIC_CF_ANALYTICS_TOKEN) {
    script.push(CF_ANALYTICS_SCRIPT);
    connect.push(CF_ANALYTICS_BEACON);
  }
  if (env.PUBLIC_ADSENSE_CLIENT || env.PUBLIC_GTM_ID) {
    // AdSense や GTM（GA4 など）は国別ドメインを含む多数の Google ドメインから配信されるため、
    // ドメインを列挙する CSP は保守できない。これらを有効にしたときは https を広く許可し、
    // 入力データを送らないことはコード側（no-network.test.ts）と E2E（外部タグなしビルドで外部通信ゼロ）で担保する。
    script.push("'unsafe-inline'", 'https:');
    connect.push('https:');
    img.push('https:');
    frame = ['https:'];
  }

  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${frame.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** @param {Record<string, string | undefined>} env */
export function buildHeaders(env) {
  return [
    '/*',
    `  Content-Security-Policy: ${buildCsp(env)}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    '',
  ].join('\n');
}

/** @param {Record<string, string | undefined>} env */
export function buildAdsTxt(env) {
  const client = env.PUBLIC_ADSENSE_CLIENT;
  if (!client) return '';
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env がなければ環境変数だけを使う
  }
  const dist = new URL('../dist/', import.meta.url);
  writeFileSync(new URL('_headers', dist), buildHeaders(process.env));
  writeFileSync(new URL('ads.txt', dist), buildAdsTxt(process.env));
  console.log('postbuild: dist/_headers と dist/ads.txt を生成しました');
}
