import type { FileEntry } from "../types/app.types";
import { getDirName } from "@/utils/path-helpers";
import { isDraft } from "immer";

export function sortFileEntries(entries: FileEntry[]): FileEntry[] {
  return entries.sort((a, b) => {
    // Directories come first
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;

    // Then sort alphabetically (case-insensitive)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

// Immutable sibling arrays share their path index until that level changes.
// A lookup follows ancestors rather than inspecting every loaded descendant.
const siblingIndexes = new WeakMap<FileEntry[], Map<string, number>>();

function indexOfAncestor(files: FileEntry[], targetPath: string): number | undefined {
  const cacheable = !isDraft(files);
  let index = cacheable ? siblingIndexes.get(files) : undefined;
  if (!index) {
    index = new Map(files.map((file, position) => [file.path, position]));
    if (cacheable) siblingIndexes.set(files, index);
  }
  let path = targetPath;
  while (path) {
    const position = index.get(path);
    if (position !== undefined) return position;
    const parent = getDirName(path);
    if (parent === path) break;
    path = parent;
  }
  return undefined;
}

export function findFileInTree(files: FileEntry[], targetPath: string): FileEntry | null {
  const position = indexOfAncestor(files, targetPath);
  if (position === undefined) return null;
  const file = files[position];
  if (file.path === targetPath) return file;
  return file.children ? findFileInTree(file.children, targetPath) : null;
}

export function updateFileInTree(
  files: FileEntry[],
  targetPath: string,
  updater: (file: FileEntry) => FileEntry,
): FileEntry[] {
  const position = indexOfAncestor(files, targetPath);
  if (position === undefined) return files;
  const file = files[position];
  let updatedFile = file;
  if (file.path === targetPath) {
    updatedFile = updater(file);
  } else if (file.children) {
    const children = updateFileInTree(file.children, targetPath, updater);
    if (children !== file.children) updatedFile = { ...file, children };
  }
  if (updatedFile === file) return files;
  const updatedFiles = files.slice();
  updatedFiles[position] = updatedFile;
  return updatedFiles;
}

export function getCompactFolderChild(item: FileEntry): FileEntry | null {
  if (!item.isDir || item.isEditing || item.isRenaming || item.isNewItem || !item.children) {
    return null;
  }

  if (item.children.length !== 1) {
    return null;
  }

  const child = item.children[0];
  return child.isDir && !child.isEditing && !child.isRenaming && !child.isNewItem ? child : null;
}

export async function loadFolderExpansion(
  files: FileEntry[],
  startPath: string,
  compactFolders: boolean,
  readChildren: (path: string) => Promise<FileEntry[]>,
) {
  const expandedPaths: string[] = [];
  const loadedChildren = new Map<string, FileEntry[]>();
  const visitedPaths = new Set<string>();
  let nextFiles = files;
  let currentPath = startPath;

  while (true) {
    if (visitedPaths.has(currentPath)) break;
    visitedPaths.add(currentPath);
    const folder = findFileInTree(nextFiles, currentPath);
    if (!folder?.isDir) break;

    let children = folder.children;
    if (children === undefined) {
      children = await readChildren(currentPath);
      loadedChildren.set(currentPath, children);
      nextFiles = updateFileInTree(nextFiles, currentPath, (item) => ({ ...item, children }));
    }

    expandedPaths.push(currentPath);
    const child = compactFolders ? getCompactFolderChild({ ...folder, children }) : null;
    if (!child) break;
    currentPath = child.path;
  }

  return {
    expandedPaths,
    finalPath: expandedPaths[expandedPaths.length - 1] ?? startPath,
    loadedChildren,
  };
}

export function removeFileFromTree(files: FileEntry[], targetPath: string): FileEntry[] {
  let changed = false;
  const nextFiles: FileEntry[] = [];

  for (const file of files) {
    if (file.path === targetPath) {
      changed = true;
      continue;
    }

    if (file.children) {
      const updatedChildren = removeFileFromTree(file.children, targetPath);
      if (updatedChildren !== file.children) {
        changed = true;
        nextFiles.push({
          ...file,
          children: updatedChildren,
        });
        continue;
      }
    }

    nextFiles.push(file);
  }

  return changed ? nextFiles : files;
}

function isDirectoryChildrenRoot(files: FileEntry[], parentPath: string): boolean {
  if (files.length === 0 || !files[0].path) return false;
  return parentPath === getDirName(files[0].path);
}

function appendSortedFile(files: FileEntry[], newFile: FileEntry): FileEntry[] {
  return sortFileEntries([...files, newFile]);
}

export function addFileToTree(
  files: FileEntry[],
  parentPath: string,
  newFile: FileEntry,
): FileEntry[] {
  // If parentPath is empty or root, add to top level
  if (!parentPath || parentPath === "/" || parentPath === "\\") {
    return appendSortedFile(files, newFile);
  }

  // Check if parentPath matches the root folder (when files are direct children of parentPath)
  // This happens when creating files in the root directory
  if (isDirectoryChildrenRoot(files, parentPath)) {
    return appendSortedFile(files, newFile);
  }

  let changed = false;
  const result = files.map((file) => {
    if (file.path === parentPath && file.isDir) {
      changed = true;
      const children = appendSortedFile(file.children || [], newFile);
      return { ...file, children };
    }
    if (file.children) {
      const updatedChildren = addFileToTree(file.children, parentPath, newFile);
      if (updatedChildren !== file.children) {
        changed = true;
        return {
          ...file,
          children: updatedChildren,
        };
      }
    }
    return file;
  });
  return changed ? result : files;
}
