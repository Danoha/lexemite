abstract class Graph<N, E> {
  constructor(protected superGraph: SuperGraph<N>) {}

  abstract getEdge(a: number, b: number): E | undefined;
  abstract setEdge(a: number, b: number, value: E): void;
  abstract removeEdge(a: number, b: number): void;

  getNode(a: number): N | undefined {
    return this.superGraph.getNode(a);
  }

  addNode(node: N): number {
    return this.superGraph.addNode(node);
  }
}

export class DirectedGraph<N, E> extends Graph<N, E> {
  #edgesOut: { current: E }[][] = [];
  #edgesIn: { current: E }[][] = [];

  getEdge(a: number, b: number): E | undefined {
    return this.#edgesOut[a]?.[b]?.current;
  }

  *getOutgoingEdges(a: number): Iterable<[number, E]> {
    for (const [b, edge] of this.#edgesOut[a]?.entries() ?? []) {
      if (edge !== undefined) {
        yield [b, edge.current];
      }
    }
  }

  *getIncomingEdges(a: number): Iterable<[number, E]> {
    for (const [b, edge] of this.#edgesIn[a]?.entries() ?? []) {
      if (edge !== undefined) {
        yield [b, edge.current];
      }
    }
  }

  setEdge(a: number, b: number, value: E) {
    let edge = this.#edgesOut[a]?.[b];

    if (edge) {
      edge.current = value;
      return;
    }

    edge = { current: value };

    if (!this.#edgesOut[a]) {
      this.#edgesOut[a] = [];
    }
    this.#edgesOut[a][b] = edge;

    if (!this.#edgesIn[b]) {
      this.#edgesIn[b] = [];
    }
    this.#edgesIn[b][a] = edge;
  }

  removeEdge(a: number, b: number) {
    const edgesOut = this.#edgesOut[a];

    if (edgesOut) {
      delete edgesOut[b];
    }

    const edgesIn = this.#edgesIn[b];

    if (edgesIn) {
      delete edgesIn[a];
    }
  }

  topoSort() {
    const visited = new Set<number>();
    const visitedTemp = new Set<number>();
    const result = new Array<number>(this.superGraph.size);
    let index = this.superGraph.size - 1;

    const visit = (n: number) => {
      if (visited.has(n)) {
        return;
      }
      if (visitedTemp.has(n)) {
        throw new Error('Cannot topologically sort a cyclic graph');
      }
      visitedTemp.add(n);

      for (const [m] of this.getOutgoingEdges(n)) {
        visit(m);
      }

      visitedTemp.delete(n);
      visited.add(n);

      result[index--] = n;
    };

    for (let i = 0; i < this.superGraph.size; i++) {
      visit(i);
    }

    return result;
  }
}

export class UndirectedGraph<N, E> extends Graph<N, E> {
  #inner = new DirectedGraph<N, E>(this.superGraph);

  getEdge(a: number, b: number): E | undefined {
    const min = Math.min(a, b);
    const max = Math.max(a, b);

    return this.#inner.getEdge(min, max);
  }

  *getEdges(a: number): Iterable<[number, E]> {
    yield* this.#inner.getOutgoingEdges(a);
    yield* this.#inner.getIncomingEdges(a);
  }

  setEdge(a: number, b: number, value: E) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    this.#inner.setEdge(min, max, value);
  }

  removeEdge(a: number, b: number) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    this.#inner.removeEdge(min, max);
  }
}

export class SuperGraph<N> {
  #nodes: N[] = [];

  get size(): number {
    return this.#nodes.length;
  }

  getNode(id: number): N | undefined {
    return this.#nodes[id];
  }

  addNode(node: N): number {
    const id = this.#nodes.length;
    this.#nodes.push(node);
    return id;
  }

  createUndirectedLayer<E>(): UndirectedGraph<N, E> {
    return new UndirectedGraph<N, E>(this);
  }

  createDirectedLayer<E>(): DirectedGraph<N, E> {
    return new DirectedGraph<N, E>(this);
  }
}
