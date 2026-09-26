import { describe, expect, it } from 'vitest';
import { pushAdSlots } from './ads';

function fakeSlot() {
  const attrs = new Set<string>();
  return {
    attrs,
    setAttribute: (name: string) => attrs.add(name),
  };
}

describe('pushAdSlots', () => {
  it('まだ処理していない広告枠ごとに 1 回ずつ push する', () => {
    const slots = [fakeSlot(), fakeSlot()];
    const queue: unknown[] = [];
    const win: { adsbygoogle?: { push(x: unknown): void } } = { adsbygoogle: { push: (x) => queue.push(x) } };
    expect(pushAdSlots(slots, win)).toBe(2);
    expect(queue).toHaveLength(2);
    for (const s of slots) expect(s.attrs.has('data-cwg-pushed')).toBe(true);
  });

  it('1 つの枠で AdSense がエラーを投げても、残りの枠は処理する', () => {
    const slots = [fakeSlot(), fakeSlot()];
    let calls = 0;
    const win = {
      adsbygoogle: {
        push() {
          calls++;
          if (calls === 1) throw new Error('TagError: No slot size for availableWidth=0');
        },
      },
    };
    expect(pushAdSlots(slots, win)).toBe(1);
    expect(calls).toBe(2);
  });

  it('スクリプトの読み込み前は配列を作って積んでおく', () => {
    const win: { adsbygoogle?: unknown[] | { push(x: unknown): void } } = {};
    expect(pushAdSlots([fakeSlot()], win)).toBe(1);
    expect(win.adsbygoogle).toEqual([{}]);
  });
});
