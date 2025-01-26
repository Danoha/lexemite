import { SuperGraph } from '@danoha/supergraph';
import {
  AsyncParallelHook,
  AsyncSeriesBailHook,
  AsyncSeriesHook,
  SyncBailHook,
} from 'tapable';
import type { SyntaxNode } from 'tree-sitter';
import type { EngineHost } from './host.ts';
import type {
  ProgramExportSelf,
  ProgramImport,
  ProgramReexport,
} from './languages';

export type Meta =
  | {
      kind: 'dir';
      path: string;
    }
  | {
      kind: 'file';
      path: string;
    }
  | {
      kind: 'symbol';
      syntaxNode: SyntaxNode;
    };

export class NodeIterator {
  #stack: Node[][] = [];
  #node: Node | undefined;

  constructor(node: Node) {
    this.#node = node;
  }

  get current() {
    return this.#node;
  }

  next() {
    const firstChild = this.goToFirstChild();

    if (firstChild) {
      return firstChild;
    }

    while (this.#stack.length) {
      const sibling = this.goToNextSibling();

      if (sibling) {
        return sibling;
      }
    }

    return undefined;
  }

  [Symbol.iterator](): Iterator<Node> {
    return {
      next: () => {
        const node = this.next();

        if (node) {
          return { value: node, done: false };
        }

        return { done: true, value: undefined };
      },
    };
  }

  goToFirstChild() {
    if (!this.#node) {
      return undefined;
    }

    const children = this.#node.children();
    const [firstChild, ...rest] = children;

    if (firstChild) {
      this.#stack.push(rest);
      this.#node = firstChild;
      return this.#node;
    }

    this.#node = undefined;
    return undefined;
  }

  goToNextSibling() {
    const siblings = this.#stack[this.#stack.length - 1] ?? [];
    const [firstSibling, ...rest] = siblings;

    if (firstSibling) {
      this.#stack[this.#stack.length - 1] = rest;
      this.#node = firstSibling;
      return this.#node;
    }

    this.#stack.pop();
    this.#node = undefined;
    return undefined;
  }

  goToParent() {
    this.#stack.pop();

    return this.goToNextSibling();
  }
}

export class Node {
  #children: Record<string, Record<string, Node>> = {};
  #isReal = false;

  readonly id: number;
  meta?: Meta;

  get isReal() {
    return this.#isReal;
  }

  set isReal(value: boolean) {
    if (this.#isReal === value) {
      return;
    }

    this.#isReal = value;

    if (value && this.parent) {
      this.parent.isReal = true;
    }
  }

  constructor(
    readonly engine: Engine,
    readonly type: string,
    readonly name: string,
    readonly parent: Node | null,
  ) {
    this.id = engine.graph.addNode(this);
  }

  child(type: string, name: string): Node {
    if (!this.#children[type]) {
      this.#children[type] = {};
    }

    if (!this.#children[type][name]) {
      let child: Node;

      switch (type) {
        case 'dir':
          child = new DirNode(this.engine, name, this);
          break;
        case 'file':
          child = new FileNode(this.engine, name, this);
          break;
        case 'program':
          child = new ProgramNode(this.engine, name, this);
          break;
        case 'symbol':
          child = new SymbolNode(this.engine, name, this);
          break;
        default:
          child = new Node(this.engine, type, name, this);
      }

      this.#children[type][name] = child;
    }

    return this.#children[type][name];
  }

  file(name: string) {
    return this.child('file', name) as FileNode;
  }

  dir(name: string) {
    return this.child('dir', name) as DirNode;
  }

  program(name: string) {
    return this.child('program', name) as ProgramNode;
  }

  symbol(name: string) {
    return this.child('symbol', name) as SymbolNode;
  }

