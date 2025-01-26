import type { Stats } from 'node:fs';

const fileNotFoundError = new Error('File not found');
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
(fileNotFoundError as any).code = 'ENOENT';

export class Directory {
  constructor(
    public name: string,
    public contents: readonly FileSystemEntry[],
  ) {}

  resolve(path: string): FileSystemEntry | null {
    const parts = path.split('/').filter(Boolean);
    return this._resolve(parts);
  }

  _resolve(path: string[]): FileSystemEntry | null {
    if (path.length === 0) {
      return this;
    }

    const [name, ...rest] = path;

    for (const entry of this.contents) {
      if (entry.name === name) {
        if (entry instanceof Directory) {
          return entry._resolve(rest);
        }
        if (rest.length === 0) {
          return entry;
        }
      }
    }

    return null;
  }
}

export class File {
  constructor(
    public name: string,
    public content: string,
  ) {}
}

export type FileSystemEntry = Directory | File;

export function createHost(root: Directory) {
  return {
    readFile(path: string) {
      const entry = root.resolve(path);

      if (entry instanceof File) {
        return Promise.resolve(Buffer.from(entry.content));
      }

      return Promise.reject(fileNotFoundError);
    },
    stat(path: string) {
      const entry = root.resolve(path);

      if (!entry) {
        return Promise.reject(fileNotFoundError);
      }

      return Promise.resolve({
        isDirectory: () => entry instanceof Directory,
        isFile: () => entry instanceof File,
      } as Stats);
    },
    readdir(path: string) {
      const entry = root.resolve(path);

      if (entry instanceof Directory) {
        return Promise.resolve(entry.contents.map(({ name }) => name));
      }

      return Promise.reject(new Error('Directory not found'));
    },
    readlink(_path: string) {
      return Promise.reject(new Error('Not implemented'));
    },
    exists(path: string) {
      return Promise.resolve(root.resolve(path) !== null);
    },
  };
}
