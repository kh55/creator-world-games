import type { CreateGame } from '../../engine/runner';
import { hitBrick, reflectPaddle, type Ball, type Rect } from './logic';

interface Brick extends Rect {
  alive: boolean;
  score: number;
  color: string;
}

interface Paddle {
  w: number;
  h: number;
  x: number;
  y: number;
}

export const create: CreateGame = (host, api) => {
  const W = 480,
    H = 640; // 論理解像度
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const COLS = 8,
    ROWS = 5,
    BW = 52,
    BH = 20,
    BGAP = 4,
    BTOP = 70,
    BLEFT = (W - (COLS * (BW + BGAP) - BGAP)) / 2;
  const ROW_SCORE = [50, 40, 30, 20, 10];
  const ROW_COLOR = ['#ff5b5b', '#ffa94d', '#ffd43b', '#51cf66', '#4dabf7'];

  const STATE = { READY: 0, PLAY: 1, OVER: 2, CLEAR: 3 };
  let state: number, score: number, lives: number, level: number, bricks: Brick[], paddle: Paddle, ball: Ball, baseSpeed: number;
  let clearTimer = 0;
  let fresh = true;

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        bricks.push({
          x: BLEFT + c * (BW + BGAP),
          y: BTOP + r * (BH + BGAP),
          w: BW,
          h: BH,
          alive: true,
          score: ROW_SCORE[r],
          color: ROW_COLOR[r],
        });
  }
  function resetBall() {
    ball = { x: W / 2, y: H - 90, r: 7, vx: 0, vy: 0 };
    paddle = { w: 90, h: 14, x: (W - 90) / 2, y: H - 40 };
    state = STATE.READY;
  }
  function launch() {
    const v = reflectPaddle(ball.x, paddle.x, paddle.w, baseSpeed);
    ball.vx = v.vx * 0.6;
    ball.vy = v.vy;
    state = STATE.PLAY;
    if (fresh) {
      fresh = false;
      api.started();
    }
  }
  function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    baseSpeed = 300;
    fresh = true;
    buildBricks();
    resetBall();
    api.setScore(0);
  }
  function nextLevel() {
    level++;
    baseSpeed += 40;
    buildBricks();
    resetBall();
    state = STATE.READY;
  }
  function loseLife() {
    lives--;
    if (lives <= 0) {
      state = STATE.OVER;
      api.submitScore(score);
    } else resetBall();
  }

  startGame();

  // パドル操作: ポインタ追従 + ←→キー
  api.input.onPointer((p) => {
    const rectW = canvas.getBoundingClientRect().width || W;
    const scale = W / rectW;
    paddle.x = p.x * scale - paddle.w / 2;
  });
  api.input.onStart(() => {
    if (state === STATE.READY) launch();
    else if (state === STATE.OVER || state === STATE.CLEAR) startGame();
  });
  api.input.addButton({ label: '◀', action: 'left', ariaLabel: '左' });
  api.input.addButton({ label: '▶', action: 'right', ariaLabel: '右' });

  function clampPaddle() {
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  }

  const h = api.loop((dt) => {
    // キーでのパドル移動
    if (api.input.isDown('left')) paddle.x -= 420 * dt;
    if (api.input.isDown('right')) paddle.x += 420 * dt;
    clampPaddle();

    if (state === STATE.READY) {
      ball.x = paddle.x + paddle.w / 2;
    }

    if (state === STATE.PLAY) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      // 壁反射
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }
      // パドル反射
      if (
        ball.vy > 0 &&
        ball.y + ball.r >= paddle.y &&
        ball.y - ball.r <= paddle.y + paddle.h &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.w
      ) {
        const v = reflectPaddle(ball.x, paddle.x, paddle.w, Math.hypot(ball.vx, ball.vy) || baseSpeed);
        ball.vx = v.vx;
        ball.vy = v.vy;
        ball.y = paddle.y - ball.r;
      }
      // ブロック衝突（1フレーム1個）
      for (let i = 0; i < bricks.length; i++) {
        if (!bricks[i].alive) continue;
        const axis = hitBrick(ball, bricks[i]);
        if (axis) {
          bricks[i].alive = false;
          score += bricks[i].score;
          api.setScore(score);
          if (axis === 'x') ball.vx = -ball.vx;
          else ball.vy = -ball.vy;
          break;
        }
      }
      // 落下
      if (ball.y - ball.r > H) loseLife();
      // クリア
      let remain = 0;
      for (let k = 0; k < bricks.length; k++) if (bricks[k].alive) remain++;
      if (remain === 0) {
        state = STATE.CLEAR;
        clearTimer = 1.2;
      }
    }

    if (state === STATE.CLEAR) {
      clearTimer -= dt;
      if (clearTimer <= 0) nextLevel();
    }

    render();
  });

  function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // ブロック
    for (let i = 0; i < bricks.length; i++) {
      if (!bricks[i].alive) continue;
      ctx.fillStyle = bricks[i].color;
      ctx.fillRect(bricks[i].x, bricks[i].y, bricks[i].w, bricks[i].h);
    }
    // パドル・ボール
    ctx.fillStyle = '#39ff14';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    // HUD
    ctx.fillStyle = '#2f8f22';
    ctx.font = "16px 'Courier New', monospace";
    ctx.textAlign = 'left';
    ctx.fillText('LIVES ' + lives + '   LV ' + level, 10, 24);
    // メッセージ
    ctx.textAlign = 'center';
    ctx.fillStyle = '#39ff14';
    ctx.font = "bold 22px 'Courier New', monospace";
    if (state === STATE.READY) ctx.fillText('タップ / SPACE で発射', W / 2, H / 2);
    if (state === STATE.CLEAR) ctx.fillText('CLEAR!', W / 2, H / 2);
    if (state === STATE.OVER) {
      ctx.fillText('GAME OVER', W / 2, H / 2 - 12);
      ctx.font = "16px 'Courier New', monospace";
      ctx.fillText('タップでリトライ', W / 2, H / 2 + 18);
    }
  }

  return {
    destroy: () => {
      h.stop();
      host.replaceChildren();
    },
  };
};
