import { describe, expect, it } from 'vitest';
import { bootGtm, CONSENT_REGIONS, isGtmId } from './gtm';

function fakeEnv() {
  const inserted: { src: string; async: boolean }[] = [];
  const win: { dataLayer?: unknown[] } = {};
  const doc = {
    createElement: () => ({ src: '', async: false }),
    head: { append: (el: { src: string; async: boolean }) => inserted.push(el) },
  };
  return { win, doc, inserted };
}

const entries = (dl: unknown[] | undefined) =>
  (dl ?? []).map((e) => (typeof e === 'object' && e !== null && 'length' in e ? Array.from(e as ArrayLike<unknown>) : e));

describe('isGtmId', () => {
  it('GTM- で始まる英大文字・数字だけを受け付ける', () => {
    expect(isGtmId('GTM-ABC123')).toBe(true);
    expect(isGtmId('gtm-abc')).toBe(false);
    expect(isGtmId('GTM-"><script>')).toBe(false);
    expect(isGtmId('')).toBe(false);
  });
});

describe('bootGtm', () => {
  it('同意の初期値を送ってから GTM を読み込む', () => {
    const { win, doc, inserted } = fakeEnv();
    expect(bootGtm(win, doc, 'GTM-ABC123', () => 1000)).toBe(true);
    const dl = entries(win.dataLayer);
    expect(dl[0]).toEqual([
      'consent',
      'default',
      { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' },
    ]);
    expect(dl[1]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        region: CONSENT_REGIONS,
        wait_for_update: 500,
      },
    ]);
    expect(dl[2]).toEqual({ 'gtm.start': 1000, event: 'gtm.js' });
    expect(inserted).toEqual([{ src: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123', async: true }]);
  });

  it('gtag の呼び出しは配列ではなく arguments オブジェクトとして積む（GTM の仕様）', () => {
    const { win, doc } = fakeEnv();
    bootGtm(win, doc, 'GTM-ABC123');
    expect(Array.isArray(win.dataLayer![0])).toBe(false);
    expect(Object.prototype.toString.call(win.dataLayer![0])).toBe('[object Arguments]');
  });

  it('既存の dataLayer を引き継ぐ', () => {
    const { win, doc } = fakeEnv();
    win.dataLayer = [{ event: 'before' }];
    bootGtm(win, doc, 'GTM-ABC123');
    expect(win.dataLayer[0]).toEqual({ event: 'before' });
  });

  it('不正な ID なら何もしない', () => {
    const { win, doc, inserted } = fakeEnv();
    expect(bootGtm(win, doc, 'UA-123')).toBe(false);
    expect(win.dataLayer).toBeUndefined();
    expect(inserted).toEqual([]);
  });

  it('同意が必要な地域に EEA・英国・スイスを含む', () => {
    for (const code of ['DE', 'FR', 'IS', 'LI', 'NO', 'GB', 'CH']) expect(CONSENT_REGIONS).toContain(code);
    expect(CONSENT_REGIONS).not.toContain('JP');
    expect(CONSENT_REGIONS).toHaveLength(32);
  });
});
