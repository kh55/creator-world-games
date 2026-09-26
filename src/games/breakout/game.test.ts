import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Action, ButtonSpec, GameInput, PointerInfo } from '../../engine/input';
import type { LoopHandle } from '../../engine/loop';
import type { GameApi } from '../../engine/runner';
import { create } from './game';

// game.ts は document.createElement('canvas') を直接呼ぶため、Vitest の node
// 環境用に最小限の canvas / 2D context をグローバルにスタブする。
function fakeCtx(): CanvasRenderingContext2D {
  const ctx = {
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function stubDocument() {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => fakeCtx(),
    getBoundingClientRect: () => ({ width: 480, height: 640 }),
  } as unknown as HTMLCanvasElement;
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'canvas' ? canvas : ({} as unknown as HTMLElement)),
  });
}

/** api.input の最小限フェイク。onStart で登録されたコールバックを保持して、テストから直接叩けるようにする。 */
function fakeInput(): GameInput & { fireStart(): void; isDownMap: Partial<Record<Action, boolean>> } {
  const startCbs: (() => void)[] = [];
  const isDownMap: Partial<Record<Action, boolean>> = {};
  return {
    keys: {},
    isDown: (a) => !!isDownMap[a],
    onPointer: (_cb: (p: PointerInfo) => void) => {},
    onStart: (cb) => void startCbs.push(cb),
    addButton: (_spec: ButtonSpec) => ({}) as HTMLButtonElement,
    destroy: () => {},
    fireStart: () => startCbs.forEach((f) => f()),
    isDownMap,
  };
}

function fakeApi() {
  const loopFns: ((dt: number) => void)[] = [];
  const input = fakeInput();
  const api: GameApi = {
    setScore: vi.fn(),
    submitScore: vi.fn(() => false),
    getHighScore: vi.fn(() => 0),
    started: vi.fn(),
    loop: (fn) => {
      loopFns.push(fn);
      return { stop: () => {} } as LoopHandle;
    },
    input,
    onQuit: () => {},
    get stageSize() {
      return { w: 480, h: 640 };
    },
  };
  return {
    api,
    input,
    /** api.loop に渡された最後のコールバックを 1 フレーム分呼ぶ */
    frame: (dt: number) => loopFns[loopFns.length - 1]?.(dt),
  };
}

describe('breakout game.ts: リトライ後の game_start 再送（I1）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GAME OVER からリトライして発射すると、2 回目の api.started() を呼ぶ', () => {
    stubDocument();
    const host = { appendChild: () => {}, replaceChildren: () => {} } as unknown as HTMLElement;
    const { api, input, frame } = fakeApi();

    create(host, api);

    // 1 回目の発射
    input.fireStart();
    expect(api.started).toHaveBeenCalledTimes(1);

    // 大きな dt を 2 フレーム与えて、壁で跳ね返ってから画面外まで一気に落とす。
    // パドル位置に関係なく（衝突判定はその場フレームの座標だけを見るため）確実にライフを失わせる、
    // タイミングに依存しない決定的な方法。3 回落として GAME OVER にする。
    for (let life = 0; life < 3; life++) {
      frame(5); // 上壁で反射（vy が反転）
      frame(5); // 反射後、画面下まで一気に通過してライフを失う
      if (life < 2) input.fireStart(); // 次のライフの発射（状態は READY のはず）
    }
    expect(api.submitScore).toHaveBeenCalledTimes(1);
    expect(api.started).toHaveBeenCalledTimes(1); // GAME OVER まではまだ 1 回だけ

    // リトライ: GAME OVER 中の 1 回目の fireStart は startGame() だけ呼び、まだ発射しない
    input.fireStart();
    expect(api.started).toHaveBeenCalledTimes(1);

    // 2 回目の fireStart で launch() が呼ばれ、fresh がリセットされているため
    // 2 回目の api.started() が送られる（このリセットが I1 の修正内容）
    input.fireStart();
    expect(api.started).toHaveBeenCalledTimes(2);
  });
});

describe('breakout game.ts: Space（fire）で発射・リトライ', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    stubDocument();
    const host = { appendChild: () => {}, replaceChildren: () => {} } as unknown as HTMLElement;
    const env = fakeApi();
    create(host, env.api);
    return env;
  }

  /** 大きな dt で上壁に跳ね返してから画面外まで落とし、ライフを 1 つ失わせる */
  function dropBall(frame: (dt: number) => void) {
    frame(5);
    frame(5);
  }

  it('待機中に Space を押すと発射して api.started() を呼ぶ', () => {
    const { api, input, frame } = setup();
    frame(0.016);
    expect(api.started).not.toHaveBeenCalled();
    input.isDownMap.fire = true;
    frame(0.016);
    expect(api.started).toHaveBeenCalledTimes(1);
  });

  it('ページを開いた時点で Space が押されたままでも発射しない', () => {
    stubDocument();
    const host = { appendChild: () => {}, replaceChildren: () => {} } as unknown as HTMLElement;
    const { api, input, frame } = fakeApi();
    input.isDownMap.fire = true;
    create(host, api);
    frame(0.016);
    expect(api.started).not.toHaveBeenCalled();
  });

  it('Space を押しっぱなしのままではリトライせず、押し直すとリトライする', () => {
    const { api, input, frame } = setup();
    input.isDownMap.fire = true;
    frame(0.016); // 発射
    for (let life = 0; life < 3; life++) {
      dropBall(frame);
      if (life < 2) {
        // 次のライフも Space で発射する（いったん離して押し直す）
        input.isDownMap.fire = false;
        frame(0.016);
        input.isDownMap.fire = true;
        frame(0.016);
      }
    }
    expect(api.submitScore).toHaveBeenCalledTimes(1);
    const setScoreCalls = vi.mocked(api.setScore).mock.calls.length;

    // 押しっぱなしのままではリトライしない
    frame(0.016);
    expect(vi.mocked(api.setScore).mock.calls.length).toBe(setScoreCalls);

    // 離して押し直すとリトライ（startGame が setScore(0) を呼ぶ）
    input.isDownMap.fire = false;
    frame(0.016);
    input.isDownMap.fire = true;
    frame(0.016);
    expect(vi.mocked(api.setScore).mock.calls.at(-1)).toEqual([0]);

    // リトライ後、もう一度押し直すと発射して 2 回目の game_start を送る
    input.isDownMap.fire = false;
    frame(0.016);
    input.isDownMap.fire = true;
    frame(0.016);
    expect(api.started).toHaveBeenCalledTimes(2);
  });
});
