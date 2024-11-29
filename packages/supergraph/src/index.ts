export enum DirectionFlag {
	Forward = 1,
	Reverse = 2,
	Any = 3,
}

export interface GraphLike<TNodeKey, TNode, TEdge> {
	getNode(key: TNodeKey): TNode | undefined;
	getNodes(): Iterable<TNodeKey>;
	getEdges(
		key: TNodeKey,
		to?: TNodeKey,
		direction?: DirectionFlag,
	): Iterable<readonly [TNodeKey, TEdge]>;

	setNode(key: TNodeKey, node: TNode): void;
	addEdge(from: TNodeKey, to: TNodeKey, edge: TEdge): void;
	removeEdge(from: TNodeKey, to: TNodeKey, edge: TEdge): void;
	clearEdges(from: TNodeKey, to: TNodeKey): void;

	bfs(direction: DirectionFlag, ...start: TNodeKey[]): Iterable<TNodeKey>;
	dfs(direction: DirectionFlag, ...start: TNodeKey[]): Iterable<TNodeKey>;

	isReachable(from: TNodeKey, to: TNodeKey, direction?: DirectionFlag): boolean;
	getUnreachableNodes(
		from: TNodeKey,
		direction?: DirectionFlag,
	): Iterable<TNodeKey>;
}

export abstract class Graph<TNodeKey, TNode, TEdge> {
	abstract getNodes(): Iterable<TNodeKey>;
	abstract getEdges(
		key: TNodeKey,
		to?: TNodeKey,
		direction?: DirectionFlag,
	): Iterable<readonly [TNodeKey, TEdge]>;

	*bfs(direction: DirectionFlag, ...start: TNodeKey[]): Iterable<TNodeKey> {
		const visited = new Set<TNodeKey>();
		const queue = start;

		while (queue.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const key = queue.shift()!;

			if (visited.has(key)) {
				continue;
			}

			visited.add(key);

			yield key;

			for (const [to] of this.getEdges(key, undefined, direction)) {
				if (!visited.has(to)) {
					queue.push(to);
				}
			}
		}
	}

	*dfs(direction: DirectionFlag, ...start: TNodeKey[]): Iterable<TNodeKey> {
		const visited = new Set<TNodeKey>();
		const stack = start;

		while (stack.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const key = stack.pop()!;

			if (visited.has(key)) {
				continue;
			}

			visited.add(key);

			yield key;

			for (const [to] of this.getEdges(key, undefined, direction)) {
				if (!visited.has(to)) {
					stack.push(to);
				}
			}
		}
	}

	isReachable(
		from: TNodeKey,
		to: TNodeKey,
		direction: DirectionFlag = DirectionFlag.Forward,
	): boolean {
		for (const node of this.bfs(direction, from)) {
			if (node === to) {
				return true;
			}
		}

		return false;
	}

	*getUnreachableNodes(
		from: TNodeKey,
		direction: DirectionFlag = DirectionFlag.Forward,
	): Iterable<TNodeKey> {
		const reachable = new Set(this.bfs(direction, from));

		for (const node of this.getNodes()) {
			if (!reachable.has(node)) {
				yield node;
			}
		}
	}
}

export class UndirectedGraph<TNodeKey, TNode, TEdge>
	extends Graph<TNodeKey, TNode, TEdge>
	implements GraphLike<TNodeKey, TNode, TEdge>
{
	readonly #nodes = new Map<TNodeKey, TNode>();
	readonly #edges = new Map<TNodeKey, Map<TNodeKey, Set<TEdge>>>();

	getNode(key: TNodeKey) {
		return this.#nodes.get(key);
	}

	getNodes() {
		return this.#nodes.keys();
	}

	*getEdges(key: TNodeKey, to?: TNodeKey) {
		const edges = this.#edges.get(key);

		if (edges) {
			if (to === undefined) {
				for (const [to, nodeEdges] of edges.entries()) {
					for (const nodeEdge of nodeEdges) {
						yield [to, nodeEdge] as const;
					}
				}
			} else {
				const nodeEdges = edges.get(to);

				if (nodeEdges) {
					for (const nodeEdge of nodeEdges) {
						yield [to, nodeEdge] as const;
					}
				}
			}
		}
	}

	setNode(key: TNodeKey, node: TNode) {
		this.#nodes.set(key, node);
	}

	addEdge(from: TNodeKey, to: TNodeKey, edge: TEdge) {
		const edges = this.#edges;

		function add(n1: TNodeKey, n2: TNodeKey, edge: TEdge) {
			let map = edges.get(n1);

			if (!map) {
				map = new Map();
				edges.set(n1, map);
			}

			let nodeEdges = map.get(n2);

			if (!nodeEdges) {
				nodeEdges = new Set();
				map.set(n2, nodeEdges);
			}

			nodeEdges.add(edge);
		}

		add(from, to, edge);
		add(to, from, edge);
	}

	removeEdge(from: TNodeKey, to: TNodeKey, edge: TEdge) {
		this.#edges.get(from)?.get(to)?.delete(edge);
	}

	clearEdges(from: TNodeKey, to: TNodeKey) {
		this.#edges.get(from)?.delete(to);
		this.#edges.get(to)?.delete(from);
	}
}

