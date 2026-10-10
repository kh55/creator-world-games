import type { Action } from '../../engine/input';
import type { CreateGame } from '../../engine/runner';
import { onSwipe } from '../../engine/swipe';
import { type Board, canMove, type Dir, GOAL, maxTile, move, newBoard, addRandomTile, SIZE } from './logic';

const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
const POP_TIME = 0.12; // 新しいタイルが現れるときの拡大アニメーション（秒）
const GOAL_BANNER_TIME = 2; // 2048 達成の表示時間（秒）

// タイルの数ごとの背景色（それより大きい数は最後の色）
const TILE_COLORS: Record<number, string> = {
  2: '#1d4a14',
  4: '#235c17',
  8: '#2a701b',
  16: '#31851f',
  32: '#399a23',
  64: '#42b028',
  128: '#0e5f6b',
  256: '#11808f',
  512: '#15a2b5',
  1024: '#8a6d0b',
  2048: '#c9a10f',
};

export const create: CreateGame = (host, api) => {
  const CELL = 90,
    GAP = 10;
  const W = SIZE * CELL + (SIZE + 1) * GAP,
    H = W;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '2048 の盤面');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  type Phase = 'play' | 'over';
  let phase: Phase = 'play';
  let board: Board;
  let score: number;
  let started: boolean;
  let reachedGoal: boolean;
  let goalBanner: number;
  let pop: { x: number; y: number; t: number } | null;
  const prev: Record<string, boolean> = {};

  function newGame() {
    board = newBoard();
    score = 0;
    started = false;
    reachedGoal = false;
    goalBanner = 0;
    pop = null;
    phase = 'play';
    // 押したままのキーで、開始直後に動かないようにする
    for (const d of DIRS) prev[d] = api.input.isDown(d as Action);
    api.setScore(0);
  }

  function slide(dir: Dir) {
    if (phase !== 'play') return;
    const res = move(board, dir);
    if (!res.moved) return;
    if (!started) {
      started = true;
      api.started();
    }
    const before = res.board;
    board = addRandomTile(before, Math.random);
    pop = null;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) if (before[y][x] === 0 && board[y][x] !== 0) pop = { x, y, t: POP_TIME };
    score += res.gained;
    api.setScore(score);
    if (!reachedGoal && maxTile(board) >= GOAL) {
      reachedGoal = true;
      goalBanner = GOAL_BANNER_TIME;
    }
    if (!canMove(board)) {
      phase = 'over';
      api.submitScore(score);
    }
  }

  // 終局中に押し始めたスワイプは「リトライ」の操作として扱い、新しい盤面は動かさない
  onSwipe(api.input, slide, () => phase !== 'over');
  api.input.onStart(() => {
    if (phase === 'over') newGame();
  });
  api.input.addButton({ label: '◀', action: 'left', ariaLabel: '左へ寄せる' });
  api.input.addButton({ label: '▲', action: 'up', ariaLabel: '上へ寄せる' });
  api.input.addButton({ label: '▼', action: 'down', ariaLabel: '下へ寄せる' });
  api.input.addButton({ label: '▶', action: 'right', ariaLabel: '右へ寄せる' });

  newGame();

  const h = api.loop((dt) => {
    // キーと画面のボタンは押した瞬間だけ反応させる（押しっぱなしで連続して動かない）
    for (const d of DIRS) {
      const down = api.input.isDown(d as Action);
      if (down && !prev[d]) slide(d);
      prev[d] = down;
    }
    if (pop) {
      pop.t -= dt;
      if (pop.t <= 0) pop = null;
    }
    if (goalBanner > 0) goalBanner -= dt;
    render();
  });

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const px = GAP + x * (CELL + GAP),
          py = GAP + y * (CELL + GAP);
        ctx.fillStyle = '#0b1408';
        roundRect(px, py, CELL, CELL, 8);
        const v = board[y][x];
        if (!v) continue;

        let s = 1;
        if (pop && pop.x === x && pop.y === y) s = 1 - pop.t / POP_TIME;
        const size = CELL * s,
          off = (CELL - size) / 2;
        ctx.fillStyle = TILE_COLORS[v] ?? TILE_COLORS[GOAL];
        roundRect(px + off, py + off, size, size, 8);

        const digits = String(v).length;
        const fontSize = (digits <= 2 ? 40 : digits === 3 ? 34 : digits === 4 ? 28 : 22) * s;
        ctx.fillStyle = v >= 1024 ? '#000' : v >= 16 ? '#eaffe0' : '#39ff14';
        ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
        ctx.fillText(String(v), px + CELL / 2, py + CELL / 2 + 2);
      }
    }

    if (goalBanner > 0 && phase === 'play') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, H / 2 - 36, W, 72);
      ctx.fillStyle = '#ffd43b';
      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.fillText(`${GOAL} 達成！ まだ続けられます`, W / 2, H / 2);
    }

    if (phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, H / 2 - 56, W, 112);
      ctx.fillStyle = '#39ff14';
      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.fillText('GAME OVER', W / 2, H / 2 - 14);
      ctx.font = "16px 'Courier New', monospace";
      ctx.fillText('タップ / ENTER でリトライ', W / 2, H / 2 + 22);
    }
    ctx.textBaseline = 'alphabetic';
  }

  return {
    destroy: () => {
      h.stop();
      host.replaceChildren();
    },
  };
};
