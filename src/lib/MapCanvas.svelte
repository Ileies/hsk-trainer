<script lang="ts">
	import { onMount } from 'svelte';
	import { forceSimulation, forceManyBody, forceLink, forceCenter } from 'd3-force';
	import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
	import { quadtree as d3quadtree } from 'd3-quadtree';
	import { resolve } from '$app/paths';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { buildGraph, bfsDistances } from '$lib/mapGraph';
	import type { Word, Edge } from '$lib/mapGraph';
	import { Search, Crosshair } from '@lucide/svelte';

	let { words }: { words: Word[] } = $props();

	type SimNode = Word & SimulationNodeDatum & { degree: number };
	type SimLink = SimulationLinkDatum<SimNode> & { source: SimNode; target: SimNode; score: number };

	// HSK filter - all on by default (only controls visibility, not simulation)
	const activeHsk = new SvelteSet([1, 2, 3, 4, 5, 6]);
	let visibleCount = $derived(words.filter((w) => activeHsk.has(w.hskLevel)).length);

	// Canvas element
	let canvas = $state<HTMLCanvasElement | undefined>(undefined);

	// Simulation output
	let loading = $state(true);
	let nodes: SimNode[] = [];
	let basePositions: { x: number; y: number }[] = []; // centered, pre-stretch
	let keptEdges: Edge[] = [];
	let adjacency = new SvelteMap<number, { neighborId: number; sharedChars: string[] }[]>();
	const nodeById = new SvelteMap<number, SimNode>();
	let qt = d3quadtree<SimNode>()
		.x((n: SimNode) => n.x ?? 0)
		.y((n: SimNode) => n.y ?? 0);

	// Focus
	let focusedId = $state<number | null>(null);
	let bfsResult = new SvelteMap<number, number>();
	// Pre-computed per-focus lists so render passes don't scan all 5k nodes / 30k edges each frame
	let focusedEdges: typeof keptEdges = [];
	let nearNodes: SimNode[] = [];

	// Camera - plain objects mutated each frame
	const cam = { x: 0, y: 0, scale: 0.5 };
	const camTarget = { x: 0, y: 0, scale: 0.5 };
	let minScale = 0.04;
	let worldBbox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

	function clampCamPos(cx: number, cy: number, scale: number): { x: number; y: number } {
		if (!canvas || nodes.length === 0) return { x: cx, y: cy };
		const W = canvas.width;
		const H = canvas.height;
		const { minX, maxX, minY, maxY } = worldBbox;
		const worldCx = (minX + maxX) / 2;
		const worldCy = (minY + maxY) / 2;

		// At or near minScale, force centering
		if (scale <= minScale * 1.02) {
			return { x: W / 2 - worldCx * scale, y: H / 2 - worldCy * scale };
		}

		// Keep the viewport center within the content bounding box.
		// Screen center in world = (W/2 - cam.x) / scale, must be in [minX, maxX].
		// → cam.x in [W/2 - maxX*scale, W/2 - minX*scale]
		const newX = Math.max(W / 2 - maxX * scale, Math.min(W / 2 - minX * scale, cx));
		const newY = Math.max(H / 2 - maxY * scale, Math.min(H / 2 - minY * scale, cy));

		return { x: newX, y: newY };
	}

	// Hover tooltip
	let hoverNode = $state<SimNode | null>(null);
	let hoverClientX = $state(0);
	let hoverClientY = $state(0);

	// Drag state
	let isDragging = $state(false);
	let hasDragged = false;
	let dragLast = { x: 0, y: 0 };

	// Multi-touch / pinch state
	let activePointers = new SvelteMap<number, { x: number; y: number }>();
	let lastPinchDist = 0;

	// Map-local search
	let mapSearch = $state('');
	let mapDropdown = $state<
		{ id: number; hanzi: string; pinyin: string; english: string; hskLevel: number }[]
	>([]);
	let showMapDropdown = $state(false);
	let mapSearchDebounce: ReturnType<typeof setTimeout> | null = null;
	let mapSearchInput: HTMLInputElement | undefined = $state();

	let rafId = 0;
	let simulated = false;
	let needsRedraw = true;

	const LAYOUT_CACHE_KEY = 'hsk-map-layout-v2';

	function loadCachedLayout(): { id: number; x: number; y: number }[] | null {
		try {
			const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
			if (!raw) return null;
			const data = JSON.parse(raw);
			if (!Array.isArray(data) || data.length !== words.length) return null;
			return data;
		} catch {
			return null;
		}
	}

	function saveCachedLayout(ns: SimNode[]) {
		try {
			localStorage.setItem(
				LAYOUT_CACHE_KEY,
				JSON.stringify(ns.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 })))
			);
		} catch {
			// Ignore storage quota/private mode failures.
		}
	}

	const HSK_COLORS = ['#4ade80', '#60a5fa', '#facc15', '#fb923c', '#f87171', '#c084fc'];
	const HSK_LABELS = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];

	function hskColor(level: number) {
		return HSK_COLORS[(level - 1) % 6];
	}

	const DEPTH_NODE_ALPHA = [1, 0.9, 0.5, 0.2];
	const DEPTH_EDGE_ALPHA = [0, 0.65, 0.35, 0.12];
	const DEPTH_RADIUS = [11, 7, 5, 4];

	function nodeAlpha(d: number | undefined): number {
		if (focusedId === null) return 1;
		if (d === undefined || d > 3) return 0.3;
		return DEPTH_NODE_ALPHA[d];
	}

	function edgeAlpha(minDepth: number): number {
		return DEPTH_EDGE_ALPHA[Math.min(minDepth, 3)];
	}

	function nodeRadius(d: number | undefined): number {
		if (d === undefined) return 4;
		return DEPTH_RADIUS[Math.min(d, 3)];
	}

	function runSimulation(simWords: Word[]) {
		focusedId = null;
		hoverNode = null;
		bfsResult = new SvelteMap();

		if (simWords.length === 0) {
			nodes = [];
			keptEdges = [];
			adjacency = new SvelteMap();
			nodeById.clear();
			loading = false;
			return;
		}

		const { edges, adjacency: adj } = buildGraph(simWords);
		adjacency = new SvelteMap(adj);
		keptEdges = edges;

		const degree = new SvelteMap<number, number>(simWords.map((w) => [w.id, 0]));
		for (const edge of edges) {
			degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
			degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
		}

		const byDegree = [...simWords].sort(
			(a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)
		);
		const connectedWords = byDegree.filter((w) => (degree.get(w.id) ?? 0) > 0);
		const isolatedWords = byDegree.filter((w) => (degree.get(w.id) ?? 0) === 0);
		const goldenAngle = Math.PI * (3 - Math.sqrt(5));

		function finalize(connNodes: SimNode[]) {
			const cx = connNodes.reduce((s, n) => s + (n.x ?? 0), 0) / connNodes.length;
			const cy = connNodes.reduce((s, n) => s + (n.y ?? 0), 0) / connNodes.length;
			for (const n of connNodes) {
				n.x = (n.x ?? 0) - cx;
				n.y = (n.y ?? 0) - cy;
			}

			const clusterR = connNodes.reduce((r, n) => Math.max(r, Math.hypot(n.x ?? 0, n.y ?? 0)), 0);
			const isoR = clusterR + 20;
			const isoNodes: SimNode[] = isolatedWords.map((w, i) => ({
				...w,
				x: isoR * Math.cos(i * goldenAngle),
				y: isoR * Math.sin(i * goldenAngle),
				degree: 0
			}));

			const allNodes = [...connNodes, ...isoNodes];
			saveCachedLayout(allNodes);

			nodes = allNodes;
			nodeById.clear();
			for (const n of allNodes) nodeById.set(n.id, n);
			basePositions = allNodes.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 }));
			applyLayout();

			if (canvas) {
				cam.x = canvas.width / 2;
				cam.y = canvas.height / 2;
				cam.scale = minScale;
				camTarget.x = cam.x;
				camTarget.y = cam.y;
				camTarget.scale = minScale;
			}
			loading = false;
			needsRedraw = true;
			const autoFocus = byDegree[0];
			if (autoFocus) focusNode(autoFocus.id);
		}

		// Restore from localStorage cache - instant load on repeat visits
		const cached = loadCachedLayout();
		if (cached) {
			const posMap = new SvelteMap(cached.map((p) => [p.id, p]));
			const connNodes: SimNode[] = connectedWords.map((w) => {
				const p = posMap.get(w.id) ?? { x: 0, y: 0 };
				return { ...w, x: p.x, y: p.y, degree: degree.get(w.id) ?? 0 };
			});
			finalize(connNodes);
			return;
		}

		// First visit: run force simulation, then cache. One rAF yield so the loading
		// spinner renders before we block, then everything runs synchronously to avoid
		// setTimeout throttling on mobile (which can delay chunks by seconds each).
		const spiralScale = 20;
		const connSimNodes: SimNode[] = connectedWords.map((w, i) => ({
			...w,
			x: spiralScale * Math.sqrt(i + 1) * Math.cos(i * goldenAngle),
			y: spiralScale * Math.sqrt(i + 1) * Math.sin(i * goldenAngle),
			degree: degree.get(w.id) ?? 0
		}));

		const idToConn = new SvelteMap(connSimNodes.map((n) => [n.id, n]));
		const simLinks = edges
			.map((e): SimLink | null => {
				const s = idToConn.get(e.sourceId),
					t = idToConn.get(e.targetId);
				return s && t ? { source: s, target: t, score: e.score } : null;
			})
			.filter((l): l is SimLink => l !== null);

		const sim = forceSimulation(connSimNodes)
			.force('charge', forceManyBody().strength(-80))
			.force(
				'link',
				forceLink<SimNode, SimLink>(simLinks)
					.distance((l) => 20 + 60 / (1 + l.score * 10))
					.strength(0.6)
			)
			.force('center', forceCenter(0, 0))
			.stop();

		requestAnimationFrame(() => {
			for (let i = 0; i < 120; i++) sim.tick();
			finalize(connSimNodes);
		});
	}

	function applyLayout() {
		if (!canvas || nodes.length === 0) return;

		const distances = basePositions.map((p) => Math.hypot(p.x, p.y));
		const sortedDist = [...distances].sort((a, b) => a - b);
		const rInner = sortedDist[Math.floor(sortedDist.length * 0.6)] ?? 0;
		const rOuter = sortedDist[Math.floor(sortedDist.length * 0.85)] ?? rInner * 1.5;

		const canvasAspect = canvas.width / canvas.height;
		const isWide = canvasAspect > 1;
		const stretch = isWide ? canvasAspect : 1 / canvasAspect;

		for (let i = 0; i < nodes.length; i++) {
			nodes[i].x = basePositions[i].x;
			nodes[i].y = basePositions[i].y;
		}

		if (rOuter > rInner && stretch > 1.05) {
			for (let i = 0; i < nodes.length; i++) {
				const n = nodes[i];
				const r = distances[i];
				if (r <= rInner) continue;
				const t = Math.min(1, (r - rInner) / (rOuter - rInner));
				const blend = t * t * (3 - 2 * t);
				const bx = basePositions[i].x;
				const by = basePositions[i].y;
				const theta = Math.atan2(by, bx);
				if (isWide) {
					n.x = bx * (1 + blend * (stretch - 1) * Math.cos(theta) ** 2);
				} else {
					n.y = by * (1 + blend * (stretch - 1) * Math.sin(theta) ** 2);
				}
			}
		}

		let bboxMinX = Infinity,
			bboxMaxX = -Infinity;
		let bboxMinY = Infinity,
			bboxMaxY = -Infinity;
		for (const n of nodes) {
			const nx = n.x ?? 0,
				ny = n.y ?? 0;
			if (nx < bboxMinX) bboxMinX = nx;
			if (nx > bboxMaxX) bboxMaxX = nx;
			if (ny < bboxMinY) bboxMinY = ny;
			if (ny > bboxMaxY) bboxMaxY = ny;
		}
		const bboxW = bboxMaxX - bboxMinX;
		const bboxH = bboxMaxY - bboxMinY;
		const pad = 60;
		const sx = bboxW > 0 ? (canvas.width - pad * 2) / bboxW : 1;
		const sy = bboxH > 0 ? (canvas.height - pad * 2) / bboxH : 1;
		minScale = Math.min(sx, sy);
		worldBbox = { minX: bboxMinX, maxX: bboxMaxX, minY: bboxMinY, maxY: bboxMaxY };

		qt = d3quadtree<SimNode>()
			.x((n: SimNode) => n.x ?? 0)
			.y((n: SimNode) => n.y ?? 0)
			.addAll(nodes);

		needsRedraw = true;
	}

	function focusNode(id: number, panCamera = true) {
		const node = nodeById.get(id);
		if (!node) return;
		focusedId = id;
		bfsResult = new SvelteMap(bfsDistances(adjacency, id, 3));
		// Pre-compute per-focus lists so render passes don't scan everything each frame
		focusedEdges = keptEdges.filter((e) => {
			const sd = bfsResult.get(e.sourceId) ?? Infinity;
			const td = bfsResult.get(e.targetId) ?? Infinity;
			return Math.min(sd, td) <= 2;
		});
		nearNodes = nodes.filter((n) => {
			const d = bfsResult.get(n.id);
			return d !== undefined && d <= 2;
		});
		needsRedraw = true;
		if (panCamera && canvas) {
			camTarget.scale = 1.8;
			camTarget.x = canvas.width / 2 - (node.x ?? 0) * camTarget.scale;
			camTarget.y = canvas.height / 2 - (node.y ?? 0) * camTarget.scale;
		}
	}

	function canvasToWorld(clientX: number, clientY: number): [number, number] {
		const rect = canvas!.getBoundingClientRect();
		const cx = (clientX - rect.left) * devicePixelRatio;
		const cy = (clientY - rect.top) * devicePixelRatio;
		return [(cx - cam.x) / cam.scale, (cy - cam.y) / cam.scale];
	}

	function hitTest(wx: number, wy: number): SimNode | null {
		const r = Math.max(12, 12 / cam.scale);
		const found = qt.find(wx, wy, r);
		return found && activeHsk.has(found.hskLevel) ? found : null;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const rect = canvas!.getBoundingClientRect();
		const cx = (e.clientX - rect.left) * devicePixelRatio;
		const cy = (e.clientY - rect.top) * devicePixelRatio;
		const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
		const newScale = Math.max(minScale, Math.min(6, cam.scale * factor));
		const ratio = newScale / cam.scale;
		const rawX = cx - (cx - cam.x) * ratio;
		const rawY = cy - (cy - cam.y) * ratio;
		const clamped = clampCamPos(rawX, rawY, newScale);
		cam.x = clamped.x;
		cam.y = clamped.y;
		cam.scale = newScale;
		camTarget.x = cam.x;
		camTarget.y = cam.y;
		camTarget.scale = cam.scale;
		needsRedraw = true;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

		if (activePointers.size >= 2) {
			isDragging = false;
			const pts = [...activePointers.values()];
			lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		} else {
			isDragging = true;
			hasDragged = false;
			dragLast = { x: e.clientX, y: e.clientY };
		}
	}

	function onPointerMove(e: PointerEvent) {
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (activePointers.size >= 2) {
			const pts = [...activePointers.values()];
			const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
			if (lastPinchDist > 0 && dist > 0) {
				const factor = dist / lastPinchDist;
				const midClientX = (pts[0].x + pts[1].x) / 2;
				const midClientY = (pts[0].y + pts[1].y) / 2;
				const rect = canvas!.getBoundingClientRect();
				const cx = (midClientX - rect.left) * devicePixelRatio;
				const cy = (midClientY - rect.top) * devicePixelRatio;
				const newScale = Math.max(minScale, Math.min(6, cam.scale * factor));
				const ratio = newScale / cam.scale;
				const rawX = cx - (cx - cam.x) * ratio;
				const rawY = cy - (cy - cam.y) * ratio;
				const clamped = clampCamPos(rawX, rawY, newScale);
				cam.x = clamped.x;
				cam.y = clamped.y;
				cam.scale = newScale;
				camTarget.x = cam.x;
				camTarget.y = cam.y;
				camTarget.scale = cam.scale;
				needsRedraw = true;
			}
			lastPinchDist = dist;
			hasDragged = true;
			return;
		}

		if (isDragging) {
			const dx = (e.clientX - dragLast.x) * devicePixelRatio;
			const dy = (e.clientY - dragLast.y) * devicePixelRatio;
			if (Math.abs(dx) + Math.abs(dy) > 3) hasDragged = true;
			const clamped = clampCamPos(cam.x + dx, cam.y + dy, cam.scale);
			cam.x = clamped.x;
			cam.y = clamped.y;
			camTarget.x = cam.x;
			camTarget.y = cam.y;
			dragLast = { x: e.clientX, y: e.clientY };
			hoverNode = null;
			needsRedraw = true;
		} else if (!loading && nodes.length > 0) {
			const [wx, wy] = canvasToWorld(e.clientX, e.clientY);
			hoverNode = hitTest(wx, wy);
			hoverClientX = e.clientX;
			hoverClientY = e.clientY;
		}
	}

	function onPointerUp(e: PointerEvent) {
		activePointers.delete(e.pointerId);

		if (activePointers.size === 1) {
			// One finger lifted during pinch - resume single-finger drag
			lastPinchDist = 0;
			const [, pos] = [...activePointers.entries()][0];
			isDragging = true;
			hasDragged = true; // prevent accidental tap-focus after pinch
			dragLast = { x: pos.x, y: pos.y };
			return;
		}

		lastPinchDist = 0;
		if (!isDragging) return;
		isDragging = false;
		if (!hasDragged) {
			const [wx, wy] = canvasToWorld(e.clientX, e.clientY);
			const hit = hitTest(wx, wy);
			if (hit && hit.id !== focusedId) {
				focusNode(hit.id);
			}
		}
	}

	function onPointerCancel(e: PointerEvent) {
		activePointers.delete(e.pointerId);
		if (activePointers.size === 0) {
			isDragging = false;
			lastPinchDist = 0;
		}
		hoverNode = null;
	}

	function onPointerLeave() {
		activePointers.clear();
		lastPinchDist = 0;
		isDragging = false;
		hoverNode = null;
	}

	function renderLoop() {
		rafId = requestAnimationFrame(renderLoop);
		if (!canvas || loading || nodes.length === 0) return;

		const ct = clampCamPos(camTarget.x, camTarget.y, camTarget.scale);
		camTarget.x = ct.x;
		camTarget.y = ct.y;

		const dx = camTarget.x - cam.x;
		const dy = camTarget.y - cam.y;
		const ds = camTarget.scale - cam.scale;
		const camMoving = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05 || Math.abs(ds) > 0.0005;

		if (!camMoving && !needsRedraw) return;
		needsRedraw = false;

		if (camMoving) {
			cam.x += dx * 0.2;
			cam.y += dy * 0.2;
			cam.scale += ds * 0.2;
		} else {
			cam.x = camTarget.x;
			cam.y = camTarget.y;
			cam.scale = camTarget.scale;
		}

		const ctx = canvas.getContext('2d')!;
		const W = canvas.width;
		const H = canvas.height;

		// World-space viewport bounds for culling (pad covers max node radius ~11/scale)
		const vpPad = 20 / cam.scale;
		const vpX0 = -cam.x / cam.scale - vpPad;
		const vpY0 = -cam.y / cam.scale - vpPad;
		const vpX1 = (W - cam.x) / cam.scale + vpPad;
		const vpY1 = (H - cam.y) / cam.scale + vpPad;

		function inView(x: number, y: number): boolean {
			return x >= vpX0 && x <= vpX1 && y >= vpY0 && y <= vpY1;
		}

		ctx.clearRect(0, 0, W, H);
		ctx.save();
		ctx.translate(cam.x, cam.y);
		ctx.scale(cam.scale, cam.scale);

		const focused = focusedId !== null;

		// Pass 0: edge skeleton - skip at overview zoom where it's invisible
		if (cam.scale > 0.12) {
			ctx.globalAlpha = focused ? 0.04 : 0.08;
			ctx.strokeStyle = '#aaaaaa';
			ctx.lineWidth = 1 / cam.scale;
			ctx.beginPath();
			for (const edge of keptEdges) {
				const s = nodeById.get(edge.sourceId);
				const t = nodeById.get(edge.targetId);
				if (!s || !t) continue;
				if (!activeHsk.has(s.hskLevel) || !activeHsk.has(t.hskLevel)) continue;
				const sx = s.x ?? 0,
					sy = s.y ?? 0,
					tx = t.x ?? 0,
					ty = t.y ?? 0;
				if (!inView(sx, sy) && !inView(tx, ty)) continue;
				ctx.moveTo(sx, sy);
				ctx.lineTo(tx, ty);
			}
			ctx.stroke();
		}

		// Node batch helper: groups circles by (hskLevel, alpha) so each color/alpha
		// combo is drawn with a single fill() call instead of one per node.
		// Numeric key: hskLevel*10 + round(alpha*10) - avoids string allocation per node.
		type Circle = [number, number, number]; // x, y, r
		const batchMap = new SvelteMap<
			number,
			{ color: string; alpha: number; plain: Circle[]; outlined: Circle[] }
		>();

		function batchNode(node: SimNode, d: number | undefined) {
			const alpha = nodeAlpha(d);
			if (alpha < 0.01) return;
			const nx = node.x ?? 0,
				ny = node.y ?? 0;
			if (!inView(nx, ny)) return;
			const r = focused ? nodeRadius(d) / cam.scale : (3 + 2 * Math.sqrt(node.degree)) / cam.scale;
			const color = hskColor(node.hskLevel);
			const key = node.hskLevel * 10 + Math.round(alpha * 10);
			let b = batchMap.get(key);
			if (!b) {
				b = { color, alpha, plain: [], outlined: [] };
				batchMap.set(key, b);
			}
			(node.hanzi.length === 1 ? b.outlined : b.plain).push([nx, ny, r]);
		}

		function flushBatches() {
			for (const { color, alpha, plain, outlined } of batchMap.values()) {
				ctx.globalAlpha = alpha;
				ctx.fillStyle = color;
				ctx.beginPath();
				for (const [x, y, r] of plain) {
					ctx.moveTo(x + r, y);
					ctx.arc(x, y, r, 0, Math.PI * 2);
				}
				for (const [x, y, r] of outlined) {
					ctx.moveTo(x + r, y);
					ctx.arc(x, y, r, 0, Math.PI * 2);
				}
				ctx.fill();
				if (outlined.length > 0) {
					ctx.strokeStyle = '#000000';
					ctx.lineWidth = 1.5 / cam.scale;
					ctx.beginPath();
					for (const [x, y, r] of outlined) {
						ctx.moveTo(x + r, y);
						ctx.arc(x, y, r, 0, Math.PI * 2);
					}
					ctx.stroke();
				}
			}
			batchMap.clear();
		}

		// Pass 1: background nodes (d > 2 when focused, all when not)
		for (const node of nodes) {
			if (!activeHsk.has(node.hskLevel)) continue;
			const d = focused ? bfsResult.get(node.id) : undefined;
			if (focused && d !== undefined && d <= 2) continue;
			batchNode(node, d);
		}
		flushBatches();

		// Pass 2: focused edges - iterate pre-computed list (~hundreds, not 30k)
		if (focused) {
			type EBatch = { alpha: number; lw: number; lines: [number, number, number, number][] };
			const eBatches = new SvelteMap<number, EBatch>();
			for (const edge of focusedEdges) {
				const s = nodeById.get(edge.sourceId);
				const t = nodeById.get(edge.targetId);
				if (!s || !t) continue;
				if (!activeHsk.has(s.hskLevel) || !activeHsk.has(t.hskLevel)) continue;
				const sd = bfsResult.get(edge.sourceId) ?? Infinity;
				const td = bfsResult.get(edge.targetId) ?? Infinity;
				const nearDepth = Math.min(sd, td);
				const farDepth = Math.max(sd, td);
				if (nearDepth > 2) continue;
				const sx = s.x ?? 0,
					sy = s.y ?? 0,
					tx = t.x ?? 0,
					ty = t.y ?? 0;
				if (!inView(sx, sy) && !inView(tx, ty)) continue;
				const alpha = nearDepth === 0 ? 0.85 : edgeAlpha(farDepth) * 0.5;
				const lw = (nearDepth === 0 ? 1.8 : 1) / cam.scale;
				const key = Math.round(alpha * 100);
				let b = eBatches.get(key);
				if (!b) {
					b = { alpha, lw, lines: [] };
					eBatches.set(key, b);
				}
				b.lines.push([sx, sy, tx, ty]);
			}
			ctx.strokeStyle = '#777777';
			for (const { alpha, lw, lines } of eBatches.values()) {
				ctx.globalAlpha = alpha;
				ctx.lineWidth = lw;
				ctx.beginPath();
				for (const [sx, sy, tx, ty] of lines) {
					ctx.moveTo(sx, sy);
					ctx.lineTo(tx, ty);
				}
				ctx.stroke();
			}
		}

		// Pass 3: near/focused nodes - iterate pre-computed list (~hundreds, not 5k)
		if (focused) {
			const fn = nodeById.get(focusedId!);
			if (fn && inView(fn.x ?? 0, fn.y ?? 0)) {
				const nx = fn.x ?? 0,
					ny = fn.y ?? 0;
				const r = nodeRadius(0) / cam.scale;
				ctx.globalAlpha = 0.2;
				ctx.fillStyle = hskColor(fn.hskLevel);
				ctx.beginPath();
				ctx.arc(nx, ny, r * 2.5, 0, Math.PI * 2);
				ctx.fill();
			}
			for (const node of nearNodes) {
				if (!activeHsk.has(node.hskLevel)) continue;
				batchNode(node, bfsResult.get(node.id));
			}
			flushBatches();
		}

		// Pass 4: labels - use nearNodes when focused to avoid scanning all 5k
		{
			const fs = Math.max(7, Math.round(12 / cam.scale));
			ctx.fillStyle = '#111111';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';
			const labelNodes = focused ? nearNodes : nodes;
			for (const node of labelNodes) {
				if (!activeHsk.has(node.hskLevel)) continue;
				const d = focused ? bfsResult.get(node.id) : undefined;
				if (focused && (d === undefined || d > 2)) continue;
				const showLabel = focused
					? d !== undefined && d <= 1
						? cam.scale > 0.5
						: cam.scale > 1.2
					: cam.scale > 1.3;
				if (!showLabel) continue;
				const alpha = nodeAlpha(d);
				if (alpha < 0.01) continue;
				const nx = node.x ?? 0,
					ny = node.y ?? 0;
				if (!inView(nx, ny)) continue;
				const r = focused
					? nodeRadius(d) / cam.scale
					: (3 + 2 * Math.sqrt(node.degree)) / cam.scale;
				ctx.globalAlpha = alpha * 0.95;
				ctx.font = `${node.id === focusedId ? '900 ' : ''}${fs}px "Noto Serif CJK SC", serif`;
				ctx.fillText(node.hanzi, nx, ny + r + 2 / cam.scale);
			}
		}

		ctx.restore();
	}

	function resizeCanvas() {
		if (!canvas) return;
		const dpr = devicePixelRatio;
		const rect = canvas.getBoundingClientRect();
		const newW = Math.round(rect.width * dpr);
		const newH = Math.round(rect.height * dpr);
		if (newW === 0 || newH === 0) return;
		if (canvas.width !== newW || canvas.height !== newH) {
			canvas.width = newW;
			canvas.height = newH;
			if (!simulated) {
				simulated = true;
				loading = true;
				bfsResult = new SvelteMap();
				requestAnimationFrame(() => {
					requestAnimationFrame(() => runSimulation(words));
				});
			} else {
				applyLayout();
			}
		}
	}

	async function onMapSearchInput() {
		const q = mapSearch.trim();
		if (mapSearchDebounce) clearTimeout(mapSearchDebounce);
		if (!q) {
			mapDropdown = [];
			showMapDropdown = false;
			return;
		}
		mapSearchDebounce = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
				mapDropdown = await res.json();
				showMapDropdown = mapDropdown.length > 0;
			} catch {
				mapDropdown = [];
				showMapDropdown = false;
			}
		}, 200);
	}

	function onMapSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showMapDropdown = false;
			mapSearchInput?.blur();
		}
	}

	function selectMapWord(id: number) {
		showMapDropdown = false;
		mapSearch = '';
		const node = nodeById.get(id);
		if (node) {
			focusNode(id);
		} else {
			const word = words.find((w) => w.id === id);
			if (word) {
				activeHsk.add(word.hskLevel);
				needsRedraw = true;
			}
		}
	}

	function onMapSearchFocusOut(e: FocusEvent) {
		const related = e.relatedTarget as HTMLElement | null;
		if (related && (e.currentTarget as HTMLElement).contains(related)) return;
		setTimeout(() => {
			showMapDropdown = false;
		}, 150);
	}

	onMount(() => {
		resizeCanvas();
		const ro = new ResizeObserver(resizeCanvas);
		if (canvas) ro.observe(canvas);

		rafId = requestAnimationFrame(renderLoop);

		return () => {
			cancelAnimationFrame(rafId);
			ro.disconnect();
		};
	});
