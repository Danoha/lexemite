import { callbackify } from 'node:util';
import ER from 'enhanced-resolve';
import { z } from 'zod';
import type { Engine, ProgramNode } from '../engine.ts';

const optionsSchema = z
  .object({
    alias: z.record(z.string().nonempty('alias must be nonempty')).default({}),
    conditionNames: z
      .array(z.string())
      .default(['import', 'require', 'node', 'default']),
    descriptionFiles: z.array(z.string()).default(['package.json']),
    exportsFields: z.array(z.string()).default(['exports']),
    extensions: z
      .array(z.string().nonempty('extension must be nonempty'))
      .default(['.js', '.json', '.node']),
    fullySpecified: z.boolean().default(false),
    mainFields: z.array(z.string()).default(['main', 'module']),
    mainFiles: z.array(z.string()).default(['index']),
    modules: z
      .array(z.string().nonempty('module directory must be nonempty'))
      .default(['node_modules']),
    symlinks: z.boolean().default(false),
  })
  .passthrough();

export type NodeResolverOptions = z.infer<typeof optionsSchema>;

export class NodeResolverPlugin {
  static schema = optionsSchema;

  constructor(private readonly options: NodeResolverOptions) {}

  createResolver(engine: Engine) {
    return ER.ResolverFactory.createResolver({
      ...this.options,
      fileSystem: {
        // @ts-expect-error - it works, dunno
        readFile: callbackify(engine.host.readFile),
        // @ts-expect-error - it works, dunno
        readdir: callbackify(engine.host.readdir),
        // @ts-expect-error - it works, dunno
        readlink: callbackify(engine.host.readlink),
        // @ts-expect-error - it works, dunno
        stat: callbackify(engine.host.stat),
      },
    });
  }

  apply(engine: Engine) {
    const resolver = this.createResolver(engine);

    engine.hooks.resolveProgramNode.tapAsync(
      'NodeResolverPlugin',
      (request, callback) => {
        const dirNode = request.context.closest('dir');

        if (!dirNode || dirNode.meta?.kind !== 'dir') {
          return callback(null, undefined);
        }

        const context = dirNode.meta.path;

        resolver.resolve({}, context, request.moduleId, {}, (err, result) => {
          if (err || !result) {
            if (err?.details) {
              request.details.push(err.details);
            }

            callback(null, undefined);
          } else {
            const file = engine.file(result);
            const [knownProgram] = file.childrenOfType('program');
            const program =
              (knownProgram as ProgramNode | undefined) ??
              file.program('unknown');

            callback(null, program);
          }
        });
      },
    );
  }
}
