import { describe, expect, it } from 'vitest';
import type { LoopEnv } from './loop';
import { runGame, type CreateGame, type GameElements } from './runner';
import { createScoreStore } from './storage';

function fakeEl() {
  const t = new EventTarget() as EventTarget & {
    textContent: string;
    clientWidth: number;
    clientHeight: number;
    cleared: number;
    replaceChildren(): void;
    contains(): boolean;
    getBoundingClientRect(): { left: number; top: number };
  };
  t.textContent = '';
  t.clientWidth = 320;
  t.clientHeight = 480;
  t.cleared = 0;
  t.replaceChildren = () => void t.cleared++;
  t.contains = () => false;
  t.getBoundingClientRect = () => ({ left: 0, top: 0 });
  return t;
}

const noopLoop: LoopEnv = { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, isHidden: () => false };

function setup(create: CreateGame) {
  const els = { stage: fakeEl(), touchbar: fakeEl(), score: fakeEl(), best: fakeEl() };
  const win = new EventTarget() as EventTarget & { dataLayer?: unknown[] };
  const store = createScoreStore(() => undefined);
  const handle = runGame('tetris', create, els as unknown as GameElements, { win, store, loopEnv: noopLoop });
  return { els, win, store, handle };
}

describe('runGame', () => {
  it('SCORE と BEST を表示し、ゲームに stage と api を渡す', () => {
    let host: unknown;
    const { els } = setup((h, api) => {
      host = h;
      api.setScore(12.7);
      expect(api.stageSize).toEqual({ w: 320, h: 480 });
    });
    expect(host).toBe(els.stage);
    expect(els.score.textContent).toBe('12');
    expect(els.best.textContent).toBe('0');
  });

  it('started() で game_start を 1 回ずつ積む', () => {
    let api!: Parameters<CreateGame>[1];
    const { win } = setup((_h, a) => void (api = a));
    api.started();
    api.started();
    expect(win.dataLayer).toEqual([
      { event: 'game_start', game_id: 'tetris' },
      { event: 'game_start', game_id: 'tetris' },
    ]);
  });

  it('submitScore() で game_over を積み、ハイスコアなら BEST を更新する', () => {
    let api!: Parameters<CreateGame>[1];
    const { win, els, store } = setup((_h, a) => void (api = a));
    expect(api.submitScore(300)).toBe(true);
    expect(api.submitScore(100)).toBe(false);
    expect(win.dataLayer).toEqual([
      { event: 'game_over', game_id: 'tetris', score: 300 },
      { event: 'game_over', game_id: 'tetris', score: 100 },
    ]);
    expect(els.best.textContent).toBe('300');
    expect(store.getHighScore('tetris')).toBe(300);
  });

  it('既存の dataLayer（GTM が作ったもの）に追記する', () => {
    const els = { stage: fakeEl(), touchbar: fakeEl(), score: fakeEl(), best: fakeEl() };
    const win = Object.assign(new EventTarget(), { dataLayer: [{ event: 'gtm.js' }] as unknown[] });
    let api!: Parameters<CreateGame>[1];
    runGame('whack', (_h, a) => void (api = a), els as unknown as GameElements, {
      win,
      store: createScoreStore(() => undefined),
      loopEnv: noopLoop,
    });
    api.started();
    expect(win.dataLayer).toEqual([{ event: 'gtm.js' }, { event: 'game_start', game_id: 'whack' }]);
  });

  it('close() で onQuit・ループ停止・destroy・stage の片付けを行う', () => {
    const calls: string[] = [];
    const { els, handle } = setup((_h, api) => {
      api.onQuit(() => calls.push('quit'));
      api.loop(() => {});
      return { destroy: () => calls.push('destroy') };
    });
    handle.close();
    handle.close();
    expect(calls).toEqual(['quit', 'destroy']);
    expect(els.stage.cleared).toBe(1);
  });

  it('create が例外を投げたら stage にメッセージを出す', () => {
    const { els } = setup(() => {
      throw new Error('boom');
    });
    expect(els.stage.textContent).toBe('読み込みに失敗しました。ページを再読み込みしてください。');
  });

  it('loop.stop() が例外を投げても destroy と cleanup を行う', () => {
    const calls: string[] = [];
    const throwingLoop: LoopEnv = {
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {
        throw new Error('cancel failed');
      },
      isHidden: () => false,
    };
    const els = { stage: fakeEl(), touchbar: fakeEl(), score: fakeEl(), best: fakeEl() };
    const win = new EventTarget() as EventTarget & { dataLayer?: unknown[] };
    const store = createScoreStore(() => undefined);
    const handle = runGame('tetris', (_h, api) => {
      api.loop(() => {});
      return { destroy: () => calls.push('destroy') };
    }, els as unknown as GameElements, { win, store, loopEnv: throwingLoop });
    handle.close();
    expect(calls).toEqual(['destroy']);
    expect(els.stage.cleared).toBe(1);
  });
});
