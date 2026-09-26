export interface LoopEnv {
  requestAnimationFrame(cb: (ts: number) => void): number | void;
  cancelAnimationFrame(id: number): void;
  isHidden(): boolean;
}

export interface LoopHandle {
  stop(): void;
}

const browserEnv = (): LoopEnv => ({
  requestAnimationFrame: (cb) => window.requestAnimationFrame(cb),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
  isHidden: () => document.hidden,
});

export function createLoop(callback: (dt: number) => void, env: LoopEnv = browserEnv()): LoopHandle {
  let last: number | null = null;
  let running = true;
  let rafId: number | null = null;

  function schedule() {
    const id = env.requestAnimationFrame(frame);
    rafId = typeof id === 'number' ? id : null;
  }

  function frame(ts: number) {
    if (!running) return;
    if (env.isHidden()) {
      last = null;
      schedule();
      return;
    }
    if (last == null) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    callback(dt);
    schedule();
  }

  schedule();
  return {
    stop() {
      running = false;
      env.cancelAnimationFrame(rafId ?? 0);
    },
  };
}
