import { minimatch } from 'minimatch';
import z from 'zod';
import type { Engine, FileNode, Node } from '../engine.ts';
import { toArray } from '../utils/toArray.ts';

const optionsSchema = z.union([
  z.string().nonempty('entry must be nonempty'),
  z.string().nonempty('entry must be nonempty').array(),
]);

export type EntryOptions = z.infer<typeof optionsSchema>;

export class EntryPlugin {
  static schema = optionsSchema;

  readonly selectors: readonly string[];

  constructor(options: EntryOptions) {
    this.selectors = toArray(options);
  }

  apply(engine: Engine) {
    engine.hooks.buildGraph
      .withOptions({
        stage: 20,
      })
      .tap('EntryPlugin', () => {
        for (const node of engine.rootNode.walk()) {
          if (this.isMatch(node)) {
            engine.addDependency(engine.rootNode, node);
          }
        }
      });
  }

  isMatch(node: Node): boolean {
    const path = [];

    // try to anchor to file
    const file = node.closest('file') as FileNode | null;

    if (file) {
      let currentNode: Node | null = node;
      while (currentNode && currentNode !== file) {
        path.unshift(currentNode.name);
        currentNode = currentNode.parent;
      }
      path.unshift(file.name);
    } else {
      let currentNode: Node | null = node;
      while (currentNode && currentNode.type !== 'root') {
        path.unshift(currentNode.name);
        currentNode = currentNode.parent;
      }
    }

    const fullPath = path.join('/');

    return this.selectors.some((selector) => minimatch(fullPath, selector));
  }
}
