import { isBuiltin } from 'node:module';
import z from 'zod';
import type { Engine } from '../engine.ts';
import { findNode, parseJson } from '../languages/json.ts';

const optionsSchema = z.object({
  dependencies: z.boolean().default(true),
  devDependencies: z.boolean().default(false),
  bin: z.boolean().default(true),
  main: z.boolean().default(true),
  exports: z.boolean().default(true),
  lockFiles: z.boolean().default(true),
  workspaceFiles: z.boolean().default(true),
}).strict().default({});

export type JavaScriptOptions = z.infer<typeof optionsSchema>;

export class JavaScriptPlugin {
  static schema = optionsSchema;

  constructor(readonly options: JavaScriptOptions) {}

  apply(engine: Engine) {
    engine.hooks.buildGraph
      .withOptions({
        stage: 30,
      })
      .tapPromise('NodeJsPlugin', async () => {
        for (const file of engine.files()) {
          if (file.name !== 'package.json') {
            continue;
          }

          const contents = (
            await engine.hooks.readFile.promise(file)
          )?.toString();

          if (contents === undefined) {
            continue;
          }

          const packageJson = JSON.parse(contents);
          const packageJsonTree = parseJson(contents);
          const contextDir = file.parent;

          if (!contextDir) {
            continue;
          }

          const nodeModulesDir = contextDir.dir('node_modules');

          for (const dependencyKind of [
            'dependencies',
            'devDependencies',
          ] as const) {
            if (!this.options[dependencyKind] || !packageJson[dependencyKind]) {
              continue;
            }

            const listedDependencies = Object.keys(packageJson[dependencyKind]);

            if (!listedDependencies.length) {
              continue;
            }

            const dependenciesNode = file.symbol(
              dependencyKind,
              findNode(packageJsonTree, [dependencyKind]),
            );

            for (const dependencyName of listedDependencies) {
              const listedDependencyNode = dependenciesNode.symbol(
                dependencyName,
                findNode(packageJsonTree, [dependencyKind, dependencyName]),
              );

              listedDependencyNode.isReal = true;

              const moduleDirNode = nodeModulesDir.dir(dependencyName);

              engine.addDependency(moduleDirNode, listedDependencyNode);
            }
          }

          if (this.options.bin && packageJson.bin) {
            for (const [name, moduleId] of Object.entries(packageJson.bin)) {
              if (typeof moduleId !== 'string') {
                continue;
              }

              const targetProgramNode = await engine.resolveProgram(
                moduleId,
                file,
                findNode(packageJsonTree, ['bin', name]),
              );

              if (targetProgramNode) {
                engine.addDependency(file, targetProgramNode);
              }
            }
          }

          if (this.options.main && packageJson.main) {
            const targetProgramNode = await engine.resolveProgram(
              packageJson.main,
              file,
              findNode(packageJsonTree, ['main']),
            );

            if (targetProgramNode) {
              engine.addDependency(file, targetProgramNode.allExportsSymbol());
            }
          }

          if (this.options.exports && packageJson.exports) {
            const moduleIds = (function reduce(
              obj: unknown,
              path: (string | number)[],
            ): [string, (string | number)[]][] {
              if (typeof obj === 'string') {
                return [[obj, path]];
              }
              if (Array.isArray(obj)) {
                return obj.flatMap((item, index) =>
                  reduce(item, [...path, index]),
                );
              }
              if (typeof obj === 'object' && obj) {
                return Object.entries(obj).flatMap(([key, value]) =>
                  reduce(value, [...path, key]),
                );
              }
              return [];
            })(packageJson.exports, ['exports']);

            for (const [moduleId, path] of moduleIds) {
              const targetProgramNode = await engine.resolveProgram(
                moduleId,
                file,
                findNode(packageJsonTree, path),
              );

              if (targetProgramNode) {
                engine.addDependency(
                  file,
                  targetProgramNode.allExportsSymbol(),
                );
              }
            }
          }

          if (this.options.lockFiles) {
            for (const name of [
              'package-lock.json',
              'yarn.lock',
              'pnpm-lock.yaml',
            ]) {
              const lockFileNode = contextDir.child('file', name);

              engine.addDependency(file, lockFileNode);
            }
          }

          if (this.options.workspaceFiles) {
            for (const name of [
              'lerna.json',
              'pnpm-workspace.yaml',
              'yarn-workspace-versioning.json',
            ]) {
              const workspaceFileNode = contextDir.child('file', name);

              engine.addDependency(file, workspaceFileNode);
            }
          }

          engine.addDependency(engine.rootNode, file);
        }
      });

    engine.hooks.resolveProgramNode.tap('NodeJsPlugin', ({ moduleId }) => {
      if (!isBuiltin(moduleId)) {
        return undefined;
      }

      return engine.file(moduleId).program('node');
    });
  }
}
