// AdSense の広告枠（<ins class="adsbygoogle">）を 1 つずつ有効にする。

interface SlotLike {
  setAttribute(name: string, value: string): void;
}

interface AdsWindow {
  adsbygoogle?: unknown[] | { push(x: unknown): void };
}

/** 処理できた枠の数を返す。1 つの枠で AdSense がエラーを投げても、残りの枠は処理する */
export function pushAdSlots(slots: Iterable<SlotLike>, win: AdsWindow): number {
  let pushed = 0;
  for (const el of slots) {
    el.setAttribute('data-cwg-pushed', '');
    try {
      // スクリプトの読み込み前は配列に積んでおくと、読み込み後に AdSense が処理する
      (win.adsbygoogle = win.adsbygoogle ?? []).push({});
      pushed++;
    } catch {
      // 表示幅が取れない等で AdSense がエラーを投げた枠は諦める（ページの他の処理は止めない）
    }
  }
  return pushed;
}
