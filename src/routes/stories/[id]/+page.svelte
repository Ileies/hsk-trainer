<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, MessageCircle, X } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import WordCard from './WordCard.svelte';

	let { data } = $props();

	// -------------------------------------------------------------------------
	// Tokenize English sentence into mapped/unmapped spans (longest-match)
	// -------------------------------------------------------------------------

	type Token = { text: string; wordMapId: number | null };

	// Scan sentence.chinese left-to-right, matching zh segments individually.
	// Each zh comma-segment is matched on its own so non-adjacent pairs like '我,朋友'
	// still highlight both '我' and '朋友' even when separated by particles.
	function buildChineseTokens(
		chinese: string,
		wordMapIds: number[],
		wm: typeof data.wordMapById
	): Token[] {
		const segEntries: { segment: string; id: number }[] = [];
		for (const id of wordMapIds) {
			const w = wm[id];
			if (!w) continue;
			for (const seg of w.zh
				.split(',')
				.map((h: string) => h.trim())
				.filter(Boolean)) {
				segEntries.push({ segment: seg, id });
			}
		}
		segEntries.sort((a, b) => b.segment.length - a.segment.length);

		const tokens: Token[] = [];
		let i = 0;
		while (i < chinese.length) {
			let matched = false;
			for (const { segment, id } of segEntries) {
				if (chinese.slice(i, i + segment.length) === segment) {
					tokens.push({ text: segment, wordMapId: id });
					i += segment.length;
					matched = true;
					break;
				}
			}
			if (!matched) {
				const last = tokens[tokens.length - 1];
				if (last && last.wordMapId === null) {
					last.text += chinese[i];
				} else {
					tokens.push({ text: chinese[i], wordMapId: null });
				}
				i++;
			}
		}
		return tokens;
	}

	function buildTokens(
		english: string,
		wordMapIds: number[],
		wm: typeof data.wordMapById
	): Token[] {
		const entries = wordMapIds
			.map((id) => ({ en: wm[id]?.en ?? '', id }))
			.filter((e) => e.en)
			.sort((a, b) => b.en.length - a.en.length);

		const tokens: Token[] = [];
		let i = 0;
		while (i < english.length) {
			let matched = false;
			for (const { en, id } of entries) {
				if (english.slice(i, i + en.length).toLowerCase() === en) {
					const nextChar = english[i + en.length];
					const prevChar = i > 0 ? english[i - 1] : ' ';
					const atWordBoundaryStart = !/[a-zA-Z']/.test(prevChar);
					const atWordBoundaryEnd = !nextChar || !/[a-zA-Z']/.test(nextChar);
					if (!atWordBoundaryStart || !atWordBoundaryEnd) continue;
					tokens.push({ text: english.slice(i, i + en.length), wordMapId: id });
					i += en.length;
					matched = true;
					break;
				}
			}
			if (!matched) {
				const last = tokens[tokens.length - 1];
				if (last && last.wordMapId === null) {
					last.text += english[i];
				} else {
					tokens.push({ text: english[i], wordMapId: null });
				}
				i++;
			}
		}
		return tokens;
	}

	// -------------------------------------------------------------------------
	// Mutable state maps (optimistic updates)
	// -------------------------------------------------------------------------

	// svelte-ignore state_referenced_locally
	let stateMap = $state<Record<number, { learned: boolean; hanziLearned: boolean }>>(
		Object.fromEntries(
			Object.entries(data.stateMap).map(([k, v]) => [
				k,
				{ learned: v.learned, hanziLearned: v.hanziLearned }
			])
		)
	);

	// -------------------------------------------------------------------------
	// Drag selection (immediate - no hold timer)
	// Tracks token positions (si = sentence index, ti = token index within sentence)
	// so that both vocab and non-vocab spans can be selected.
	// -------------------------------------------------------------------------

	type TokPos = { si: number; ti: number };

	let isDragging = $state(false);
	let dragStartPos = $state<TokPos | null>(null);
	let dragCurrentPos = $state<TokPos | null>(null);

	// Non-reactive pointer tracking
	let pointerDownPos: { x: number; y: number } | null = null;
	let hasMoved = false;
	const DRAG_THRESHOLD = 6;

	// -------------------------------------------------------------------------
	// Spoiler: which sentence's English translation is currently revealed (accordion)
	// -------------------------------------------------------------------------
	let openSentenceIdx = $state<number | null>(null);

	// Confirmed selection (sticky after drag released)
	const selectedWordMapIds = new SvelteSet<number>();
	let selectedText = $state('');
	let confirmedStart = $state<TokPos | null>(null);
	let confirmedEnd = $state<TokPos | null>(null);

	// Returns true if token at (si, ti) falls within the given range (inclusive, bi-directional)
	function posInRange(si: number, ti: number, a: TokPos, b: TokPos): boolean {
		// Normalize so s1/t1 <= s2/t2
		let s1 = a.si,
			t1 = a.ti,
			s2 = b.si,
			t2 = b.ti;
		if (s1 > s2 || (s1 === s2 && t1 > t2)) {
			[s1, t1, s2, t2] = [s2, t2, s1, t1];
		}
		if (si < s1 || si > s2) return false;
		if (s1 === s2) return ti >= t1 && ti <= t2;
		if (si === s1) return ti >= t1;
		if (si === s2) return ti <= t2;
		return true;
	}

	function isInDragRange(si: number, ti: number): boolean {
		return (
			isDragging &&
			dragStartPos !== null &&
			dragCurrentPos !== null &&
			posInRange(si, ti, dragStartPos, dragCurrentPos)
		);
	}

	function isInConfirmed(si: number, ti: number): boolean {
		return (
			confirmedStart !== null &&
			confirmedEnd !== null &&
			posInRange(si, ti, confirmedStart, confirmedEnd)
		);
	}

	// AI bar - only opens when user explicitly clicks "Ask AI"
	let aiBarOpen = $state(false);
	let questionText = $state('');
	let questionAnswer = $state('');
	let questionLoading = $state(false);

	function openAiBar() {
		aiBarOpen = true;
	}

	function closeAiBar() {
		aiBarOpen = false;
		selectedWordMapIds.clear();
		selectedText = '';
		confirmedStart = null;
		confirmedEnd = null;
		questionText = '';
		questionAnswer = '';
	}

	let selectedWordsInOrder = $derived.by(() => {
		const position = new SvelteMap<number, number>();
		let pos = 0;
		for (const s of data.sentences) {
			for (const wmId of s.wordMapIds) {
				if (!position.has(wmId)) position.set(wmId, pos++);
			}
		}
		return [...selectedWordMapIds].sort(
			(a, b) => (position.get(a) ?? 9999) - (position.get(b) ?? 9999)
		);
	});

	async function submitQuestion() {
		if (!questionText.trim() || (selectedWordMapIds.size === 0 && !selectedText.trim())) return;
		questionLoading = true;
		questionAnswer = '';
		try {
			const res = await fetch('/api/story-question', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					storyId: data.story.id,
					selectedWordMapIds: [...selectedWordMapIds],
					selectedText,
					question: questionText
				})
			});
			const json = await res.json();
			questionAnswer = json.answer ?? '';
		} finally {
			questionLoading = false;
		}
	}

	// Returns the token position at a screen coordinate, looking at data-si / data-ti attributes.
	function tokenPosAtPoint(x: number, y: number): TokPos | null {
		const el = document.elementFromPoint(x, y) as HTMLElement | null;
		if (!el) return null;
		const target = (el.dataset?.si != null ? el : el.closest('[data-si]')) as HTMLElement | null;
		if (!target?.dataset?.si) return null;
		const si = parseInt(target.dataset.si!);
		const ti = parseInt(target.dataset.ti ?? '');
		return isNaN(si) || isNaN(ti) ? null : { si, ti };
	}

	function onSentencePointerDown(e: PointerEvent) {
		pointerDownPos = { x: e.clientX, y: e.clientY };
		hasMoved = false;
	}

	function onGlobalPointerMove(e: PointerEvent) {
		if (pointerDownPos === null) return;

		const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);

		if (!isDragging && dist > DRAG_THRESHOLD) {
			// Only start drag if pointer is over a token span
			const startPos = tokenPosAtPoint(pointerDownPos.x, pointerDownPos.y);
			if (startPos === null) return;
			hasMoved = true;
			isDragging = true;
			dragStartPos = startPos;
			dragCurrentPos = startPos;
		}

		if (isDragging) {
			const pos = tokenPosAtPoint(e.clientX, e.clientY);
			if (pos !== null) dragCurrentPos = pos;
		}
	}

	// Extracts vocab word IDs and visible text for the confirmed token range.
	function extractRange(start: TokPos, end: TokPos): { wmIds: SvelteSet<number>; text: string } {
		let s1 = start.si,
			t1 = start.ti,
			s2 = end.si,
			t2 = end.ti;
		if (s1 > s2 || (s1 === s2 && t1 > t2)) {
			[s1, t1, s2, t2] = [s2, t2, s1, t1];
		}

		const wmIds = new SvelteSet<number>();
		const parts: string[] = [];

		for (let si = s1; si <= s2; si++) {
			const sentence = data.sentences[si];
			const flipped = isSentenceFlipped(sentence.wordMapIds);
			const tokens = flipped
				? buildChineseTokens(sentence.chinese, sentence.wordMapIds, data.wordMapById)
				: buildTokens(sentence.english, sentence.wordMapIds, data.wordMapById);

			const tiFrom = si === s1 ? t1 : 0;
			const tiTo = si === s2 ? t2 : tokens.length - 1;
			for (let ti = tiFrom; ti <= tiTo; ti++) {
				const tok = tokens[ti];
				if (!tok) continue;
				if (tok.wordMapId !== null) wmIds.add(tok.wordMapId);
				parts.push(tok.wordMapId !== null ? getWordDisplay(tok.wordMapId) : tok.text);
			}
		}

		return { wmIds, text: parts.join('') };
	}

	function onGlobalPointerUp(e: PointerEvent) {
		if (isDragging && dragStartPos && dragCurrentPos) {
			const { wmIds, text } = extractRange(dragStartPos, dragCurrentPos);
			let s1 = dragStartPos.si,
				t1 = dragStartPos.ti,
				s2 = dragCurrentPos.si,
				t2 = dragCurrentPos.ti;
			if (s1 > s2 || (s1 === s2 && t1 > t2)) {
				[s1, t1, s2, t2] = [s2, t2, s1, t1];
			}
			confirmedStart = { si: s1, ti: t1 };
			confirmedEnd = { si: s2, ti: t2 };
			selectedWordMapIds.clear();
			for (const id of wmIds) selectedWordMapIds.add(id);
			selectedText = text;
			isDragging = false;
			dragStartPos = null;
			dragCurrentPos = null;
		} else if (!isDragging && !hasMoved) {
			isDragging = false;
			dragStartPos = null;
			dragCurrentPos = null;

			const inKeepZone = !!(e.target as HTMLElement)?.closest('[data-keep-selection]');

			if (!inKeepZone) {
				// Clear confirmed selection on any click outside the AI bar / Ask AI button
				confirmedStart = null;
				confirmedEnd = null;
				selectedWordMapIds.clear();
				selectedText = '';
				if (aiBarOpen) closeAiBar();
			}
		}
		pointerDownPos = null;
		hasMoved = false;
	}

	function onGlobalPointerCancel() {
		isDragging = false;
		dragStartPos = null;
		dragCurrentPos = null;
		pointerDownPos = null;
		hasMoved = false;
	}

	// -------------------------------------------------------------------------
	// WordCard (single-click on vocab word, separate from drag)
	// -------------------------------------------------------------------------
	let wordCardWordMapId = $state<number | null>(null);
	let wordCardAnchor = $state<{ x: number; y: number } | null>(null);

	function openWordCard(wordMapId: number, e: MouseEvent | PointerEvent) {
		wordCardWordMapId = wordMapId;
		wordCardAnchor = { x: e.clientX, y: e.clientY };
	}

	function closeWordCard() {
		wordCardWordMapId = null;
		wordCardAnchor = null;
	}

	// -------------------------------------------------------------------------
	// Word display logic
	// -------------------------------------------------------------------------

	type DisplayMode = 'en' | 'pinyin' | 'hanzi';

	function getVocabIds(wordMapId: number): number[] {
		const wm = data.wordMapById[wordMapId];
		if (!wm) return [];
		return wm.zh
			.split(',')
			.map((h: string) => h.trim())
			.filter(Boolean)
			.map((h: string) => data.vocabMap[h]?.id)
			.filter((id): id is number => id !== undefined);
	}

	function getWordMode(wordMapId: number): DisplayMode {
		const ids = getVocabIds(wordMapId);
		if (ids.length === 0) return 'en';
		if (ids.every((id) => stateMap[id]?.hanziLearned)) return 'hanzi';
		if (ids.every((id) => stateMap[id]?.learned)) return 'pinyin';
		return 'en';
	}

	function getWordDisplay(wordMapId: number): string {
		const wm = data.wordMapById[wordMapId];
		if (!wm) return '';
		const mode = getWordMode(wordMapId);
		if (mode === 'en') return wm.en;
		const segments = wm.zh
			.split(',')
			.map((h: string) => h.trim())
			.filter(Boolean);
		if (mode === 'hanzi') return segments.join('');
		return segments.map((h: string) => data.vocabMap[h]?.pinyin ?? h).join(' ');
	}

	function isSentenceFlipped(wordMapIds: number[]): boolean {
		if (wordMapIds.length === 0) return false;
		return wordMapIds.every((wmId) => {
			const ids = getVocabIds(wmId);
			return ids.length === 0 || ids.every((id) => stateMap[id]?.hanziLearned);
		});
	}

	// -------------------------------------------------------------------------
	// Progress
	// -------------------------------------------------------------------------
	let progressStats = $derived.by(() => {
		const unique = [...new Set(data.sentences.flatMap((s) => s.wordMapIds))];
		let en = 0,
			py = 0,
			hz = 0;
		for (const id of unique) {
			const m = getWordMode(id);
			if (m === 'en') en++;
			else if (m === 'pinyin') py++;
			else hz++;
		}
		const total = unique.length || 1;
		return {
			english: en,
			pinyin: py,
			hanzi: hz,
			total,
			ePct: (en / total) * 100,
			pPct: (py / total) * 100,
			hPct: (hz / total) * 100
		};
	});

	// -------------------------------------------------------------------------
	// State toggle API calls
	// -------------------------------------------------------------------------

	async function toggleLearned(wordMapId: number, learned: boolean) {
		const ids = getVocabIds(wordMapId);
		const prev = ids.map((id) => [id, stateMap[id]] as const);
		for (const id of ids) {
			stateMap[id] = { learned, hanziLearned: learned && (stateMap[id]?.hanziLearned ?? false) };
		}
		try {
			const res = await fetch('/api/story-word-learned', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ vocabIds: ids, learned })
			});
			if (!res.ok) throw new Error('Failed');
		} catch {
			for (const [id, s] of prev) {
				if (s) stateMap[id] = s;
				else delete stateMap[id];
			}
		}
	}

	async function toggleHanziLearned(wordMapId: number, hanziLearned: boolean) {
		const ids = getVocabIds(wordMapId);
		const prev = ids.map((id) => [id, stateMap[id]] as const);
		for (const id of ids) {
			stateMap[id] = { learned: stateMap[id]?.learned ?? false, hanziLearned };
		}
		try {
			const res = await fetch('/api/story-hanzi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ vocabIds: ids, hanziLearned })
			});
			if (!res.ok) throw new Error('Failed');
		} catch {
			for (const [id, s] of prev) {
				if (s) stateMap[id] = s;
				else delete stateMap[id];
			}
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			closeWordCard();
			closeAiBar();
		}
	}}
	onpointermove={onGlobalPointerMove}
	onpointerup={onGlobalPointerUp}
	onpointercancel={onGlobalPointerCancel}
