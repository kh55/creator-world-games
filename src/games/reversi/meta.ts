import type { GameMeta } from '../../lib/game-meta';

export const meta: GameMeta = {
  slug: 'reversi',
  title: 'リバーシ',
  description: 'CPU と対戦するリバーシ（オセロ型の石取りゲーム）。相手の石をはさんで裏返し、最後に石が多いほうの勝ち。勝ったときの石の数がスコアです。',
  icon: '⚫',
  order: 5,
};
