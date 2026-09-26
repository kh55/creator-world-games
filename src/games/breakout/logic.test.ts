import { describe, expect, it } from 'vitest';
import { hitBrick, reflectPaddle } from './logic';

describe('reflectPaddle', () => {
  it('中央に当たるとほぼ真上へ', () => {
    const c = reflectPaddle(100, 80, 40, 300);
    expect(Math.abs(c.vx)).toBeLessThan(1e-6);
    expect(c.vy).toBeLessThan(0);
  });

  it('右寄りに当たると右上へ、速度の大きさは保つ', () => {
    const r = reflectPaddle(118, 80, 40, 300);
    expect(r.vx).toBeGreaterThan(0);
    expect(r.vy).toBeLessThan(0);
    expect(Math.abs(Math.hypot(r.vx, r.vy) - 300)).toBeLessThan(1);
  });
});

describe('hitBrick', () => {
  const brick = { x: 0, y: 0, w: 40, h: 20 };

  it('下面に接触すると縦に反射', () => {
    expect(hitBrick({ x: 20, y: 24, r: 6, vx: 0, vy: -100 }, brick)).toBe('y');
  });

  it('左面に接触すると横に反射', () => {
    expect(hitBrick({ x: -4, y: 10, r: 6, vx: 100, vy: 0 }, brick)).toBe('x');
  });

  it('離れていれば衝突しない', () => {
    expect(hitBrick({ x: 200, y: 200, r: 6, vx: 0, vy: 0 }, brick)).toBeNull();
    expect(hitBrick({ x: 20, y: 30, r: 6, vx: 0, vy: -100 }, brick)).toBeNull();
  });
});
