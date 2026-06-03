<script lang="ts">
	import { BookOpen } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in - HSK Trainer</title>
</svelte:head>

<div class="min-h-dvh flex items-center justify-center bg-base-200 px-4">
	<div class="card bg-base-100 shadow-xl w-full max-w-sm">
		<div class="card-body gap-6">
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="text-primary">
					<BookOpen size={40} />
				</div>
				<h1 class="text-2xl font-bold">HSK Trainer</h1>
				<p class="text-base-content/60 text-sm">Enter your email to receive a sign-in link.</p>
			</div>

			{#if form?.sent}
				<div class="alert alert-success">
					<span>Check your inbox - a sign-in link was sent to <strong>{form.email}</strong>.</span>
				</div>
			{:else}
				<form method="POST" class="flex flex-col gap-4">
					{#if form?.error}
						<div class="alert alert-error text-sm">
							<span>{form.error}</span>
						</div>
					{/if}

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Email</legend>
						<input
							type="email"
							name="email"
							value={form?.email ?? ''}
							placeholder="you@example.com"
							autocomplete="email"
							required
							class="input input-bordered w-full"
						/>
					</fieldset>

					<button type="submit" class="btn btn-primary w-full">Send sign-in link</button>
				</form>
			{/if}
		</div>
	</div>
</div>
