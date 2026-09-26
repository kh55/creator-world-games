import { describe, expect, it } from 'vitest';
import { aabb, scoreForRow, UFO_SCORES } from './logic';

describe('invader logic', () => {
  it('段ごとの得点: 1 段目 30、2〜3 段目 20、4〜5 段目 10', () => {
    expect([0, 1, 2, 3, 4].map(scoreForRow)).toEqual([30, 20, 20, 10, 10]);
  });

  it('UFO の得点は 4 通り', () => {
    expect(UFO_SCORES).toEqual([50, 100, 150, 300]);
  });

  it('aabb: 重なりを判定し、辺が接しているだけなら重ならない', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(aabb(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(aabb(a, { x: 0, y: 20, w: 10, h: 10 })).toBe(false);
  });
});
