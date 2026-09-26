import { describe, expect, it } from 'vitest';
import * as T from './logic';

describe('SHAPES', () => {
  it('7 種 × 4 回転、各 4 セル、座標は 0..3', () => {
    expect(T.SHAPES.length, 'ミノは7種').toBe(7);
    for (let t = 0; t < 7; t++) {
      expect(T.SHAPES[t].length, `type ${t + 1} は4回転`).toBe(4);
      for (let r = 0; r < 4; r++) {
        const cells = T.SHAPES[t][r];
        expect(cells.length, `type ${t + 1} rot ${r} は4セル`).toBe(4);
        for (const c of cells) expect(c[0] >= 0 && c[0] <= 3 && c[1] >= 0 && c[1] <= 3, '座標は0..3に収まる').toBe(true);
      }
    }
  });

  it('O ミノは回転しても同じ形', () => {
    const oSet = T.SHAPES[1].map((r) => r.map((c) => c.join(',')).sort().join(' '));
    expect(oSet.every((s) => s === oSet[0]), 'Oミノは回転しても同じ形').toBe(true);
  });
});

describe('createBoard', () => {
  it('指定サイズの空盤面を作る', () => {
    const empty = T.createBoard(10, 20);
    expect(empty.length, '20行').toBe(20);
    expect(empty[0].length, '10列').toBe(10);
    expect(empty.every((row) => row.every((v) => v === 0)), '全セル0').toBe(true);
  });
});

describe('canPlace: 盤外', () => {
  const flat: T.Board = [
    [0, 0, 0],
    [0, 0, 0],
  ]; // 3列 × 2行
  const dot: T.Cell[] = [[0, 0]];

  it('空盤面の内側は置ける', () => {
    expect(T.canPlace(flat, dot, 0, 0)).toBe(true);
  });
  it('左の盤外は不可', () => {
    expect(T.canPlace(flat, dot, -1, 0)).toBe(false);
  });
  it('右の盤外は不可', () => {
    expect(T.canPlace(flat, dot, 3, 0)).toBe(false);
  });
  it('床より下は不可', () => {
    expect(T.canPlace(flat, dot, 0, 2)).toBe(false);
  });
  it('盤面より上は空として扱う', () => {
    expect(T.canPlace(flat, dot, 0, -1)).toBe(true);
  });
});

describe('canPlace: 既存ブロックとの衝突', () => {
  const occupied: T.Board = [
    [0, 0, 0],
    [0, 5, 0],
  ];
  const dot: T.Cell[] = [[0, 0]];

  it('埋まったセルには置けない', () => {
    expect(T.canPlace(occupied, dot, 1, 1)).toBe(false);
  });
  it('空いたセルには置ける', () => {
    expect(T.canPlace(occupied, dot, 0, 1)).toBe(true);
  });
});

describe('回転時の衝突: 右壁際で I ミノを縦(rot1)から横(rot2)にできない', () => {
  const board10 = T.createBoard(10, 20);

  it('右壁にめり込む回転は不可', () => {
    // I の rot0/rot2 は x 方向に 0..3 を占める。x=7 なら列7..10 → 列10は盤外
    expect(T.canPlace(board10, T.SHAPES[0][0], 7, 0)).toBe(false);
  });
  it('収まる位置なら可', () => {
    expect(T.canPlace(board10, T.SHAPES[0][0], 6, 0)).toBe(true);
  });
});

describe('merge: 元の盤面を変更せず、新しい盤面を返す', () => {
  const base = T.createBoard(3, 3);
  const merged = T.merge(
    base,
    [
      [0, 0],
      [1, 0],
    ],
    1,
    2,
    4,
  );

  it('merge は元の盤面を変更しない', () => {
    expect(base[2][1]).toBe(0);
    expect(base[2][2]).toBe(0);
  });
  it('指定した色インデックスで固定される', () => {
    expect(merged[2][1]).toBe(4);
    expect(merged[2][2]).toBe(4);
  });
  it('関係ないセルは空のまま', () => {
    expect(merged[0][0]).toBe(0);
  });
  it('by=0 のセルだけ書き込まれる', () => {
    // 盤面より上のセルは書き込まれない（例外にもならない）
    const above = T.merge(
      T.createBoard(3, 3),
      [
        [0, 0],
        [0, 1],
      ],
      0,
      -1,
      6,
    );
    expect(above[0][0]).toBe(6);
  });
});

