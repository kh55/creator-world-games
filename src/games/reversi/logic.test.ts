import { describe, expect, it } from 'vitest';
import {
  applyMove,
  BLACK,
  type Board,
  cellName,
  chooseCpuMove,
  count,
  createBoard,
  EMPTY,
  finalScore,
  flipsFor,
  legalMoves,
  nextTurn,
  WHITE,
} from './logic';

/** 8 文字 × 8 行の文字列から盤面を作る（. = 空、B = 黒、W = 白） */
function parse(rows: string[]): Board {
  return rows.map((r) => [...r].map((ch) => (ch === 'B' ? BLACK : ch === 'W' ? WHITE : EMPTY)));
}

const EMPTY_ROW = '........';

describe('createBoard / cellName', () => {
  it('中央 4 マスの初期配置（d4・e5 が白、d5・e4 が黒）', () => {
    const b = createBoard();
    expect(b).toHaveLength(8);
    expect(b.every((row) => row.length === 8)).toBe(true);
    expect(b[3][3]).toBe(WHITE); // d4
    expect(b[4][4]).toBe(WHITE); // e5
    expect(b[4][3]).toBe(BLACK); // d5
    expect(b[3][4]).toBe(BLACK); // e4
    expect(count(b)).toEqual({ black: 2, white: 2 });
  });

  it('座標名は左上が a1', () => {
    expect(cellName(0, 0)).toBe('a1');
    expect(cellName(3, 2)).toBe('d3');
    expect(cellName(7, 7)).toBe('h8');
  });
});

describe('legalMoves / flipsFor', () => {
  it('初期配置で黒が置けるのは d3・c4・f5・e6（行優先の順）', () => {
    const moves = legalMoves(createBoard(), BLACK);
    expect(moves.map(([x, y]) => cellName(x, y))).toEqual(['d3', 'c4', 'f5', 'e6']);
  });

  it('8 方向すべての石を裏返す', () => {
    const b = parse([
      'B..B..B.',
      '.W.W.W..',
      '..WWW...',
      'BWW.WWB.',
      '..WWW...',
      '.W.W.W..',
      'B..B..B.',
      EMPTY_ROW,
    ]);
    const flips = flipsFor(b, 3, 3, BLACK).map(([x, y]) => cellName(x, y)).sort();
    expect(flips).toEqual(
      ['b2', 'c3', 'd2', 'd3', 'f2', 'e3', 'b4', 'c4', 'e4', 'f4', 'c5', 'b6', 'd5', 'd6', 'e5', 'f6'].sort(),
    );
  });

  it('盤の端までで相手の石が途切れない方向は裏返さない', () => {
    const b = parse(['.WWWWWWW', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
    expect(flipsFor(b, 0, 0, BLACK)).toEqual([]);
  });

  it('空きでないマスや、1 枚も裏返せないマスには置けない', () => {
    const b = createBoard();
    expect(flipsFor(b, 3, 3, BLACK)).toEqual([]); // d4 は石がある
    expect(flipsFor(b, 0, 0, BLACK)).toEqual([]); // a1 は何も挟めない
  });
});

describe('applyMove / count', () => {
  it('置いて裏返した新しい盤面を返し、元の盤面は変えない', () => {
    const b = createBoard();
    const after = applyMove(b, 3, 2, BLACK); // d3
    expect(after[2][3]).toBe(BLACK);
    expect(after[3][3]).toBe(BLACK); // d4 が裏返る
    expect(count(after)).toEqual({ black: 4, white: 1 });
    expect(b[2][3]).toBe(EMPTY);
    expect(b[3][3]).toBe(WHITE);
  });

  it('置けない手なら同じ内容の新しい盤面を返す（例外を投げない）', () => {
    const b = createBoard();
    const after = applyMove(b, 0, 0, BLACK);
    expect(after).toEqual(b);
    expect(after).not.toBe(b);
  });
});

describe('nextTurn', () => {
  it('相手に置き場があれば相手の番', () => {
    const b = applyMove(createBoard(), 3, 2, BLACK);
    expect(nextTurn(b, BLACK)).toBe(WHITE);
  });

  it('相手に置き場がなく自分にあればパス（直前の側がもう一度）', () => {
    // 白 b1 は黒 a1（角）に挟めず、黒は c1 に置ける
    const b = parse(['BW......', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
    expect(legalMoves(b, WHITE)).toEqual([]);
    expect(nextTurn(b, BLACK)).toBe(BLACK);
    expect(nextTurn(b, WHITE)).toBe(BLACK);
  });

  it('両者とも置けなければ終局（null）', () => {
    const b = parse(['B.......', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
    expect(nextTurn(b, BLACK)).toBeNull();
    expect(nextTurn(b, WHITE)).toBeNull();
  });
});

describe('chooseCpuMove', () => {
  it('置ける角があれば角を選ぶ', () => {
    // 白は a1（b2 の黒を挟む角）、c4（d4 の黒を横に挟む）、e5（d4 の黒を斜めに挟む）に置ける
    const b = parse([
      EMPTY_ROW,
      '.B......',
      '..W.....',
      '...BW...',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
    ]);
    expect(legalMoves(b, WHITE).map(([x, y]) => cellName(x, y))).toEqual(['a1', 'c4', 'e5']);
    expect(chooseCpuMove(b, WHITE, () => 0.99)).toEqual([0, 0]);
  });

  it('置き場がなければ null', () => {
    const b = parse(['BW......', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
    expect(chooseCpuMove(b, WHITE)).toBeNull();
  });

  it('同じ評価の手が複数あれば random で選び、どれも合法手', () => {
    // 初期配置の白の合法手は対称で評価が同じ
    const b = applyMove(createBoard(), 3, 2, BLACK);
    const legal = legalMoves(b, WHITE).map((m) => m.join(','));
    const a = chooseCpuMove(b, WHITE, () => 0)!;
    const z = chooseCpuMove(b, WHITE, () => 0.999)!;
    expect(legal).toContain(a.join(','));
    expect(legal).toContain(z.join(','));
  });
});

describe('finalScore', () => {
  const fill = (black: number, white: number): Board => {
    const cells: number[] = [...Array(black).fill(BLACK), ...Array(white).fill(WHITE)];
    while (cells.length < 64) cells.push(EMPTY);
    return Array.from({ length: 8 }, (_, y) => cells.slice(y * 8, y * 8 + 8) as Board[number]);
  };

  it('黒の勝ちなら黒の石数', () => {
    expect(finalScore(fill(42, 22))).toBe(42);
  });

  it('負けは 0', () => {
    expect(finalScore(fill(20, 44))).toBe(0);
  });

  it('引き分けは 0', () => {
    expect(finalScore(fill(32, 32))).toBe(0);
  });
});