  childrenOfType(type: string): Node[] {
    return Object.values(this.#children[type] ?? {});
  }

  children(): Node[] {
    return Object.values(this.#children).flatMap(Object.values);
  }

  walk() {
    return new NodeIterator(this);
  }

  closest(type: string, name?: string) {
    let current: Node | null = this;

    while (current) {
      if (
        current.type === type &&
        (name === undefined || current.name === name)
      ) {
        return current;
      }

      current = current.parent;
    }

    return null;
  }

  toString() {
    return `${this.type}:${this.name}`;
  }
}

export class FileNode extends Node {
  constructor(engine: Engine, name: string, parent: Node) {
    super(engine, 'file', name, parent);
  }

  path(): string | undefined {
    return this.meta?.kind === 'file' ? this.meta.path : undefined;
  }

  override symbol(name: string, syntaxNode?: SyntaxNode | null): SymbolNode {
    const symbol = super.symbol(name);

    if (syntaxNode && !symbol.meta) {
      symbol.meta = { kind: 'symbol', syntaxNode };
      this.engine.addDependency(symbol, this);
    }

    return symbol;
  }

  override program(name: string) {
    const program = super.program(name);

    this.engine.addDependency(program, this);

    return program;
  }
}

export class DirNode extends Node {
  constructor(engine: Engine, name: string, parent: Node) {
    super(engine, 'dir', name, parent);
  }

  path(): string | undefined {
    return this.meta?.kind === 'dir' ? this.meta.path : undefined;
  }
}

export class ProgramNode extends Node {
  constructor(engine: Engine, name: string, parent: Node) {
    super(engine, 'program', name, parent);
  }

  allExportsSymbol() {
    const symbol = super.symbol('*');

    this.engine.addDependency(symbol, this);

    return symbol;
  }

  override symbol(
    name: string | null,
    syntaxNode?: SyntaxNode | null,
  ): SymbolNode {
    const allExports = this.allExportsSymbol();

    if (name === null) {
      return allExports;
    }

    const symbol = super.symbol(name);

    if (syntaxNode && !symbol.meta) {
      symbol.meta = { kind: 'symbol', syntaxNode };
      this.engine.addDependency(allExports, symbol);
    }

    this.engine.addDependency(symbol, this);

    return symbol;
  }

  addImport(targetProgramNode: ProgramNode, programImport: ProgramImport) {
    const localNode = this.symbol(
      programImport.localSpecifier,
      programImport.node,
    );

    const sourceNode = targetProgramNode.symbol(
      programImport.externalSpecifier,
    );

    this.engine.addDependency(this, localNode);
    this.engine.addDependency(localNode, sourceNode);
  }

  addExport(programExport: ProgramExportSelf) {
    this.symbol(programExport.exportedSpecifier, programExport.node).isReal =
      true;
  }

  addReexport(sourceProgramNode: ProgramNode, programExport: ProgramReexport) {
    const localNode = this.symbol(
      programExport.exportedSpecifier,
      programExport.node,
    );

    const sourceNode = sourceProgramNode.symbol(
      programExport.source.externalSpecifier,
    );

    localNode.isReal = true;

    this.engine.addDependency(localNode, sourceNode);
  }
}

export class SymbolNode extends Node {
  constructor(engine: Engine, name: string, parent: Node) {
    super(engine, 'symbol', name, parent);
  }

  override symbol(name: string, syntaxNode?: SyntaxNode | null): SymbolNode {
    const symbol = super.symbol(name);

    if (syntaxNode && !symbol.meta) {
      symbol.meta = { kind: 'symbol', syntaxNode };
      this.engine.addDependency(symbol, this);
    }

    return symbol;
  }
}

export interface Issue {
  level: 'error' | 'warning';
  code: string;
  description: string;
  help?: string | null;
  syntaxNode?: SyntaxNode | null;
  details?: string[];
}

export interface ResolveProgramModuleRequest {
  moduleId: string;
  context: Node;
  details: string[];
}

export class Engine {
  readonly hooks: {
    readonly initialize: AsyncSeriesHook<[Engine]>;
    readonly buildGraph: AsyncSeriesHook<[Engine]>;
    readonly analyzeGraph: AsyncSeriesHook<[Engine]>;
    readonly done: AsyncParallelHook<[Engine]>;
    readonly readFile: AsyncSeriesBailHook<[Node], Buffer | undefined>;
    readonly resolveProgramNode: AsyncSeriesBailHook<
      [ResolveProgramModuleRequest],
      ProgramNode | undefined
    >;
    readonly formatNode: SyncBailHook<Node, string | undefined>;
  };
  readonly graph = new SuperGraph<Node>();
  readonly rootNode = new Node(this, 'root', 'root', null);
  readonly issues = this.graph.createDirectedLayer<Set<Issue>>();
  readonly dependencies = this.graph.createDirectedLayer<true>();

  constructor(readonly host: EngineHost) {
    this.hooks = {
      initialize: new AsyncSeriesHook(['engine'], 'initialize'),
      buildGraph: new AsyncSeriesHook(['engine'], 'buildGraph'),
      analyzeGraph: new AsyncSeriesHook(['engine'], 'analyzeGraph'),
      done: new AsyncParallelHook(['engine'], 'done'),
      readFile: new AsyncSeriesBailHook(['node'], 'readFile'),
      resolveProgramNode: new AsyncSeriesBailHook(
        ['request'],
        'resolveProgramNode',
      ),
      formatNode: new SyncBailHook(['node'], 'formatNode'),
    };
  }

  dir(path: string): Node {
    let currentPath = path;
    let parentPath = this.host.dirname(path);
    const stack: { name: string; path: string }[] = [];

    while (currentPath !== parentPath) {
      const name = this.host.basename(currentPath);
      stack.push({ name, path: currentPath });
      currentPath = parentPath;
      parentPath = this.host.dirname(parentPath);
    }

    let node = this.rootNode;

    for (const { name, path } of stack.reverse()) {
      const parentNode = node;
      node = node.child('dir', name);

      if (!node.meta) {
        node.meta = { kind: 'dir', path };
        this.addDependency(node, parentNode);
      }
    }

    return node;
  }

  file(path: string): Node {
    const dirNode = this.dir(this.host.dirname(path));
    const fileNode = dirNode.child('file', this.host.basename(path));

    if (!fileNode.meta) {
      fileNode.meta = { kind: 'file', path };
      this.addDependency(fileNode, dirNode);
    }

    return fileNode;
  }

  *files(parent = this.rootNode): Iterable<FileNode> {
    const walker = parent.walk();

    while (walker.current) {
      if (walker.current instanceof DirNode || walker.current.type === 'root') {
        if (!walker.goToFirstChild()) {
          walker.goToNextSibling();
        }
        continue;
      }
      if (!(walker.current instanceof FileNode)) {
        walker.goToNextSibling();
        continue;
      }

      yield walker.current;

      if (!walker.goToNextSibling()) {
        walker.next();
      }
    }
  }

  addIssue(node: Node, issue: Issue) {
    let issues = this.issues.getEdge(this.rootNode.id, node.id);

    if (!issues) {
      issues = new Set();
      this.issues.setEdge(this.rootNode.id, node.id, issues);
    }

    issues.add(issue);
  }

  *getIssuesForNode(node: Node): Iterable<Issue> {
    const issues = this.issues.getEdge(this.rootNode.id, node.id);

    if (issues) {
      yield* issues;
    }
  }

  *getIssues(): Iterable<[Node, Issue]> {
    for (const [to, issues] of this.issues.getOutgoingEdges(this.rootNode.id)) {
      const node = this.graph.getNode(to);

      if (node) {
        for (const issue of issues) {
          yield [node, issue];
        }
      }
    }
  }

  addDependency(from: Node, to: Node) {
    this.dependencies.setEdge(from.id, to.id, true);
  }

  addEntry(node: Node) {
    this.addDependency(this.rootNode, node);
  }

  *getDependencies(node: Node): Iterable<Node> {
    for (const [to] of this.dependencies.getOutgoingEdges(node.id)) {
      const node = this.graph.getNode(to);

      if (node) {
        yield node;
      }
    }
  }

  *getDependents(node: Node): Iterable<Node> {
    for (const [from] of this.dependencies.getIncomingEdges(node.id)) {
      const node = this.graph.getNode(from);

      if (node) {
        yield node;
      }
    }
  }

  formatNode(node: Node): string {
    const result = this.hooks.formatNode.call(node);

    if (result !== undefined) {
      return result;
    }

    if (node.type === 'file' || node.type === 'dir') {
      // prevent infinite recursion

      if (node.meta?.kind === 'file' || node.meta?.kind === 'dir') {
        return node.meta.path;
      }
      return node.toString();
    }

    // try to anchor the node to a file
    const file = node.closest('file');

    if (file) {
      return `${this.formatNode(file)} > ${node.toString()}`;
    }

    // now try to anchor the node to a dir
    const dir = node.closest('dir');

    if (dir) {
      return `${this.formatNode(dir)} > ${node.toString()}`;
    }

    return node.toString();
  }

  async resolveProgram(
    moduleId: string,
    context: Node,
    syntaxNode?: SyntaxNode | null,
  ): Promise<ProgramNode | undefined> {
    const details: string[] = [];
    const result = await this.hooks.resolveProgramNode.promise({
      moduleId,
      context,
      details,
    });

    if (result === undefined) {
      this.addIssue(context, {
        description: `Cannot resolve module "${moduleId}"`,
        level: 'warning',
        code: 'module-not-found',
        syntaxNode: syntaxNode ?? null,
        help: 'This indicates a misconfiguration or a missing dependency.',
        details,
      });
    }

    return result;
  }
}
