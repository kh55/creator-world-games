import { describe, expect, it } from 'vitest';
import {
  cellName,
  chord,
  COLS,
  createField,
  type Field,
  flagsLeft,
  isCleared,
  MINES,
  neighbors,
  openCell,
  placeMines,
  ROWS,
  scoreFor,
  setMines,
  toggleFlag,
} from './logic';

/** 文字列の行から盤面を作る（* = 地雷、それ以外 = 安全） */
function parse(rows: string[]): Field {
  const f = createField(rows[0].length, rows.length);
  setMines(
    f,
    rows.flatMap((r) => [...r].map((ch) => ch === '*')),
  );
  return f;
}

/** 開いたマスを # 、旗を F 、隠れたマスを . で表す */
function view(f: Field): string[] {
  const out: string[] = [];
  for (let y = 0; y < f.rows; y++) {
    let s = '';
    for (let x = 0; x < f.cols; x++) {
      const st = f.state[y * f.cols + x];
      s += st === 'open' ? '#' : st === 'flag' ? 'F' : '.';
    }
    out.push(s);
  }
  return out;
}

describe('createField / neighbors / cellName', () => {
  it('既定は 10×10・地雷 15 個で、最初はすべて隠れていて地雷は未配置', () => {
    expect([COLS, ROWS, MINES]).toEqual([10, 10, 15]);
    const f = createField(COLS, ROWS);
    expect(f.state).toHaveLength(100);
    expect(f.state.every((s) => s === 'hidden')).toBe(true);
    expect(f.placed).toBe(false);
    expect(f.mines.some(Boolean)).toBe(false);
  });

  it('隣のマスは角で 3、辺で 5、内側で 8', () => {
    const f = createField(10, 10);
    expect(neighbors(f, 0).sort((a, b) => a - b)).toEqual([1, 10, 11]);
    expect(neighbors(f, 5)).toHaveLength(5);
    expect(neighbors(f, 55)).toHaveLength(8);
    expect(neighbors(f, 99).sort((a, b) => a - b)).toEqual([88, 89, 98]);
  });

  it('座標名は左上が a1、右下が j10', () => {
    expect(cellName(0, 0)).toBe('a1');
    expect(cellName(3, 2)).toBe('d3');
    expect(cellName(9, 9)).toBe('j10');
  });
});

describe('setMines / placeMines', () => {
  it('周りの地雷の数を数える', () => {
    const f = parse(['*..', '.*.', '...']);
    expect(f.adjacent).toEqual([1, 2, 1, 2, 1, 1, 1, 1, 1]);
    expect(f.placed).toBe(true);
  });

  it('指定した数だけ置き、開いたマスとその周りには置かない', () => {
    for (const seed of [0, 0.3, 0.99]) {
      let n = seed;
      const rand = () => (n = (n * 9301 + 0.49297) % 1);
      const f = createField(10, 10);
      placeMines(f, 15, 55, rand);
      expect(f.mines.filter(Boolean)).toHaveLength(15);
      for (const i of [55, ...neighbors(f, 55)]) expect(f.mines[i]).toBe(false);
    }
  });

  it('周りを避けると置ききれないときは、開いたマスだけを避ける', () => {
    const f = createField(3, 3);
    placeMines(f, 8, 4, () => 0);
    expect(f.mines.filter(Boolean)).toHaveLength(8);
    expect(f.mines[4]).toBe(false);
  });
});

describe('openCell', () => {
  it('数字のマスはそのマスだけ開く', () => {
    const f = parse(['*...', '....', '....']);
    expect(openCell(f, 1)).toBe('opened');
    expect(view(f)).toEqual(['.#..', '....', '....']);
  });

  it('0 のマスはつながった 0 と縁の数字まで開く（地雷は開かない）', () => {
    const f = parse(['*...', '....', '....']);
    expect(openCell(f, 11)).toBe('opened');
    expect(view(f)).toEqual(['.###', '####', '####']);
    expect(f.state[0]).toBe('hidden');
  });

  it('広がるときも旗のマスは開かない', () => {
    const f = parse(['*...', '....', '....']);
    toggleFlag(f, 3);
    openCell(f, 11);
    expect(view(f)).toEqual(['.##F', '####', '####']);
  });

  it('地雷を開くと mine、開いたマス・旗のマスは何もしない', () => {
    const f = parse(['*...', '....', '....']);
    expect(openCell(f, 0)).toBe('mine');
    expect(f.state[0]).toBe('open');
    expect(openCell(f, 0)).toBe('none');
    toggleFlag(f, 5);
    expect(openCell(f, 5)).toBe('none');
    expect(f.state[5]).toBe('flag');
  });
});

describe('toggleFlag / flagsLeft', () => {
  it('隠れたマスにだけ立てられ、もう一度で外れる', () => {
    const f = parse(['*..', '...']);
    expect(toggleFlag(f, 0)).toBe(true);
    expect(f.state[0]).toBe('flag');
    expect(flagsLeft(f, 1)).toBe(0);
    expect(toggleFlag(f, 0)).toBe(true);
    expect(f.state[0]).toBe('hidden');
    openCell(f, 1);
    expect(toggleFlag(f, 1)).toBe(false);
  });

  it('残り地雷数は旗を立てすぎると負になる', () => {
    const f = parse(['*..', '...']);
    toggleFlag(f, 0);
    toggleFlag(f, 2);
    expect(flagsLeft(f, 1)).toBe(-1);
  });
});

describe('chord', () => {
  it('周りの旗が数字と同じなら、残りの隠れたマスをまとめて開く', () => {
    const f = parse(['*..', '...', '...']);
    openCell(f, 4); // 中央は 1
    toggleFlag(f, 0);
    expect(chord(f, 4)).toBe('opened');
    expect(view(f)).toEqual(['F##', '###', '###']);
  });

  it('旗の数が足りないときは何もしない', () => {
    const f = parse(['*..', '...', '...']);
    openCell(f, 4);
    expect(chord(f, 4)).toBe('none');
    expect(view(f)).toEqual(['...', '.#.', '...']);
  });

  it('旗の位置が間違っていれば地雷を開いて mine', () => {
    const f = parse(['*..', '...', '...']);
    openCell(f, 4);
    toggleFlag(f, 8);
    expect(chord(f, 4)).toBe('mine');
    expect(f.state[0]).toBe('open');
  });

  it('隠れたマスや 0 のマスでは何もしない', () => {
    const f = parse(['*..', '...', '...']);
    expect(chord(f, 4)).toBe('none');
    const g = parse(['*...', '....', '....']);
    openCell(g, 11);
    expect(chord(g, 11)).toBe('none');
  });
});

describe('isCleared / scoreFor', () => {
  it('地雷以外をすべて開くとクリア（旗の有無は問わない）', () => {
    const f = parse(['*..', '...']);
    expect(isCleared(f)).toBe(false);
    openCell(f, 5); // a2 は数字のマスにしか接していないので残る
    expect(isCleared(f)).toBe(false);
    toggleFlag(f, 0);
    openCell(f, 3);
    expect(isCleared(f)).toBe(true);
  });

  it('スコアは 1000 − 経過秒（切り捨て）、最低 1', () => {
    expect(scoreFor(0)).toBe(1000);
    expect(scoreFor(42.9)).toBe(958);
    expect(scoreFor(999)).toBe(1);
    expect(scoreFor(5000)).toBe(1);
  });
});
