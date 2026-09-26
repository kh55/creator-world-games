// Google タグマネージャーの読み込み。公式スニペットは inline script だが、CSP で inline を
// 禁止しているため、同じ処理をバンドルされたスクリプトから実行する。
// GTM より先に同意モード v2 の初期値を送る（EEA・英国・スイスは拒否、それ以外は許可）。
// 同意の更新は AdSense の「プライバシーとメッセージ」（Google 認定 CMP）が行う。

/** 同意が必要な地域（EU 27 か国 + アイスランド・リヒテンシュタイン・ノルウェー + 英国 + スイス） */
export const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
  'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
];

export function isGtmId(id: string): boolean {
  return /^GTM-[A-Z0-9]+$/.test(id);
}

interface GtmWindow {
  dataLayer?: unknown[];
}

interface ScriptLike {
  src: string;
  async: boolean;
}

// テストでは偽物を渡せるよう、document のうち使う部分だけを型にする
interface GtmDocument<E extends ScriptLike> {
  createElement(tag: 'script'): E;
  head: { append(el: E): void };
}

export function bootGtm<E extends ScriptLike>(
  win: GtmWindow,
  doc: GtmDocument<E>,
  id: string,
  now: () => number = Date.now,
): boolean {
  if (!isGtmId(id)) return false;
  const dataLayer = (win.dataLayer = win.dataLayer ?? []);
  // gtag() は配列ではなく arguments オブジェクトを積む必要がある
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  }
  const all = (value: 'granted' | 'denied') => ({
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
  gtag('consent', 'default', all('granted'));
  gtag('consent', 'default', { ...all('denied'), region: CONSENT_REGIONS, wait_for_update: 500 });
  dataLayer.push({ 'gtm.start': now(), event: 'gtm.js' });
  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  doc.head.append(script);
  return true;
}
