<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { ArrowLeft, Star, StarOff } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	const LEVEL_COLORS = [
		'badge-primary',
		'badge-secondary',
		'badge-accent',
		'badge-warning',
		'badge-error',
		'badge-neutral'
	];
</script>

<svelte:head>
	<title>Starred Words - HSK Tester</title>
</svelte:head>

<div class="flex items-center gap-3 mb-6">
	<a href="/" class="btn btn-ghost btn-sm gap-1">
		<ArrowLeft size={16} />
		Dashboard
	</a>
	<div class="flex items-center gap-2">
		<Star size={18} class="fill-warning text-warning" />
		<h1 class="text-xl font-bold">Starred Words</h1>
	</div>
</div>

{#if data.words.length === 0}
	<div class="hero min-h-[40vh]">
		<div class="hero-content text-center">
			<div class="max-w-sm">
				<Star size={48} class="mx-auto mb-4 text-base-content/20" />
				<p class="text-base-content/50">No starred words yet.</p>
				<p class="text-base-content/40 text-sm mt-1">
					Click the star on any word card while studying to save it here.
				</p>
				<a href="/practice" class="btn btn-primary btn-sm mt-6">Start practicing</a>
			</div>
		</div>
	</div>
{:else}
	<p class="text-base-content/50 text-sm mb-4">{data.words.length} word{data.words.length === 1 ? '' : 's'}</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each data.words as word}
			<div class="card bg-base-100 shadow-sm border border-base-200">
				<div class="card-body py-4 px-5 gap-2">
					<div class="flex items-start justify-between gap-2">
						<div class="flex gap-1.5 flex-wrap">
							<span class="badge {LEVEL_COLORS[word.hskLevel - 1]} badge-sm">
								HSK {word.hskLevel}
							</span>
						</div>
						<form method="POST" action="?/unstar" use:enhance>
							<input type="hidden" name="wordId" value={word.id} />
							<button
								type="submit"
								class="btn btn-ghost btn-xs btn-circle"
								title="Remove star"
							>
								<StarOff size={14} class="text-warning" />
							</button>
						</form>
					</div>
					<div class="hanzi text-4xl font-bold leading-none mt-1">{word.hanzi}</div>
					<div class="text-primary font-medium tracking-wide">{word.pinyin}</div>
					<div class="text-base-content/60 text-sm">{word.english}</div>
					{#if word.learned}
						<div class="text-xs text-success mt-1">Learned</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
