export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 上の段から squid / crab / octopus の得点 */
export const INVADER_SCORES = [30, 20, 10] as const;
export const UFO_SCORES = [50, 100, 150, 300] as const;

/** 行番号（0 始まり）から敵の種類の添字を返す。0 段目=0、1〜2 段目=1、それ以外=2 */
export function typeIndexForRow(row: number): 0 | 1 | 2 {
  if (row === 0) return 0;
  if (row <= 2) return 1;
  return 2;
}

export function scoreForRow(row: number): number {
  return INVADER_SCORES[typeIndexForRow(row)];
}

export function aabb(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
