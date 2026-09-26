import { describe, expect, it } from 'vitest';
import { createInput } from './input';

type FakeEl = EventTarget & { closest(sel: string): FakeEl | null; tag: string; parent?: FakeEl };

function el(tag: string, parent?: FakeEl): FakeEl {
  const t = new EventTarget() as FakeEl;
  t.tag = tag;
  t.parent = parent;
  t.closest = (sel) => {
    const tags = sel.split(',').map((s) => s.trim());
    for (let cur: FakeEl | undefined = t; cur; cur = cur.parent) if (tags.includes(cur.tag)) return cur;
    return null;
  };
  return t;
}

function key(type: 'keydown' | 'keyup', code: string, target: FakeEl | null = null) {
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, 'code', { value: code });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

function withContains(node: FakeEl): FakeEl & { contains(n: unknown): boolean } {
  const n2 = node as FakeEl & { contains(n: unknown): boolean };
  n2.contains = (n) => {
    for (let cur = n as FakeEl | undefined; cur; cur = cur.parent) if (cur === n2) return true;
    return false;
  };
  return n2;
}

function setup(extra: { isActive?: () => boolean } = {}) {
  const win = new EventTarget();
  const touchbar = withContains(el('div'));
  const input = createInput({ keyTarget: win, touchbar: touchbar as unknown as HTMLElement, ...extra });
  return { win, touchbar, input };
}

describe('createInput（キーボード）', () => {
  it('対応キーを押している間だけ isDown が true', () => {
    const { win, input } = setup();
    win.dispatchEvent(key('keydown', 'ArrowLeft'));
    expect(input.isDown('left')).toBe(true);
    win.dispatchEvent(key('keyup', 'ArrowLeft'));
    expect(input.isDown('left')).toBe(false);
  });

  it('Enter で onStart を呼び、既定動作を止める', () => {
    const { win, input } = setup();
    let started = 0;
    input.onStart(() => void started++);
    const e = key('keydown', 'Enter');
    win.dispatchEvent(e);
    expect(started).toBe(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('リンクにフォーカスがあるときの Enter はゲームに渡さず、既定動作も止めない', () => {
    const { win, input } = setup();
    let started = 0;
    input.onStart(() => void started++);
    const e = key('keydown', 'Enter', el('a'));
    win.dispatchEvent(e);
    expect(started).toBe(0);
    expect(e.defaultPrevented).toBe(false);
  });

  it('touchbar 以外のボタンにフォーカスがあるときの Space もゲームに渡さない', () => {
    const { win, input } = setup();
    const e = key('keydown', 'Space', el('button'));
    win.dispatchEvent(e);
    expect(input.isDown('fire')).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it('touchbar のボタンにフォーカスがあってもゲームのキーとして扱う', () => {
    const { win, touchbar, input } = setup();
    win.dispatchEvent(key('keydown', 'Space', el('button', touchbar)));
    expect(input.isDown('fire')).toBe(true);
  });

  it('destroy 後はキーに反応しない', () => {
    const { win, input } = setup();
    input.destroy();
    win.dispatchEvent(key('keydown', 'ArrowLeft'));
    expect(input.isDown('left')).toBe(false);
  });

  it('isActive が false を返す間はキーを無視し、既定動作も止めない（解説スクロール用）', () => {
    let active = false;
    const { win, input } = setup({ isActive: () => active });
    const e = key('keydown', 'ArrowDown');
    win.dispatchEvent(e);
    expect(input.isDown('down')).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it('isActive が true なら従来どおり動作する', () => {
    let active = true;
    const { win, input } = setup({ isActive: () => active });
    const e = key('keydown', 'ArrowDown');
    win.dispatchEvent(e);
    expect(input.isDown('down')).toBe(true);
    expect(e.defaultPrevented).toBe(true);
  });

  it('isActive 省略時は常に有効', () => {
    const { win, input } = setup();
    const e = key('keydown', 'ArrowDown');
    win.dispatchEvent(e);
    expect(input.isDown('down')).toBe(true);
  });

  it('pointerTarget（stage）内のボタンにフォーカスがあっても Enter をゲームに渡す（Ruling R8）', () => {
    const win = new EventTarget();
    const pointerTarget = withContains(el('div'));
    const input = createInput({ keyTarget: win, pointerTarget: pointerTarget as unknown as HTMLElement });
    let started = 0;
    input.onStart(() => void started++);
    const e = key('keydown', 'Enter', el('button', pointerTarget));
    win.dispatchEvent(e);
    expect(started).toBe(1);
  });
});

describe('createInput（ポインタでのフォーカス解除）', () => {
  function fakePointerEvent() {
    const e = new Event('pointerdown', { cancelable: true }) as PointerEvent;
    Object.defineProperty(e, 'clientX', { value: 0 });
    Object.defineProperty(e, 'clientY', { value: 0 });
    return e;
  }

  it('stage 外の要素（パンくずリンクなど）にフォーカスが残っていたら pointerdown で blur する', () => {
    const win = new EventTarget();
    const pointerTarget = withContains(el('div')) as unknown as HTMLElement & {
      getBoundingClientRect(): { left: number; top: number };
    };
    (pointerTarget as unknown as { getBoundingClientRect(): { left: number; top: number } }).getBoundingClientRect = () => ({
      left: 0,
      top: 0,
    });
    let blurred = 0;
    const link = el('a');
    (link as FakeEl & { blur(): void }).blur = () => void blurred++;
    const body = el('body');
    const doc = { activeElement: link, body } as unknown as Document;
    createInput({ keyTarget: win, pointerTarget, doc });
    pointerTarget.dispatchEvent(fakePointerEvent());
    expect(blurred).toBe(1);
  });

  it('body にフォーカスがある場合は blur を呼ばない', () => {
    const win = new EventTarget();
    const pointerTarget = withContains(el('div')) as unknown as HTMLElement & {
      getBoundingClientRect(): { left: number; top: number };
    };
    (pointerTarget as unknown as { getBoundingClientRect(): { left: number; top: number } }).getBoundingClientRect = () => ({
      left: 0,
      top: 0,
    });
    const body = el('body');
    let blurred = 0;
    (body as FakeEl & { blur(): void }).blur = () => void blurred++;
    const doc = { activeElement: body, body } as unknown as Document;
    createInput({ keyTarget: win, pointerTarget, doc });
    pointerTarget.dispatchEvent(fakePointerEvent());
    expect(blurred).toBe(0);
  });
});
