import { describe, expect, it } from 'vitest';
import { addRandomTile, canMove, createBoard, emptyCells, maxTile, move, newBoard, slideRow } from './logic';

describe('slideRow', () => {
  it('左へ寄せる', () => {
    expect(slideRow([0, 2, 0, 4])).toEqual({ row: [2, 4, 0, 0], gained: 0 });
  });

  it('同じ数を合体させ、合体後の数を得点にする', () => {
    expect(slideRow([2, 2, 0, 0])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
    expect(slideRow([2, 0, 0, 2])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
  });

  it('1 回の移動で同じタイルは 1 度だけ合体する', () => {
    expect(slideRow([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 });
    expect(slideRow([4, 4, 8, 0])).toEqual({ row: [8, 8, 0, 0], gained: 8 });
  });

  it('3 枚並びは進む向きの先頭側から合体する', () => {
    expect(slideRow([2, 2, 2, 0])).toEqual({ row: [4, 2, 0, 0], gained: 4 });
  });
});

describe('move', () => {
  const b = [
    [2, 0, 2, 0],
    [0, 4, 0, 4],
    [2, 0, 0, 0],
    [0, 0, 0, 2],
  ];

  it('左右上下へ動かせる', () => {
    expect(move(b, 'left').board).toEqual([
      [4, 0, 0, 0],
      [8, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    expect(move(b, 'right').board).toEqual([
      [0, 0, 0, 4],
      [0, 0, 0, 8],
      [0, 0, 0, 2],
      [0, 0, 0, 2],
    ]);
    expect(move(b, 'up').board).toEqual([
      [4, 4, 2, 4],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(b, 'down').board).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4],
      [4, 4, 2, 2],
    ]);
  });

  it('得点は合体でできた数の合計', () => {
    expect(move(b, 'left').gained).toBe(12);
    expect(move(b, 'up').gained).toBe(4);
  });

  it('動かないときは moved が false で、元の盤面を変更しない', () => {
    const fixed = [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const copy = fixed.map((r) => r.slice());
    expect(move(fixed, 'left').moved).toBe(false);
    expect(move(fixed, 'up').moved).toBe(false);
    expect(move(fixed, 'right').moved).toBe(true);
    expect(fixed).toEqual(copy);
  });
});

describe('タイルの追加', () => {
  it('空きマスに 2 を置く（rnd が 0.1 以上）', () => {
    const out = addRandomTile(createBoard(), () => 0.5);
    expect(emptyCells(out)).toHaveLength(15);
    expect(maxTile(out)).toBe(2);
  });

  it('rnd が 0.1 未満なら 4 を置く', () => {
    const out = addRandomTile(createBoard(), () => 0.05);
    expect(maxTile(out)).toBe(4);
  });

  it('空きがなければそのまま返す', () => {
    const full = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(addRandomTile(full, () => 0.5)).toBe(full);
  });

  it('開始時はタイルが 2 枚', () => {
    expect(emptyCells(newBoard())).toHaveLength(14);
  });
});

describe('canMove', () => {
  it('空きがあれば動かせる', () => {
    expect(canMove(createBoard())).toBe(true);
  });

  it('満杯でも隣に同じ数があれば動かせる', () => {
    expect(
      canMove([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 8, 8],
      ]),
    ).toBe(true);
    expect(
      canMove([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 8],
        [4, 2, 4, 8],
      ]),
    ).toBe(true);
  });

  it('満杯で隣に同じ数がなければ動かせない', () => {
    expect(
      canMove([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]),
    ).toBe(false);
  });
});
