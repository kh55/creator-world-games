export interface GameMeta {
  /** URL: /games/<slug>/。フォルダ名と一致させる。localStorage のスコアキーにも使う */
  slug: string;
  title: string;
  /** meta description とカードの説明文（120 字以内） */
  description: string;
  /** 絵文字 1 文字 */
  icon: string;
  /** トップの並び順（昇順） */
  order: number;
}
