// 1 ページで 1 つのゲームを起動する。SCORE / BEST の表示とハイスコアの保存、GA4 用のイベント送信を受け持つ。
import { createInput, type GameInput } from './input';
import { createLoop, type LoopEnv, type LoopHandle } from './loop';
import { scores, type ScoreStore } from './storage';

export interface GameApi {
  setScore(n: number): void;
  /** ゲームオーバー時にだけ呼ぶ。ハイスコアなら true */
  submitScore(n: number): boolean;
  getHighScore(): number;
  /** プレイを開始したときに呼ぶ */
  started(): void;
  loop(fn: (dt: number) => void): LoopHandle;
  input: GameInput;
  onQuit(fn: () => void): void;
  readonly stageSize: { w: number; h: number };
}

export type GameInstance = { destroy?(): void } | void;
export type CreateGame = (host: HTMLElement, api: GameApi) => GameInstance;

export interface GameElements {
  stage: HTMLElement;
  touchbar: HTMLElement;
  score: HTMLElement;
  best: HTMLElement;
}

export interface RunnerEnv {
  win: EventTarget & { dataLayer?: unknown[] };
  store: ScoreStore;
  loopEnv?: LoopEnv;
  doc?: Document;
  /** false の間はキー入力を無視する（例: ゲームの stage が画面外にスクロールしている） */
  isActive?: () => boolean;
}

export function runGame(slug: string, create: CreateGame, els: GameElements, env: RunnerEnv): { close(): void } {
  const { win, store } = env;
  const track = (data: Record<string, unknown>) => (win.dataLayer = win.dataLayer ?? []).push(data);
  const input = createInput({
    keyTarget: win,
    pointerTarget: els.stage,
    touchbar: els.touchbar,
    doc: env.doc,
    isActive: env.isActive,
  });
  const loops: LoopHandle[] = [];
  const quitCbs: (() => void)[] = [];
  let instance: GameInstance;
  let closed = false;

  els.score.textContent = '0';
  els.best.textContent = String(store.getHighScore(slug));

  const api: GameApi = {
    setScore: (n) => void (els.score.textContent = String(Math.floor(n))),
    submitScore(n) {
      const score = Math.floor(n);
      track({ event: 'game_over', game_id: slug, score });
      const record = store.submitScore(slug, score);
      if (record) els.best.textContent = String(store.getHighScore(slug));
      return record;
    },
    getHighScore: () => store.getHighScore(slug),
    started: () => void track({ event: 'game_start', game_id: slug }),
    loop(fn) {
      const h = createLoop(fn, env.loopEnv);
      loops.push(h);
      return h;
    },
    input,
    onQuit: (fn) => void quitCbs.push(fn),
    get stageSize() {
      return { w: els.stage.clientWidth, h: els.stage.clientHeight };
    },
  };

  try {
    instance = create(els.stage, api);
  } catch (e) {
    console.error('game create failed:', e);
    els.stage.textContent = '読み込みに失敗しました。ページを再読み込みしてください。';
  }

  return {
    close() {
      if (closed) return;
      closed = true;
      for (const f of quitCbs) {
        try {
          f();
        } catch (e) {
          console.error(e);
        }
      }
      for (const h of loops) {
        try {
          h.stop();
        } catch (e) {
          console.error(e);
        }
      }
      input.destroy();
      try {
        instance?.destroy?.();
      } catch (e) {
        console.error(e);
      }
      els.stage.replaceChildren();
      els.touchbar.replaceChildren();
    },
  };
}

/** GameLayout の要素を探してゲームを起動する。ブラウザ専用 */
export function mountGame(slug: string, create: CreateGame): void {
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);
  const stage = q('[data-stage]');
  const touchbar = q('[data-touchbar]');
  const score = q('[data-score]');
  const best = q('[data-best]');
  if (!stage || !touchbar || !score || !best) return;

  // 解説までスクロールして stage が画面外に出ている間は、↑↓・Space などのキー入力をページのスクロールに譲る（Ruling R6）
  let visible = true;
  let observer: IntersectionObserver | undefined;
  const section = stage.closest<HTMLElement>('[data-game]');
  if (section && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(section);
  }

  const handle = runGame(
    slug,
    create,
    { stage, touchbar, score, best },
    { win: window, store: scores, isActive: () => visible },
  );
  window.addEventListener('pagehide', () => {
    observer?.disconnect();
    handle.close();
  });
  // 「戻る」で bfcache から復帰したときは片付け済みなので、読み込み直して起動し直す
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) window.location.reload();
  });
}
