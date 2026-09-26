import { describe, expect, it } from 'vitest';
import { buildAdsTxt, buildCsp, buildHeaders } from './postbuild.mjs';

const directive = (csp, name) => csp.split('; ').find((d) => d.startsWith(`${name} `));

describe('buildCsp', () => {
  it('広告・解析なしでは自サイト以外へ通信できない', () => {
    const csp = buildCsp({});
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(csp, 'script-src')).toBe("script-src 'self'");
    expect(directive(csp, 'frame-src')).toBe("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('https:');
  });

  it('解析トークンがあれば Cloudflare Web Analytics だけ許可', () => {
    const csp = buildCsp({ PUBLIC_CF_ANALYTICS_TOKEN: 'abc' });
    expect(directive(csp, 'script-src')).toBe(
      "script-src 'self' https://static.cloudflareinsights.com",
    );
    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' https://cloudflareinsights.com",
    );
  });

  it('AdSense を有効にすると https を広く許可する', () => {
    const csp = buildCsp({ PUBLIC_ADSENSE_CLIENT: 'ca-pub-1' });
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https:");
    expect(directive(csp, 'frame-src')).toBe('frame-src https:');
    expect(directive(csp, 'script-src')).toContain('https:');
  });
});

describe('buildCsp（GTM）', () => {
  it('GTM を有効にすると https を広く許可する（GA4 などのタグを配信するため）', () => {
    const csp = buildCsp({ PUBLIC_GTM_ID: 'GTM-ABC123' });
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https:");
    expect(directive(csp, 'frame-src')).toBe('frame-src https:');
    expect(directive(csp, 'img-src')).toContain('https:');
    expect(directive(csp, 'script-src')).toContain('https:');
  });

  it('GTM と AdSense を両方有効にしても許可が重複しない', () => {
    const csp = buildCsp({ PUBLIC_GTM_ID: 'GTM-ABC123', PUBLIC_ADSENSE_CLIENT: 'ca-pub-1' });
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https:");
  });
});

describe('buildHeaders', () => {
  it('全パスにセキュリティヘッダーを付ける', () => {
    const h = buildHeaders({});
    expect(h.startsWith('/*\n')).toBe(true);
    expect(h).toContain('  Content-Security-Policy: ');
    expect(h).toContain('  X-Content-Type-Options: nosniff');
    expect(h).toContain('  Referrer-Policy: strict-origin-when-cross-origin');
    expect(h).toContain('  Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });
});

describe('buildAdsTxt', () => {
  it('パブリッシャー ID から ads.txt の行を作る', () => {
    expect(buildAdsTxt({ PUBLIC_ADSENSE_CLIENT: 'ca-pub-1234567890' })).toBe(
      'google.com, pub-1234567890, DIRECT, f08c47fec0942fa0\n',
    );
  });

  it('未設定なら空', () => {
    expect(buildAdsTxt({})).toBe('');
  });
});
