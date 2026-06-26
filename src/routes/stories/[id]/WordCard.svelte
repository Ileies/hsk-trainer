<script lang="ts">
	import { X } from '@lucide/svelte';

	interface Props {
		wordMapId: number;
		anchor: { x: number; y: number };
		wordMap: Record<number, { en: string; zh: string }>;
		vocabMap: Record<string, { id: number; pinyin: string; english: string; hskLevel: number }>;
		stateMap: Record<number, { learned: boolean; hanziLearned: boolean }>;
		onClose: () => void;
		onToggleLearned: (wordMapId: number, learned: boolean) => void;
		onToggleHanziLearned: (wordMapId: number, hanziLearned: boolean) => void;
	}

	let {
		wordMapId,
		anchor,
		wordMap,
		vocabMap,
		stateMap,
		onClose,
		onToggleLearned,
		onToggleHanziLearned
	}: Props = $props();

	const CARD_WIDTH = 260;
	const CARD_HEIGHT = 220;

	let cardStyle = $derived.by(() => {
		const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
		let x = anchor.x + 12;
		let y = anchor.y + 12;
		if (x + CARD_WIDTH > vw - 8) x = vw - CARD_WIDTH - 8;
		if (x < 8) x = 8;
		if (y + CARD_HEIGHT > vh - 8) y = anchor.y - CARD_HEIGHT - 12;
		if (y < 8) y = 8;
		return `left:${x}px;top:${y}px;`;
	});

	let wm = $derived(wordMap[wordMapId]);

	let segments = $derived(
		wm
			? wm.zh
					.split(',')
					.map((h) => h.trim())
					.filter(Boolean)
			: []
	);

	let hanziDisplay = $derived(segments.join(''));

	let pinyinDisplay = $derived(segments.map((h) => vocabMap[h]?.pinyin ?? h).join(' '));

	let englishDisplay = $derived(
		segments
			.map((h) => vocabMap[h]?.english?.split(',')[0] ?? '')
			.filter(Boolean)
			.join(', ')
	);

	let hskLevel = $derived(Math.max(...segments.map((h) => vocabMap[h]?.hskLevel ?? 0)));

	let vocabIds = $derived(
		segments.map((h) => vocabMap[h]?.id).filter((id): id is number => id !== undefined)
	);

	let allLearned = $derived(vocabIds.length > 0 && vocabIds.every((id) => stateMap[id]?.learned));
	let allHanziLearned = $derived(
		vocabIds.length > 0 && vocabIds.every((id) => stateMap[id]?.hanziLearned)
	);
</script>

<div
	class="fixed z-50 bg-base-100 border border-base-300 shadow-2xl rounded-2xl p-4 space-y-3"
	style="width:{CARD_WIDTH}px;{cardStyle}"
>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<div class="hanzi text-4xl font-bold leading-none text-primary">{hanziDisplay}</div>
			<div class="text-sm text-base-content/60 mt-1">{pinyinDisplay}</div>
			{#if englishDisplay}
				<div class="text-sm text-base-content/80 mt-0.5 line-clamp-2">{englishDisplay}</div>
			{/if}
		</div>
		<div class="flex flex-col items-end gap-1.5 shrink-0">
			{#if hskLevel > 0}
				<span class="badge badge-sm badge-outline">HSK {hskLevel}</span>
			{/if}
			<button class="btn btn-ghost btn-xs btn-square" onclick={onClose}>
				<X size={12} />
			</button>
		</div>
	</div>

	<div class="flex flex-col gap-1.5">
		{#if !allLearned}
			<button
				class="btn btn-sm btn-success w-full"
				onclick={() => {
					onToggleLearned(wordMapId, true);
					onClose();
				}}
			>
				Mark as learned
			</button>
		{:else}
			<button
				class="btn btn-sm btn-ghost w-full text-error"
				onclick={() => {
					onToggleLearned(wordMapId, false);
					onClose();
				}}
			>
				Mark as forgotten
			</button>
			{#if !allHanziLearned}
				<button
					class="btn btn-sm btn-primary w-full"
					onclick={() => {
						onToggleHanziLearned(wordMapId, true);
						onClose();
					}}
				>
					I know this character
				</button>
			{:else}
				<button
					class="btn btn-sm btn-ghost w-full"
					onclick={() => {
						onToggleHanziLearned(wordMapId, false);
						onClose();
					}}
				>
					Unlearn character
				</button>
			{/if}
		{/if}
	</div>
</div>
