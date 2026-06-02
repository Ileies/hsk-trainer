<script lang="ts">
	import type { PageData } from './$types';
	import {
		GraduationCap,
		BookOpen,
		Zap,
		ChevronRight,
		Trophy,
		Star
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();


	const totalWords = $derived(data.stats.reduce((sum, s) => sum + s.total, 0));
	const totalLearned = $derived(data.stats.reduce((sum, s) => sum + (s.learned ?? 0), 0));
	const overallPct = $derived(totalWords > 0 ? Math.round((totalLearned / totalWords) * 100) : 0);
</script>

<svelte:head>
	<title>HSK Trainer - Dashboard</title>
</svelte:head>

{#if data.stats.length === 0}
	<div class="hero min-h-[60vh]">
		<div class="hero-content text-center">
			<div class="max-w-md">
				<BookOpen size={64} class="mx-auto mb-4 text-primary opacity-50" />
				<h1 class="text-3xl font-bold mb-4">No vocabulary loaded yet</h1>
				<p class="text-base-content/70 mb-6">
					Run the seed script to load the HSK word lists into the database.
				</p>
				<div class="mockup-code text-sm">
					<pre data-prefix="$"><code>bun run db:push && bun run db:seed</code></pre>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Header + overall stats -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
		<div class="text-center sm:text-left">
			<h1 class="text-3xl font-bold">Your Progress</h1>
			<p class="text-base-content/60 mt-1">
				{totalLearned.toLocaleString()} / {totalWords.toLocaleString()} words learned
			</p>
		</div>
		<div class="flex gap-2 justify-center sm:justify-end">
			<a href="/starred" class="btn btn-ghost gap-2">
				<Star size={16} class="text-warning" />
				Starred
			</a>
			<a href="/practice" class="btn btn-primary gap-2">
				<Zap size={16} />
				Practice All
			</a>
		</div>
	</div>

	<!-- Overall progress -->
	<div class="card bg-base-100 shadow-sm mb-6">
		<div class="card-body py-5">
			<div class="flex items-center justify-between mb-2">
				<div class="flex items-center gap-2">
					<Trophy size={20} class="text-warning" />
					<span class="font-semibold">Overall Progress</span>
				</div>
				<span class="text-2xl font-bold text-primary">{overallPct}%</span>
			</div>
			<progress
				class="progress progress-primary w-full h-4"
				value={totalLearned}
				max={totalWords}
			></progress>
			<div class="flex justify-between text-sm text-base-content/60 mt-1">
				<span>{totalLearned.toLocaleString()} learned</span>
				<span>{(totalWords - totalLearned).toLocaleString()} remaining</span>
			</div>
		</div>
	</div>

	<!-- Per-level cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
		{#each data.stats as stat}
			{@const learned = stat.learned ?? 0}
			{@const remaining = stat.total - learned}
			{@const pct = Math.round((learned / stat.total) * 100)}
			<div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
				<div class="card-body gap-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<GraduationCap size={18} class="text-base-content/60" />
							<span class="font-bold text-lg">HSK {stat.hskLevel}</span>
						</div>
						<span class="badge badge-primary badge-sm">{pct}%</span>
					</div>

					<progress
						class="progress progress-primary w-full"
						value={learned}
						max={stat.total}
					></progress>

					<div class="flex justify-between text-sm text-base-content/60">
						<span>{learned} / {stat.total} learned</span>
						<span>{remaining} left</span>
					</div>

					<div class="card-actions justify-end items-center mt-1 gap-2">
						{#if learned > 0}
							<a href="/finished?hsk={stat.hskLevel}" class="btn btn-sm gap-1">
								<BookOpen size={14} />
								Review
							</a>
						{/if}
						<a
							href="/practice?hsk={stat.hskLevel}"
							class="btn btn-sm gap-1"
							class:btn-disabled={remaining === 0}
						>
							{remaining === 0 ? 'Complete!' : 'Practice'}
							{#if remaining > 0}
								<ChevronRight size={14} />
							{:else}
								<Trophy size={14} class="text-warning" />
							{/if}
						</a>
					</div>
				</div>
			</div>
		{/each}
	</div>

{/if}
