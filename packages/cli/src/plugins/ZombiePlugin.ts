import z from 'zod';
import type { Engine } from '../engine.ts';

const optionsSchema = z
  .object({
    reportAll: z.boolean().default(false),
  })
    .strict().default({});

export type ZombieOptions = z.infer<typeof optionsSchema>;

export class ZombiePlugin {
  static schema = optionsSchema;

  constructor(protected options: ZombieOptions) {}

  apply(engine: Engine) {
    let unusedNodeIds: Set<number> = new Set();

    engine.hooks.analyzeGraph.tap('ZombiePlugin', () => {
      unusedNodeIds = new Set(
        Array.from({ length: engine.graph.size }).map((_, i) => i),
      );

      const stack = [engine.rootNode];

      while (stack.length) {
        // biome-ignore lint/style/noNonNullAssertion: Stack is never empty
        const node = stack.pop()!;

        if (!unusedNodeIds.has(node.id)) {
          continue;
        }

        unusedNodeIds.delete(node.id);
        stack.push(...engine.getDependencies(node));
      }

      for (const unusedNodeId of unusedNodeIds) {
        const node = engine.graph.getNode(unusedNodeId);

        if (!node?.isReal) {
          unusedNodeIds.delete(unusedNodeId);
        }
      }

      if (!this.options.reportAll) {
        // report only leaf nodes
        for (const unusedNodeId of unusedNodeIds) {
          let node = engine.graph.getNode(unusedNodeId)?.parent;

          while (node) {
            unusedNodeIds.delete(node.id);
            node = node.parent;
          }
        }
      }

      for (const unusedNodeId of unusedNodeIds) {
        const node = engine.graph.getNode(unusedNodeId);

        if (!node) {
          continue;
        }

        if (node.meta?.kind === 'symbol') {
          const { syntaxNode } = node.meta;
          const programNode = node.closest('program');

          if (programNode) {
            engine.addIssue(node, {
              level: 'warning',
              code: 'zombie',
              syntaxNode,
              description: 'This symbol is needlessly exported',
              help: 'No imports were found that reference this symbol.\nYou can safely remove the export modifier.',
            });
          } else {
            engine.addIssue(node, {
              level: 'warning',
              code: 'zombie',
              syntaxNode,
              description: 'This symbol is not used',
              help: 'No imports were found that reference this symbol.\nYou can safely remove it.',
            });
          }
        } else {
          let help: string | null = null;

          if (node.type === 'file') {
            help =
              'No imports or references detected.\nYou can safely remove this file or update your config.';
          }

          engine.addIssue(node, {
            level: 'warning',
            code: 'zombie',
            description: `Found unused ${node.type}`,
            help,
          });
        }
      }
    });
  }
}
