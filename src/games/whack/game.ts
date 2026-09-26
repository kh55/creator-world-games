import type { CreateGame } from '../../engine/runner';
import { difficulty, DURATION, HOLES } from './logic';

interface Mole {
  up: boolean;
  ttl: number;
}

export const create: CreateGame = (host, api) => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;';

  const info = document.createElement('div');
  info.className = 'whack-info';
  info.style.cssText = 'letter-spacing:1px;';
  const timeEl = document.createElement('b');
  timeEl.className = 'wtime';
  timeEl.textContent = '30.0';
  info.append('のこり ', timeEl, 's');

  const grid = document.createElement('div');
  grid.className = 'whack-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:min(92vw,360px);';

  const msgEl = document.createElement('div');
  msgEl.className = 'whack-msg';
  msgEl.style.cssText = 'min-height:22px;color:var(--neon-dim);text-align:center;';

  wrap.append(info, grid, msgEl);

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < HOLES; i++) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'whack-hole';
    c.style.cssText =
      'aspect-ratio:1/1;min-height:80px;font-size:40px;line-height:1;border-radius:14px;' +
      'border:2px solid var(--line);background:#0b1408;color:var(--neon);touch-action:manipulation;cursor:pointer;';
    c.textContent = '';
    cells.push(c);
    grid.appendChild(c);
  }
  host.appendChild(wrap);

  let running = false;
  let score = 0;
  let timeLeft = DURATION;
  let elapsed = 0;
  let spawnTimer = 0;
  const moles: Mole[] = cells.map(() => ({ up: false, ttl: 0 }));

  function reset() {
    running = true;
    score = 0;
    timeLeft = DURATION;
    elapsed = 0;
    spawnTimer = 0;
    moles.forEach((m, idx) => {
      m.up = false;
      m.ttl = 0;
      cells[idx].textContent = '';
    });
    api.setScore(0);
    msgEl.textContent = '';
    api.started();
  }

  function spawn() {
    const down: number[] = [];
    for (let i = 0; i < moles.length; i++) if (!moles[i].up) down.push(i);
    if (!down.length) return;
    const idx = down[Math.floor(Math.random() * down.length)];
    const d = difficulty(elapsed);
    moles[idx].up = true;
    moles[idx].ttl = d.upMin + Math.random() * (d.upMax - d.upMin);
    cells[idx].textContent = '🐹';
  }

  function whack(idx: number) {
    if (!running || !moles[idx].up) return;
    moles[idx].up = false;
    moles[idx].ttl = 0;
    cells[idx].textContent = '💥';
    score += 1;
    api.setScore(score);
    const cell = cells[idx];
    window.setTimeout(() => {
      if (cell.textContent === '💥') cell.textContent = '';
    }, 120);
  }
  cells.forEach((cell, idx) => cell.addEventListener('click', () => whack(idx)));

  function end() {
    running = false;
    moles.forEach((m, idx) => {
      m.up = false;
      cells[idx].textContent = '';
    });
    const rec = api.submitScore(score);
    msgEl.textContent = 'しゅうりょう！ スコア ' + score + (rec ? ' 🏆新記録！' : '') + ' — タップでもう一度';
  }

  api.input.onStart(() => {
    if (!running) reset();
  });

  reset();
  const h = api.loop((dt) => {
    if (!running) return;
    timeLeft -= dt;
    elapsed += dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      timeEl.textContent = '0.0';
      end();
      return;
    }
    timeEl.textContent = timeLeft.toFixed(1);
    const d = difficulty(elapsed);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawn();
      spawnTimer = d.gap;
    }
    for (let i = 0; i < moles.length; i++) {
      if (moles[i].up) {
        moles[i].ttl -= dt;
        if (moles[i].ttl <= 0) {
          moles[i].up = false;
          cells[i].textContent = '';
        }
      }
    }
  });

  return {
    destroy: () => {
      h.stop();
      host.replaceChildren();
    },
  };
};
