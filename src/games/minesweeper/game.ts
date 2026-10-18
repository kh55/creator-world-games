import type { CreateGame } from '../../engine/runner';
import {
  cellName,
  chord,
  COLS,
  createField,
  type Field,
  flagsLeft,
  isCleared,
  MINES,
  openCell,
  type OpenResult,
  placeMines,
  ROWS,
  scoreFor,
  toggleFlag,
} from './logic';

const LONG_PRESS = 0.4; // 秒
const NUMBER_COLORS = ['', '#4dabf7', '#69db7c', '#ff6b6b', '#b197fc', '#ffa94d', '#3bc9db', '#f783ac', '#ced4da'];

type Phase = 'ready' | 'playing' | 'won' | 'lost';

export const create: CreateGame = (host, api) => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;';

  const status = document.createElement('div');
  status.className = 'ms-status';
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'min-height:22px;text-align:center;letter-spacing:1px;';

  const info = document.createElement('div');
  info.className = 'ms-info';
  info.style.cssText = 'color:var(--neon-dim);letter-spacing:1px;';

  const grid = document.createElement('div');
  grid.className = 'ms-board';
  grid.style.cssText =
    `display:grid;grid-template-columns:repeat(${COLS},1fr);gap:2px;width:min(92vw,400px);aspect-ratio:${COLS}/${ROWS};` +
    'background:var(--line);padding:2px;border-radius:8px;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;';

  const buttonCss =
    'font-family:inherit;font-size:16px;color:var(--neon);background:#061a04;border:2px solid #2a7d1c;' +
    'border-radius:10px;padding:8px 16px;min-height:44px;cursor:pointer;touch-action:manipulation;';
  const flagMode = document.createElement('button');
  flagMode.type = 'button';
  flagMode.className = 'ms-flag-mode';
  flagMode.style.cssText = buttonCss;

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'ms-again';
  again.textContent = 'もう一度';
  again.hidden = true;
  again.style.cssText = buttonCss;

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:10px;';
  controls.append(flagMode, again);

  wrap.append(status, info, grid, controls);

  const cells: HTMLButtonElement[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'ms-cell';
      c.dataset.name = cellName(x, y);
      c.style.cssText =
        'aspect-ratio:1/1;padding:0;border:0;border-radius:3px;cursor:pointer;font-family:inherit;font-weight:bold;' +
        'font-size:min(4.6vw,20px);line-height:1;display:flex;align-items:center;justify-content:center;touch-action:manipulation;';
      cells.push(c);
      grid.appendChild(c);
    }
  }
  host.appendChild(wrap);

  let field: Field = createField(COLS, ROWS);
  let phase: Phase = 'ready';
  let elapsed = 0;
  let shownSeconds = -1;
  let flagging = false;
  // 終了中に押し始めたタップは「次のゲームを始める」操作として扱い、マスは開かない
  let pressStartedWhileOver = false;
  // 長押しで旗を立てた直後の click は捨てる
  let longPressFired = false;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPointerType = '';

  const isOver = () => phase === 'won' || phase === 'lost';

  function renderInfo() {
    shownSeconds = Math.floor(elapsed);
    info.textContent = `💣 残り ${flagsLeft(field, MINES)}　⏱ ${shownSeconds} 秒`;
  }

  function render() {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const st = field.state[i];
      const mine = field.mines[i];
      const n = field.adjacent[i];
      let text = '';
      let bg = '#3d7a2a';
      let shadow = 'inset 2px 2px 0 #5fa847, inset -2px -2px 0 #234a17';
      let color = 'var(--neon)';
      let label: string;
      let state: string = st;
      if (st === 'open' && mine) {
        text = '💥';
        bg = '#7a1010';
        shadow = 'none';
        label = '踏んだ地雷';
        state = 'exploded';
      } else if (st === 'open') {
        bg = '#0b1408';
        shadow = 'none';
        text = n > 0 ? String(n) : '';
        color = NUMBER_COLORS[n] ?? color;
        label = n > 0 ? String(n) : '空白';
      } else if (phase === 'lost' && st === 'flag' && !mine) {
        text = '❌';
        label = '間違った旗';
        state = 'wrong-flag';
      } else if (st === 'flag' || (phase === 'won' && mine)) {
        text = '🚩';
        label = '旗';
        state = 'flag';
      } else if (phase === 'lost' && mine) {
        text = '💣';
        label = '地雷';
        state = 'mine';
      } else {
        label = '隠れたマス';
      }
      cell.textContent = text;
      cell.style.background = bg;
      cell.style.boxShadow = shadow;
      cell.style.color = color;
      cell.style.cursor = isOver() || st === 'open' ? 'default' : 'pointer';
      cell.dataset.state = state;
      cell.setAttribute('aria-label', `${cell.dataset.name} ${label}`);
    }
    flagMode.textContent = flagging ? '🚩 旗モード: ON' : '🚩 旗モード: OFF';
    flagMode.setAttribute('aria-pressed', String(flagging));
    flagMode.style.background = flagging ? '#2a7d1c' : '#061a04';
    flagMode.style.color = flagging ? '#000' : 'var(--neon)';
    renderInfo();
  }

  function newGame() {
    field = createField(COLS, ROWS);
    phase = 'ready';
    elapsed = 0;
    status.textContent = 'マスを開いてスタート';
    again.hidden = true;
    api.setScore(0);
    render();
  }

  function finish(won: boolean) {
    phase = won ? 'won' : 'lost';
    const score = won ? scoreFor(elapsed) : 0;
    status.textContent = won ? `クリア！ ${Math.floor(elapsed)} 秒` : 'ドカン！ 地雷を踏みました';
    again.hidden = false;
    render();
    api.setScore(score);
    api.submitScore(score);
  }

  /** マスを押したときの処理。flag なら旗の切り替え（開いたマスではまとめて開く） */
  function act(i: number, flag: boolean) {
    if (isOver()) return;
    const st = field.state[i];
    if (flag && st !== 'open') {
      if (toggleFlag(field, i)) render();
      return;
    }
    let result: OpenResult;
    if (st === 'open') {
      result = chord(field, i);
    } else if (st === 'flag') {
      return;
    } else {
      if (!field.placed) placeMines(field, MINES, i);
      if (phase === 'ready') {
        phase = 'playing';
        status.textContent = '数字をヒントに地雷を避けよう';
        api.started();
      }
      result = openCell(field, i);
    }
    if (result === 'mine') finish(false);
    else if (isCleared(field)) finish(true);
    else if (result === 'opened') render();
  }

  function retry() {
    if (isOver()) newGame();
  }

  function cancelPress() {
    if (pressTimer !== undefined) clearTimeout(pressTimer);
    pressTimer = undefined;
  }

  const isActivationKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  grid.addEventListener('pointerdown', () => {
    pressStartedWhileOver = isOver();
  });
  cells.forEach((cell, i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    cell.addEventListener('pointerdown', (e) => {
      longPressFired = false;
      lastPointerType = e.pointerType;
      cancelPress();
      if (e.pointerType === 'mouse' || isOver()) return;
      pressTimer = setTimeout(() => {
        pressTimer = undefined;
        longPressFired = true;
        act(i, true);
      }, LONG_PRESS * 1000);
    });
    cell.addEventListener('pointerup', cancelPress);
    cell.addEventListener('pointerleave', cancelPress);
    cell.addEventListener('pointercancel', cancelPress);
    // 右クリックはマウスのときだけ旗。タッチの長押しで出る contextmenu は既定動作を止めるだけ（二重に切り替えない）
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // 右ボタンでは click が来ないので、終了中に押し始めた印はここで消す（次の左クリックを捨てないように）
      if (pressStartedWhileOver) {
        pressStartedWhileOver = false;
        return;
      }
      if (lastPointerType === 'mouse') act(i, true);
    });
    cell.addEventListener('click', () => {
      if (pressStartedWhileOver) {
        pressStartedWhileOver = false;
        return;
      }
      if (longPressFired) {
        longPressFired = false;
        return;
      }
      act(i, flagging);
    });
    // エンジンの window の keydown は Enter / Space の既定動作（click）を止め、Enter を onStart に回す。
    // マスでは自分で処理し、window まで伝えない（最後の一手の Enter がそのままリトライにならないように）
    cell.addEventListener('keydown', (e) => {
      const arrow = ARROWS[e.key];
      if (arrow) {
        e.preventDefault();
        e.stopPropagation();
        const nx = Math.min(COLS - 1, Math.max(0, x + arrow[0]));
        const ny = Math.min(ROWS - 1, Math.max(0, y + arrow[1]));
        cells[ny * COLS + nx].focus();
        return;
      }
      const isFlagKey = e.key === 'f' || e.key === 'F';
      if (!isActivationKey(e) && !isFlagKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // 押しっぱなしのキーリピートでは開かない・リトライしない
      if (isOver()) {
        if (!isFlagKey) retry();
      } else act(i, isFlagKey);
    });
  });
  flagMode.addEventListener('click', () => {
    flagging = !flagging;
    render();
  });
  again.addEventListener('click', retry);
  for (const b of [flagMode, again]) {
    b.addEventListener('keydown', (e) => {
      if (!isActivationKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      b.click();
    });
  }
  // 終了後はステージのタップや Enter でも次のゲームを始める（プレイ中は無視）
  api.input.onStart(retry);

  const h = api.loop((dt) => {
    if (phase !== 'playing') return;
    elapsed += dt;
    if (Math.floor(elapsed) !== shownSeconds) renderInfo();
  });

  newGame();

  return {
    destroy: () => {
      cancelPress();
      h.stop();
      host.replaceChildren();
    },
  };
};
