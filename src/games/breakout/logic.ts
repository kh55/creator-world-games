export interface Ball {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** パドルに当たった位置から反射後の速度を返す（中央=真上、端ほど最大 60° 傾く） */
export function reflectPaddle(ballCx: number, paddleX: number, paddleW: number, speed: number): { vx: number; vy: number } {
  let rel = (ballCx - (paddleX + paddleW / 2)) / (paddleW / 2); // -1..1
  if (rel < -1) rel = -1;
  if (rel > 1) rel = 1;
  const maxAngle = (60 * Math.PI) / 180;
  const angle = rel * maxAngle;
  return { vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) };
}

/** ボールとブロックの衝突判定。反射する軸を返す */
export function hitBrick(ball: Ball, brick: Rect): 'x' | 'y' | null {
  // 円の中心を矩形にクランプした最近接点で衝突判定
  const nx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const ny = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  if (dx * dx + dy * dy > ball.r * ball.r) return null;
  const overlapX = ball.r - Math.abs(dx);
  const overlapY = ball.r - Math.abs(dy);
  if (nx > brick.x && nx < brick.x + brick.w) return 'y'; // 上下面に接触
  if (ny > brick.y && ny < brick.y + brick.h) return 'x'; // 左右面に接触
  return overlapX < overlapY ? 'x' : 'y'; // 角は浅い方
}
