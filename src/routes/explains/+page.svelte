<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { marked } from 'marked';
	import { BookOpen, Trash2, Sparkles } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Saved Explanations - HSK Tester</title>
</svelte:head>

<div class="flex items-center justify-between mb-8">
	<div>
		<h1 class="text-3xl font-bold">Saved Explanations</h1>
		<p class="text-base-content/60 mt-1">{data.explains.length} explanation{data.explains.length !== 1 ? 's' : ''} saved</p>
	</div>
	<Sparkles size={32} class="text-primary opacity-40" />
</div>

{#if data.explains.length === 0}
	<div class="hero min-h-[50vh]">
		<div class="hero-content text-center">
			<div class="max-w-sm">
				<BookOpen size={64} class="mx-auto mb-4 text-primary opacity-30" />
				<h2 class="text-xl font-bold mb-2">No explanations yet</h2>
				<p class="text-base-content/60">
					When you get a word wrong in practice and click "Explain", the explanation will be saved here.
				</p>
				<a href="/practice" class="btn btn-primary mt-6">Start practicing</a>
			</div>
		</div>
	</div>
{:else}
	<div class="flex flex-col gap-4">
		{#each data.explains as item (item.id)}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body gap-3 py-5 px-6">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-center gap-3">
							<span class="hanzi text-3xl font-bold">{item.hanzi}</span>
							<div>
								<div class="text-primary font-medium tracking-widest">{item.pinyin}</div>
								<div class="text-base-content/60 text-sm">{item.english}</div>
							</div>
						</div>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<button
								type="submit"
								class="btn btn-ghost btn-sm text-base-content/30 hover:text-error"
								title="Remove explanation"
							>
								<Trash2 size={16} />
							</button>
						</form>
					</div>

					{#if item.userAnswer}
						<div class="text-xs text-base-content/40">
							You typed: <span class="font-mono text-error">{item.userAnswer}</span>
						</div>
					{/if}

					<div class="explanation-md text-sm text-base-content/80 leading-relaxed border-t border-base-200 pt-3">
						{@html marked.parse(item.explanation)}
					</div>

					<div class="text-xs text-base-content/30 text-right">
						{new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
