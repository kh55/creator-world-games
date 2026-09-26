export const SITE = {
  name: 'Creator World Games',
  tagline: 'ブラウザですぐ遊べる、登録不要のミニゲーム集',
  url: 'https://browser-games.creator-world.net',
} as const;

// すべて任意。未設定なら広告・解析のタグを出力しない
export const env = {
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
  slotGame: import.meta.env.PUBLIC_ADSENSE_SLOT_GAME ?? '',
  slotFooter: import.meta.env.PUBLIC_ADSENSE_SLOT_FOOTER ?? '',
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
  gtmId: import.meta.env.PUBLIC_GTM_ID ?? '',
};
