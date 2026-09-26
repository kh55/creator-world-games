import { describe, expect, it } from 'vitest';
import { difficulty, DURATION, HOLES } from './logic';

describe('whack logic', () => {
  it('穴は 9 個、制限時間は 30 秒', () => {
    expect(HOLES).toBe(9);
    expect(DURATION).toBe(30);
  });

  it('時間が進むほど出現間隔と滞在時間が短くなり、下限がある', () => {
    const d0 = difficulty(0);
    const d30 = difficulty(30);
    expect(d0.gap).toBeGreaterThan(d30.gap);
    expect(d30.gap).toBeGreaterThanOrEqual(0.35);
    expect(d0.upMax).toBeGreaterThan(d0.upMin);
    expect(d30.upMax).toBeLessThanOrEqual(d0.upMax);
    expect(d30.upMin).toBeGreaterThanOrEqual(0.4);
  });

  it('現行と同じ値（開始時と 30 秒後）', () => {
    expect(difficulty(0)).toEqual({ gap: 1.1, upMax: 1.3, upMin: 0.9 });
    const end = difficulty(30);
    expect(end.gap).toBeCloseTo(0.35);
    expect(end.upMax).toBeCloseTo(0.7);
    expect(end.upMin).toBeCloseTo(0.4);
  });
});
