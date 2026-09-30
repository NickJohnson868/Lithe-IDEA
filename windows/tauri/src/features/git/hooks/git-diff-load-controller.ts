import type { GitDiff } from "../types/git.types";

interface DiffLoadHost {
  isCurrent: () => boolean;
  isStaged: boolean;
  read: (staged: boolean) => Promise<GitDiff | null>;
  update: (diff: GitDiff) => void;
  open: (staged: boolean, diff: GitDiff) => void;
  close: () => void;
  loading: (loading: boolean) => void;
  error: (error: unknown | null) => void;
}

export interface DiffRefreshScheduler {
  schedule: (callback: () => void) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
}

const defaultScheduler: DiffRefreshScheduler = {
  schedule: (callback) => setTimeout(callback, 50),
  clear: (timer) => clearTimeout(timer),
};

/** Owns one buffer's requests and debounce; stale reads never mutate another view. */
export function createDiffLoadController(host: DiffLoadHost, scheduler = defaultScheduler) {
  let generation = 0;
  let disposed = false;
  let refreshing = false;
  let refreshAgain = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const isCurrent = (ticket: number) => !disposed && generation === ticket && host.isCurrent();

  const refresh = async (): Promise<void> => {
    if (disposed || !host.isCurrent()) return;
    if (refreshing) {
      refreshAgain = true;
      return;
    }
    const ticket = ++generation;
    refreshing = true;
    host.loading(true);
    host.error(null);
    try {
      const diff = await host.read(host.isStaged);
      if (!isCurrent(ticket)) return;
      if (diff && diff.lines.length > 0) host.update(diff);
      else {
        const other = await host.read(!host.isStaged);
        if (!isCurrent(ticket)) return;
        if (other && other.lines.length > 0) host.open(!host.isStaged, other);
        host.close();
      }
    } catch (error) {
      if (isCurrent(ticket)) host.error(error);
    } finally {
      if (isCurrent(ticket)) {
        refreshing = false;
        host.loading(false);
        if (refreshAgain) {
          refreshAgain = false;
          scheduleRefresh();
        }
      }
    }
  };

  const scheduleRefresh = () => {
    if (disposed || !host.isCurrent()) return;
    if (timer !== null) scheduler.clear(timer);
    timer = scheduler.schedule(() => {
      timer = null;
      void refresh();
    });
  };

  return {
    activate: () => {
      // React Strict Mode reconnects effects; invalidating the old generation
      // lets the same owner reconnect without accepting reads from its cleanup.
      disposed = false;
      generation += 1;
      refreshing = false;
      refreshAgain = false;
    },
    refresh,
    scheduleRefresh,
    switchView: async (staged: boolean) => {
      if (disposed || !host.isCurrent()) return;
      if (timer !== null) scheduler.clear(timer);
      timer = null;
      const ticket = ++generation;
      refreshing = false;
      refreshAgain = false;
      host.loading(false);
      host.error(null);
      try {
        const diff = await host.read(staged);
        if (isCurrent(ticket) && diff && diff.lines.length > 0) host.open(staged, diff);
      } catch (error) {
        if (isCurrent(ticket)) host.error(error);
      }
    },
    dispose: () => {
      disposed = true;
      generation += 1;
      if (timer !== null) scheduler.clear(timer);
      timer = null;
    },
  };
}
