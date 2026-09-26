import type { CreateGame } from '../../engine/runner';
import * as T from './logic';

interface Piece {
  type: number;
  rot: number;
  x: number;
  y: number;
}

export const create: CreateGame = (host, api) => {
  const COLS = 10,
    ROWS = 20,
    CELL = 32;
  const BOARD_W = COLS * CELL,
    PANEL_W = 140;
  const W = BOARD_W + PANEL_W,
    H = ROWS * CELL;
  const COLORS = [null, '#22d3ee', '#facc15', '#c084fc', '#4ade80', '#f87171', '#60a5fa', '#fb923c'];
  const LOCK_DELAY = 0.5,
    DAS = 0.17,
    ARR = 0.05,
    SOFT_INTERVAL = 0.05;
  // PC（マウス+キーボード）のときだけキー凡例を出す。判定は初回1回のみ
  const showKeys = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const STATE = { READY: 0, PLAY: 1, OVER: 2 };
  let state: number, board: T.Board, score: number, lines: number, level: number;
  let piece: Piece, nextType: number;
  let dropTimer: number, lockTimer: number, moveTimer: number, moveDir: number, prevUp: boolean, prevFire: boolean;

  function randType(): number {
    return 1 + Math.floor(Math.random() * 7);
  }
  function cellsOf(type: number, rot: number): T.Cell[] {
    return T.SHAPES[type - 1][rot];
  }

  function spawn() {
    piece = { type: nextType, rot: 0, x: 3, y: 0 };
    nextType = randType();
    dropTimer = 0;
    lockTimer = -1;
    if (!T.canPlace(board, cellsOf(piece.type, 0), piece.x, piece.y)) {
      state = STATE.OVER;
      api.submitScore(score);
    }
  }

  function startGame() {
    board = T.createBoard(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    moveTimer = 0;
    moveDir = 0;
    prevUp = api.input.isDown('up');
    prevFire = api.input.isDown('fire');
    state = STATE.PLAY;
    nextType = randType();
    spawn();
    api.setScore(0);
  }

  function tryMove(dx: number, dy: number): boolean {
    if (T.canPlace(board, cellsOf(piece.type, piece.rot), piece.x + dx, piece.y + dy)) {
      piece.x += dx;
      piece.y += dy;
      return true;
    }
    return false;
  }
  function tryRotate(): boolean {
    const r = (piece.rot + 1) % 4;
    if (T.canPlace(board, cellsOf(piece.type, r), piece.x, piece.y)) {
      piece.rot = r;
      return true;
    }
    return false;
  }
  function grounded(): boolean {
    return !T.canPlace(board, cellsOf(piece.type, piece.rot), piece.x, piece.y + 1);
  }
  function lockPiece() {
    board = T.merge(board, cellsOf(piece.type, piece.rot), piece.x, piece.y, piece.type);
    const res = T.clearLines(board);
    board = res.board;
    if (res.cleared > 0) {
      score += T.lineScore(res.cleared, level);
      lines += res.cleared;
      level = T.levelFor(lines);
      api.setScore(score);
    }
    spawn();
  }
  function hardDrop() {
    let n = 0;
    while (tryMove(0, 1)) n++;
    if (n > 0) {
      score += n * 2;
      api.setScore(score);
    }
    lockPiece();
  }

  // 左右長押しの連続移動（DAS/ARR 相当）
  function handleMove(dt: number) {
    const dir = (api.input.isDown('left') ? -1 : 0) + (api.input.isDown('right') ? 1 : 0);
    if (dir === 0) {
      moveDir = 0;
      moveTimer = 0;
      return;
    }
    if (dir !== moveDir) {
      moveDir = dir;
      tryMove(dir, 0);
      moveTimer = DAS;
      return;
    }
    moveTimer -= dt;
    while (moveTimer <= 0) {
      tryMove(dir, 0);
      moveTimer += ARR;
    }
  }

  api.input.onStart(() => {
    if (state === STATE.READY || state === STATE.OVER) {
      startGame();
      api.started();
    }
  });
  api.input.addButton({ label: '◀', action: 'left', ariaLabel: '左へ移動' });
  api.input.addButton({ label: '▶', action: 'right', ariaLabel: '右へ移動' });
  api.input.addButton({ label: '↻', action: 'up', ariaLabel: '回転' });
  api.input.addButton({ label: '▼', action: 'down', ariaLabel: 'ソフトドロップ' });
  api.input.addButton({ label: '⇩', action: 'fire', ariaLabel: 'ハードドロップ' });

  startGame();
  state = STATE.READY; // 初回は開始待ちから

  const h = api.loop((dt) => {
    if (state === STATE.PLAY) {
      handleMove(dt);

      const up = api.input.isDown('up');
      if (up && !prevUp) tryRotate();
      prevUp = up;

      const fire = api.input.isDown('fire');
      if (fire && !prevFire) hardDrop();
      prevFire = fire;
    }

    // ハードドロップで OVER になった同一フレームで重力を進めないため、ここで再判定する
    if (state === STATE.PLAY) {
      const soft = api.input.isDown('down');
      let interval = T.dropInterval(level);
      if (soft && SOFT_INTERVAL < interval) interval = SOFT_INTERVAL;

      dropTimer += dt;
      while (dropTimer >= interval) {
        dropTimer -= interval;
        // 接地して落ちられないときはタイマーを溜めない
        // （溜めると、猶予中に横移動して穴に落ちた瞬間に一気に落下してしまう）
        if (!tryMove(0, 1)) {
          dropTimer = 0;
          break;
        }
        if (soft) {
          score += 1;
          api.setScore(score);
        }
        lockTimer = -1;
      }

      if (grounded()) {
        if (lockTimer < 0) lockTimer = LOCK_DELAY;
        lockTimer -= dt;
        if (lockTimer <= 0) lockPiece();
      } else {
        lockTimer = -1;
      }
    }

    render();
  });

  function drawCell(px: number, py: number, colorIdx: number, size: number) {
    ctx.fillStyle = COLORS[colorIdx]!;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  }

  function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // 盤面のグリッド線
    ctx.strokeStyle = '#132';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * CELL + 0.5, 0);
      ctx.lineTo(gx * CELL + 0.5, H);
      ctx.stroke();
    }
    for (let gy = 0; gy <= ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(0, gy * CELL + 0.5);
      ctx.lineTo(BOARD_W, gy * CELL + 0.5);
      ctx.stroke();
    }

    // 積まれたブロック
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(x * CELL, y * CELL, board[y][x], CELL);
      }

    // 落下中のミノ
    if (state !== STATE.OVER) {
      const cs = cellsOf(piece.type, piece.rot);
      for (let i = 0; i < cs.length; i++) {
        const by = piece.y + cs[i][1];
        if (by >= 0) drawCell((piece.x + cs[i][0]) * CELL, by * CELL, piece.type, CELL);
      }
    }

    // サイドパネル
    ctx.fillStyle = '#39ff14';
    ctx.font = "14px 'Courier New', monospace";
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', BOARD_W + 16, 28);
    const ns = T.SHAPES[nextType - 1][0];
    for (let j = 0; j < ns.length; j++) {
      drawCell(BOARD_W + 20 + ns[j][0] * 22, 40 + ns[j][1] * 22, nextType, 22);
    }
    ctx.fillStyle = '#2f8f22';
    ctx.fillText('LINES', BOARD_W + 16, 180);
    ctx.fillStyle = '#39ff14';
    ctx.fillText(String(lines), BOARD_W + 16, 202);
    ctx.fillStyle = '#2f8f22';
    ctx.fillText('LEVEL', BOARD_W + 16, 236);
    ctx.fillStyle = '#39ff14';
    ctx.fillText(String(level), BOARD_W + 16, 258);

    // キー凡例（PC のみ）
    if (showKeys) {
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillStyle = '#2f8f22';
      ctx.fillText('KEYS', BOARD_W + 16, 300);
      ctx.fillStyle = '#39ff14';
      const KEY_ROWS = [
        ['←→', '移動'],
        ['↑', '回転'],
        ['↓', '落下加速'],
        ['SPACE', '一気に落下'],
      ];
      for (let k = 0; k < KEY_ROWS.length; k++) {
        const ky = 320 + k * 18;
        ctx.fillText(KEY_ROWS[k][0], BOARD_W + 16, ky);
        ctx.fillText(KEY_ROWS[k][1], BOARD_W + 60, ky);
      }
    }

    // オーバーレイ
    if (state !== STATE.PLAY) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, H / 2 - 56, BOARD_W, 112);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#39ff14';
      ctx.font = "bold 20px 'Courier New', monospace";
      if (state === STATE.READY) {
        ctx.fillText('タップ / ENTER で開始', BOARD_W / 2, H / 2 + 6);
      } else {
        ctx.fillText('GAME OVER', BOARD_W / 2, H / 2 - 8);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText('タップでリトライ', BOARD_W / 2, H / 2 + 22);
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
