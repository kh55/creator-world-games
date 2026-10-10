// 2048 の盤面ロジック。DOM を使わない。盤面は size×size の数値（0 は空き）で、元の盤面は変更しない。
export type Board = number[][];
export type Dir = 'left' | 'right' | 'up' | 'down';

export const SIZE = 4;
export const GOAL = 2048;
/** 新しく出るタイルが 4 になる確率 */
export const FOUR_RATE = 0.1;

export function createBoard(size = SIZE): Board {
  return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

/** 1 行を左へ寄せて合体させる。同じ数は 1 回の移動で 1 度だけ合体する */
export function slideRow(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const v = tiles[i] * 2;
      out.push(v);
      gained += v;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

function transpose(b: Board): Board {
  return b[0].map((_, x) => b.map((row) => row[x]));
}

/** 盤面を dir の向きへ動かす。moved は 1 マスでも動いたか（動かなければタイルを足さない） */
export function move(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const vertical = dir === 'up' || dir === 'down';
  const reverse = dir === 'right' || dir === 'down';
  let rows = vertical ? transpose(board) : board.map((r) => r.slice());
  let gained = 0;
  rows = rows.map((r) => {
    const src = reverse ? r.slice().reverse() : r;
    const res = slideRow(src);
    gained += res.gained;
    return reverse ? res.row.reverse() : res.row;
  });
  const out = vertical ? transpose(rows) : rows;
  const moved = out.some((row, y) => row.some((v, x) => v !== board[y][x]));
  return { board: out, gained, moved };
}

export function emptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  board.forEach((row, y) => row.forEach((v, x) => v === 0 && cells.push([x, y])));
  return cells;
}

/** 空きマスにタイル（2 か 4）を 1 枚置いた盤面を返す。空きがなければそのまま返す。rnd は [0,1) を返す関数 */
export function addRandomTile(board: Board, rnd: () => number = Math.random): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const [x, y] = cells[Math.min(cells.length - 1, Math.floor(rnd() * cells.length))];
  const out = board.map((r) => r.slice());
  out[y][x] = rnd() < FOUR_RATE ? 4 : 2;
  return out;
}

/** 空きがあるか、隣り合う同じ数があれば、まだ動かせる */
export function canMove(board: Board): boolean {
  const n = board.length;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = board[y][x];
      if (v === 0) return true;
      if (x + 1 < n && board[y][x + 1] === v) return true;
      if (y + 1 < n && board[y + 1][x] === v) return true;
    }
  }
  return false;
}

export function maxTile(board: Board): number {
  return Math.max(...board.map((r) => Math.max(...r)));
}

/** ゲーム開始時の盤面（タイル 2 枚） */
export function newBoard(rnd: () => number = Math.random): Board {
  return addRandomTile(addRandomTile(createBoard(), rnd), rnd);
}
