// ステージ上のスワイプ（ポインタを押して離すまでの移動）を上下左右の向きに変換する。
// 2048・スネークで使う。押した瞬間に onStart も呼ばれる点はゲーム側で扱う。
import type { GameInput } from './input';

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

/** これより短い移動はスワイプとみなさない（CSS px） */
export const SWIPE_MIN = 24;

/** 移動量から向きを返す。短すぎるときは null。縦横同じ量なら横を優先する */
export function swipeDirection(dx: number, dy: number, min = SWIPE_MIN): SwipeDir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < min) return null;
  if (ax >= ay) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * スワイプを検出して cb を呼ぶ。指を離す前でも min 以上動いた時点で 1 回だけ発火する
 * （スネークで素早く曲がれるように）。onDown は押した瞬間に呼ばれ、false を返すとその操作のスワイプを無視する。
 */
export function onSwipe(input: GameInput, cb: (dir: SwipeDir) => void, onDown?: () => boolean | void): void {
  let origin: { x: number; y: number } | null = null;
  input.onPointer((p) => {
    if (p.type === 'down') {
      origin = onDown?.() === false ? null : { x: p.x, y: p.y };
      return;
    }
    if (!origin) return;
    const dir = swipeDirection(p.x - origin.x, p.y - origin.y);
    if (dir) {
      origin = null;
      cb(dir);
    } else if (p.type === 'up') {
      origin = null;
    }
  });
}
