import Parser from 'tree-sitter';
import z from 'zod';
import type { Engine, Node, ProgramNode } from '../engine.ts';
import { findExports, findImports } from '../languages/jsts.ts';

const optionsSchema = z.object({
  tsx: z.enum(['always', 'never']).optional(),
}).strict().default({});

export type TypeScriptOptions = z.infer<typeof optionsSchema>;

export class TypeScriptPlugin {
  static schema = optionsSchema;

  #tsxLang: unknown;
  #typescriptLang: unknown;

  constructor(readonly options: TypeScriptOptions) {}

  async init() {
    const { typescript: typescriptLang, tsx: tsxLang } = (
      await import('tree-sitter-typescript')
    ).default;

    this.#typescriptLang = typescriptLang;
    this.#tsxLang = tsxLang;
  }

  apply(engine: Engine) {
    const programs = new Map<
      ProgramNode,
      { fileNode: Node; tree: Parser.Tree }
    >();

    engine.hooks.initialize.tapPromise('TypeScriptPlugin', async () => {
      await this.init();

      engine.hooks.buildGraph
        .withOptions({
          stage: 10,
        })
        .tapPromise('TypeScriptPlugin', async () => {
          for (const fileNode of engine.files()) {
            const dialect = this.chooseDialect(fileNode.name);

            if (dialect === null) {
              continue;
            }

            const contents = await engine.hooks.readFile.promise(fileNode);

            if (!contents) {
              continue;
            }

            const parser = new Parser();
            parser.setLanguage(
              dialect === 'ts' ? this.#typescriptLang : this.#tsxLang,
            );
            const tree = parser.parse(contents.toString(), undefined, {
              bufferSize: 1024 * 1024,
            });

            const programNode = fileNode.program(dialect);

            programs.set(programNode, { fileNode, tree });
          }
        });
    });

    engine.hooks.buildGraph
      .withOptions({ stage: 15 })
      .tapPromise('TypeScriptPlugin', async () => {
        for (const [programNode, { tree }] of programs) {
          for (const programImport of findImports(tree)) {
            const targetProgramNode = await engine.resolveProgram(
              programImport.moduleId,
              programNode,
              programImport.node,
            );

            if (targetProgramNode) {
              programNode.addImport(targetProgramNode, programImport);
            }
          }

          for (const programExport of findExports(tree)) {
            if (programExport.source) {
              const targetProgramNode = await engine.resolveProgram(
                programExport.source.moduleId,
                programNode,
                programExport.node,
              );

              if (!targetProgramNode) {
                continue;
              }

              programNode.addReexport(targetProgramNode, programExport);
            } else {
              programNode.addExport(programExport);
            }
          }
        }
      });

    engine.hooks.formatNode.tap('TypeScriptPlugin', (node) => {
      const closestProgram = node.closest('program') as ProgramNode | null;

      if (!closestProgram) {
        return undefined;
      }

      const { fileNode } = programs.get(closestProgram) ?? {};

      if (!fileNode) {
        return undefined;
      }

      switch (node.type) {
        case 'symbol': {
          if (node.name === '*') {
            return `${engine.formatNode(fileNode)} > all exports`;
          }
          return `${engine.formatNode(fileNode)} > ${node.name}`;
        }
        case 'program':
          return `${engine.formatNode(fileNode)} > ${node.name} program`;
        default:
          return engine.formatNode(fileNode);
      }
    });
  }

  chooseDialect(fileName: string) {
    const endsTs = fileName.endsWith('.ts');
    const endsTsx = fileName.endsWith('.tsx');

    if (!endsTs && !endsTsx) {
      return null;
    }

    if (this.options.tsx === 'always') {
      return 'tsx';
    }

    if (this.options.tsx === 'never') {
      return 'ts';
    }

    return endsTsx ? 'tsx' : 'ts';
  }
}
