export interface Word {
	id: number;
	hanzi: string;
	pinyin: string;
	english: string;
	hskLevel: number;
}

export interface Edge {
	sourceId: number;
	targetId: number;
	sharedChars: string[];
	score: number;
}

function getCjkChars(hanzi: string): string[] {
	return [...hanzi].filter((c) => c >= '一' && c <= '鿿');
}

const MAX_EDGES_PER_NODE = 15;

export function buildGraph(words: Word[]): {
	edges: Edge[];
	adjacency: Map<number, { neighborId: number; sharedChars: string[] }[]>;
} {
	const charToWords = new Map<string, number[]>();
	for (const word of words) {
		for (const ch of getCjkChars(word.hanzi)) {
			if (!charToWords.has(ch)) charToWords.set(ch, []);
			charToWords.get(ch)!.push(word.id);
		}
	}

	// exclusivity score per character: rarer = higher score
	const charScore = new Map<string, number>();
	for (const [ch, ids] of charToWords) {
		charScore.set(ch, 1 / ids.length);
	}

	// collect all candidate edges (deduplicated by sorted id pair)
	const edgeMap = new Map<
		string,
		{ sourceId: number; targetId: number; sharedChars: string[]; score: number }
	>();
	for (const [ch, ids] of charToWords) {
		if (ids.length < 2) continue;
		const score = charScore.get(ch)!;
		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				const a = ids[i];
				const b = ids[j];
				const key = a < b ? `${a}:${b}` : `${b}:${a}`;
				const existing = edgeMap.get(key);
				if (existing) {
					existing.sharedChars.push(ch);
					if (score > existing.score) existing.score = score;
				} else {
					edgeMap.set(key, {
						sourceId: a < b ? a : b,
						targetId: a < b ? b : a,
						sharedChars: [ch],
						score
					});
				}
			}
		}
	}

	// per-node: keep only top MAX_EDGES_PER_NODE edges by score
	const nodeEdgeCount = new Map<number, number>();
	const allEdges = [...edgeMap.values()].sort((a, b) => b.score - a.score);
	const keptEdges: Edge[] = [];

	for (const edge of allEdges) {
		const ca = nodeEdgeCount.get(edge.sourceId) ?? 0;
		const cb = nodeEdgeCount.get(edge.targetId) ?? 0;
		if (ca >= MAX_EDGES_PER_NODE || cb >= MAX_EDGES_PER_NODE) continue;
		keptEdges.push(edge);
		nodeEdgeCount.set(edge.sourceId, ca + 1);
		nodeEdgeCount.set(edge.targetId, cb + 1);
	}

	// build adjacency list
	const adjacency = new Map<number, { neighborId: number; sharedChars: string[] }[]>();
	for (const word of words) adjacency.set(word.id, []);
	for (const edge of keptEdges) {
		adjacency
			.get(edge.sourceId)!
			.push({ neighborId: edge.targetId, sharedChars: edge.sharedChars });
		adjacency
			.get(edge.targetId)!
			.push({ neighborId: edge.sourceId, sharedChars: edge.sharedChars });
	}

	return { edges: keptEdges, adjacency };
}

export function bfsDistances(
	adjacency: Map<number, { neighborId: number; sharedChars: string[] }[]>,
	startId: number,
	maxDepth = 3
): Map<number, number> {
	const dist = new Map<number, number>();
	dist.set(startId, 0);
	const queue: number[] = [startId];
	while (queue.length > 0) {
		const cur = queue.shift()!;
		const d = dist.get(cur)!;
		if (d >= maxDepth) continue;
		for (const { neighborId } of adjacency.get(cur) ?? []) {
			if (!dist.has(neighborId)) {
				dist.set(neighborId, d + 1);
				queue.push(neighborId);
			}
		}
	}
	return dist;
}
