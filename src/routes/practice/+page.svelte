<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		CheckCircle,
		XCircle,
		ChevronRight,
		Eye,
		ArrowLeft,
		Loader,
		Sparkles,
		Star,
		Wrench
	} from '@lucide/svelte';
	import { marked } from 'marked';
	import { tick } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	let { data }: { data: PageData } = $props();

	type WordResult = {
		correct: boolean;
		userAnswer: string;
		word: {
			id: number;
			hanzi: string;
			pinyin: string;
			pinyinPlain: string;
			english: string;
			hskLevel: number;
			exampleSentences: string | null;
			starred: boolean;
		};
	};

	type PracticeWord = WordResult['word'];

	type PracticeNextResponse = {
		word: PracticeWord | null;
		remaining: number;
		total: number;
		learned: number;
		needsReset: boolean;
	};

	let phase = $state<'input' | 'checking' | 'feedback'>('input');
	let answer = $state('');
	let result = $state<WordResult | null>(null);
	let submitting = $state(false);
	let loading = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();
	let showHint = $state(false);
	let explaining = $state(false);
	let explanation = $state<string | null>(null);
	let aiCheck = $state(true);
	let aiCorrected = $state(false);
	let aiReason = $state<string | null>(null);
	let seenIds = $state<number[]>([]);
	let sessionStartTotal = $state(0);
	let starred = $state(false);
	let repairing = $state(false);
	let repaired = $state(false);
	let repairError = $state<string | null>(null);
	let showVocab = $state(false);
	let shownEnglish = $state<string | null>(null);
	let currentWord: PracticeWord | null = $derived(data.word);
	let remaining = $derived(data.remaining);
	let total = $derived(data.total);
	let loadError = $state<string | null>(null);

	$effect(() => {
		const stored = localStorage.getItem('aiCheck');
		if (stored !== null) aiCheck = stored === 'true';
	});

	$effect(() => {
		if (seenIds.length === 0 && remaining > 0) {
			sessionStartTotal = remaining;
		}
	});

	$effect(() => {
		currentWord = data.word;
		remaining = data.remaining;
		total = data.total;
		answer = '';
		result = null;
		showHint = false;
		explanation = null;
		aiCorrected = false;
		aiReason = null;
		loadError = null;
		phase = 'input';
		loading = false;
		starred = data.word?.starred ?? false;
		repairing = false;
		repaired = false;
		repairError = null;
		showVocab = false;
		shownEnglish = null;
	});

	function toggleAiCheck() {
		aiCheck = !aiCheck;
		localStorage.setItem('aiCheck', String(aiCheck));
	}

	async function explain() {
		const word = result?.word ?? currentWord;
		if (!word || explaining) return;
		explaining = true;
		explanation = null;
		try {
			const res = await fetch('/api/explain', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					wordId: word.id,
					hanzi: word.hanzi,
					pinyin: word.pinyin,
					pinyinPlain: word.pinyinPlain,
					english: word.english,
					hskLevel: word.hskLevel,
					userAnswer: result?.userAnswer ?? ''
				})
			});
			const data = await res.json();
			explanation = data.explanation ?? null;
		} catch {
			explanation = 'Could not load explanation. Please try again.';
		} finally {
			explaining = false;
		}
	}

	async function repair() {
		const word = result?.word ?? currentWord;
		if (!word || repairing) return;
		repairing = true;
		repairError = null;
		try {
			const res = await fetch('/api/repair', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					wordId: word.id,
					hanzi: word.hanzi,
					pinyin: word.pinyin,
					pinyinPlain: word.pinyinPlain,
					english: word.english,
					explanation
				})
			});
			if (!res.ok) throw new Error('Repair failed');
			const corrected = await res.json();
			if (result) {
				result = { ...result, word: { ...result.word, english: corrected.english } };
			} else {
				shownEnglish = corrected.english;
			}
			repaired = true;
		} catch {
			repairError = 'Could not repair the flashcard. Please try again.';
		} finally {
			repairing = false;
		}
	}

	$effect(() => {
		if (phase === 'input' && inputEl) {
			inputEl.focus();
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && phase === 'feedback' && !loading) {
			e.preventDefault();
			next();
		}
	}

	async function toggleStar(wordId: number) {
		starred = !starred;
		await fetch('/api/star', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ wordId, starred })
		});
	}

	function setFilter(hsk: number | null) {
		seenIds = [];
		sessionStartTotal = 0;
		const params = new SvelteURLSearchParams();
		if (hsk) params.set('hsk', String(hsk));
		goto(resolve(`/practice${buildPracticeSearch(params)}` as '/practice'), {
			replaceState: true,
			invalidateAll: true
		});
	}

	function toggleHsk(level: number) {
		setFilter(data.hsk === level ? null : level);
	}

	function buildNextParams(lastId: number | null, newSeenIds: number[]) {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.delete('exclude');
		params.delete('last');
		if (newSeenIds.length > 0) params.set('exclude', newSeenIds.join(','));
		if (lastId) params.set('last', String(lastId));
		return params;
	}

	function buildPracticeSearch(params: SvelteURLSearchParams) {
		return params.size ? `?${params}` : '';
	}

	async function loadSessionWord(lastId: number | null, newSeenIds: number[]) {
		loading = true;
		loadError = null;
		const params = buildNextParams(lastId, newSeenIds);

		try {
			const res = await fetch(`/api/practice-next${params.size ? '?' + params : ''}`);
			if (!res.ok) throw new Error('Could not load next word');
			const nextData = (await res.json()) as PracticeNextResponse;

			seenIds = newSeenIds;
			currentWord = nextData.word;
			remaining = nextData.remaining;
			total = nextData.total;
			replaceState(resolve(`/practice${buildPracticeSearch(params)}` as '/practice'), page.state);

			answer = '';
			result = null;
			explanation = null;
			showHint = false;
			aiCorrected = false;
			aiReason = null;
			starred = nextData.word?.starred ?? false;
			repairing = false;
			repaired = false;
			repairError = null;
			showVocab = false;
			shownEnglish = null;
			phase = 'input';
			loading = false;

			await tick();
			inputEl?.focus();
		} catch {
			loadError = 'Could not load the next word. Please try again.';
			loading = false;
		}
	}

	async function next() {
		const currentId = result?.word.id ?? currentWord?.id ?? null;
		const newSeenIds = currentId !== null ? [...seenIds, currentId] : seenIds;
		await loadSessionWord(currentId, newSeenIds);
	}

	async function skip() {
		await loadSessionWord(currentWord?.id ?? null, seenIds);
	}

	const LEVEL_COLORS = [
		'badge-primary',
		'badge-secondary',
		'badge-accent',
		'badge-warning',
		'badge-error',
		'badge-neutral'
	];
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Practice{data.hsk ? ` - HSK ${data.hsk}` : ''} - HSK Trainer</title>
</svelte:head>

