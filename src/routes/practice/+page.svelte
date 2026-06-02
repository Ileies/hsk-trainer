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
	import { tick, untrack } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { practiceSession, type WordResult, type PracticeWord } from '$lib/app.svelte';

	let { data }: { data: PageData } = $props();

	type PracticeNextResponse = {
		word: PracticeWord | null;
		remaining: number;
		total: number;
		learned: number;
		needsReset: boolean;
	};

	// Transient loading/UI state that doesn't need to survive navigation
	let loading = $state(false);
	let submitting = $state(false);
	let explaining = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	// Read-only derived aliases so the template doesn't need to change much
	const currentWord = $derived(practiceSession.word);
	const remaining = $derived(practiceSession.remaining);
	const total = $derived(practiceSession.total);

	// Initialise aiCheck from localStorage once on component mount
	$effect(() => {
		const stored = localStorage.getItem('aiCheck');
		if (stored !== null) practiceSession.aiCheck = stored === 'true';
	});

	// Sync server data into session state.
	// Uses untrack() for practiceSession fields so this effect only re-runs
	// when server data changes - not when we write to practiceSession ourselves.
	// That prevents a feedback loop where our writes trigger another init cycle.
	$effect(() => {
		const serverWord = data.word;
		const serverRemaining = data.remaining;
		const serverTotal = data.total;
		const serverHsk = data.hsk ?? null;

		practiceSession.remaining = serverRemaining;
		practiceSession.total = serverTotal;

		const needsInit =
			untrack(() => practiceSession.wordId) === null ||
			(serverHsk !== null && untrack(() => practiceSession.hsk) !== serverHsk);

		if (needsInit) {
			practiceSession.hsk = serverHsk;
			practiceSession.word = serverWord;
			practiceSession.wordId = serverWord?.id ?? null;
			practiceSession.phase = 'input';
			practiceSession.answer = '';
			practiceSession.result = null;
			practiceSession.showHint = false;
			practiceSession.explanation = null;
			practiceSession.aiCorrected = false;
			practiceSession.aiReason = null;
			practiceSession.loadError = null;
			practiceSession.starred = serverWord?.starred ?? false;
			practiceSession.repairing = false;
			practiceSession.repaired = false;
			practiceSession.repairError = null;
			practiceSession.showVocab = false;
			practiceSession.shownEnglish = null;
			practiceSession.seenIds = [];
			practiceSession.sessionStartTotal = serverRemaining > 0 ? serverRemaining : 0;
		}
	});

	$effect(() => {
		if (practiceSession.phase === 'input' && inputEl) {
			inputEl.focus();
		}
	});

	function toggleAiCheck() {
		practiceSession.aiCheck = !practiceSession.aiCheck;
		localStorage.setItem('aiCheck', String(practiceSession.aiCheck));
	}

	async function explain() {
		const word = practiceSession.result?.word ?? currentWord;
		if (!word || explaining) return;
		explaining = true;
		practiceSession.explanation = null;
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
					userAnswer: practiceSession.result?.userAnswer ?? ''
				})
			});
			const json = await res.json();
			practiceSession.explanation = json.explanation ?? null;
		} catch {
			practiceSession.explanation = 'Could not load explanation. Please try again.';
		} finally {
			explaining = false;
		}
	}

	async function repair() {
		const word = practiceSession.result?.word ?? currentWord;
		if (!word || practiceSession.repairing) return;
		practiceSession.repairing = true;
		practiceSession.repairError = null;
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
					explanation: practiceSession.explanation
				})
			});
			if (!res.ok) throw new Error('Repair failed');
			const corrected = await res.json();
			if (practiceSession.result) {
				practiceSession.result = {
					...practiceSession.result,
					word: { ...practiceSession.result.word, english: corrected.english }
				};
			} else {
				practiceSession.shownEnglish = corrected.english;
			}
			practiceSession.repaired = true;
		} catch {
			practiceSession.repairError = 'Could not repair the flashcard. Please try again.';
		} finally {
			practiceSession.repairing = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && practiceSession.phase === 'feedback' && !loading) {
			e.preventDefault();
			next();
		}
	}

	async function toggleStar(wordId: number) {
		practiceSession.starred = !practiceSession.starred;
		await fetch('/api/star', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ wordId, starred: practiceSession.starred })
		});
	}

	function setFilter(hsk: number | null) {
		// Setting wordId = null forces the sync $effect to re-init when new data
		// arrives, even if the HSK level comparison hasn't changed yet.
		practiceSession.wordId = null;
		const params = new SvelteURLSearchParams();
		if (hsk) params.set('hsk', String(hsk));
		goto(resolve(`/practice${buildPracticeSearch(params)}` as '/practice'), {
			replaceState: true,
			invalidateAll: true
		});
	}

	function buildNextParams(lastId: number | null, newSeenIds: number[]) {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		// Always reflect the session's hsk filter - the URL may have lost it
		// (e.g. after navigating back via the plain /practice nav link)
		if (practiceSession.hsk) {
			params.set('hsk', String(practiceSession.hsk));
		} else {
			params.delete('hsk');
		}
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
		practiceSession.loadError = null;
		const params = buildNextParams(lastId, newSeenIds);

		try {
			const res = await fetch(`/api/practice-next${params.size ? '?' + params : ''}`);
			if (!res.ok) throw new Error('Could not load next word');
			const nextData = (await res.json()) as PracticeNextResponse;

			practiceSession.seenIds = newSeenIds;
			practiceSession.word = nextData.word;
			practiceSession.wordId = nextData.word?.id ?? null;
			practiceSession.remaining = nextData.remaining;
			practiceSession.total = nextData.total;
			replaceState(resolve(`/practice${buildPracticeSearch(params)}` as '/practice'), page.state);

			practiceSession.answer = '';
			practiceSession.result = null;
			practiceSession.explanation = null;
			practiceSession.showHint = false;
			practiceSession.aiCorrected = false;
			practiceSession.aiReason = null;
			practiceSession.starred = nextData.word?.starred ?? false;
			practiceSession.repairing = false;
			practiceSession.repaired = false;
			practiceSession.repairError = null;
			practiceSession.showVocab = false;
			practiceSession.shownEnglish = null;
			practiceSession.phase = 'input';
			loading = false;

			await tick();
			inputEl?.focus();
		} catch {
			practiceSession.loadError = 'Could not load the next word. Please try again.';
			loading = false;
		}
	}

	async function next() {
		const currentId = practiceSession.result?.word.id ?? currentWord?.id ?? null;
		const newSeenIds =
			currentId !== null ? [...practiceSession.seenIds, currentId] : practiceSession.seenIds;
		await loadSessionWord(currentId, newSeenIds);
	}

	async function skip() {
		await loadSessionWord(currentWord?.id ?? null, practiceSession.seenIds);
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
	<title>Practice{practiceSession.hsk ? ` - HSK ${practiceSession.hsk}` : ''} - HSK Trainer</title>
</svelte:head>

<!-- Top bar -->
<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
	<a href={resolve('/')} class="btn gap-1 self-start btn-ghost btn-sm">
		<ArrowLeft size={16} />
		Dashboard
	</a>

	<div class="flex flex-1 justify-start sm:justify-center">
		<span class="text-sm font-semibold text-base-content/70">
			{practiceSession.hsk ? `HSK ${practiceSession.hsk}` : 'All levels'}
		</span>
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
				checked={practiceSession.aiCheck}
				onchange={toggleAiCheck}
			/>
		</label>
	</div>
</div>

<!-- Progress bar -->
{#if practiceSession.sessionStartTotal > 0}
	<div class="mb-6">
		<div class="mb-1 flex justify-between text-xs text-base-content/50">
			<span>{practiceSession.seenIds.length} done this session</span>
			<span>{practiceSession.sessionStartTotal - practiceSession.seenIds.length} remaining</span>
		</div>
		<progress
			class="progress h-2 w-full progress-primary"
			value={practiceSession.seenIds.length}
			max={practiceSession.sessionStartTotal}
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
					{practiceSession.hsk ? `HSK ${practiceSession.hsk} complete!` : 'All words learned!'}
				</h2>
				<p class="mb-6 text-base-content/60">
					You've learned all {total} words in this set.
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<a href={resolve('/')} class="btn btn-primary">Back to Dashboard</a>
					{#if practiceSession.hsk && practiceSession.hsk < 6}
						<button class="btn btn-outline" onclick={() => setFilter(practiceSession.hsk! + 1)}>
							Try HSK {practiceSession.hsk + 1}
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
					You went through all {practiceSession.seenIds.length} words. {remaining} still to learn -
					restart to practice them again.
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<button
						class="btn btn-primary"
						onclick={() => {
							practiceSession.wordId = null;
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
{:else if practiceSession.phase === 'input'}
	<!-- Practice card -->
	<div class="card relative mx-auto max-w-xl bg-base-100 shadow-lg">
		<button
			class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm"
			title={practiceSession.starred ? 'Unstar' : 'Star this word'}
			onclick={() => toggleStar(currentWord!.id)}
		>
			<Star
				size={18}
				class={practiceSession.starred ? 'fill-warning text-warning' : 'text-base-content/30'}
			/>
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
				<p class="text-3xl leading-snug font-semibold">
					{practiceSession.shownEnglish ?? currentWord.english}
				</p>
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

							if (
								!wordResult.correct &&
								practiceSession.aiCheck &&
								wordResult.userAnswer.trim()
							) {
								practiceSession.phase = 'checking';
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
										practiceSession.result = { ...wordResult, correct: true };
										practiceSession.aiCorrected = true;
										practiceSession.aiReason = null;
									} else {
										practiceSession.result = wordResult;
										practiceSession.aiCorrected = false;
										practiceSession.aiReason = reason ?? null;
									}
								} catch {
									practiceSession.result = wordResult;
									practiceSession.aiCorrected = false;
								}
							} else {
								practiceSession.result = wordResult;
							}

							practiceSession.starred =
								practiceSession.result?.word.starred ?? practiceSession.starred;
							practiceSession.phase = 'feedback';
						}
					};
				}}
			>
				<input type="hidden" name="wordId" value={currentWord.id} />

				<div class="flex flex-col gap-3">
					{#if !practiceSession.showVocab}
						<input
							bind:this={inputEl}
							bind:value={practiceSession.answer}
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

					{#if !practiceSession.showVocab}
						<div class="flex gap-2">
							<button
								type="button"
								class="btn flex-1 gap-1 btn-ghost bg-base-200"
								onclick={() => (practiceSession.showVocab = true)}
							>
								<Eye size={16} />
								Show
							</button>
							<button
								type="submit"
								class="btn flex-1 gap-1 btn-primary"
								disabled={!practiceSession.answer.trim() || submitting}
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
					{#if practiceSession.loadError}
						<p class="text-center text-sm text-error">{practiceSession.loadError}</p>
					{/if}
				</div>
			</form>

			{#if practiceSession.showVocab}
				<div class="border-t border-base-200 pt-4">
					<div class="py-2 text-center">
						<div class="hanzi mb-3 text-6xl leading-none font-bold">{currentWord.hanzi}</div>
						<div class="text-lg font-medium tracking-widest text-primary">{currentWord.pinyin}</div>
						<div class="mt-1 text-sm text-base-content/60">
							{practiceSession.shownEnglish ?? currentWord.english}
						</div>
					</div>

					{#if practiceSession.explanation}
						<div
							class="explanation-md mt-3 rounded-xl bg-base-200 px-4 py-3 text-sm leading-relaxed text-base-content/80"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html marked.parse(practiceSession.explanation)}
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
							class="btn gap-2 btn-outline btn-sm {practiceSession.repaired ? 'btn-success' : ''}"
							onclick={repair}
							disabled={practiceSession.repairing}
						>
							{#if practiceSession.repairing}
								<Loader size={14} class="animate-spin" />
								Repairing...
							{:else if practiceSession.repaired}
								<Wrench size={14} />
								Repaired!
							{:else}
								<Wrench size={14} />
								Repair flashcard
							{/if}
						</button>
					</div>
					{#if practiceSession.repairError}
						<p class="mt-2 text-center text-sm text-error">{practiceSession.repairError}</p>
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
					{#if practiceSession.loadError}
						<p class="mt-2 text-center text-sm text-error">{practiceSession.loadError}</p>
					{/if}
				</div>
			{/if}

			{#if currentWord.exampleSentences}
				<div class="border-t border-base-200 pt-4">
					{#if practiceSession.showHint}
						<div class="text-sm leading-relaxed whitespace-pre-line text-base-content/70">
							{currentWord.exampleSentences}
						</div>
						<button
							class="btn mt-2 text-base-content/40 btn-ghost btn-xs"
							onclick={() => (practiceSession.showHint = false)}
						>
							Tipp verstecken
						</button>
					{:else}
						<button
							class="btn gap-1 text-base-content/50 btn-ghost btn-sm"
							onclick={() => (practiceSession.showHint = true)}
						>
							Tipp anzeigen
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else if practiceSession.phase === 'checking'}
	<!-- AI checking phase -->
	<div class="card mx-auto max-w-xl bg-base-100 shadow-lg">
		<div class="card-body items-center gap-3 py-16">
			<Loader size={28} class="animate-spin text-primary" />
			<p class="text-sm text-base-content/50">KI bewertet die Antwort...</p>
		</div>
	</div>
{:else if practiceSession.phase === 'feedback' && practiceSession.result}
	<!-- Feedback card -->
	<div
		class="card relative mx-auto max-w-xl border-2 shadow-lg {practiceSession.result.correct
			? 'border-success/30 bg-success/10'
			: 'border-error/30 bg-error/10'}"
	>
		<button
			class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm"
			title={practiceSession.starred ? 'Unstar' : 'Star this word'}
			onclick={() => toggleStar(practiceSession.result!.word.id)}
		>
			<Star
				size={18}
				class={practiceSession.starred ? 'fill-warning text-warning' : 'text-base-content/30'}
			/>
		</button>
		<div class="card-body gap-5 px-8 py-10">
			<!-- Result banner -->
			<div
				class="flex items-center gap-2 text-lg font-bold {practiceSession.result.correct
					? 'text-success'
					: 'text-error'}"
			>
				{#if practiceSession.result.correct}
					<CheckCircle size={24} />
					Correct!
				{:else}
					<XCircle size={24} />
					Incorrect
				{/if}
			</div>

			{#if practiceSession.result.correct && practiceSession.aiCorrected}
				<div class="rounded-xl bg-base-100 px-4 py-3 text-center text-sm text-base-content/60">
					You typed:
					<span class="ml-1 font-mono text-base-content/80"
						>{practiceSession.result.userAnswer}</span
					>
				</div>
			{/if}

			<!-- Hanzi (big reveal) -->
			<div class="py-2 text-center">
				<div class="hanzi mb-3 text-7xl leading-none font-bold">
					{practiceSession.result.word.hanzi}
				</div>
				<div class="text-xl font-medium tracking-widest text-primary">
					{practiceSession.result.word.pinyin}
				</div>
				<div class="mt-1 text-base-content/60">{practiceSession.result.word.english}</div>
			</div>

			<!-- If wrong: show what they typed + Explain button -->
			{#if !practiceSession.result.correct}
				<div class="rounded-xl bg-base-100 px-4 py-3 text-center text-sm">
					<span class="text-base-content/50">You typed:</span>
					<span class="ml-2 font-mono text-error"
						>{practiceSession.result.userAnswer || '(empty)'}</span
					>
					<span class="mx-2 text-base-content/50">·</span>
					<span class="text-base-content/50">Correct:</span>
					<span class="ml-2 font-mono text-success">{practiceSession.result.word.pinyinPlain}</span>
					{#if practiceSession.aiReason}
						<div class="mt-2 text-base-content/50 italic">{practiceSession.aiReason}</div>
					{/if}
				</div>

				{#if practiceSession.explanation}
					<div
						class="explanation-md rounded-xl bg-base-100 px-4 py-3 text-sm leading-relaxed text-base-content/80"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html marked.parse(practiceSession.explanation)}
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
						class="btn gap-2 btn-outline btn-sm {practiceSession.repaired ? 'btn-success' : ''}"
						onclick={repair}
						disabled={practiceSession.repairing}
					>
						{#if practiceSession.repairing}
							<Loader size={14} class="animate-spin" />
							Repairing...
						{:else if practiceSession.repaired}
							<Wrench size={14} />
							Repaired!
						{:else}
							<Wrench size={14} />
							Repair flashcard
						{/if}
					</button>
				</div>
				{#if practiceSession.repairError}
					<p class="text-center text-sm text-error">{practiceSession.repairError}</p>
				{/if}
			{/if}

			<!-- Badges -->
			<div class="flex justify-center gap-2">
				<span class="badge {LEVEL_COLORS[practiceSession.result.word.hskLevel - 1]} badge-sm">
					HSK {practiceSession.result.word.hskLevel}
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
			{#if practiceSession.loadError}
				<p class="text-center text-sm text-error">{practiceSession.loadError}</p>
			{/if}
		</div>
	</div>
{/if}
