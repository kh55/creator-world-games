// ハイスコアを localStorage に保存する。使えない環境ではメモリに保存する（現行 common/storage.js と同じ規則）。
const PREFIX = 'bg:highscore:';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ScoreStore {
  getHighScore(id: string): number;
  submitScore(id: string, n: number): boolean;
}

export function createScoreStore(getStorage: () => KeyValueStorage | undefined): ScoreStore {
  // 書き込みに失敗した値もセッション内では有効にするため、メモリを優先して読む
  const mem = new Map<string, string>();

  function read(key: string): string | null {
    const own = mem.get(key);
    if (own !== undefined) return own;
    try {
      return getStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function write(key: string, value: string): void {
    // セッション内で読み直しても同じ値が見えるよう、常にメモリへも反映する
    // （getStorage() が呼び出しごとに異なるインスタンスを返す場合でも一貫させるため）
    mem.set(key, value);
    try {
      getStorage()?.setItem(key, value);
    } catch {
      // メモリのみに保存する
    }
  }

  function getHighScore(id: string): number {
    const n = parseInt(read(PREFIX + id) ?? '', 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function submitScore(id: string, n: number): boolean {
    const score = Math.floor(Number(n) || 0);
    if (score > getHighScore(id)) {
      write(PREFIX + id, String(score));
      return true;
    }
    return false;
  }

  return { getHighScore, submitScore };
}

export const scores = createScoreStore(() => globalThis.localStorage);
