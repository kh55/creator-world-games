// スネークのロジック。DOM を使わない。座標は [x, y]、body[0] が頭。元の配列は変更しない。
export type Point = [number, number];
export type Dir = 'left' | 'right' | 'up' | 'down';

export const COLS = 20;
export const ROWS = 20;
export const START_LENGTH = 3;
export const FOOD_SCORE = 10;
/** 方向キーの先行入力を何手分まで受け付けるか */
export const QUEUE_MAX = 2;

const DELTA: Record<Dir, Point> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

const OPPOSITE: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' };

/** 盤面の中央に、右向きで START_LENGTH 個の体を置く */
export function createSnake(cols = COLS, rows = ROWS): Point[] {
  const y = Math.floor(rows / 2);
  const hx = Math.floor(cols / 2);
  return Array.from({ length: START_LENGTH }, (_, i) => [hx - i, y] as Point);
}

/**
 * 方向の先行入力。最後に予定している向き（なければ今の向き）と同じ向き・真逆の向きは捨てる。
 * 1 マス進む間に「上→左」のように 2 回曲がっても、その場で反転して自分にぶつからないようにするため。
 */
export function enqueueDir(queue: Dir[], current: Dir, want: Dir, max = QUEUE_MAX): Dir[] {
  const last = queue.length > 0 ? queue[queue.length - 1] : current;
  if (want === last || want === OPPOSITE[last] || queue.length >= max) return queue;
  return [...queue, want];
}

export function samePoint(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * 1 マス進める。壁か自分の体にぶつかったら dead。
 * 餌を食べないときは尾が同時に動くので、今の尾のマスへは進める。
 */
export function step(
  body: Point[],
  dir: Dir,
  food: Point | null,
  cols = COLS,
  rows = ROWS,
): { body: Point[]; ate: boolean; dead: boolean } {
  const [dx, dy] = DELTA[dir];
  const head: Point = [body[0][0] + dx, body[0][1] + dy];
  if (head[0] < 0 || head[0] >= cols || head[1] < 0 || head[1] >= rows) {
    return { body, ate: false, dead: true };
  }
  const ate = food !== null && samePoint(head, food);
  const rest = ate ? body : body.slice(0, -1);
  if (rest.some((p) => samePoint(p, head))) return { body, ate: false, dead: true };
  return { body: [head, ...rest], ate, dead: false };
}

/** 体のないマスから餌の位置を選ぶ。空きがなければ null。rnd は [0,1) を返す関数 */
export function placeFood(body: Point[], cols = COLS, rows = ROWS, rnd: () => number = Math.random): Point | null {
  const free: Point[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) if (!body.some((p) => p[0] === x && p[1] === y)) free.push([x, y]);
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(rnd() * free.length))];
}

/** 1 マス進む間隔（秒）。食べた数が増えるほど速くなり、0.06 秒で頭打ち */
export function stepInterval(eaten: number): number {
  return Math.max(0.06, 0.15 - eaten * 0.004);
}
