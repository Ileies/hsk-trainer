<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { ArrowLeft, RotateCcw, CheckCircle } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	const LEVEL_COLORS = [
		'badge-primary',
		'badge-secondary',
		'badge-accent',
		'badge-warning',
		'badge-error',
		'badge-neutral'
	];

	const title = $derived(data.hskLevel ? `HSK ${data.hskLevel} - Review` : 'Review vocabulary');

	function toggleUrl(all: boolean) {
		const params = new URLSearchParams();
		if (data.hskLevel) params.set('hsk', String(data.hskLevel));
		if (all) params.set('all', '1');
		return `/finished?${params.toString()}`;
	}
</script>

<svelte:head>
	<title>{title} - HSK Trainer</title>
</svelte:head>

<div class="flex items-center gap-3 mb-6">
	<a href="/" class="btn btn-ghost btn-sm gap-1">
		<ArrowLeft size={16} />
		Dashboard
	</a>
	<div class="flex items-center gap-2">
		<CheckCircle size={18} class="text-success" />
		<h1 class="text-xl font-bold">{title}</h1>
	</div>
</div>

<div class="tabs tabs-box mb-5 w-fit">
	<a
		href={toggleUrl(false)}
		class="tab {!data.showAll ? 'tab-active' : ''}"
	>
		Learned
	</a>
	<a
		href={toggleUrl(true)}
		class="tab {data.showAll ? 'tab-active' : ''}"
	>
		All vocabulary
	</a>
</div>

{#if data.words.length === 0}
	<div class="hero min-h-[40vh]">
		<div class="hero-content text-center">
			<div class="max-w-sm">
				<CheckCircle size={48} class="mx-auto mb-4 text-base-content/20" />
				{#if data.showAll}
					<p class="text-base-content/50">No words found.</p>
				{:else}
					<p class="text-base-content/50">No learned words yet.</p>
					<p class="text-base-content/40 text-sm mt-1">Words you learn while practicing will appear here.</p>
					{#if data.hskLevel}
						<a href="/practice?hsk={data.hskLevel}" class="btn btn-primary btn-sm mt-6">Start practicing HSK {data.hskLevel}</a>
					{:else}
						<a href="/practice" class="btn btn-primary btn-sm mt-6">Start practicing</a>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{:else}
	<p class="text-base-content/50 text-sm mb-4">
		{data.words.length} word{data.words.length === 1 ? '' : 's'}
	</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each data.words as word}
			<div class="card bg-base-100 shadow-sm border border-base-200 {data.showAll && !word.learned ? 'opacity-50' : ''}">
				<div class="card-body py-4 px-5 gap-2">
					<div class="flex items-start justify-between gap-2">
						<div class="flex gap-1.5 flex-wrap">
							<span class="badge {LEVEL_COLORS[word.hskLevel - 1]} badge-sm">
								HSK {word.hskLevel}
							</span>
							{#if data.showAll && word.learned}
								<span class="badge badge-success badge-sm">learned</span>
							{/if}
						</div>
						{#if word.learned}
							<form method="POST" action="?/unlearn" use:enhance>
								<input type="hidden" name="wordId" value={word.id} />
								<button
									type="submit"
									class="btn btn-ghost btn-xs gap-1"
									title="Remove from finished"
								>
									<RotateCcw size={12} />
									<span class="text-xs">Relearn</span>
								</button>
							</form>
						{/if}
					</div>
					<div class="hanzi text-4xl font-bold leading-none mt-1">{word.hanzi}</div>
					<div class="text-primary font-medium tracking-wide">{word.pinyin}</div>
					<div class="text-base-content/60 text-sm">{word.english}</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
