import type { PathLike } from 'node:fs';
import path from 'node:path';
import { callbackify } from 'node:util';
import z from 'zod';
import type { Engine, Node } from '../engine.ts';

const filesSchema = z.union([
  z.string().nonempty('files must be nonempty'),
  z
    .array(z.string().nonempty('files must be nonempty'))
    .nonempty('files must be nonempty'),
]);

const objectSchema = z.object({
  include: filesSchema,
  exclude: z
    .union([
      z.string().nonempty('exclude must be nonempty'),
      z.string().nonempty('exclude must be nonempty').array(),
    ])
    .default([]),
});

const optionsSchema = z.union([filesSchema, objectSchema]);

export type FilesOptions = z.infer<typeof optionsSchema>;

export class FilesPlugin {
  static schema = optionsSchema;

  readonly options: z.infer<typeof objectSchema>;

  constructor(options: FilesOptions) {
    if (typeof options === 'string' || Array.isArray(options)) {
      this.options = { include: options, exclude: [] };
    } else {
      this.options = options;
    }
  }

  apply(engine: Engine) {
    const { host } = engine;
    const filePaths = new WeakMap<Node, PathLike>();
    const fileContents = new WeakMap<Node, Promise<Buffer>>();

    engine.hooks.initialize.tapPromise('FilesPlugin', async () => {
      const { globbyStream } = await import('globby');
      const { include, exclude } = this.options;

      engine.hooks.buildGraph.tapPromise('FilesPlugin', async () => {
        for await (const path of globbyStream(include, {
          ignore: Array.isArray(exclude) ? exclude : [exclude],
          absolute: true,
          onlyFiles: true,
          unique: true,
          fs: {
            // @ts-expect-error It works, dunno
            readdir: callbackify(host.readdir),
            stat: callbackify(host.stat),
          },
        })) {
          const fileNode = engine.file(path.toString());
          fileNode.isReal = true;

          filePaths.set(fileNode, path);
        }
      });
    });

    engine.hooks.readFile.tapPromise('FilesPlugin', async (node) => {
      const path = filePaths.get(node);

      if (!path) {
        return undefined;
      }

      let contents = fileContents.get(node);

      if (!contents) {
        contents = host.readFile(path);
        fileContents.set(node, contents);
      }

      return contents;
    });

    const baseDir = path.resolve();

    engine.hooks.formatNode.tap('FilesPlugin', (node) => {
      const filePath = filePaths.get(node);

      if (!filePath) {
        return undefined;
      }

      return path.relative(baseDir, filePath.toString());
    });
  }
}
