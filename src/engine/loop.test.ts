import { describe, expect, it } from 'vitest';
import { createLoop, type LoopEnv } from './loop';

function fakeEnv() {
  const queue: ((ts: number) => void)[] = [];
  let cancelled = 0;
  const env: LoopEnv & { hidden: boolean } = {
    hidden: false,
    requestAnimationFrame: (cb) => queue.push(cb),
    cancelAnimationFrame: () => void cancelled++,
    isHidden() {
      return env.hidden;
    },
  };
  const tick = (ts: number) => queue.shift()!(ts);
  return { env, tick, get cancelled() { return cancelled; } };
}

describe('createLoop', () => {
  it('初回は dt=0、以降は秒単位の差分を渡し、0.05 秒で頭打ちにする', () => {
    const f = fakeEnv();
    const dts: number[] = [];
    createLoop((dt) => dts.push(dt), f.env);
    f.tick(1000);
    f.tick(1016);
    f.tick(2000);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBe(0.05);
  });

  it('タブが非表示の間は呼ばず、復帰後の最初のフレームは dt=0', () => {
    const f = fakeEnv();
    const dts: number[] = [];
    createLoop((dt) => dts.push(dt), f.env);
    f.tick(0);
    f.env.hidden = true;
    f.tick(16);
    f.env.hidden = false;
    f.tick(5000);
    expect(dts).toEqual([0, 0]);
  });

  it('stop 後は呼ばない', () => {
    const f = fakeEnv();
    let calls = 0;
    const h = createLoop(() => void calls++, f.env);
    h.stop();
    f.tick(0);
    expect(calls).toBe(0);
    expect(f.cancelled).toBe(1);
  });
});
