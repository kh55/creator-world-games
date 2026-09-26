// SRC common/input.js の移植。差分は次の 4 点のみ:
// 1. create(opts) -> export function createInput(opts): GameInput、root.GameInput -> export const KEYMAP / export function createInput
// 2. onKeyDown の先頭でゲーム外の操作部品にフォーカスがあるときは何もしない（isForeignControl）
// 3. touchbar.innerHTML = '' -> touchbar.replaceChildren()
// 4. document / window の既定値は使用箇所（addButton / createInput 先頭）で遅延評価する

export const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'fire',
  Enter: 'start',
};

export type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'start';

export interface PointerInfo {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
}

export interface ButtonSpec {
  label: string;
  action: Action;
  ariaLabel?: string;
}

export interface InputOptions {
  keyTarget?: EventTarget;
  pointerTarget?: HTMLElement | null;
  touchbar?: HTMLElement | null;
  doc?: Document;
  /** false の間はキー入力を無視し、既定動作も止めない（解説までスクロールしている等） */
  isActive?: () => boolean;
}

export interface GameInput {
  keys: Record<string, boolean>;
  isDown(action: Action): boolean;
  onPointer(cb: (p: PointerInfo) => void): void;
  onStart(cb: () => void): void;
  addButton(spec: ButtonSpec): HTMLButtonElement;
  destroy(): void;
}

const INTERACTIVE = 'a, button, input, select, textarea, summary, [contenteditable]';

function isForeignControl(target: EventTarget | null, touchbar: HTMLElement | null, pointerTarget: HTMLElement | null): boolean {
  const el = target as (Element & { closest?: (s: string) => Element | null }) | null;
  const control = el?.closest?.(INTERACTIVE) ?? null;
  if (!control) return false;
  const inTouchbar = !!(touchbar && touchbar.contains(control));
  const inPointerTarget = !!(pointerTarget && pointerTarget.contains(control));
  return !(inTouchbar || inPointerTarget);
}

interface ListenerRecord {
  target: EventTarget;
  type: string;
  fn: EventListener;
  opt?: boolean | AddEventListenerOptions;
}

export function createInput(opts: InputOptions = {}): GameInput {
  const keyTarget = opts.keyTarget ?? window;
  const pointerTarget = opts.pointerTarget ?? null;
  const touchbar = opts.touchbar ?? null;
  const isActive = opts.isActive ?? (() => true);
  const keys: Record<string, boolean> = {}; // e.code -> bool
  const actions: Record<string, number> = {}; // action -> count of holders
  let pointerCbs: ((p: PointerInfo) => void)[] = [];
  let startCbs: (() => void)[] = [];
  let listeners: ListenerRecord[] = [];

  function on(target: EventTarget, type: string, fn: EventListener, opt?: boolean | AddEventListenerOptions) {
    target.addEventListener(type, fn, opt);
    listeners.push({ target, type, fn, opt });
  }

  function setAction(a: Action | undefined, v: boolean) {
    if (!a) return;
    actions[a] = Math.max(0, (actions[a] || 0) + (v ? 1 : -1));
  }

  function onKeyDown(e: Event) {
    if (isForeignControl(e.target, touchbar, pointerTarget)) return;
    if (!isActive()) return;
    const code = (e as KeyboardEvent).code;
    const a = KEYMAP[code];
    if (a) {
      if (!keys[code]) {
        keys[code] = true;
        setAction(a, true);
      }
      e.preventDefault();
      if (a === 'start') startCbs.forEach((f) => f());
    }
  }

  function onKeyUp(e: Event) {
    const code = (e as KeyboardEvent).code;
    const a = KEYMAP[code];
    if (a && keys[code]) {
      keys[code] = false;
      setAction(a, false);
    }
  }

  on(keyTarget, 'keydown', onKeyDown);
  on(keyTarget, 'keyup', onKeyUp);

  function relXY(e: PointerEvent) {
    const r = pointerTarget!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  if (pointerTarget) {
    on(pointerTarget, 'pointerdown', ((e: PointerEvent) => {
      const doc = opts.doc ?? (typeof document !== 'undefined' ? document : undefined);
      const active = doc?.activeElement as (Element & { blur?: () => void }) | null | undefined;
      if (
        active &&
        active !== doc?.body &&
        !pointerTarget!.contains(active) &&
        !(touchbar && touchbar.contains(active))
      ) {
        active.blur?.();
      }
      e.preventDefault();
      const p = relXY(e);
      pointerCbs.forEach((f) => f({ type: 'down', x: p.x, y: p.y }));
      startCbs.forEach((f) => f());
    }) as EventListener);
    on(pointerTarget, 'pointermove', ((e: PointerEvent) => {
      const p = relXY(e);
      pointerCbs.forEach((f) => f({ type: 'move', x: p.x, y: p.y }));
    }) as EventListener);
    on(pointerTarget, 'pointerup', ((e: PointerEvent) => {
      const p = relXY(e);
      pointerCbs.forEach((f) => f({ type: 'up', x: p.x, y: p.y }));
    }) as EventListener);
  }

  function addButton(spec: ButtonSpec): HTMLButtonElement {
    const doc = opts.doc ?? document;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = spec.label;
    if (spec.ariaLabel) btn.setAttribute('aria-label', spec.ariaLabel);
    const code = 'BTN_' + spec.action;
    function press(e: Event) {
      e.preventDefault();
      if (!keys[code]) {
        keys[code] = true;
        setAction(spec.action, true);
        if (spec.action === 'start') startCbs.forEach((f) => f());
      }
    }
    function release(e: Event) {
      e.preventDefault();
      if (keys[code]) {
        keys[code] = false;
        setAction(spec.action, false);
      }
    }
    on(btn, 'pointerdown', press);
    on(btn, 'pointerup', release);
    on(btn, 'pointerleave', release);
    on(btn, 'pointercancel', release);
    if (touchbar) touchbar.appendChild(btn);
    return btn;
  }

  return {
    keys,
    isDown(a: Action) {
      return (actions[a] || 0) > 0;
    },
    onPointer(cb) {
      pointerCbs.push(cb);
    },
    onStart(cb) {
      startCbs.push(cb);
    },
    addButton,
    destroy() {
      listeners.forEach((l) => l.target.removeEventListener(l.type, l.fn, l.opt));
      listeners = [];
      pointerCbs = [];
      startCbs = [];
      // テスト用の簡易 touchbar は replaceChildren を持たない場合があるため、存在確認してから呼ぶ
      (touchbar as (HTMLElement & { replaceChildren?: () => void }) | null)?.replaceChildren?.();
    },
  };
}
