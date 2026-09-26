import type { CreateGame } from '../../engine/runner';
import { aabb, INVADER_SCORES, typeIndexForRow, UFO_SCORES } from './logic';

export const create: CreateGame = (host, api) => {
  // ============================================================
  // canvas / 定数
  // ============================================================
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 720;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;

  const COLORS = {
    bg: '#000000',
    player: '#39ff14',
    invA: '#7CFC00',
    invB: '#39ff14',
    invC: '#2eea0e',
    bullet: '#ffffff',
    ebullet: '#ff5b5b',
    ufo: '#ff4fd8',
    barrier: '#39c20e',
    text: '#39ff14',
    dim: '#1f7a13',
  };

  const COLS = 11,
    ROWS = 5,
    SPR = 3,
    COL_GAP = 46,
    ROW_GAP = 40;
  const FORMATION_TOP = 90,
    FORMATION_DROP = 18,
    INVADER_LINE_Y = H - 110;
  const PLAYER_SPEED = 240,
    PLAYER_BULLET_SPEED = 560,
    ENEMY_BULLET_SPEED = 230,
    UFO_SPEED = 130;
  const PLAYER_FIRE_COOLDOWN = 0.34,
    START_LIVES = 3;

  // ============================================================
  // スプライト
  // ============================================================
  const SQUID = [
    ['..X..X..', '...XX...', '..XXXX..', '.XX..XX.', 'XXXXXXXX', 'X.XXXX.X', 'X.X..X.X', '...XX...'],
    ['..X..X..', 'X..XX..X', 'X.XXXX.X', 'XXX..XXX', 'XXXXXXXX', '.XXXXXX.', '..X..X..', '.X....X.'],
  ];
  const CRAB = [
    ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
    ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.'],
  ];
  const OCTO = [
    ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX'],
    ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..X......X..'],
  ];
  const SHIP = ['......X......', '.....XXX.....', '.....XXX.....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX'];
  const UFO_SPR = [
    '.....XXXXXX.....',
    '...XXXXXXXXXX...',
    '..XXXXXXXXXXXX..',
    '.XX.XX.XX.XX.XX.',
    'XXXXXXXXXXXXXXXX',
    '..XXX....XXX....',
    '...X......X.....',
  ];

  interface InvType {
    frames: string[][];
    color: string;
    score: number;
  }

  const INV_TYPES: InvType[] = [
    { frames: SQUID, color: COLORS.invA, score: INVADER_SCORES[0] },
    { frames: CRAB, color: COLORS.invB, score: INVADER_SCORES[1] },
    { frames: OCTO, color: COLORS.invC, score: INVADER_SCORES[2] },
  ];
  function typeForRow(row: number): InvType {
    return INV_TYPES[typeIndexForRow(row)];
  }
  function spriteSize(rows: string[]): { w: number; h: number } {
    return { w: rows[0].length * SPR, h: rows.length * SPR };
  }
  function drawSprite(rows: string[], x: number, y: number, color: string, scale?: number) {
    scale = scale || SPR;
    ctx.fillStyle = color;
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let c = 0; c < line.length; c++) {
        if (line[c] === 'X') ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale);
      }
    }
  }

  // ============================================================
  // 状態
  // ============================================================
  const STATE = { TITLE: 'title', PLAYING: 'playing', GAMEOVER: 'gameover' };
  let state = STATE.TITLE;
  let score = 0;
  let high = api.getHighScore();
  let lives = START_LIVES;
  let wave = 1;
  let won = false;

  interface Invader {
    col: number;
    row: number;
    cx: number;
    y: number;
    w: number;
    h: number;
    type: InvType;
    alive: boolean;
  }
  interface Bullet {
    x: number;
    y: number;
    w: number;
    h: number;
    dead?: boolean;
  }
  interface Ufo {
    x: number;
    y: number;
    w: number;
    h: number;
    dir: number;
    score: number;
  }
  interface Barrier {
    x: number;
    y: number;
    cell: number;
    cols: number;
    rows: number;
    grid: boolean[][];
    bw: number;
    bh: number;
  }
  interface Player {
    w: number;
    h: number;
    x: number;
    y: number;
    cooldown: number;
    blink: number;
  }

  const shipSize = spriteSize(SHIP);
  const player: Player = { w: shipSize.w, h: shipSize.h, x: (W - shipSize.w) / 2, y: H - 70, cooldown: 0, blink: 0 };

  let playerBullets: Bullet[] = [],
    enemyBullets: Bullet[] = [],
    invaders: Invader[] = [],
    barriers: Barrier[] = [],
    ufo: Ufo | null = null;
  let formDir = 1,
    formDrop = 0,
    animTimer = 0,
    animFrame = 0;
  let enemyFireTimer = 0,
    ufoTimer = 0;

  // ============================================================
  // ユーティリティ
  // ============================================================
  function rand(a: number, b: number): number {
    return a + Math.random() * (b - a);
  }
  function invLeft(inv: Invader): number {
    return inv.cx - inv.w / 2;
  }
  function invRect(inv: Invader) {
    return { x: invLeft(inv), y: inv.y, w: inv.w, h: inv.h };
  }
  function perfNow(): number {
    return typeof performance !== 'undefined' ? performance.now() : 0;
  }

  // ============================================================
  // セットアップ
  // ============================================================
  function buildInvaders() {
    invaders = [];
    const gridW = (COLS - 1) * COL_GAP;
    const startX = (W - gridW) / 2;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const type = typeForRow(row);
        const sz = spriteSize(type.frames[0]);
        const cx = startX + col * COL_GAP;
        invaders.push({ col: col, row: row, cx: cx, y: FORMATION_TOP + row * ROW_GAP, w: sz.w, h: sz.h, type: type, alive: true });
      }
    }
  }
  function buildBarriers() {
    const shape = ['..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXX....XXXX', 'XXX......XXX', 'XXX......XXX'];
    const cell = 6,
      cols = shape[0].length,
      rows = shape.length,
      bw = cols * cell,
      count = 4;
    const gap = (W - count * bw) / (count + 1);
    const y = INVADER_LINE_Y - 70;
    barriers = [];
    for (let i = 0; i < count; i++) {
      const x = gap + i * (bw + gap);
      const grid = shape.map((line) => line.split('').map((ch) => ch === 'X'));
      barriers.push({ x: x, y: y, cell: cell, cols: cols, rows: rows, grid: grid, bw: bw, bh: rows * cell });
    }
  }
  function resetEntities() {
    playerBullets = [];
    enemyBullets = [];
    ufo = null;
    formDir = 1;
    formDrop = 0;
    enemyFireTimer = rand(0.4, 1.0);
    ufoTimer = rand(8, 16);
    player.x = (W - player.w) / 2;
    player.cooldown = 0;
    player.blink = 0;
  }
  function startGame() {
    score = 0;
    lives = START_LIVES;
    wave = 1;
    won = false;
    buildInvaders();
    buildBarriers();
    resetEntities();
    state = STATE.PLAYING;
  }
  function nextWave() {
    wave++;
    buildInvaders();
    buildBarriers();
    resetEntities();
  }
  function gameOver() {
    state = STATE.GAMEOVER;
    high = Math.max(high, score);
    api.submitScore(score);
  }
  function loseLife() {
    lives--;
    if (lives <= 0) {
      gameOver();
    } else {
      player.x = (W - player.w) / 2;
      player.blink = 1.6;
      enemyBullets = [];
    }
  }

  // ============================================================
  // 入力（シェル経由）
  // ============================================================
  api.input.addButton({ label: '◀', action: 'left', ariaLabel: '左' });
  api.input.addButton({ label: '▶', action: 'right', ariaLabel: '右' });
  api.input.addButton({ label: 'FIRE', action: 'fire', ariaLabel: '発射' });
  api.input.onStart(() => {
    if (state !== STATE.PLAYING) {
      startGame();
      api.started();
    }
  });

  // ============================================================
  // 更新
  // ============================================================
  function update(dt: number) {
    if (state !== STATE.PLAYING) return;

    if (api.input.isDown('left')) player.x -= PLAYER_SPEED * dt;
    if (api.input.isDown('right')) player.x += PLAYER_SPEED * dt;
    player.x = Math.max(8, Math.min(W - player.w - 8, player.x));

    player.cooldown -= dt;
    if (player.blink > 0) player.blink -= dt;
    if (api.input.isDown('fire') && player.cooldown <= 0) {
      playerBullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 10, w: 4, h: 14 });
      player.cooldown = PLAYER_FIRE_COOLDOWN;
    }

    for (let i = 0; i < playerBullets.length; i++) playerBullets[i].y -= PLAYER_BULLET_SPEED * dt;
    playerBullets = playerBullets.filter((b) => b.y + b.h > 0);

    updateInvaders(dt);

    enemyFireTimer -= dt;
    if (enemyFireTimer <= 0) {
      enemyFire();
      const base = Math.max(0.35, 1.1 - wave * 0.12);
      enemyFireTimer = rand(base, base + 0.9);
    }
    for (let j = 0; j < enemyBullets.length; j++) enemyBullets[j].y += ENEMY_BULLET_SPEED * dt;
    enemyBullets = enemyBullets.filter((b) => b.y < H);

    updateUfo(dt);
    handleCollisions();

    if (invaders.every((inv) => !inv.alive)) nextWave();
  }

  function aliveInvaders(): Invader[] {
    return invaders.filter((i) => i.alive);
  }

  function updateInvaders(dt: number) {
    const alive = aliveInvaders();
    if (alive.length === 0) return;

    const total = COLS * ROWS;
    const speedup = 1 + ((total - alive.length) / total) * 3.2;
    const waveFactor = 1 + (wave - 1) * 0.18;
    const speed = 26 * speedup * waveFactor;

    animTimer -= dt;
    if (animTimer <= 0) {
      animFrame ^= 1;
      animTimer = Math.max(0.12, 0.7 / speedup);
    }

    if (formDrop > 0) {
      const d = Math.min(formDrop, speed * 2.2 * dt);
      for (let a = 0; a < alive.length; a++) alive[a].y += d;
      formDrop -= d;
      return;
    }

    let minX = Infinity,
      maxX = -Infinity;
    for (let b = 0; b < alive.length; b++) {
      const l = invLeft(alive[b]);
      minX = Math.min(minX, l);
      maxX = Math.max(maxX, l + alive[b].w);
    }
    const dx = formDir * speed * dt;
    if (formDir > 0 && maxX + dx > W - 8) {
      formDir = -1;
      formDrop = FORMATION_DROP;
    } else if (formDir < 0 && minX + dx < 8) {
      formDir = 1;
      formDrop = FORMATION_DROP;
    } else {
      for (let c = 0; c < alive.length; c++) alive[c].cx += dx;
    }

    for (let e = 0; e < alive.length; e++) {
      if (alive[e].y + alive[e].h >= INVADER_LINE_Y) {
        won = false;
        gameOver();
        break;
      }
    }
  }

  function enemyFire() {
    const alive = aliveInvaders();
    if (alive.length === 0) return;
    const bottomByCol: Record<number, Invader> = {};
    for (let i = 0; i < alive.length; i++) {
      const inv = alive[i],
        cur = bottomByCol[inv.col];
      if (!cur || inv.y > cur.y) bottomByCol[inv.col] = inv;
    }
    const shooters = Object.keys(bottomByCol).map((k) => bottomByCol[Number(k)]);
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    enemyBullets.push({ x: shooter.cx - 2, y: shooter.y + shooter.h, w: 4, h: 12 });
  }

  function updateUfo(dt: number) {
    if (ufo) {
      ufo.x += ufo.dir * UFO_SPEED * dt;
      if (ufo.x > W + 20 || ufo.x + ufo.w < -20) ufo = null;
      return;
    }
    ufoTimer -= dt;
    if (ufoTimer <= 0) {
      const sz = spriteSize(UFO_SPR);
      const dir = Math.random() < 0.5 ? 1 : -1;
      ufo = {
        x: dir > 0 ? -sz.w : W,
        y: 50,
        w: sz.w,
        h: sz.h,
        dir: dir,
        score: UFO_SCORES[Math.floor(Math.random() * 4)],
      };
      ufoTimer = rand(12, 22);
    }
  }

  function damageBarrier(barrier: Barrier, bx: number, by: number, radius?: number) {
    const cell = barrier.cell;
    const cc = Math.floor((bx - barrier.x) / cell);
    const cr = Math.floor((by - barrier.y) / cell);
    const rad = radius || 1;
    for (let r = cr - rad; r <= cr + rad; r++) {
      for (let c = cc - rad; c <= cc + rad; c++) {
        if (r >= 0 && r < barrier.rows && c >= 0 && c < barrier.cols) {
          if (Math.abs(r - cr) + Math.abs(c - cc) <= rad) barrier.grid[r][c] = false;
        }
      }
    }
  }
  function bulletHitsBarrier(bullet: Bullet): boolean {
    for (let i = 0; i < barriers.length; i++) {
      const bar = barriers[i];
      if (bullet.x + bullet.w < bar.x || bullet.x > bar.x + bar.bw || bullet.y + bullet.h < bar.y || bullet.y > bar.y + bar.bh) continue;
      const cell = bar.cell;
      const c0 = Math.max(0, Math.floor((bullet.x - bar.x) / cell));
      const c1 = Math.min(bar.cols - 1, Math.floor((bullet.x + bullet.w - bar.x) / cell));
      const r0 = Math.max(0, Math.floor((bullet.y - bar.y) / cell));
      const r1 = Math.min(bar.rows - 1, Math.floor((bullet.y + bullet.h - bar.y) / cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (bar.grid[r][c]) {
            damageBarrier(bar, bar.x + c * cell + cell / 2, bar.y + r * cell + cell / 2, 1);
            return true;
          }
        }
      }
    }
    return false;
  }

  function handleCollisions() {
    playerBullets = playerBullets.filter((b) => !bulletHitsBarrier(b));
    enemyBullets = enemyBullets.filter((b) => !bulletHitsBarrier(b));

    for (let i = 0; i < playerBullets.length; i++) {
      const b = playerBullets[i];
      for (let k = 0; k < invaders.length; k++) {
        const inv = invaders[k];
        if (!inv.alive) continue;
        if (aabb(b, invRect(inv))) {
          inv.alive = false;
          b.dead = true;
          score += inv.type.score;
          break;
        }
      }
    }
    if (ufo) {
      for (let m = 0; m < playerBullets.length; m++) {
        const pb = playerBullets[m];
        if (!pb.dead && aabb(pb, ufo)) {
          score += ufo.score;
          pb.dead = true;
          ufo = null;
          break;
        }
      }
    }
    playerBullets = playerBullets.filter((b) => !b.dead);

    if (player.blink <= 0) {
      const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
      for (let n = 0; n < enemyBullets.length; n++) {
        if (aabb(enemyBullets[n], pr)) {
          enemyBullets[n].dead = true;
          loseLife();
          break;
        }
      }
      enemyBullets = enemyBullets.filter((b) => !b.dead);
    }
  }

  // ============================================================
  // 描画
  // ============================================================
  function render() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (state === STATE.TITLE) {
      drawTitle();
      api.setScore(score);
      return;
    }

    drawHUD();
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(0, INVADER_LINE_Y + 30, W, 2);
    for (let i = 0; i < barriers.length; i++) drawBarrier(barriers[i]);
    for (let k = 0; k < invaders.length; k++) {
      const inv = invaders[k];
      if (!inv.alive) continue;
      drawSprite(inv.type.frames[animFrame], invLeft(inv), inv.y, inv.type.color);
    }
    if (ufo) drawSprite(UFO_SPR, ufo.x, ufo.y, COLORS.ufo);
    if (!(player.blink > 0 && Math.floor(player.blink * 12) % 2 === 0)) drawSprite(SHIP, player.x, player.y, COLORS.player);
    ctx.fillStyle = COLORS.bullet;
    for (let a = 0; a < playerBullets.length; a++) {
      const pb = playerBullets[a];
      ctx.fillRect(pb.x, pb.y, pb.w, pb.h);
    }
    ctx.fillStyle = COLORS.ebullet;
    for (let e = 0; e < enemyBullets.length; e++) {
      const eb = enemyBullets[e];
      ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
    }
    if (state === STATE.GAMEOVER) drawGameOver();
    api.setScore(score);
  }

  function drawBarrier(bar: Barrier) {
    ctx.fillStyle = COLORS.barrier;
    const cell = bar.cell;
    for (let r = 0; r < bar.rows; r++)
      for (let c = 0; c < bar.cols; c++) if (bar.grid[r][c]) ctx.fillRect(bar.x + c * cell, bar.y + r * cell, cell, cell);
  }
  function drawHUD() {
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.font = "20px 'Courier New', monospace";
    ctx.fillText('SCORE ' + String(score).padStart(5, '0'), 14, 30);
    ctx.textAlign = 'center';
    ctx.fillText('WAVE ' + wave, W / 2, 30);
    ctx.textAlign = 'right';
    ctx.fillText('HI ' + String(Math.max(high, score)).padStart(5, '0'), W - 14, 30);
    ctx.textAlign = 'left';
    for (let i = 0; i < lives; i++) drawSprite(SHIP, 14 + i * (shipSize.w + 8), 42, COLORS.player, 2);
  }
  function drawTitle() {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 44px 'Courier New', monospace";
    ctx.fillText('INVADERS', W / 2, H / 2 - 120);
    drawSprite(SQUID[0], W / 2 - 140, H / 2 - 40, COLORS.invA, 4);
    drawSprite(CRAB[0], W / 2 - 30, H / 2 - 40, COLORS.invB, 4);
    drawSprite(OCTO[0], W / 2 + 90, H / 2 - 40, COLORS.invC, 4);
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillText('30 PTS        20 PTS        10 PTS', W / 2, H / 2 + 40);
    drawSprite(UFO_SPR, W / 2 - spriteSize(UFO_SPR).w * 2, H / 2 + 70, COLORS.ufo, 4);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('? MYSTERY', W / 2, H / 2 + 150);
    ctx.font = "bold 22px 'Courier New', monospace";
    if (Math.floor(perfNow() / 500) % 2 === 0) ctx.fillText('PRESS ENTER / TAP TO START', W / 2, H / 2 + 220);
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('← → 移動  /  SPACE 発射', W / 2, H - 40);
  }
  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5b5b';
    ctx.font = "bold 46px 'Courier New', monospace";
    ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
    ctx.fillStyle = COLORS.text;
    ctx.font = "22px 'Courier New', monospace";
    ctx.fillText('SCORE ' + score, W / 2, H / 2 + 10);
    ctx.fillText('HI ' + Math.max(high, score), W / 2, H / 2 + 44);
    ctx.font = "bold 20px 'Courier New', monospace";
    if (Math.floor(perfNow() / 500) % 2 === 0) ctx.fillText('PRESS ENTER / TAP TO RETRY', W / 2, H / 2 + 110);
  }

  // ============================================================
  // ループ（シェル経由）
  // ============================================================
  const h = api.loop((dt) => {
    update(dt);
    render();
  });

  return {
    destroy: () => {
      h.stop();
      host.replaceChildren();
    },
  };
};
