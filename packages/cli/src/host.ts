import { promises as fs, type PathLike, type Stats } from 'node:fs';
import path from 'node:path';

export interface EngineHost {
  basename(path: string): string;
  dirname(path: string): string;
  join(...paths: string[]): string;
  readFile(path: PathLike): Promise<Buffer>;
  readdir(path: PathLike): Promise<string[]>;
  readlink(path: PathLike): Promise<string>;
  stat(path: PathLike): Promise<Stats>;
}

export const sys: EngineHost = {
  basename: path.basename,
  dirname: path.dirname,
  join: path.join,
  readFile: fs.readFile,
  readdir: fs.readdir,
  readlink: fs.readlink,
  stat: fs.stat,
};