describe('clearLines: 1行消去で上の行が降りてくる', () => {
  const one: T.Board = [
    [0, 0, 0],
    [7, 0, 0],
    [1, 2, 3],
  ];
  const r1 = T.clearLines(one);

  it('1行消去', () => {
    expect(r1.cleared).toBe(1);
  });
  it('行数は変わらない', () => {
    expect(r1.board.length).toBe(3);
  });
  it('上の行が降りてくる', () => {
    expect(r1.board[2]).toEqual([7, 0, 0]);
  });
  it('最上段は空になる', () => {
    expect(r1.board[0]).toEqual([0, 0, 0]);
  });
});

describe('clearLines: 4行同時消去', () => {
  const four = T.createBoard(4, 6);
  for (let y = 2; y < 6; y++) four[y] = [1, 1, 1, 1];
  four[1] = [0, 9, 0, 0];
  const r4 = T.clearLines(four);

  it('4行同時消去', () => {
    expect(r4.cleared).toBe(4);
  });
  it('残った行が最下段に降りる', () => {
    expect(r4.board[5]).toEqual([0, 9, 0, 0]);
  });
  it('上は全部空', () => {
    expect(r4.board.slice(0, 5).every((row) => row.every((v) => v === 0))).toBe(true);
  });
});

describe('clearLines: 消去が無ければ盤面は変わらない', () => {
  const none: T.Board = [
    [0, 0],
    [1, 0],
  ];
  const r0 = T.clearLines(none);

  it('消去なし', () => {
    expect(r0.cleared).toBe(0);
  });
  it('盤面は変わらない', () => {
    expect(r0.board).toEqual(none);
  });
});

describe('lineScore: 1/2/3/4列 × レベル', () => {
  it('消去0なら0点', () => {
    expect(T.lineScore(0, 5)).toBe(0);
  });
  it('1列 × Lv1', () => {
    expect(T.lineScore(1, 1)).toBe(100);
  });
  it('2列 × Lv1', () => {
    expect(T.lineScore(2, 1)).toBe(300);
  });
  it('3列 × Lv1', () => {
    expect(T.lineScore(3, 1)).toBe(500);
  });
  it('4列 × Lv1', () => {
    expect(T.lineScore(4, 1)).toBe(800);
  });
  it('レベル倍率が掛かる (4列 × Lv2)', () => {
    expect(T.lineScore(4, 2)).toBe(1600);
  });
  it('レベル倍率が掛かる (1列 × Lv3)', () => {
    expect(T.lineScore(1, 3)).toBe(300);
  });
});

describe('levelFor: 10ラインごとに+1、レベル1開始', () => {
  it('0ラインはレベル1', () => {
    expect(T.levelFor(0)).toBe(1);
  });
  it('9ラインはまだレベル1', () => {
    expect(T.levelFor(9)).toBe(1);
  });
  it('10ラインでレベル2', () => {
    expect(T.levelFor(10)).toBe(2);
  });
  it('25ラインでレベル3', () => {
    expect(T.levelFor(25)).toBe(3);
  });
});

describe('dropInterval: レベル1で0.8秒、単調非増加、下限0.08', () => {
  it('レベル1は0.8秒', () => {
    expect(Math.abs(T.dropInterval(1) - 0.8) < 1e-9).toBe(true);
  });

  it('単調非増加で下限0.08を下回らない', () => {
    let prev = T.dropInterval(1);
    for (let lv = 2; lv <= 30; lv++) {
      const cur = T.dropInterval(lv);
      expect(cur <= prev, `レベル${lv}で間隔が増えない`).toBe(true);
      expect(cur >= 0.08 - 1e-9, `レベル${lv}で下限0.08を下回らない`).toBe(true);
      prev = cur;
    }
  });

  it('レベルが上がると速くなる', () => {
    expect(T.dropInterval(5) < T.dropInterval(1)).toBe(true);
  });

  it('高レベルでは下限に張り付く', () => {
    expect(Math.abs(T.dropInterval(30) - 0.08) < 1e-9).toBe(true);
  });
});
