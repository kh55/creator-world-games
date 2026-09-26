import { describe, expect, it } from 'vitest';
import { createScoreStore, type KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('createScoreStore', () => {
  it('現行と同じ規則でハイスコアを更新する', () => {
    const s = createScoreStore(() => memoryStorage());
    expect(s.getHighScore('t1')).toBe(0);
    expect(s.submitScore('t1', 100)).toBe(true);
    expect(s.getHighScore('t1')).toBe(100);
    expect(s.submitScore('t1', 50)).toBe(false);
    expect(s.getHighScore('t1')).toBe(100);
    expect(s.submitScore('t1', 150)).toBe(true);
    expect(s.submitScore('t1', 150)).toBe(false);
    expect(s.getHighScore('other')).toBe(0);
  });

  it('キーは bg:highscore:<id>（現行と同じ）', () => {
    const storage = memoryStorage();
    createScoreStore(() => storage).submitScore('tetris', 12.9);
    expect(storage.data.get('bg:highscore:tetris')).toBe('12');
  });

  it('localStorage がないときはメモリに保存する', () => {
    const s = createScoreStore(() => undefined);
    expect(s.submitScore('x', 10)).toBe(true);
    expect(s.getHighScore('x')).toBe(10);
  });

  it('localStorage へのアクセス自体が例外でも動く', () => {
    const s = createScoreStore(() => {
      throw new Error('SecurityError');
    });
    expect(s.submitScore('x', 10)).toBe(true);
    expect(s.getHighScore('x')).toBe(10);
  });

  it('書き込みだけ失敗しても、そのセッション内では新しい値を返す', () => {
    const storage = memoryStorage();
    storage.data.set('bg:highscore:x', '5');
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const s = createScoreStore(() => storage);
    expect(s.submitScore('x', 10)).toBe(true);
    expect(s.getHighScore('x')).toBe(10);
  });

  it('壊れた値は 0 として扱う', () => {
    const storage = memoryStorage();
    storage.data.set('bg:highscore:x', 'abc');
    expect(createScoreStore(() => storage).getHighScore('x')).toBe(0);
  });
});
