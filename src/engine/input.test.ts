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

function setup() {
  const win = new EventTarget();
  const touchbar = el('div');
  (touchbar as FakeEl & { contains(n: unknown): boolean }).contains = (n) => {
    for (let cur = n as FakeEl | undefined; cur; cur = cur.parent) if (cur === touchbar) return true;
    return false;
  };
  const input = createInput({ keyTarget: win, touchbar: touchbar as unknown as HTMLElement });
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
});
