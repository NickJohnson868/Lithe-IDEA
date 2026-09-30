import type { FileEntry } from "../types/app.types";
import { getCompactFolderChild } from "./file-tree-utils";

interface DirectoryLoadHost {
  find: (path: string) => FileEntry | null;
  read: (path: string) => Promise<FileEntry[]>;
  apply: (path: string, children: FileEntry[]) => void;
  isExpanded: (path: string) => boolean;
  expand: (path: string) => void;
  // This includes workspace lifetime, not just its filesystem path.
  isActive: () => boolean;
  idle: () => Promise<void>;
  reportError: (path: string, error: unknown) => void;
}

/** Owns one workspace's directory requests and low-priority prefetch queue. */
export function createDirectoryLoadController(host: DirectoryLoadHost) {
  let generation = 0;
  let prefetchGeneration = 0;
  const pending = new Map<string, Promise<FileEntry[]>>();
  const expansions = new Map<string, object>();

  const current = (epoch: number) => epoch === generation && host.isActive();
  const read = (path: string) => {
    const existing = pending.get(path);
    if (existing) return existing;
    const promise = host.read(path).finally(() => {
      if (pending.get(path) === promise) pending.delete(path);
    });
    pending.set(path, promise);
    return promise;
  };

  return {
    invalidate() {
      generation++;
      prefetchGeneration++;
      expansions.clear();
      pending.clear();
    },
    cancelPrefetch() {
      prefetchGeneration++;
    },
    collapse(path: string) {
      expansions.delete(path);
      prefetchGeneration++;
    },
    async expand(startPath: string, compact: boolean): Promise<string> {
      const epoch = generation;
      const owner = {};
      expansions.set(startPath, owner);
      host.expand(startPath);
      const valid = () => current(epoch) && expansions.get(startPath) === owner && host.isExpanded(startPath);
      let path = startPath;
      const visited = new Set<string>();
      try {
        while (valid() && !visited.has(path)) {
          visited.add(path);
          const folder = host.find(path);
          if (!folder?.isDir) break;
          let children = folder.children;
          if (children === undefined) {
            children = await read(path);
            if (!valid()) break;
            host.apply(path, children);
          }
          if (!valid()) break;
          host.expand(path);
          const child = compact ? getCompactFolderChild({ ...folder, children }) : null;
          if (!child) break;
          path = child.path;
        }
        return path;
      } catch (error) {
        if (valid()) throw error;
        return startPath;
      } finally {
        if (expansions.get(startPath) === owner) expansions.delete(startPath);
      }
    },
    async preload(rootPath: string, maxDepth: number, maxDirs: number) {
      const epoch = generation;
      const prefetch = ++prefetchGeneration;
      const valid = () => current(epoch) && prefetch === prefetchGeneration && host.isExpanded(rootPath);
      const queue = [{ path: rootPath, depth: 0 }];
      const visited = new Set<string>();
      let processed = 0;
      while (queue.length && processed < maxDirs && valid()) {
        await host.idle();
        if (!valid()) return;
        const batch = queue.splice(0, Math.min(2, maxDirs - processed));
        await Promise.all(batch.map(async ({ path, depth }) => {
          if (!valid() || visited.has(path) || depth >= maxDepth) return;
          visited.add(path);
          processed++;
          const folder = host.find(path);
          if (!folder?.isDir) return;
          try {
            const children = folder.children ?? await read(path);
            if (!valid()) return;
            if (folder.children === undefined) host.apply(path, children);
            for (const child of children) {
              if (child.isDir) queue.push({ path: child.path, depth: depth + 1 });
            }
          } catch (error) {
            if (valid()) host.reportError(path, error);
          }
        }));
      }
    },
  };
}
