import { describe, expect, it } from 'vitest';
import type { GameInput, PointerInfo } from './input';
import { onSwipe, swipeDirection, type SwipeDir } from './swipe';

describe('swipeDirection', () => {
  it('短い移動は null', () => {
    expect(swipeDirection(0, 0)).toBeNull();
    expect(swipeDirection(23, -23)).toBeNull();
  });

  it('大きい方の軸で向きを決める', () => {
    expect(swipeDirection(-30, 5)).toBe('left');
    expect(swipeDirection(30, -5)).toBe('right');
    expect(swipeDirection(5, -30)).toBe('up');
    expect(swipeDirection(-5, 30)).toBe('down');
  });

  it('縦横同じ量なら横を優先する', () => {
    expect(swipeDirection(30, 30)).toBe('right');
  });

  it('しきい値を指定できる', () => {
    expect(swipeDirection(10, 0, 8)).toBe('right');
  });
});

function fakeInput() {
  let cb: ((p: PointerInfo) => void) | null = null;
  const input = { onPointer: (f: (p: PointerInfo) => void) => void (cb = f) } as unknown as GameInput;
  const emit = (type: PointerInfo['type'], x: number, y: number) => cb!({ type, x, y });
  return { input, emit };
}

describe('onSwipe', () => {
  it('しきい値を超えた時点で 1 回だけ発火する', () => {
    const { input, emit } = fakeInput();
    const got: SwipeDir[] = [];
    onSwipe(input, (d) => got.push(d));
    emit('down', 100, 100);
    emit('move', 110, 100);
    emit('move', 140, 100);
    emit('move', 180, 100);
    emit('up', 180, 100);
    expect(got).toEqual(['right']);
  });

  it('押していないときの move や短いタップでは発火しない', () => {
    const { input, emit } = fakeInput();
    const got: SwipeDir[] = [];
    onSwipe(input, (d) => got.push(d));
    emit('move', 0, 0);
    emit('move', 100, 0);
    emit('down', 50, 50);
    emit('up', 55, 52);
    emit('move', 200, 200);
    expect(got).toEqual([]);
  });

  it('onDown が false を返した操作は無視する', () => {
    const { input, emit } = fakeInput();
    const got: SwipeDir[] = [];
    let allow = false;
    onSwipe(input, (d) => got.push(d), () => allow);
    emit('down', 0, 0);
    emit('up', 0, 100);
    allow = true;
    emit('down', 0, 0);
    emit('up', 0, -100);
    expect(got).toEqual(['up']);
  });
});