export class DirectedGraph<TNodeKey, TNode, TEdge>
	extends Graph<TNodeKey, TNode, TEdge>
	implements GraphLike<TNodeKey, TNode, TEdge>
{
	readonly #nodes = new Map<TNodeKey, TNode>();
	readonly #inEdges = new Map<TNodeKey, Map<TNodeKey, Set<TEdge>>>();
	readonly #outEdges = new Map<TNodeKey, Map<TNodeKey, Set<TEdge>>>();

	getNode(key: TNodeKey) {
		return this.#nodes.get(key);
	}

	getNodes() {
		return this.#nodes.keys();
	}

	*getEdges(
		key: TNodeKey,
		to?: TNodeKey,
		direction: DirectionFlag = DirectionFlag.Forward,
	) {
		function* iter(source: Map<TNodeKey, Map<TNodeKey, Set<TEdge>>>) {
			const edges = source.get(key);

			if (!edges) {
				return;
			}

			if (to === undefined) {
				for (const [to, nodeEdges] of edges.entries()) {
					for (const nodeEdge of nodeEdges) {
						yield [to, nodeEdge] as const;
					}
				}
			} else {
				const nodeEdges = edges.get(to);

				if (nodeEdges) {
					for (const nodeEdge of nodeEdges) {
						yield [to, nodeEdge] as const;
					}
				}
			}
		}

		if (direction & DirectionFlag.Forward) {
			yield* iter(this.#inEdges);
		}

		if (direction & DirectionFlag.Reverse) {
			yield* iter(this.#outEdges);
		}
	}

	setNode(key: TNodeKey, node: TNode) {
		this.#nodes.set(key, node);
	}

	addEdge(from: TNodeKey, to: TNodeKey, edge: TEdge) {
		function add(
			target: Map<TNodeKey, Map<TNodeKey, Set<TEdge>>>,
			n1: TNodeKey,
			n2: TNodeKey,
			edge: TEdge,
		) {
			let map = target.get(n1);

			if (!map) {
				map = new Map();
				target.set(n1, map);
			}

			let nodeEdges = map.get(n2);

			if (!nodeEdges) {
				nodeEdges = new Set();
				map.set(n2, nodeEdges);
			}

			nodeEdges.add(edge);
		}

		add(this.#outEdges, from, to, edge);
		add(this.#inEdges, to, from, edge);
	}

	removeEdge(from: TNodeKey, to: TNodeKey, edge: TEdge) {
		this.#outEdges.get(from)?.get(to)?.delete(edge);
		this.#inEdges.get(to)?.get(from)?.delete(edge);
	}

	clearEdges(from: TNodeKey, to: TNodeKey) {
		this.#outEdges.get(from)?.delete(to);
		this.#inEdges.get(to)?.delete(from);
	}
}

export class Node<TKey, TData, TEdge> {
	readonly #graph: GraphLike<TKey, TData, TEdge>;
	readonly #key: TKey;

	constructor(graph: GraphLike<TKey, TData, TEdge>, key: TKey, data: TData) {
		this.#graph = graph;
		this.#key = key;
		this.#graph.setNode(this.#key, data);
	}

	setData(data: TData) {
		return this.#graph.setNode(this.#key, data);
	}

	getData() {
		return this.#graph.getNode(this.#key);
	}

	getEdges(to?: TKey, direction = DirectionFlag.Forward) {
		return this.#graph.getEdges(this.#key, to, direction);
	}

	addEdge(to: TKey, edge: TEdge) {
		return this.#graph.addEdge(this.#key, to, edge);
	}

	removeEdge(to: TKey, edge: TEdge) {
		return this.#graph.removeEdge(this.#key, to, edge);
	}

	clearEdges(to: TKey) {
		return this.#graph.clearEdges(this.#key, to);
	}

	bfs(direction: DirectionFlag) {
		return this.#graph.bfs(direction, this.#key);
	}

	dfs(direction: DirectionFlag) {
		return this.#graph.dfs(direction, this.#key);
	}

	isReachable(to: TKey, direction: DirectionFlag = DirectionFlag.Forward) {
		return this.#graph.isReachable(this.#key, to, direction);
	}
}
