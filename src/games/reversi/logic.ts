// リバーシのルールと CPU。DOM を使わない純粋な関数だけを置く。盤面は board[y][x]。

export type Cell = 0 | 1 | 2;
export type Color = 1 | 2;
export type Board = Cell[][];
export type Move = [number, number]; // [x, y]

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
const SIZE = 8;

const DIRS: Move[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** マスの価値（角は高く、角の隣は低い） */
const WEIGHTS: number[][] = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, -1, -1, -1, -1, -2, 10],
  [5, -2, -1, -1, -1, -1, -2, 5],
  [5, -2, -1, -1, -1, -1, -2, 5],
  [10, -2, -1, -1, -1, -1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

export function opponent(color: Color): Color {
  return color === BLACK ? WHITE : BLACK;
}

export function cellName(x: number, y: number): string {
  return 'abcdefgh'[x] + String(y + 1);
}

export function createBoard(): Board {
  const b: Board = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(EMPTY));
  b[3][3] = WHITE;
  b[4][4] = WHITE;
  b[4][3] = BLACK;
  b[3][4] = BLACK;
  return b;
}

function inside(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function flipsFor(board: Board, x: number, y: number, color: Color): Move[] {
  if (!inside(x, y) || board[y][x] !== EMPTY) return [];
  const other = opponent(color);
  const result: Move[] = [];
  for (const [dx, dy] of DIRS) {
    const line: Move[] = [];
    let cx = x + dx;
    let cy = y + dy;
    while (inside(cx, cy) && board[cy][cx] === other) {
      line.push([cx, cy]);
      cx += dx;
      cy += dy;
    }
    if (line.length > 0 && inside(cx, cy) && board[cy][cx] === color) result.push(...line);
  }
  return result;
}

export function legalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (flipsFor(board, x, y, color).length > 0) moves.push([x, y]);
    }
  }
  return moves;
}

export function applyMove(board: Board, x: number, y: number, color: Color): Board {
  const next = board.map((row) => row.slice());
  const flips = flipsFor(board, x, y, color);
  if (flips.length === 0) return next;
  next[y][x] = color;
  for (const [fx, fy] of flips) next[fy][fx] = color;
  return next;
}

export function count(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const c of row) {
      if (c === BLACK) black++;
      else if (c === WHITE) white++;
    }
  }
  return { black, white };
}

/** 次の手番。相手が置けなければパスして直前の側、どちらも置けなければ null（終局） */
export function nextTurn(board: Board, justMoved: Color): Color | null {
  const other = opponent(justMoved);
  if (legalMoves(board, other).length > 0) return other;
  if (legalMoves(board, justMoved).length > 0) return justMoved;
  return null;
}

function evaluate(board: Board, color: Color): number {
  let score = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === color) score += WEIGHTS[y][x];
      else if (board[y][x] !== EMPTY) score -= WEIGHTS[y][x];
    }
  }
  return score;
}

const isCorner = ([x, y]: Move) => (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1);

/**
 * 2 手読み: 自分の手に対する相手の最善の応手を想定し、評価が最大になる手を選ぶ。
 * 置ける角があれば候補を角に絞る（評価表だけだと、相手の X 打ちを残す手を角より高く見ることがあるため）。
 */
export function chooseCpuMove(board: Board, color: Color, random: () => number = Math.random): Move | null {
  const legal = legalMoves(board, color);
  if (legal.length === 0) return null;
  const corners = legal.filter(isCorner);
  const moves = corners.length > 0 ? corners : legal;
  const other = opponent(color);
  let best = -Infinity;
  let bestMoves: Move[] = [];
  for (const [x, y] of moves) {
    const after = applyMove(board, x, y, color);
    const replies = legalMoves(after, other);
    let value: number;
    if (replies.length === 0) {
      value = evaluate(after, color);
    } else {
      value = Infinity;
      for (const [rx, ry] of replies) {
        value = Math.min(value, evaluate(applyMove(after, rx, ry, other), color));
      }
    }
    if (value > best) {
      best = value;
      bestMoves = [[x, y]];
    } else if (value === best) {
      bestMoves.push([x, y]);
    }
  }
  const i = Math.min(bestMoves.length - 1, Math.floor(random() * bestMoves.length));
  return bestMoves[i];
}

/** 黒（プレイヤー）が勝っていれば黒の石数、負け・引き分けは 0 */
export function finalScore(board: Board): number {
  const { black, white } = count(board);
  return black > white ? black : 0;
}
