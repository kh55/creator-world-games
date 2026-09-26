export const HOLES = 9;
export const DURATION = 30;

/** 経過秒 t から出現間隔と滞在時間の範囲（秒）を返す */
export function difficulty(t: number): { gap: number; upMax: number; upMin: number } {
  const p = Math.min(1, t / 30); // 0→1 の進行度
  const gap = 1.1 - 0.75 * p; // 1.1s → 0.35s
  const upMax = 1.3 - 0.6 * p; // 1.3s → 0.7s
  const upMin = 0.9 - 0.5 * p; // 0.9s → 0.4s
  return { gap: Math.max(0.35, gap), upMax, upMin: Math.max(0.4, upMin) };
}
