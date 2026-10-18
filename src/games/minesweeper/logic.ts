// マインスイーパーの純粋なロジック。盤面は行優先の 1 次元配列（i = y * cols + x）で持ち、関数は Field を直接書き換える。

export const COLS = 10;
export const ROWS = 10;
export const MINES = 15;

export type CellState = 'hidden' | 'open' | 'flag';
/** none = 何も変わらない、opened = マスを開いた、mine = 地雷を開いた */
export type OpenResult = 'none' | 'opened' | 'mine';

export interface Field {
  cols: number;
  rows: number;
  mines: boolean[];
  /** 周りの地雷の数 */
  adjacent: number[];
  state: CellState[];
  /** 地雷を配置済みか（最初に開いたときに配置する） */
  placed: boolean;
}

export function createField(cols: number, rows: number): Field {
  const n = cols * rows;
  return {
    cols,
    rows,
    mines: new Array<boolean>(n).fill(false),
    adjacent: new Array<number>(n).fill(0),
    state: new Array<CellState>(n).fill('hidden'),
    placed: false,
  };
}

export function neighbors(f: Field, i: number): number[] {
  const x = i % f.cols;
  const y = Math.floor(i / f.cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < f.cols && ny >= 0 && ny < f.rows) out.push(ny * f.cols + nx);
    }
  }
  return out;
}

/** 左上が a1。列は a〜、行は 1〜 */
export function cellName(x: number, y: number): string {
  return String.fromCharCode(97 + x) + (y + 1);
}

/** 地雷の位置を決めて、周りの地雷の数を数え直す */
export function setMines(f: Field, mines: boolean[]): void {
  f.mines = mines.slice();
  f.adjacent = f.mines.map((_, i) => neighbors(f, i).filter((j) => f.mines[j]).length);
  f.placed = true;
}

/** safe とその周りを避けて count 個置く。避けると置ききれないときは safe だけを避ける */
export function placeMines(f: Field, count: number, safe: number, rand: () => number = Math.random): void {
  const n = f.cols * f.rows;
  const zone = new Set([safe, ...neighbors(f, safe)]);
  let candidates = [...Array(n).keys()].filter((i) => !zone.has(i));
  if (candidates.length < count) candidates = [...Array(n).keys()].filter((i) => i !== safe);
  // 先頭から count 個だけのフィッシャー–イェーツ
  for (let k = 0; k < count && k < candidates.length; k++) {
    const j = k + Math.floor(rand() * (candidates.length - k));
    [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
  }
  const mines = new Array<boolean>(n).fill(false);
  for (const i of candidates.slice(0, count)) mines[i] = true;
  setMines(f, mines);
}

/** 隠れたマスを開く。0 のマスなら、つながった 0 のマスと縁の数字まで開く（旗のマスは開かない） */
export function openCell(f: Field, i: number): OpenResult {
  if (f.state[i] !== 'hidden') return 'none';
  f.state[i] = 'open';
  if (f.mines[i]) return 'mine';
  const stack = f.adjacent[i] === 0 ? [i] : [];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const j of neighbors(f, cur)) {
      if (f.state[j] !== 'hidden') continue;
      f.state[j] = 'open';
      if (f.adjacent[j] === 0) stack.push(j);
    }
  }
  return 'opened';
}

/** 開いた数字のマスで、周りの旗の数が数字と同じなら残りの隠れたマスをまとめて開く */
export function chord(f: Field, i: number): OpenResult {
  if (f.state[i] !== 'open' || f.mines[i] || f.adjacent[i] === 0) return 'none';
  const around = neighbors(f, i);
  if (around.filter((j) => f.state[j] === 'flag').length !== f.adjacent[i]) return 'none';
  let result: OpenResult = 'none';
  for (const j of around) {
    const r = openCell(f, j);
    if (r === 'mine') result = 'mine';
    else if (r === 'opened' && result === 'none') result = 'opened';
  }
  return result;
}

/** 隠れたマスなら旗を立て、旗なら外す。変わったら true */
export function toggleFlag(f: Field, i: number): boolean {
  if (f.state[i] === 'hidden') f.state[i] = 'flag';
  else if (f.state[i] === 'flag') f.state[i] = 'hidden';
  else return false;
  return true;
}

/** 地雷の数 − 旗の数（旗を立てすぎると負） */
export function flagsLeft(f: Field, count: number): number {
  return count - f.state.filter((s) => s === 'flag').length;
}

/** 地雷以外のマスがすべて開いていればクリア */
export function isCleared(f: Field): boolean {
  return f.placed && f.state.every((s, i) => f.mines[i] || s === 'open');
}

/** クリア時のスコア。速いほど高い */
export function scoreFor(seconds: number): number {
  return Math.max(1, 1000 - Math.floor(seconds));
}
