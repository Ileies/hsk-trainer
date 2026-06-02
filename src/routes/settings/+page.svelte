<script lang="ts">
	import { enhance } from '$app/forms';
	import { Settings, RotateCcw, TriangleAlert } from '@lucide/svelte';

	const CONFIRM_WORD = 'RESET';
	let confirmText = $state('');
	let confirmed = $derived(confirmText === CONFIRM_WORD);
</script>

<svelte:head>
	<title>HSK Trainer - Settings</title>
</svelte:head>

<div class="max-w-2xl mx-auto">
	<div class="flex items-center gap-3 mb-8">
		<Settings size={28} class="text-base-content/60" />
		<h1 class="text-3xl font-bold">Settings</h1>
	</div>

	<div class="card bg-base-100 shadow-sm border border-error/30">
		<div class="card-body">
			<div class="flex items-center gap-2 mb-1">
				<TriangleAlert size={18} class="text-error" />
				<h2 class="card-title text-error">Danger Zone</h2>
			</div>
			<p class="text-sm text-base-content/60 mb-6">
				These actions are irreversible. All study progress will be permanently deleted.
			</p>

			<div class="bg-base-200 rounded-box p-4">
				<p class="font-semibold mb-1">Reset all progress</p>
				<p class="text-sm text-base-content/60 mb-4">
					Marks every word across all HSK levels as unlearned. This cannot be undone.
				</p>
				<label for="reset-confirm" class="text-sm text-base-content/70 mb-1 block">
					Type <span class="font-mono font-bold text-error">{CONFIRM_WORD}</span> to confirm
				</label>
				<input
					id="reset-confirm"
					type="text"
					class="input input-bordered input-sm w-full max-w-xs mb-3"
					placeholder={CONFIRM_WORD}
					bind:value={confirmText}
					autocomplete="off"
				/>
				<form
					method="POST"
					action="?/reset"
					use:enhance={() => {
						confirmText = '';
						return async ({ update }) => update({ reset: true });
					}}
				>
					<button
						type="submit"
						class="btn btn-error btn-sm gap-2"
						disabled={!confirmed}
					>
						<RotateCcw size={14} />
						Reset All Progress
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