<!-- Top bar -->
<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
	<a href={resolve('/')} class="btn gap-1 self-start btn-ghost btn-sm">
		<ArrowLeft size={16} />
		Dashboard
	</a>

	<div class="flex flex-1 flex-wrap justify-start gap-2 sm:justify-center">
		<!-- HSK level filters -->
		<button
			class="btn btn-xs {!data.hsk ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => setFilter(null)}
		>
			All
		</button>
		{#each [1, 2, 3, 4, 5, 6] as level (level)}
			<button
				class="btn btn-xs {data.hsk === level ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => toggleHsk(level)}
			>
				HSK {level}
			</button>
		{/each}
	</div>

	<div class="flex flex-col items-end gap-1 self-start sm:self-center">
		<label
			class="flex cursor-pointer items-center gap-1.5"
			title="KI bewertet ob Fehler wirklich falsch sind"
		>
			<span class="text-xs text-base-content/40">KI-Check</span>
			<input
				type="checkbox"
				class="toggle toggle-primary toggle-xs"
				checked={aiCheck}
				onchange={toggleAiCheck}
			/>
		</label>
	</div>
</div>

<!-- Progress bar -->
{#if sessionStartTotal > 0}
	<div class="mb-6">
		<div class="mb-1 flex justify-between text-xs text-base-content/50">
			<span>{seenIds.length} done this session</span>
			<span>{sessionStartTotal - seenIds.length} remaining</span>
		</div>
		<progress
			class="progress h-2 w-full progress-primary"
			value={seenIds.length}
			max={sessionStartTotal}
		></progress>
	</div>
{/if}

<!-- Main card -->
{#if currentWord === null && remaining === 0}
	<!-- All done! -->
	<div class="hero min-h-[50vh]">
		<div class="hero-content text-center">
			<div class="max-w-sm">
				<div class="mb-4 text-6xl">🎉</div>
				<h2 class="mb-2 text-2xl font-bold">
					{data.hsk ? `HSK ${data.hsk} complete!` : 'All words learned!'}
				</h2>
				<p class="mb-6 text-base-content/60">
					You've learned all {total} words in this set.
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<a href={resolve('/')} class="btn btn-primary">Back to Dashboard</a>
					{#if data.hsk && data.hsk < 6}
						<button class="btn btn-outline" onclick={() => setFilter(data.hsk! + 1)}>
							Try HSK {data.hsk + 1}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{:else if currentWord === null}
	<!-- Session complete -->
	<div class="hero min-h-[50vh]">
		<div class="hero-content text-center">
			<div class="max-w-sm">
				<div class="mb-4 text-5xl">✓</div>
				<h2 class="mb-2 text-2xl font-bold">Session complete!</h2>
				<p class="mb-6 text-base-content/60">
					You went through all {seenIds.length} words. {remaining} still to learn - restart to practice
					them again.
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<button
						class="btn btn-primary"
						onclick={() => {
							seenIds = [];
							sessionStartTotal = 0;
							const params = new SvelteURLSearchParams(page.url.searchParams);
							params.delete('exclude');
							params.delete('last');
							goto(resolve(`/practice${buildPracticeSearch(params)}` as '/practice'), {
								replaceState: true,
								invalidateAll: true
							});
						}}
					>
						Restart session
					</button>
					<a href={resolve('/')} class="btn btn-outline">Dashboard</a>
				</div>
			</div>
		</div>
	</div>
{:else if phase === 'input'}
	<!-- Practice card -->
	<div class="card relative mx-auto max-w-xl bg-base-100 shadow-lg">
		<button
			class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm"
			title={starred ? 'Unstar' : 'Star this word'}
			onclick={() => toggleStar(currentWord!.id)}
		>
			<Star size={18} class={starred ? 'fill-warning text-warning' : 'text-base-content/30'} />
		</button>
		<div class="card-body gap-6 px-8 py-10">
			<!-- Word info badges -->
			<div class="flex gap-2">
				<span class="badge {LEVEL_COLORS[currentWord.hskLevel - 1]} badge-sm">
					HSK {currentWord.hskLevel}
				</span>
			</div>

			<!-- English prompt -->
			<div class="text-center">
				<p class="mb-2 text-xs tracking-widest text-base-content/40 uppercase">
					Translate to pinyin
				</p>
				<p class="text-3xl leading-snug font-semibold">{shownEnglish ?? currentWord.english}</p>
			</div>

			<!-- Input form -->
			<form
				method="POST"
				action="?/answer"
				use:enhance={() => {
					submitting = true;
					return async ({ result: actionResult }) => {
						submitting = false;
						if (actionResult.type === 'success' && actionResult.data) {
							const wordResult = actionResult.data as WordResult;

							if (!wordResult.correct && aiCheck && wordResult.userAnswer.trim()) {
								phase = 'checking';
								try {
									const res = await fetch('/api/check-answer', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({
											wordId: wordResult.word.id,
											hanzi: wordResult.word.hanzi,
											pinyinPlain: wordResult.word.pinyinPlain,
											english: wordResult.word.english,
											userAnswer: wordResult.userAnswer
										})
									});
									const { valid, reason } = await res.json();
									if (valid === 0) {
										result = { ...wordResult, correct: true };
										aiCorrected = true;
										aiReason = null;
									} else {
										result = wordResult;
										aiCorrected = false;
										aiReason = reason ?? null;
									}
								} catch {
									result = wordResult;
									aiCorrected = false;
								}
							} else {
								result = wordResult;
							}

							starred = result?.word.starred ?? starred;
							phase = 'feedback';
						}
					};
				}}
			>
				<input type="hidden" name="wordId" value={currentWord.id} />

				<div class="flex flex-col gap-3">
					{#if !showVocab}
					<input
						bind:this={inputEl}
						bind:value={answer}
						name="answer"
						type="text"
						placeholder="Type pinyin without tones..."
						class="input-bordered input input-lg w-full text-center text-xl tracking-wide"
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
						spellcheck="false"
						disabled={submitting}
					/>
					{/if}

					{#if !showVocab}
					<div class="flex gap-2">
						<button
							type="button"
							class="btn flex-1 gap-1 btn-ghost bg-base-200"
							onclick={() => (showVocab = true)}
						>
							<Eye size={16} />
							Show
						</button>
						<button
							type="submit"
							class="btn flex-1 gap-1 btn-primary"
							disabled={!answer.trim() || submitting}
						>
							{#if submitting}
								<Loader size={16} class="animate-spin" />
							{:else}
								Check
								<ChevronRight size={16} />
							{/if}
						</button>
					</div>
					{/if}
					{#if loadError}
						<p class="text-center text-sm text-error">{loadError}</p>
					{/if}
				</div>
			</form>

			{#if showVocab}
				<div class="border-t border-base-200 pt-4">
					<div class="py-2 text-center">
						<div class="hanzi mb-3 text-6xl leading-none font-bold">{currentWord.hanzi}</div>
						<div class="text-lg font-medium tracking-widest text-primary">{currentWord.pinyin}</div>
						<div class="mt-1 text-sm text-base-content/60">{shownEnglish ?? currentWord.english}</div>
					</div>

					{#if explanation}
						<div
							class="explanation-md mt-3 rounded-xl bg-base-200 px-4 py-3 text-sm leading-relaxed text-base-content/80"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html marked.parse(explanation)}
						</div>
					{/if}

					<div class="mt-3 flex justify-center gap-2">
						<button
							class="btn gap-2 btn-outline btn-sm"
							onclick={explain}
							disabled={explaining}
						>
							{#if explaining}
								<Loader size={14} class="animate-spin" />
								Explaining...
							{:else}
								<Sparkles size={14} />
								Explain
							{/if}
						</button>
						<button
							class="btn gap-2 btn-outline btn-sm {repaired ? 'btn-success' : ''}"
							onclick={repair}
							disabled={repairing}
						>
							{#if repairing}
								<Loader size={14} class="animate-spin" />
								Repairing...
							{:else if repaired}
								<Wrench size={14} />
								Repaired!
							{:else}
								<Wrench size={14} />
								Repair flashcard
							{/if}
						</button>
					</div>
					{#if repairError}
						<p class="mt-2 text-center text-sm text-error">{repairError}</p>
					{/if}

					<button class="btn mt-3 w-full gap-2 btn-primary" onclick={next} disabled={loading}>
						{#if loading}
							<Loader size={16} class="animate-spin" />
							Loading...
						{:else}
							Next word
							<ChevronRight size={16} />
						{/if}
					</button>
					{#if loadError}
						<p class="mt-2 text-center text-sm text-error">{loadError}</p>
					{/if}
				</div>
			{/if}

			{#if currentWord.exampleSentences}
				<div class="border-t border-base-200 pt-4">
					{#if showHint}
						<div class="text-sm leading-relaxed whitespace-pre-line text-base-content/70">
							{currentWord.exampleSentences}
						</div>
						<button
							class="btn mt-2 text-base-content/40 btn-ghost btn-xs"
							onclick={() => (showHint = false)}
						>
							Tipp verstecken
						</button>
					{:else}
						<button
							class="btn gap-1 text-base-content/50 btn-ghost btn-sm"
							onclick={() => (showHint = true)}
						>
							Tipp anzeigen
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else if phase === 'checking'}
	<!-- AI checking phase -->
	<div class="card mx-auto max-w-xl bg-base-100 shadow-lg">
		<div class="card-body items-center gap-3 py-16">
			<Loader size={28} class="animate-spin text-primary" />
			<p class="text-sm text-base-content/50">KI bewertet die Antwort...</p>
		</div>
	</div>
{:else if phase === 'feedback' && result}
	<!-- Feedback card -->
	<div
		class="card relative mx-auto max-w-xl border-2 shadow-lg {result.correct
			? 'border-success/30 bg-success/10'
			: 'border-error/30 bg-error/10'}"
	>
		<button
			class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm"
			title={starred ? 'Unstar' : 'Star this word'}
			onclick={() => toggleStar(result!.word.id)}
		>
			<Star size={18} class={starred ? 'fill-warning text-warning' : 'text-base-content/30'} />
		</button>
		<div class="card-body gap-5 px-8 py-10">
			<!-- Result banner -->
			<div
				class="flex items-center gap-2 text-lg font-bold {result.correct
					? 'text-success'
					: 'text-error'}"
			>
				{#if result.correct}
					<CheckCircle size={24} />
					Correct!
				{:else}
					<XCircle size={24} />
					Incorrect
				{/if}
			</div>

			{#if result.correct && aiCorrected}
				<div class="rounded-xl bg-base-100 px-4 py-3 text-center text-sm text-base-content/60">
					You typed:
					<span class="ml-1 font-mono text-base-content/80">{result.userAnswer}</span>
				</div>
			{/if}

			<!-- Hanzi (big reveal) -->
			<div class="py-2 text-center">
				<div class="hanzi mb-3 text-7xl leading-none font-bold">{result.word.hanzi}</div>
				<div class="text-xl font-medium tracking-widest text-primary">{result.word.pinyin}</div>
				<div class="mt-1 text-base-content/60">{result.word.english}</div>
			</div>

			<!-- If wrong: show what they typed + Explain button -->
			{#if !result.correct}
				<div class="rounded-xl bg-base-100 px-4 py-3 text-center text-sm">
					<span class="text-base-content/50">You typed:</span>
					<span class="ml-2 font-mono text-error">{result.userAnswer || '(empty)'}</span>
					<span class="mx-2 text-base-content/50">·</span>
					<span class="text-base-content/50">Correct:</span>
					<span class="ml-2 font-mono text-success">{result.word.pinyinPlain}</span>
					{#if aiReason}
						<div class="mt-2 text-base-content/50 italic">{aiReason}</div>
					{/if}
				</div>

				{#if explanation}
					<div
						class="explanation-md rounded-xl bg-base-100 px-4 py-3 text-sm leading-relaxed text-base-content/80"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html marked.parse(explanation)}
					</div>
				{/if}

				<div class="flex justify-center gap-2">
					<button
						class="btn gap-2 btn-outline btn-sm"
						onclick={explain}
						disabled={explaining}
					>
						{#if explaining}
							<Loader size={14} class="animate-spin" />
							Explaining...
						{:else}
							<Sparkles size={14} />
							Explain
						{/if}
					</button>
					<button
						class="btn gap-2 btn-outline btn-sm {repaired ? 'btn-success' : ''}"
						onclick={repair}
						disabled={repairing}
					>
						{#if repairing}
							<Loader size={14} class="animate-spin" />
							Repairing...
						{:else if repaired}
							<Wrench size={14} />
							Repaired!
						{:else}
							<Wrench size={14} />
							Repair flashcard
						{/if}
					</button>
				</div>
				{#if repairError}
					<p class="text-center text-sm text-error">{repairError}</p>
				{/if}
			{/if}

			<!-- Badges -->
			<div class="flex justify-center gap-2">
				<span class="badge {LEVEL_COLORS[result.word.hskLevel - 1]} badge-sm">
					HSK {result.word.hskLevel}
				</span>
			</div>

			<button class="btn gap-2 btn-primary" onclick={next} disabled={loading}>
				{#if loading}
					<Loader size={16} class="animate-spin" />
					Loading...
				{:else}
					Next word
					<ChevronRight size={16} />
				{/if}
			</button>
			{#if loadError}
				<p class="text-center text-sm text-error">{loadError}</p>
			{/if}
		</div>
	</div>
{/if}
