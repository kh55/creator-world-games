import type { CreateGame } from '../../engine/runner';
import {
  applyMove,
  BLACK,
  type Board,
  cellName,
  chooseCpuMove,
  type Color,
  count,
  createBoard,
  finalScore,
  flipsFor,
  type Move,
  nextTurn,
  WHITE,
} from './logic';

const CPU_DELAY = 0.5; // 秒

type Phase = 'player' | 'cpu' | 'over';

export const create: CreateGame = (host, api) => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;';

  const status = document.createElement('div');
  status.className = 'reversi-status';
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'min-height:22px;text-align:center;letter-spacing:1px;';

  const counts = document.createElement('div');
  counts.className = 'reversi-counts';
  counts.style.cssText = 'color:var(--neon-dim);letter-spacing:1px;';

  const grid = document.createElement('div');
  grid.className = 'reversi-board';
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(8,1fr);gap:2px;width:min(92vw,400px);aspect-ratio:1/1;' +
    'background:var(--line);padding:2px;border-radius:8px;';

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'reversi-again';
  again.textContent = 'もう一度';
  again.hidden = true;
  again.style.cssText =
    'font-family:inherit;font-size:16px;color:var(--neon);background:#061a04;border:2px solid #2a7d1c;' +
    'border-radius:10px;padding:8px 16px;min-height:44px;cursor:pointer;';

  wrap.append(status, counts, grid, again);

  const cells: HTMLButtonElement[] = [];
  const discs: HTMLSpanElement[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'reversi-cell';
      c.dataset.name = cellName(x, y);
      c.style.cssText =
        'position:relative;aspect-ratio:1/1;padding:0;border:0;background:#0b1408;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;touch-action:manipulation;';
      const d = document.createElement('span');
      d.style.cssText = 'display:block;border-radius:50%;';
      c.appendChild(d);
      cells.push(c);
      discs.push(d);
      grid.appendChild(c);
    }
  }
  host.appendChild(wrap);

  let board: Board = createBoard();
  let phase: Phase = 'player';
  let started = false;
  let lastCpu: Move | null = null;
  let cpuTimer = 0;
  // 終局中に押し始めたタップは「新しい局を始める」操作として扱い、石は置かない
  let pressStartedWhileOver = false;

  function render() {
    const { black, white } = count(board);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = y * 8 + x;
        const v = board[y][x];
        const canPlace = phase === 'player' && flipsFor(board, x, y, BLACK).length > 0;
        const disc = discs[i];
        if (v === BLACK || v === WHITE) {
          disc.style.width = '78%';
          disc.style.height = '78%';
          disc.style.background = v === BLACK ? '#111' : '#f5f5f5';
          disc.style.border = v === BLACK ? '2px solid #39ff14' : '2px solid #bbb';
        } else if (canPlace) {
          disc.style.width = '18%';
          disc.style.height = '18%';
          disc.style.background = 'var(--neon-dim)';
          disc.style.border = '0';
        } else {
          disc.style.width = '0';
          disc.style.height = '0';
          disc.style.background = 'transparent';
          disc.style.border = '0';
        }
        const cell = cells[i];
        cell.toggleAttribute('data-legal', canPlace);
        const isLast = lastCpu !== null && lastCpu[0] === x && lastCpu[1] === y;
        cell.style.outline = isLast ? '2px solid #ffd43b' : 'none';
        cell.style.outlineOffset = '-2px';
        const label = v === BLACK ? '黒' : v === WHITE ? '白' : canPlace ? '空き・置ける' : '空き';
        cell.setAttribute('aria-label', `${cellName(x, y)} ${label}`);
      }
    }
    counts.textContent = `黒 ${black} / 白 ${white}`;
    api.setScore(phase === 'over' ? finalScore(board) : black);
  }

  function newGame() {
    board = createBoard();
    phase = 'player';
    started = false;
    lastCpu = null;
    status.textContent = 'あなたの番（黒）';
    again.hidden = true;
    render();
  }

  function finish() {
    phase = 'over';
    const { black, white } = count(board);
    if (black > white) status.textContent = `あなたの勝ち！ ${black} 対 ${white}`;
    else if (black < white) status.textContent = `あなたの負け… ${black} 対 ${white}`;
    else status.textContent = `引き分け ${black} 対 ${white}`;
    again.hidden = false;
    render();
    api.submitScore(finalScore(board));
  }

  /** justMoved が打った（またはパスした）後の手番へ進める */
  function advance(justMoved: Color) {
    const turn = nextTurn(board, justMoved);
    if (turn === null) {
      finish();
      return;
    }
    if (turn === BLACK) {
      phase = 'player';
      status.textContent = justMoved === BLACK ? 'CPU はパスしました。あなたの番（黒）' : 'あなたの番（黒）';
    } else {
      phase = 'cpu';
      cpuTimer = CPU_DELAY;
      status.textContent = justMoved === WHITE ? 'あなたはパスです。CPU が考えています…' : 'CPU が考えています…';
    }
    render();
  }

  function playerMove(x: number, y: number) {
    if (phase !== 'player') return;
    if (flipsFor(board, x, y, BLACK).length === 0) return;
    if (!started) {
      started = true;
      api.started();
    }
    board = applyMove(board, x, y, BLACK);
    lastCpu = null;
    advance(BLACK);
  }

  function cpuMove() {
    const move = chooseCpuMove(board, WHITE);
    if (move) {
      board = applyMove(board, move[0], move[1], WHITE);
      lastCpu = move;
    }
    advance(WHITE);
  }

  function retry() {
    if (phase === 'over') newGame();
  }

  const isActivationKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  grid.addEventListener('pointerdown', () => {
    pressStartedWhileOver = phase === 'over';
  });
  cells.forEach((cell, i) => {
    const x = i % 8;
    const y = Math.floor(i / 8);
    cell.addEventListener('click', () => {
      if (pressStartedWhileOver) {
        pressStartedWhileOver = false;
        return;
      }
      playerMove(x, y);
    });
    // エンジンの window の keydown は Enter / Space の既定動作（click）を止め、Enter を onStart に回す。
    // マスでは自分で処理し、window まで伝えない（最後の一手の Enter がそのままリトライにならないように）
    cell.addEventListener('keydown', (e) => {
      if (!isActivationKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // 押しっぱなしのキーリピートでは打たない・リトライしない
      if (phase === 'over') retry();
      else playerMove(x, y);
    });
  });
  again.addEventListener('click', retry);
  again.addEventListener('keydown', (e) => {
    if (!isActivationKey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    retry();
  });
  // 終局後はステージのタップや Enter でも新しい局を始める（プレイ中は無視）
  api.input.onStart(retry);

  const h = api.loop((dt) => {
    if (phase !== 'cpu') return;
    cpuTimer -= dt;
    if (cpuTimer <= 0) cpuMove();
  });

  newGame();

  return {
    destroy: () => {
      h.stop();
      host.replaceChildren();
    },
  };
};