/>

{#if wordCardWordMapId !== null}
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default border-0 bg-transparent p-0"
		aria-label="Close word details"
		onclick={closeWordCard}
	></button>
{/if}

<div class="space-y-6 pb-32">
	<!-- Header -->
	<div class="flex items-start gap-3">
		<a href={resolve('/stories')} class="btn btn-ghost btn-sm btn-square mt-0.5 shrink-0">
			<ArrowLeft size={16} />
		</a>
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 flex-wrap">
				<h1 class="text-2xl font-bold hanzi">{data.story.title}</h1>
				<span class="badge badge-outline">HSK {data.story.hskLevel}</span>
			</div>
			<p class="text-base-content/50 text-sm">{data.story.titleEnglish}</p>
		</div>
	</div>

	<!-- Progress bar -->
	<div class="space-y-1">
		<div class="flex h-2 rounded-full overflow-hidden bg-base-300">
			<div
				class="bg-slate-400 transition-all duration-300"
				style="width:{progressStats.ePct}%"
			></div>
			<div
				class="bg-blue-400 transition-all duration-300"
				style="width:{progressStats.pPct}%"
			></div>
			<div
				class="bg-green-500 transition-all duration-300"
				style="width:{progressStats.hPct}%"
			></div>
		</div>
		<div class="flex gap-4 text-xs text-base-content/40">
			<span
				><span class="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1"
				></span>{progressStats.english} English</span
			>
			<span
				><span class="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"
				></span>{progressStats.pinyin} Pinyin</span
			>
			<span
				><span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"
				></span>{progressStats.hanzi} Hanzi</span
			>
		</div>
	</div>

	<!-- Controls -->
	<div class="flex items-center gap-2 flex-wrap">
		<button
			data-keep-selection
			class="btn btn-sm gap-1.5 {confirmedStart !== null ? 'btn-warning' : 'btn-ghost'}"
			disabled={confirmedStart === null}
			onclick={openAiBar}
		>
			<MessageCircle size={14} />Ask AI
			{#if selectedWordMapIds.size > 0}
				<span class="badge badge-xs badge-warning">{selectedWordMapIds.size}</span>
			{/if}
		</button>
	</div>

	<!-- Story text -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="space-y-2 {isDragging ? 'touch-none select-none' : ''}">
		{#each data.sentences as sentence, si (sentence.id)}
			{@const flipped = isSentenceFlipped(sentence.wordMapIds)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div onpointerdown={onSentencePointerDown}>
				{#if flipped}
					<!-- Chinese mode -->
					<p class="text-xl leading-loose hanzi select-none">
						{#each buildChineseTokens(sentence.chinese, sentence.wordMapIds, data.wordMapById) as token, ti (`${si}:${ti}`)}
							{@const inDrag = isInDragRange(si, ti)}
							{@const inSel = isInConfirmed(si, ti)}
							{#if token.wordMapId !== null}
								{@const mode = getWordMode(token.wordMapId)}
								<button
									type="button"
									data-si={si}
									data-ti={ti}
									data-wmid={token.wordMapId}
									class="inline cursor-pointer rounded border-0 bg-transparent px-0.5 py-0 text-left align-baseline transition-colors font-serif font-semibold leading-[inherit]
										{mode === 'hanzi' ? 'text-green-700 dark:text-green-400' : ''}
										{mode === 'pinyin' ? 'text-blue-600 dark:text-blue-400' : ''}
										{mode === 'en' ? 'text-slate-500 dark:text-slate-400' : ''}
										{inDrag ? '!bg-orange-200 dark:!bg-orange-700/40' : ''}
										{inSel && !inDrag ? '!bg-yellow-200 dark:!bg-yellow-700/30' : ''}
										{!inDrag && !inSel ? 'hover:bg-base-200' : ''}"
									onclick={(e) => {
										e.stopPropagation();
										openWordCard(token.wordMapId!, e);
									}}>{token.text}</button
								>
							{:else}
								<span
									data-si={si}
									data-ti={ti}
									class="text-base-content/60
										{inDrag ? 'bg-orange-200 dark:bg-orange-700/40 rounded' : ''}
										{inSel && !inDrag ? 'bg-yellow-200 dark:bg-yellow-700/30 rounded' : ''}">{token.text}</span
								>
							{/if}
						{/each}
					</p>
					<p class="text-sm text-base-content/40 mt-0.5">{sentence.english}</p>
				{:else}
					<!-- Word-by-word / pinyin mode -->
					<p class="text-lg leading-loose select-none">
						{#each buildTokens(sentence.english, sentence.wordMapIds, data.wordMapById) as token, ti (`${si}:${ti}`)}
							{@const inDrag = isInDragRange(si, ti)}
							{@const inSel = isInConfirmed(si, ti)}
							{#if token.wordMapId !== null}
								{@const mode = getWordMode(token.wordMapId)}
								<button
									type="button"
									data-si={si}
									data-ti={ti}
									data-wmid={token.wordMapId}
									class="inline cursor-pointer select-none rounded border-0 bg-transparent px-0.5 py-0 text-left align-baseline transition-colors font-[inherit] leading-[inherit]
										{mode === 'hanzi' ? 'font-serif font-semibold text-green-700 dark:text-green-400' : ''}
										{mode === 'pinyin'
										? 'text-blue-600 dark:text-blue-400 underline decoration-dotted underline-offset-2'
										: ''}
										{mode === 'en'
										? 'text-slate-500 dark:text-slate-400 italic underline decoration-dotted underline-offset-2'
										: ''}
										{inDrag ? '!bg-orange-200 dark:!bg-orange-700/40' : ''}
										{inSel && !inDrag ? '!bg-yellow-200 dark:!bg-yellow-700/50' : ''}
										{!inDrag && !inSel ? 'hover:bg-base-200' : ''}"
									onclick={(e) => {
										e.stopPropagation();
										openWordCard(token.wordMapId!, e);
									}}
									>{mode !== 'en' ? ' ' : ''}{getWordDisplay(token.wordMapId)}{mode !== 'hanzi'
										? ' '
										: ''}</button
								>
							{:else}
								<span
									data-si={si}
									data-ti={ti}
									class="text-base-content/80
										{inDrag ? 'bg-orange-200 dark:bg-orange-700/40 rounded' : ''}
										{inSel && !inDrag ? 'bg-yellow-200 dark:bg-yellow-700/30 rounded' : ''}">{token.text}</span
								>
							{/if}
						{/each}
					</p>
					<button
						type="button"
						class="mt-1 block w-fit cursor-pointer select-none rounded border-0 px-1 py-0 text-left text-sm leading-snug transition-all duration-150 {openSentenceIdx ===
						si
							? 'bg-transparent text-base-content/40'
							: 'bg-base-content/15 text-transparent'}"
						onclick={(e) => {
							e.stopPropagation();
							openSentenceIdx = openSentenceIdx === si ? null : si;
						}}>{sentence.english}</button
					>
				{/if}
			</div>
		{/each}
	</div>
</div>

<!-- WordCard -->
{#if wordCardWordMapId !== null && wordCardAnchor !== null}
	<WordCard
		wordMapId={wordCardWordMapId}
		anchor={wordCardAnchor}
		wordMap={data.wordMapById}
		vocabMap={data.vocabMap}
		{stateMap}
		onClose={closeWordCard}
		onToggleLearned={toggleLearned}
		onToggleHanziLearned={toggleHanziLearned}
	/>
{/if}

<!-- AI question bar -->
{#if aiBarOpen && confirmedStart !== null}
	<div
		data-keep-selection
		class="fixed bottom-0 inset-x-0 bg-base-100 border-t border-base-200 shadow-2xl z-50 p-3 space-y-2
		md:max-w-2xl md:mx-auto md:left-0 md:right-0 md:bottom-4 md:rounded-2xl md:border"
	>
		<div class="flex items-start gap-2">
			<div class="flex-1 min-w-0">
				<div class="text-base font-medium leading-snug text-primary break-words">
					{selectedText}
				</div>
				{#if selectedWordsInOrder.length > 0}
					<div class="text-xs text-base-content/40 leading-snug mt-0.5">
						{selectedWordsInOrder
							.map((id) => data.wordMapById[id]?.en ?? '')
							.filter(Boolean)
							.join(' · ')}
					</div>
				{/if}
			</div>
			<button
				class="btn btn-ghost btn-xs btn-square shrink-0 mt-0.5"
				onclick={closeAiBar}
				title="Close"
			>
				<X size={14} />
			</button>
		</div>
		<div class="flex gap-2">
			<input
				bind:value={questionText}
				class="input input-sm flex-1"
				placeholder="Ask about these words..."
				onkeydown={(e) => e.key === 'Enter' && submitQuestion()}
			/>
			<button
				class="btn btn-sm btn-warning"
				onclick={submitQuestion}
				disabled={questionLoading || !questionText.trim()}
			>
				{questionLoading ? 'Asking...' : 'Ask AI'}
			</button>
		</div>
		{#if questionAnswer}
			<div class="text-sm bg-base-200 rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-line">
				{questionAnswer}
			</div>
		{/if}
	</div>
{/if}
