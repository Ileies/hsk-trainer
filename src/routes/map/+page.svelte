<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { forceSimulation, forceManyBody, forceLink } from 'd3-force';
	import type { SimulationNodeDatum } from 'd3-force';
	import { quadtree as d3quadtree } from 'd3-quadtree';
	import { buildGraph, bfsDistances } from '$lib/mapGraph';
	import type { Word, Edge } from '$lib/mapGraph';
	import { Search, Crosshair } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	type SimNode = Word & SimulationNodeDatum;

	// HSK filter
	let activeHsk = $state(new Set([1, 2, 3, 4, 5, 6]));
	let visibleCount = $derived(data.words.filter((w) => activeHsk.has(w.hskLevel)).length);

	// Canvas element
	let canvas = $state<HTMLCanvasElement | undefined>(undefined);

	// Simulation output
	let loading = $state(true);
	let nodes: SimNode[] = [];
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
	let simRInner = 0;

	// Hover tooltip
	let hoverNode = $state<SimNode | null>(null);
	let hoverClientX = $state(0);
	let hoverClientY = $state(0);

	// Drag state
	let isDragging = $state(false);
	let hasDragged = false;
	let dragLast = { x: 0, y: 0 };

	// Map-local search
	let mapSearch = $state('');
	let mapDropdown = $state<
		{ id: number; hanzi: string; pinyin: string; english: string; hskLevel: number }[]
	>([]);
	let showMapDropdown = $state(false);
	let mapSearchDebounce: ReturnType<typeof setTimeout> | null = null;
	let mapSearchInput: HTMLInputElement | undefined = $state();

	let rafId = 0;

	// Static star field - fractional screen positions, drawn each frame in screen space
	const STARS = Array.from({ length: 250 }, () => ({
		x: Math.random(),
		y: Math.random(),
		r: Math.random() * 0.9 + 0.2,
		a: Math.random() * 0.35 + 0.08
	}));

	const HSK_COLORS = ['#4ade80', '#60a5fa', '#facc15', '#fb923c', '#f87171', '#c084fc'];
	const HSK_LABELS = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];

	function hskColor(level: number) {
		return HSK_COLORS[(level - 1) % 6];
	}

	const DEPTH_EDGE_ALPHA = [0, 0.65, 0.35, 0.12];
	const DEPTH_RADIUS = [11, 7, 5, 4];

	function edgeAlpha(depth: number): number {
		return DEPTH_EDGE_ALPHA[Math.min(depth, 3)];
	}

	function nodeRadius(d: number | undefined): number {
		if (d === undefined) return 4;
		return DEPTH_RADIUS[Math.min(d, 3)];
	}

	function runSimulation(words: Word[]) {
		focusedId = null;
		hoverNode = null;
		bfsResult = new Map();

		if (words.length === 0) {
			nodes = [];
			keptEdges = [];
			adjacency = new Map();
			nodeById = new Map();
			loading = false;
			return;
		}

		const { edges, adjacency: adj } = buildGraph(words);
		adjacency = adj;
		keptEdges = edges;

		const spread = Math.sqrt(words.length) * 60;
		const simNodes: SimNode[] = words.map((w) => ({
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

		// Center the result
		const cx = simNodes.reduce((s, n) => s + (n.x ?? 0), 0) / simNodes.length;
		const cy = simNodes.reduce((s, n) => s + (n.y ?? 0), 0) / simNodes.length;
		for (const n of simNodes) {
			n.x = (n.x ?? 0) - cx;
			n.y = (n.y ?? 0) - cy;
		}

		nodes = simNodes;
		nodeById = idToSim;

		if (canvas) {
			// Percentile-based thresholds: inner cluster (untouched) vs outer ring (pushed)
			const distances = simNodes.map((n) => Math.hypot(n.x ?? 0, n.y ?? 0));
			const sortedDist = [...distances].sort((a, b) => a - b);
			const rInner = sortedDist[Math.floor(sortedDist.length * 0.6)] ?? 0;
			const rOuter = sortedDist[Math.floor(sortedDist.length * 0.85)] ?? rInner * 1.5;
			simRInner = rInner;

			// Push outer nodes outward along whichever axis the canvas has more of
			const canvasAspect = canvas.width / canvas.height;
			const isWide = canvasAspect > 1;
			const stretch = isWide ? canvasAspect : 1 / canvasAspect;

			if (rOuter > rInner && stretch > 1.05) {
				for (let i = 0; i < simNodes.length; i++) {
					const n = simNodes[i];
					const r = distances[i];
					if (r <= rInner) continue;
					const t = Math.min(1, (r - rInner) / (rOuter - rInner));
					const blend = t * t * (3 - 2 * t); // smoothstep
					const nx = n.x ?? 0;
					const ny = n.y ?? 0;
					const theta = Math.atan2(ny, nx);
					if (isWide) {
						// cos² weights the push toward nodes already on the horizontal axis
						n.x = nx * (1 + blend * (stretch - 1) * Math.cos(theta) ** 2);
					} else {
						n.y = ny * (1 + blend * (stretch - 1) * Math.sin(theta) ** 2);
					}
				}
			}

			// Bounding box after all position adjustments
			let bboxMinX = Infinity, bboxMaxX = -Infinity;
			let bboxMinY = Infinity, bboxMaxY = -Infinity;
			for (const n of simNodes) {
				const nx = n.x ?? 0, ny = n.y ?? 0;
				if (nx < bboxMinX) bboxMinX = nx;
				if (nx > bboxMaxX) bboxMaxX = nx;
				if (ny < bboxMinY) bboxMinY = ny;
				if (ny > bboxMaxY) bboxMaxY = ny;
			}
			const bboxW = bboxMaxX - bboxMinX;
			const bboxH = bboxMaxY - bboxMinY;
			const pad = 60;
			minScale = Math.min(
				bboxW > 0 ? (canvas.width - pad * 2) / bboxW : 1,
				bboxH > 0 ? (canvas.height - pad * 2) / bboxH : 1
			);

			cam.x = canvas.width / 2;
			cam.y = canvas.height / 2;
			cam.scale = minScale;
			camTarget.x = cam.x;
			camTarget.y = cam.y;
			camTarget.scale = minScale;
		}

		// Build quadtree after all position changes are final
		qt = d3quadtree<SimNode>()
			.x((n: SimNode) => n.x ?? 0)
			.y((n: SimNode) => n.y ?? 0)
			.addAll(simNodes);

		loading = false;

		// Auto-focus a random HSK 1 word
		const hsk1 = simNodes.filter((n) => n.hskLevel === 1);
		const autoFocus = hsk1.length > 0 ? hsk1[Math.floor(Math.random() * hsk1.length)] : simNodes[0];
		if (autoFocus) focusNode(autoFocus.id);
	}

	function focusNode(id: number) {
		const node = nodeById.get(id);
		if (!node) return;
		focusedId = id;
		bfsResult = bfsDistances(adjacency, id, 3);
		if (canvas) {
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
		cam.x = cx - (cx - cam.x) * ratio;
		cam.y = cy - (cy - cam.y) * ratio;
		cam.scale = newScale;
		camTarget.x = cam.x;
		camTarget.y = cam.y;
		camTarget.scale = cam.scale;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		isDragging = true;
		hasDragged = false;
		dragLast = { x: e.clientX, y: e.clientY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (isDragging) {
			const dx = (e.clientX - dragLast.x) * devicePixelRatio;
			const dy = (e.clientY - dragLast.y) * devicePixelRatio;
			if (Math.abs(dx) + Math.abs(dy) > 3) hasDragged = true;
			cam.x += dx;
			cam.y += dy;
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

	function onPointerLeave() {
		isDragging = false;
		hoverNode = null;
	}

	// RAF render loop
	function renderLoop() {
		rafId = requestAnimationFrame(renderLoop);
		if (!canvas || loading || nodes.length === 0) return;

		const ctx = canvas.getContext('2d')!;
		const W = canvas.width;
		const H = canvas.height;

		// Lerp camera
		cam.x += (camTarget.x - cam.x) * 0.12;
		cam.y += (camTarget.y - cam.y) * 0.12;
		cam.scale += (camTarget.scale - cam.scale) * 0.12;

		// Deep-space background
		ctx.fillStyle = '#07071c';
		ctx.fillRect(0, 0, W, H);

		// Static star field (screen space)
		for (const s of STARS) {
			ctx.fillStyle = `rgba(255,255,255,${s.a})`;
			ctx.beginPath();
			ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.save();
		ctx.translate(cam.x, cam.y);
		ctx.scale(cam.scale, cam.scale);

		const focused = focusedId !== null;

		// Atmosphere glow: warm-white core fading to deep blue, drawn behind nodes
		if (simRInner > 0) {
			const aR = simRInner * 2.2;
			const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, aR);
			grad.addColorStop(0,    'rgba(255, 235, 170, 0.22)');
			grad.addColorStop(0.18, 'rgba(170, 200, 255, 0.14)');
			grad.addColorStop(0.50, 'rgba(70,  100, 240, 0.06)');
			grad.addColorStop(1,    'rgba(0,   0,   0,   0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(0, 0, aR, 0, Math.PI * 2);
			ctx.fill();
		}

		// Edges (focused mode only, normal composite)
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
				ctx.globalAlpha = alpha;
				ctx.strokeStyle = '#6070a0';
				ctx.lineWidth = 1 / cam.scale;
				ctx.beginPath();
				ctx.moveTo(sx, sy);
				ctx.lineTo(tx, ty);
				ctx.stroke();

				if (alpha > 0.25 && edge.sharedChars.length > 0) {
					const mx = (sx + tx) / 2;
					const my = (sy + ty) / 2;
					const fs = Math.round(9 / cam.scale);
					ctx.globalAlpha = alpha * 0.85;
					ctx.fillStyle = '#aab0cc';
					ctx.font = `${fs}px "Noto Serif CJK SC", serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(edge.sharedChars[0], mx, my);
				}
				ctx.restore();
			}
		}

		// Nodes with additive blending — dense clusters bloom into glowing masses
		for (const node of nodes) {
			if (!activeHsk.has(node.hskLevel)) continue;
			const nx = node.x ?? 0;
			const ny = node.y ?? 0;
			const d = focused ? bfsResult.get(node.id) : undefined;

			// Per-node glow alpha: low enough that only dense overlaps saturate to white
			const glowAlpha = focused
				? (d === 0 ? 0.85 : d === 1 ? 0.38 : d === 2 ? 0.14 : d === 3 ? 0.05 : 0.02)
				: 0.07;
			if (glowAlpha < 0.005) continue;

			const r = focused ? nodeRadius(d) / cam.scale : 3 / cam.scale;
			const color = hskColor(node.hskLevel);
			const isFocused = node.id === focusedId;

			// Glow circle with additive composite
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = glowAlpha;
			if (isFocused) {
				ctx.shadowColor = color;
				ctx.shadowBlur = 18;
			}
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(nx, ny, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();

			// Hanzi label (source-over, light text on dark)
			const showLabel = focused ? (d !== undefined && d <= 2) : cam.scale > 1.3;
			if (showLabel) {
				const labelAlpha = d === 0 ? 0.95 : d === 1 ? 0.85 : 0.55;
				const fs = Math.max(7, Math.round(12 / cam.scale));
				ctx.save();
				ctx.globalAlpha = labelAlpha;
				ctx.fillStyle = '#e8eaf6';
				ctx.font = `${isFocused ? '900 ' : ''}${fs}px "Noto Serif CJK SC", serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';
				ctx.fillText(node.hanzi, nx, ny + r + 2 / cam.scale);
				ctx.restore();
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
		if (canvas.width !== newW || canvas.height !== newH) {
			canvas.width = newW;
			canvas.height = newH;
			cam.x = newW / 2;
			cam.y = newH / 2;
			camTarget.x = cam.x;
			camTarget.y = cam.y;
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
			const word = data.words.find((w) => w.id === id);
			if (word) activeHsk = new Set([...activeHsk, word.hskLevel]);
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

		const onKey = (_e: KeyboardEvent) => {};
		window.addEventListener('keydown', onKey);
		rafId = requestAnimationFrame(renderLoop);

		return () => {
			cancelAnimationFrame(rafId);
			ro.disconnect();
			window.removeEventListener('keydown', onKey);
		};
	});

	$effect(() => {
		if (!canvas) return;
		loading = true;
		bfsResult = new Map();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => runSimulation(data.words));
		});
	});
</script>

<svelte:head>
	<title>Word Map - HSK Tester</title>
</svelte:head>

<div class="flex flex-col h-full">
	<!-- Top strip: search + HSK filters + controls -->
	<div class="flex items-center gap-3 px-4 h-12 bg-base-100 border-b border-base-200 shrink-0 z-10">
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
									<span class="text-xs font-medium text-base-content/80 truncate">{word.pinyin}</span>
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
						: 'transparent'}; color: {activeHsk.has(level) ? '#111' : HSK_COLORS[i]}; border-color: {HSK_COLORS[i]};"
					onclick={() => {
						const next = new Set(activeHsk);
						next.has(level) ? next.delete(level) : next.add(level);
						if (next.size === 0) return;
						activeHsk = next;
						if (focusedId !== null) {
							const fn = nodeById.get(focusedId);
							if (fn && !next.has(fn.hskLevel)) {
								const fallback = nodes.find((n) => next.has(n.hskLevel));
								if (fallback) focusNode(fallback.id);
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
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-base-200">
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
			class="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl p-2 text-xs text-white/40 pointer-events-none"
		>
			Click: focus &nbsp; Scroll: zoom &nbsp; Drag: pan
		</div>
	</div>
</div>
