import { minimatch } from 'minimatch';
import z from 'zod';
import type { Engine, FileNode } from '../engine.ts';
import { toArray } from '../utils/toArray.ts';

const optionsSchema = z.object({
  dir: z.string().nonempty('Tests directory must be nonempty').optional(),
  snapshotsDir: z
    .string()
    .nonempty('Snapshots directory must be nonempty')
    .default('__snapshots__'),
  mocksDir: z
    .string()
    .nonempty('Mocks directory must be nonempty')
    .default('__mocks__'),
  include: z.union([
    z.string().nonempty('include must be nonempty'),
    z
      .array(z.string().nonempty('include must be nonempty'))
      .nonempty('include must be nonempty'),
  ]),
  exclude: z
    .union([
      z.string().nonempty('exclude must be nonempty'),
      z.string().nonempty('exclude must be nonempty').array(),
    ])
    .default([]),
}).strict();

export type TestsOptions = z.infer<typeof optionsSchema>;

export class TestsPlugin {
  static schema = optionsSchema;

  readonly include: string[];
  readonly exclude: string[];

  constructor(private readonly options: TestsOptions) {
    this.include = toArray(options.include);
    this.exclude = toArray(options.exclude);
  }

  apply(engine: Engine) {
    engine.hooks.buildGraph
      .withOptions({
        stage: 20,
      })
      .tap('TestsPlugin', () => {
        for (const file of engine.files()) {
          if (this.isMatch(file)) {
            engine.addDependency(engine.rootNode, file.program('test'));
          }

          // TODO: Add support for snapshots and mocks
        }
      });
  }

  isMatch(file: FileNode): boolean {
    const path = file.path();

    if (path === undefined) {
      return false;
    }

    return (
      this.include.some((pattern) => minimatch(path, pattern, { dot: true })) &&
      !this.exclude.some((pattern) => minimatch(path, pattern, { dot: true }))
    );
  }
}
