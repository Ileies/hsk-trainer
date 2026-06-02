<script lang="ts">
	import { onMount } from 'svelte';
	import { forceSimulation, forceManyBody, forceLink } from 'd3-force';
	import type { SimulationNodeDatum } from 'd3-force';
	import { quadtree as d3quadtree } from 'd3-quadtree';
	import { buildGraph, bfsDistances } from '$lib/mapGraph';
	import type { Word, Edge } from '$lib/mapGraph';
	import { Search, Crosshair } from '@lucide/svelte';

	let { words }: { words: Word[] } = $props();

	type SimNode = Word & SimulationNodeDatum;

	// HSK filter - all on by default (only controls visibility, not simulation)
	let activeHsk = $state(new Set([1, 2, 3, 4, 5, 6]));
	let visibleCount = $derived(words.filter((w) => activeHsk.has(w.hskLevel)).length);

	// Canvas element
	let canvas = $state<HTMLCanvasElement | undefined>(undefined);

	// Simulation output
	let loading = $state(true);
	let nodes: SimNode[] = [];
	let basePositions: { x: number; y: number }[] = []; // centered, pre-stretch
	let keptEdges: Edge[] = [];
	let adjacency = new Map<number, { neighborId: number; sharedChars: string[] }[]>();
	let nodeById = $state(new Map<number, SimNode>());
	let qt = d3quadtree<SimNode>()
		.x((n: SimNode) => n.x ?? 0)
		.y((n: SimNode) => n.y ?? 0);

	// Focus
	let focusedId = $state<number | null>(null);
	let bfsResult = new Map<number, number>();

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
	let activePointers = new Map<number, { x: number; y: number }>();
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
		bfsResult = new Map();

		if (simWords.length === 0) {
			nodes = [];
			keptEdges = [];
			adjacency = new Map();
			nodeById = new Map();
			loading = false;
			return;
		}

		const { edges, adjacency: adj } = buildGraph(simWords);
		adjacency = adj;
		keptEdges = edges;

		const spread = Math.sqrt(simWords.length) * 60;
		const simNodes: SimNode[] = simWords.map((w) => ({
			...w,
			x: (Math.random() - 0.5) * spread * 2,
			y: (Math.random() - 0.5) * spread * 2
		}));

		const idToSim = new Map(simNodes.map((n) => [n.id, n]));

		const simLinks = edges
			.map((e) => {
				const s = idToSim.get(e.sourceId);
				const t = idToSim.get(e.targetId);
				return s && t ? { source: s, target: t } : null;
			})
			.filter((l): l is NonNullable<typeof l> => l !== null);

		const sim = forceSimulation(simNodes)
			.force('charge', forceManyBody().strength(-30))
			.force('link', forceLink(simLinks).distance(60).strength(0.5))
			.stop();

		for (let i = 0; i < 300; i++) sim.tick();

		const cx = simNodes.reduce((s, n) => s + (n.x ?? 0), 0) / simNodes.length;
		const cy = simNodes.reduce((s, n) => s + (n.y ?? 0), 0) / simNodes.length;
		for (const n of simNodes) {
			n.x = (n.x ?? 0) - cx;
			n.y = (n.y ?? 0) - cy;
		}

		nodes = simNodes;
		nodeById = idToSim;
		basePositions = simNodes.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 }));

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

		const hsk1 = simNodes.filter((n) => n.hskLevel === 1);
		const autoFocus =
			hsk1.length > 0 ? hsk1[Math.floor(Math.random() * hsk1.length)] : simNodes[0];
		if (autoFocus) focusNode(autoFocus.id);
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

		let bboxMinX = Infinity, bboxMaxX = -Infinity;
		let bboxMinY = Infinity, bboxMaxY = -Infinity;
		for (const n of nodes) {
			const nx = n.x ?? 0, ny = n.y ?? 0;
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
	}

	function focusNode(id: number, panCamera = true) {
		const node = nodeById.get(id);
		if (!node) return;
		focusedId = id;
		bfsResult = bfsDistances(adjacency, id, 3);
		if (panCamera && canvas) {
			camTarget.scale = 1.8;
			camTarget.x = canvas.width / 2 - (node.x ?? 0) * camTarget.scale;
			camTarget.y = canvas.height / 2 - (node.y ?? 0) * camTarget.scale;
		}
	}

	function defocus() {
		focusedId = null;
		bfsResult = new Map();
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

		const ctx = canvas.getContext('2d')!;
		const W = canvas.width;
		const H = canvas.height;

		// Enforce bounds on camTarget every frame so nothing slips through
		const ct = clampCamPos(camTarget.x, camTarget.y, camTarget.scale);
		camTarget.x = ct.x;
		camTarget.y = ct.y;

		cam.x += (camTarget.x - cam.x) * 0.12;
		cam.y += (camTarget.y - cam.y) * 0.12;
		cam.scale += (camTarget.scale - cam.scale) * 0.12;

		ctx.clearRect(0, 0, W, H);
		ctx.save();
		ctx.translate(cam.x, cam.y);
		ctx.scale(cam.scale, cam.scale);

		const focused = focusedId !== null;

		function drawNode(node: SimNode, d: number | undefined) {
			const nx = node.x ?? 0;
			const ny = node.y ?? 0;
			const alpha = nodeAlpha(d);
			if (alpha < 0.01) return;
			const r = focused ? nodeRadius(d) / cam.scale : 5 / cam.scale;
			const color = hskColor(node.hskLevel);
			const isFocused = node.id === focusedId;

			ctx.save();
			ctx.globalAlpha = alpha;
			if (isFocused) {
				ctx.shadowColor = color;
				ctx.shadowBlur = 20;
			}
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(nx, ny, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.shadowBlur = 0;
			if (node.hanzi.length === 1) {
				ctx.strokeStyle = '#000000';
				ctx.lineWidth = 1.5 / cam.scale;
				ctx.stroke();
			}
			ctx.restore();
		}

		function drawLabel(node: SimNode, d: number | undefined) {
			const alpha = nodeAlpha(d);
			if (alpha < 0.01) return;
			const showLabel = focused
				? d !== undefined && d <= 1
					? cam.scale > 0.5
					: cam.scale > 1.2
				: cam.scale > 1.3;
			if (!showLabel) return;
			const r = focused ? nodeRadius(d) / cam.scale : 5 / cam.scale;
			const isFocused = node.id === focusedId;
			const fs = Math.max(7, Math.round(12 / cam.scale));
			ctx.save();
			ctx.globalAlpha = alpha * 0.95;
			ctx.fillStyle = '#111111';
			ctx.font = `${isFocused ? '900 ' : ''}${fs}px "Noto Serif CJK SC", serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';
			ctx.fillText(node.hanzi, node.x ?? 0, (node.y ?? 0) + r + 2 / cam.scale);
			ctx.restore();
		}

		// Pass 1: background nodes (far/unfocused) - drawn below edges
		for (const node of nodes) {
			if (!activeHsk.has(node.hskLevel)) continue;
			const d = focused ? bfsResult.get(node.id) : undefined;
			if (focused && d !== undefined && d <= 2) continue; // drawn in pass 3
			drawNode(node, d);
		}

		// Pass 2: edges - always on top of background nodes
		if (focused) {
			for (const edge of keptEdges) {
				const sNode = nodeById.get(edge.sourceId);
				const tNode = nodeById.get(edge.targetId);
				if (!sNode || !tNode) continue;
				if (!activeHsk.has(sNode.hskLevel) || !activeHsk.has(tNode.hskLevel)) continue;

				const sd = bfsResult.get(edge.sourceId) ?? Infinity;
				const td = bfsResult.get(edge.targetId) ?? Infinity;
				const nearDepth = Math.min(sd, td);
				const farDepth = Math.max(sd, td);
				if (nearDepth > 2) continue;

				const alpha = edgeAlpha(farDepth);
				const sx = sNode.x ?? 0;
				const sy = sNode.y ?? 0;
				const tx = tNode.x ?? 0;
				const ty = tNode.y ?? 0;

				ctx.save();
				ctx.globalAlpha = nearDepth === 0 ? 0.85 : alpha * 0.5;
				ctx.strokeStyle = '#777777';
				ctx.lineWidth = (nearDepth === 0 ? 1.8 : 1) / cam.scale;
				ctx.beginPath();
				ctx.moveTo(sx, sy);
				ctx.lineTo(tx, ty);
				ctx.stroke();

				ctx.restore();
			}
		}

		// Pass 3: near/focused nodes - always on top of edges
		if (focused) {
			for (const node of nodes) {
				if (!activeHsk.has(node.hskLevel)) continue;
				const d = bfsResult.get(node.id);
				if (d === undefined || d > 2) continue;
				drawNode(node, d);
			}
		}

		// Pass 4: labels - always on top of every node
		for (const node of nodes) {
			if (!activeHsk.has(node.hskLevel)) continue;
			const d = focused ? bfsResult.get(node.id) : undefined;
			if (focused && (d === undefined || d > 2)) continue;
			drawLabel(node, d);
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
				bfsResult = new Map();
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
				activeHsk = new Set([...activeHsk, word.hskLevel]);
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
	<div
		class="flex items-center gap-3 px-4 h-12 bg-base-100 border-b border-base-200 shrink-0 z-10"
	>
		<!-- Map-local search -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
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
					{#each mapDropdown as word}
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
			{#each [1, 2, 3, 4, 5, 6] as level, i}
				<button
					class="badge badge-sm font-semibold cursor-pointer select-none transition-opacity border"
					style="background-color: {activeHsk.has(level)
						? HSK_COLORS[i]
						: 'transparent'}; color: {activeHsk.has(level)
						? '#111'
						: HSK_COLORS[i]}; border-color: {HSK_COLORS[i]};"
					onclick={() => {
						const next = new Set(activeHsk);
						next.has(level) ? next.delete(level) : next.add(level);
						if (next.size === 0) return;
						activeHsk = next;
						if (focusedId !== null) {
							const fn = nodeById.get(focusedId);
							if (fn && !next.has(fn.hskLevel)) {
								const fallback = nodes.find((n) => next.has(n.hskLevel));
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
				{#if focusedId !== null}
					<span class="text-primary ml-2">
						- {nodeById.get(focusedId)?.hanzi} ({nodeById.get(focusedId)?.pinyin})
					</span>
				{/if}
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

		<!-- Legend -->
		<div
			class="absolute bottom-4 right-4 bg-base-100/80 backdrop-blur-sm rounded-xl p-2 text-xs text-base-content/40 pointer-events-none"
		>
			Tap: focus &nbsp; Pinch/Scroll: zoom &nbsp; Drag: pan
		</div>
	</div>
</div>