</script>

<div class="flex flex-col h-full">
	<!-- Top strip: search + HSK filters -->
	<div class="flex items-center gap-3 px-4 h-12 bg-base-100 border-b border-base-200 shrink-0 z-10">
		<!-- Map-local search -->
		<div class="relative flex items-center" onfocusout={onMapSearchFocusOut}>
			<label class="input input-sm flex items-center gap-2 w-56">
				<Search size={13} class="text-base-content/40 shrink-0" />
				<input
					bind:this={mapSearchInput}
					bind:value={mapSearch}
					oninput={onMapSearchInput}
					onkeydown={onMapSearchKeydown}
					onfocus={() => {
						if (mapDropdown.length > 0) showMapDropdown = true;
					}}
					type="text"
					placeholder="Locate word..."
					class="grow min-w-0 text-sm"
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
				/>
			</label>

			{#if showMapDropdown}
				<div
					class="absolute top-full mt-1 left-0 bg-base-100 shadow-2xl rounded-xl z-50 w-72 border border-base-200 overflow-hidden"
				>
					{#each mapDropdown as word (word.id)}
						<button
							class="w-full flex items-center gap-3 px-3 py-2 hover:bg-base-200 transition-colors text-left"
							onpointerdown={(e) => {
								e.preventDefault();
								selectMapWord(word.id);
							}}
						>
							<span class="hanzi text-xl font-bold text-primary shrink-0">{word.hanzi}</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1">
									<span class="text-xs font-medium text-base-content/80 truncate"
										>{word.pinyin}</span
									>
									<span class="badge badge-xs badge-ghost shrink-0">HSK {word.hskLevel}</span>
								</div>
								<div class="text-xs text-base-content/50 truncate">{word.english}</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="divider divider-horizontal mx-0 h-6"></div>

		<!-- HSK level toggles -->
		<div class="flex items-center gap-1.5">
			{#each [1, 2, 3, 4, 5, 6] as level, i (level)}
				<button
					class="badge badge-sm font-semibold cursor-pointer select-none transition-opacity border"
					style="background-color: {activeHsk.has(level)
						? HSK_COLORS[i]
						: 'transparent'}; color: {activeHsk.has(level)
						? '#111'
						: HSK_COLORS[i]}; border-color: {HSK_COLORS[i]};"
					onclick={() => {
						if (activeHsk.has(level)) {
							if (activeHsk.size === 1) return;
							activeHsk.delete(level);
						} else {
							activeHsk.add(level);
						}
						needsRedraw = true;
						if (focusedId !== null) {
							const fn = nodeById.get(focusedId);
							if (fn && !activeHsk.has(fn.hskLevel)) {
								const fallback = nodes.find((n) => activeHsk.has(n.hskLevel));
								if (fallback) focusNode(fallback.id, false);
							}
						}
					}}
				>
					{HSK_LABELS[i]}
				</button>
			{/each}
		</div>

		<div class="ml-auto flex items-center gap-2">
			{#if focusedId !== null}
				<div class="tooltip tooltip-bottom" data-tip="Zoom to active node">
					<button class="btn btn-ghost btn-xs btn-square" onclick={() => focusNode(focusedId!)}>
						<Crosshair size={15} />
					</button>
				</div>
			{/if}
			<span class="text-xs text-base-content/40">
				{visibleCount.toLocaleString()} words
			</span>
		</div>
	</div>

	<!-- Canvas container -->
	<div class="relative flex-1 overflow-hidden">
		{#if loading}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-base-200"
			>
				<span class="loading loading-spinner loading-lg text-primary"></span>
				<p class="text-sm text-base-content/60">Computing layout...</p>
			</div>
		{/if}

		<canvas
			bind:this={canvas}
			class="absolute inset-0 w-full h-full touch-none"
			style="cursor: {isDragging ? 'grabbing' : hoverNode ? 'pointer' : 'grab'}"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerCancel}
			onpointerleave={onPointerLeave}
		></canvas>

		<!-- Hover tooltip -->
		{#if hoverNode && !loading}
			<div
				class="pointer-events-none absolute z-30 bg-base-100 border border-base-300 rounded-xl px-3 py-2 shadow-xl text-sm min-w-max"
				style="left: {hoverClientX + 14}px; top: {hoverClientY - 10}px; transform: translateY(-50%)"
			>
				<div class="flex items-center gap-2 mb-0.5">
					<span class="hanzi text-2xl font-bold text-primary">{hoverNode.hanzi}</span>
					<span
						class="badge badge-sm font-semibold"
						style="background-color: {hskColor(hoverNode.hskLevel)}; color: #111"
					>
						HSK {hoverNode.hskLevel}
					</span>
				</div>
				<div class="text-base-content/70 text-xs">{hoverNode.pinyin}</div>
				<div class="text-base-content/50 text-xs truncate max-w-48">{hoverNode.english}</div>
			</div>
		{/if}

		<!-- Focused word panel -->
		{#if focusedId !== null && !loading}
			{@const fw = nodeById.get(focusedId)}
			{#if fw}
				<div
					class="absolute bottom-4 left-4 z-20 bg-base-100/90 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-lg border border-base-200 flex items-center gap-3 max-w-xs"
				>
					<span class="hanzi text-3xl font-bold text-primary leading-none">{fw.hanzi}</span>
					<div class="flex-1 min-w-0">
						<div class="font-medium text-sm leading-snug">{fw.pinyin}</div>
						<div class="text-xs text-base-content/60 truncate leading-snug">{fw.english}</div>
						<div class="flex items-center gap-2 mt-1">
							<span
								class="badge badge-xs font-semibold"
								style="background-color: {hskColor(fw.hskLevel)}; color: #111"
								>HSK {fw.hskLevel}</span
							>
							<a
								href={resolve(`/search?q=${encodeURIComponent(fw.hanzi)}` as '/search')}
								class="text-xs text-primary/70 hover:text-primary transition-colors">details</a
							>
						</div>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Legend -->
		<div
			class="absolute bottom-4 right-4 bg-base-100/80 backdrop-blur-sm rounded-xl p-2 text-xs text-base-content/40 pointer-events-none"
		>
			Tap: focus &nbsp; Scroll: zoom &nbsp; Drag: pan
		</div>
	</div>
</div>
