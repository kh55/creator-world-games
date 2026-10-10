import type { Action } from '../../engine/input';
import type { CreateGame } from '../../engine/runner';
import { onSwipe } from '../../engine/swipe';
import {
  COLS,
  createSnake,
  type Dir,
  enqueueDir,
  FOOD_SCORE,
  placeFood,
  type Point,
  ROWS,
  step,
  stepInterval,
} from './logic';

const DIRS: Dir[] = ['left', 'right', 'up', 'down'];

export const create: CreateGame = (host, api) => {
  const CELL = 20;
  const W = COLS * CELL,
    H = ROWS * CELL;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  type Phase = 'ready' | 'play' | 'over';
  let phase: Phase = 'ready';
  let body: Point[];
  let dir: Dir;
  let queue: Dir[];
  let food: Point | null;
  let eaten: number;
  let score: number;
  let timer: number;
  const prev: Record<string, boolean> = {};

  function reset() {
    body = createSnake();
    dir = 'right';
    queue = [];
    food = placeFood(body);
    eaten = 0;
    score = 0;
    timer = 0;
    api.setScore(0);
  }

  function startGame() {
    reset();
    // 押したままのキーで、開始直後に曲がらないようにする
    for (const d of DIRS) prev[d] = api.input.isDown(d as Action);
    phase = 'play';
    api.started();
  }

  function turn(want: Dir) {
    if (phase === 'play') queue = enqueueDir(queue, dir, want);
  }

  function gameOver() {
    phase = 'over';
    api.submitScore(score);
  }

  function advance() {
    if (queue.length > 0) {
      dir = queue[0];
      queue = queue.slice(1);
    }
    const res = step(body, dir, food);
    if (res.dead) {
      gameOver();
      return;
    }
    body = res.body;
    if (res.ate) {
      eaten++;
      score += FOOD_SCORE;
      api.setScore(score);
      food = placeFood(body);
      // 盤面がすべて体で埋まったら、それ以上進めないので終了
      if (!food) gameOver();
    }
  }

  // 終局中に押し始めたスワイプは「リトライ」の操作として扱い、向きを変えない
  onSwipe(api.input, turn, () => phase !== 'over');
  api.input.onStart(() => {
    if (phase !== 'play') startGame();
  });
  api.input.addButton({ label: '◀', action: 'left', ariaLabel: '左へ曲がる' });
  api.input.addButton({ label: '▲', action: 'up', ariaLabel: '上へ曲がる' });
  api.input.addButton({ label: '▼', action: 'down', ariaLabel: '下へ曲がる' });
  api.input.addButton({ label: '▶', action: 'right', ariaLabel: '右へ曲がる' });

  reset();

  const h = api.loop((dt) => {
    // キーと画面のボタンは押した瞬間に 1 回だけ向きを予約する
    for (const d of DIRS) {
      const down = api.input.isDown(d as Action);
      if (down && !prev[d]) turn(d);
      prev[d] = down;
    }
    if (phase === 'play') {
      timer += dt;
      let interval = stepInterval(eaten);
      while (phase === 'play' && timer >= interval) {
        timer -= interval;
        advance();
        interval = stepInterval(eaten);
      }
    }
    render();
  });

  function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#0b1a08';
    ctx.lineWidth = 1;
    for (let gx = 1; gx < COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * CELL + 0.5, 0);
      ctx.lineTo(gx * CELL + 0.5, H);
      ctx.stroke();
    }
    for (let gy = 1; gy < ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(0, gy * CELL + 0.5);
      ctx.lineTo(W, gy * CELL + 0.5);
      ctx.stroke();
    }

    if (food) {
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(food[0] * CELL + CELL / 2, food[1] * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = body.length - 1; i >= 0; i--) {
      ctx.fillStyle = i === 0 ? '#b6ff9e' : i % 2 ? '#39ff14' : '#2fd611';
      ctx.fillRect(body[i][0] * CELL + 1, body[i][1] * CELL + 1, CELL - 2, CELL - 2);
    }

    if (phase !== 'play') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, H / 2 - 56, W, 112);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#39ff14';
      ctx.font = "bold 20px 'Courier New', monospace";
      if (phase === 'ready') {
        ctx.fillText('タップ / ENTER で開始', W / 2, H / 2 + 6);
      } else {
        ctx.fillText('GAME OVER', W / 2, H / 2 - 8);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText('タップ / ENTER でリトライ', W / 2, H / 2 + 22);
      }
    }
  }

  return {
    destroy: () => {
      h.stop();
      host.replaceChildren();
    },
  };
};
