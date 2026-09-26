export type Cell = [number, number];
export type Board = number[][];

// 7種 × 4回転の形状テーブル（4×4グリッド内の [x, y] 座標）
// 添字は色インデックス-1: 0=I 1=O 2=T 3=S 4=Z 5=J 6=L
export const SHAPES: Cell[][][] = [
  [
    // I
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  ],
  [
    // O
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  [
    // T
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  [
    // S
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  [
    // Z
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
  [
    // J
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  ],
  [
    // L
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  ],
];

export function createBoard(cols: number, rows: number): Board {
  const board: Board = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) row.push(0);
    board.push(row);
  }
  return board;
}

// cells を (x, y) に置けるか。盤面より上（by < 0）は空として扱う
export function canPlace(board: Board, cells: Cell[], x: number, y: number): boolean {
  const rows = board.length,
    cols = board[0].length;
  for (let i = 0; i < cells.length; i++) {
    const bx = x + cells[i][0],
      by = y + cells[i][1];
    if (bx < 0 || bx >= cols) return false;
    if (by >= rows) return false;
    if (by < 0) continue;
    if (board[by][bx] !== 0) return false;
  }
  return true;
}

// cells を盤面に固定した新しい盤面を返す（元の board は変更しない）
export function merge(board: Board, cells: Cell[], x: number, y: number, colorIdx: number): Board {
  const out: Board = [];
  for (let r = 0; r < board.length; r++) out.push(board[r].slice());
  for (let i = 0; i < cells.length; i++) {
    const bx = x + cells[i][0],
      by = y + cells[i][1];
    if (by < 0 || by >= out.length || bx < 0 || bx >= out[0].length) continue;
    out[by][bx] = colorIdx;
  }
  return out;
}

// 埋まった行を消して上を詰めた盤面と消去行数を返す
export function clearLines(board: Board): { board: Board; cleared: number } {
  const cols = board[0].length;
  const kept: Board = [];
  for (let y = 0; y < board.length; y++) {
    let full = true;
    for (let x = 0; x < cols; x++)
      if (board[y][x] === 0) {
        full = false;
        break;
      }
    if (!full) kept.push(board[y].slice());
  }
  const cleared = board.length - kept.length;
  const out: Board = [];
  for (let i = 0; i < cleared; i++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) row.push(0);
    out.push(row);
  }
  return { board: out.concat(kept), cleared: cleared };
}

// 同時消去数とレベルからスコアを算出
export function lineScore(cleared: number, level: number): number {
  const table = [0, 100, 300, 500, 800];
  const base = table[cleared] || 0;
  return base * level;
}

// 累計ライン数からレベルを算出（レベル1開始・10ラインごとに+1）
export function levelFor(totalLines: number): number {
  return 1 + Math.floor(totalLines / 10);
}

// レベルから落下間隔（秒）を算出。下限0.08
export function dropInterval(level: number): number {
  const v = 0.8 - (level - 1) * 0.07;
  return v < 0.08 ? 0.08 : v;
}
