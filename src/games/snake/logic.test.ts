import { describe, expect, it } from 'vitest';
import { createSnake, enqueueDir, placeFood, type Point, START_LENGTH, step, stepInterval } from './logic';

describe('createSnake', () => {
  it('中央に右向きで START_LENGTH 個並ぶ', () => {
    expect(createSnake(20, 20)).toEqual([
      [10, 10],
      [9, 10],
      [8, 10],
    ]);
    expect(START_LENGTH).toBe(3);
  });
});

describe('enqueueDir', () => {
  it('曲がる向きを追加する', () => {
    expect(enqueueDir([], 'right', 'up')).toEqual(['up']);
    expect(enqueueDir(['up'], 'right', 'left')).toEqual(['up', 'left']);
  });

  it('同じ向き・真逆の向きは捨てる（最後に予定している向きと比べる）', () => {
    expect(enqueueDir([], 'right', 'right')).toEqual([]);
    expect(enqueueDir([], 'right', 'left')).toEqual([]);
    expect(enqueueDir(['up'], 'right', 'down')).toEqual(['up']);
  });

  it('上限を超えて溜めない', () => {
    expect(enqueueDir(['up', 'left'], 'right', 'down')).toEqual(['up', 'left']);
  });
});

describe('step', () => {
  const body: Point[] = [
    [5, 5],
    [4, 5],
    [3, 5],
  ];

  it('向きに 1 マス進み、長さは変わらない', () => {
    expect(step(body, 'right', null, 20, 20)).toEqual({
      body: [
        [6, 5],
        [5, 5],
        [4, 5],
      ],
      ate: false,
      dead: false,
    });
    expect(step(body, 'up', null, 20, 20).body[0]).toEqual([5, 4]);
  });

  it('餌を食べると 1 つ伸びる', () => {
    const r = step(body, 'down', [5, 6], 20, 20);
    expect(r.ate).toBe(true);
    expect(r.body).toHaveLength(4);
    expect(r.body[0]).toEqual([5, 6]);
  });

  it('壁にぶつかると dead', () => {
    expect(step([[0, 0]], 'left', null, 20, 20).dead).toBe(true);
    expect(step([[19, 3]], 'right', null, 20, 20).dead).toBe(true);
    expect(step([[3, 0]], 'up', null, 20, 20).dead).toBe(true);
    expect(step([[3, 19]], 'down', null, 20, 20).dead).toBe(true);
  });

  it('自分の体にぶつかると dead', () => {
    const coiled: Point[] = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
      [4, 6],
    ];
    expect(step(coiled, 'down', null, 20, 20).dead).toBe(true);
  });

  it('同時に動く尾のマスへは進める', () => {
    const square: Point[] = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
    ];
    const r = step(square, 'down', null, 20, 20);
    expect(r.dead).toBe(false);
    expect(r.body[0]).toEqual([5, 6]);
  });

  it('尾のマスに餌があって伸びるときはぶつかる', () => {
    const square: Point[] = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
    ];
    expect(step(square, 'down', [5, 6], 20, 20).dead).toBe(true);
  });
});

describe('placeFood', () => {
  it('体のないマスに置く', () => {
    const body: Point[] = [
      [0, 0],
      [1, 0],
    ];
    expect(placeFood(body, 2, 2, () => 0)).toEqual([0, 1]);
    expect(placeFood(body, 2, 2, () => 0.99)).toEqual([1, 1]);
  });

  it('空きがなければ null', () => {
    const body: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(placeFood(body, 2, 2, () => 0)).toBeNull();
  });
});

describe('stepInterval', () => {
  it('食べるほど速くなり、下限がある', () => {
    expect(stepInterval(0)).toBeCloseTo(0.15);
    expect(stepInterval(10)).toBeCloseTo(0.11);
    expect(stepInterval(100)).toBe(0.06);
  });
});
