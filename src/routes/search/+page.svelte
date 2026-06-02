<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Star,
		Search,
		BookOpen,
		CheckCircle,
		GraduationCap,
		MessageSquare
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	const LEVEL_COLORS = [
		'badge-primary',
		'badge-secondary',
		'badge-accent',
		'badge-warning',
		'badge-error',
		'badge-neutral'
	];

	const LEVEL_RING_COLORS = [
		'ring-primary/20 bg-primary/5',
		'ring-secondary/20 bg-secondary/5',
		'ring-accent/20 bg-accent/5',
		'ring-warning/20 bg-warning/5',
		'ring-error/20 bg-error/5',
		'ring-neutral/20 bg-neutral/5'
	];

	let search = $state('');
	let starred = $state(false);

	$effect(() => {
		search = data.q;
		starred = data.mode === 'detail' ? data.word.starred : false;
	});

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && search.trim()) {
			goto(`/search?q=${encodeURIComponent(search.trim())}`);
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

	function openDetail(id: number) {
		const params = new URLSearchParams();
		params.set('id', String(id));
		if (data.q) params.set('q', data.q);
		goto(`/search?${params}`);
	}

	function backToResults() {
		if (data.q) goto(`/search?q=${encodeURIComponent(data.q)}`);
		else goto('/search');
	}
</script>

<svelte:head>
	{#if data.mode === 'detail'}
		<title>{data.word.hanzi} - {data.word.english} - HSK Tester</title>
	{:else if data.q}
		<title>Search: {data.q} - HSK Tester</title>
	{:else}
		<title>Search - HSK Tester</title>
	{/if}
</svelte:head>

{#if data.mode === 'detail'}
	<!-- ─── Single word detail ─── -->
	<div class="max-w-2xl mx-auto">
		<!-- Back navigation -->
		<div class="flex items-center gap-3 mb-8">
			<button onclick={backToResults} class="btn btn-ghost btn-sm gap-1">
				<ArrowLeft size={16} />
				{data.q ? `Back to results` : 'Search'}
			</button>
			{#if data.q}
				<span class="text-base-content/30 text-sm">
					"{data.q}"
				</span>
			{/if}
		</div>

		<!-- Hero card -->
		<div
			class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden {LEVEL_RING_COLORS[data.word.hskLevel - 1]} ring-1"
		>
			<!-- Top accent stripe -->
			<div
				class="h-1.5 w-full {data.word.hskLevel === 1
					? 'bg-primary'
					: data.word.hskLevel === 2
						? 'bg-secondary'
						: data.word.hskLevel === 3
							? 'bg-accent'
							: data.word.hskLevel === 4
								? 'bg-warning'
								: data.word.hskLevel === 5
									? 'bg-error'
									: 'bg-neutral'}"
			></div>

			<div class="card-body px-8 py-10 gap-0">
				<!-- Badges + star row -->
				<div class="flex items-center justify-between mb-8">
					<div class="flex gap-2 flex-wrap">
						<span class="badge {LEVEL_COLORS[data.word.hskLevel - 1]} badge-md gap-1">
							<GraduationCap size={12} />
							HSK {data.word.hskLevel}
						</span>
						{#if data.word.learned}
							<span class="badge badge-success badge-md gap-1">
								<CheckCircle size={12} />
								Learned
							</span>
						{/if}
					</div>
					<button
						class="btn btn-ghost btn-circle btn-md"
						title={starred ? 'Remove star' : 'Star this word'}
						onclick={() => toggleStar(data.word.id)}
					>
						<Star
							size={22}
							class={starred ? 'fill-warning text-warning' : 'text-base-content/25'}
						/>
					</button>
				</div>

				<!-- Hanzi - the star of the show -->
				<div class="text-center mb-6">
					<div class="hanzi text-8xl sm:text-9xl font-bold leading-none mb-6 tracking-wider">
						{data.word.hanzi}
					</div>

					<!-- Pinyin -->
					<div class="text-2xl sm:text-3xl text-primary font-medium tracking-widest mb-3">
						{data.word.pinyin}
					</div>

					<!-- Plain pinyin (if different) -->
					{#if data.word.pinyinPlain && data.word.pinyinPlain !== data.word.pinyin}
						<div class="text-base-content/40 text-sm mb-3 tracking-wide">
							{data.word.pinyinPlain}
						</div>
					{/if}

					<!-- English -->
					<div class="text-xl text-base-content/70 font-light">
						{data.word.english}
					</div>
				</div>

				<!-- Example sentences -->
				{#if data.word.exampleSentences}
					<div class="mt-8 pt-8 border-t border-base-200">
						<div class="flex items-center gap-2 mb-4 text-base-content/50">
							<MessageSquare size={15} />
							<span class="text-sm font-medium uppercase tracking-wider">Example Sentences</span>
						</div>
						<div
							class="text-base-content/75 leading-relaxed whitespace-pre-line text-base bg-base-200/50 rounded-xl px-5 py-4"
						>
							{data.word.exampleSentences}
						</div>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex gap-3 mt-8 pt-6 border-t border-base-200">
					<a
						href="/practice?hsk={data.word.hskLevel}"
						class="btn btn-primary flex-1 gap-2"
					>
						<BookOpen size={16} />
						Practice HSK {data.word.hskLevel}
					</a>
					<a
						href="/starred"
						class="btn btn-ghost gap-2"
					>
						<Star size={16} class="text-warning" />
						Starred
					</a>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- ─── Search results ─── -->

	<!-- Search bar (standalone, bigger than header) -->
	<div class="max-w-2xl mx-auto mb-10">
		<div class="flex gap-2">
			<label class="input input-lg flex-1 flex items-center gap-3">
				<Search size={20} class="text-base-content/40 shrink-0" />
				<input
					type="text"
					bind:value={search}
					onkeydown={handleSearchKeydown}
					placeholder="Search by Chinese, pinyin or English..."
					class="grow"
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
				/>
			</label>
			<button
				class="btn btn-primary btn-lg"
				disabled={!search.trim()}
				onclick={() => search.trim() && goto(`/search?q=${encodeURIComponent(search.trim())}`)}
			>
				Search
			</button>
		</div>
	</div>

	{#if data.q && data.results.length === 0}
		<!-- No results -->
		<div class="hero min-h-[40vh]">
			<div class="hero-content text-center">
				<div class="max-w-sm">
					<Search size={48} class="mx-auto mb-4 text-base-content/20" />
					<h2 class="text-xl font-bold mb-2">No results for "{data.q}"</h2>
					<p class="text-base-content/50 text-sm">
						Try searching in Chinese characters, pinyin (with or without tones), or English.
					</p>
				</div>
			</div>
		</div>
	{:else if data.q}
		<!-- Results header -->
		<div class="flex items-baseline gap-3 mb-6 max-w-2xl mx-auto">
			<h1 class="text-2xl font-bold">"{data.q}"</h1>
			<span class="text-base-content/40 text-sm">
				{data.results.length} result{data.results.length === 1 ? '' : 's'}
			</span>
		</div>

		<!-- Results grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.results as word}
				<button
					class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary/30 transition-all text-left cursor-pointer group"
					onclick={() => openDetail(word.id)}
				>
					<div class="card-body py-5 px-5 gap-3">
						<!-- Badges row -->
						<div class="flex items-center justify-between gap-2">
							<div class="flex gap-1.5 flex-wrap">
								<span class="badge {LEVEL_COLORS[word.hskLevel - 1]} badge-sm">
									HSK {word.hskLevel}
								</span>
							</div>
							<div class="flex gap-1.5 shrink-0">
								{#if word.starred}
									<Star size={13} class="fill-warning text-warning" />
								{/if}
								{#if word.learned}
									<CheckCircle size={13} class="text-success" />
								{/if}
							</div>
						</div>

						<!-- Hanzi -->
						<div
							class="hanzi text-5xl font-bold leading-none mt-1 group-hover:text-primary transition-colors"
						>
							{word.hanzi}
						</div>

						<!-- Pinyin -->
						<div class="text-primary font-medium tracking-wide text-sm">{word.pinyin}</div>

						<!-- English -->
						<div class="text-base-content/60 text-sm leading-snug">{word.english}</div>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<!-- Empty state - no query yet -->
		<div class="hero min-h-[40vh]">
			<div class="hero-content text-center">
				<div class="max-w-sm">
					<Search size={48} class="mx-auto mb-4 text-base-content/20" />
					<p class="text-base-content/50">
						Search for any word in the HSK vocabulary list.
					</p>
					<p class="text-base-content/35 text-sm mt-2">
						Type Chinese characters, pinyin (with or without tones), or English.
					</p>
				</div>
			</div>
		</div>
	{/if}
{/if}
