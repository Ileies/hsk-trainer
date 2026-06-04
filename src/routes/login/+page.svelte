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
				{#if form?.sent}
					<p class="text-base-content/60 text-sm">
						Check your inbox at <strong>{form.email}</strong> and enter the PIN below, or click the
						link in the email.
					</p>
				{:else}
					<p class="text-base-content/60 text-sm">Enter your email to receive a sign-in link.</p>
				{/if}
			</div>

			{#if form?.sent}
				<form method="POST" action="?/pin" class="flex flex-col gap-4">
					<input type="hidden" name="email" value={form.email} />

					{#if form?.pinError}
						<div class="alert alert-error text-sm">
							<span>{form.pinError}</span>
						</div>
					{/if}

					<fieldset class="fieldset">
						<legend class="fieldset-legend">6-digit PIN</legend>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							name="pin"
							inputmode="numeric"
							pattern="\d{6}"
							maxlength="6"
							oninput={(e) => {
								const el = e.currentTarget as HTMLInputElement;
								el.value = el.value.replace(/\s/g, '');
							}}
							placeholder="123456"
							autocomplete="one-time-code"
							autofocus
							required
							class="input input-bordered w-full text-center text-2xl tracking-widest font-mono"
						/>
					</fieldset>

					<button type="submit" class="btn btn-primary w-full">Sign in</button>
				</form>

				<div class="divider text-xs text-base-content/30">or</div>

				<form method="POST" action="?/send">
					<input type="hidden" name="email" value={form?.email} />
					<button type="submit" class="btn btn-ghost btn-sm w-full text-base-content/50">
						Send a new link
					</button>
				</form>
			{:else}
				<form method="POST" action="?/send" class="flex flex-col gap-4">
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
