<script lang="ts">
	import { resolve } from '$app/paths';
	import { Library } from '@lucide/svelte';

	let { data } = $props();

	let hskFilter = $state<number | null>(null);

	let filtered = $derived(
		hskFilter === null ? data.stories : data.stories.filter((s) => s.hskLevel === hskFilter)
	);
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Stories</h1>
			<p class="text-base-content/50 mt-1">Graded reading texts that adapt to your progress.</p>
		</div>
		<Library size={32} class="text-primary opacity-60 hidden sm:block" />
	</div>

	<!-- HSK level filter -->
	<div class="flex flex-wrap gap-2">
		<button
			class="btn btn-sm {hskFilter === null ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (hskFilter = null)}
		>
			All levels
		</button>
		{#each [1, 2, 3, 4, 5, 6] as level (level)}
			<button
				class="btn btn-sm {hskFilter === level ? 'btn-primary' : 'btn-ghost'}"
				onclick={() => (hskFilter = level)}
			>
				HSK {level}
			</button>
		{/each}
	</div>

	{#if filtered.length === 0}
		<div class="text-center py-16 text-base-content/40">
			<Library size={48} class="mx-auto mb-4 opacity-40" />
			<p class="text-lg">No stories at this level yet.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filtered as story (story.id)}
				<a
					href={resolve('/stories/[id]', { id: String(story.id) })}
					class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-base-200 hover:border-primary/30 group"
				>
					<div class="card-body p-5">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<h2 class="text-xl font-bold text-primary leading-tight hanzi">{story.title}</h2>
								<p class="text-sm text-base-content/60 mt-0.5">{story.titleEnglish}</p>
							</div>
							<span class="badge badge-neutral shrink-0">
								HSK {story.hskLevel}
							</span>
						</div>
						{#if story.description}
							<p class="text-sm text-base-content/70 mt-2 line-clamp-2">{story.description}</p>
						{/if}
						<div class="flex items-center justify-between mt-3">
							<span class="text-xs text-base-content/40">
								{story.sentenceCount}
								{story.sentenceCount === 1 ? 'sentence' : 'sentences'}
							</span>
							<span
								class="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity"
							>
								Read -&gt;
							</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
