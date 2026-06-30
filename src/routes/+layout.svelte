<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import {
		BookOpen,
		Sparkles,
		Settings,
		Search,
		Network,
		Home,
		LogOut,
		User,
		Library
	} from '@lucide/svelte';
	import MapCanvas from '$lib/MapCanvas.svelte';

	let { children, data } = $props();

	let isMap = $derived(page.url.pathname === '/map');
	let isDashboard = $derived(page.url.pathname === '/');
	let isAuthPage = $derived(
		page.url.pathname === '/login' || page.url.pathname.startsWith('/auth/')
	);

	let searchQuery = $state('');
	let dropdown = $state<
		{
			id: number;
			hanzi: string;
			pinyin: string;
			english: string;
			hskLevel: number;
		}[]
	>([]);
	let showDropdown = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout> | null = null;
	let searchInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (!page.url.pathname) return;
		searchQuery = '';
		dropdown = [];
		showDropdown = false;
	});

	async function onSearchInput() {
		const q = searchQuery.trim();
		if (searchDebounce) clearTimeout(searchDebounce);
		if (!q) {
			dropdown = [];
			showDropdown = false;
			return;
		}
		searchDebounce = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`);
				const data = await res.json();
				dropdown = data;
				showDropdown = data.length > 0;
			} catch {
				dropdown = [];
				showDropdown = false;
			}
		}, 250);
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && searchQuery.trim()) {
			e.preventDefault();
			showDropdown = false;
			goto(resolve(`/search?q=${encodeURIComponent(searchQuery.trim())}` as '/search'));
		} else if (e.key === 'Escape') {
			showDropdown = false;
			searchInput?.blur();
		}
	}

	function selectWord(id: number) {
		showDropdown = false;
		const q = searchQuery.trim();
		const params = new SvelteURLSearchParams();
		params.set('id', String(id));
		if (q) params.set('q', q);
		goto(resolve(`/search?${params}` as '/search'));
	}

	function viewAll() {
		showDropdown = false;
		goto(resolve(`/search?q=${encodeURIComponent(searchQuery.trim())}` as '/search'));
	}

	function onFocusOut(e: FocusEvent) {
		const related = e.relatedTarget as HTMLElement | null;
		if (related && (e.currentTarget as HTMLElement).contains(related)) return;
		setTimeout(() => {
			showDropdown = false;
		}, 150);
	}
</script>

<div class="h-dvh flex flex-col bg-base-200">
	<!-- Desktop header (hidden on mobile) -->
	<nav
		class="navbar bg-base-100 shadow-sm px-4 lg:px-8 shrink-0 {isAuthPage
			? 'hidden'
			: 'hidden md:flex'}"
	>
		<div class="flex-none">
			<a href={resolve('/')} class="flex items-center gap-2 text-xl font-bold text-primary">
				<BookOpen size={24} />
				<span class="hidden sm:inline">HSK Trainer</span>
			</a>
		</div>

		<div class="relative flex-1 flex justify-center px-4" onfocusout={onFocusOut}>
			<label
				class="input input-sm flex items-center gap-2 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg"
			>
				<Search size={14} class="text-base-content/40 shrink-0" />
				<input
					bind:this={searchInput}
					bind:value={searchQuery}
					oninput={onSearchInput}
					onkeydown={onSearchKeydown}
					onfocus={() => {
						if (dropdown.length > 0) showDropdown = true;
					}}
					type="text"
					placeholder="Search..."
					class="grow min-w-0"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
				/>
			</label>

			{#if showDropdown}
				<div
					class="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-base-100 shadow-2xl rounded-2xl z-50 w-80 sm:w-96 border border-base-200 overflow-hidden"
				>
					{#each dropdown as word (word.id)}
						<button
							class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 transition-colors text-left"
							onpointerdown={(e) => {
								e.preventDefault();
								selectWord(word.id);
							}}
						>
							<span class="hanzi text-2xl font-bold leading-none text-primary shrink-0">
								{word.hanzi}
							</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="text-sm font-medium text-base-content/80 truncate">
										{word.pinyin}
									</span>
									<span class="badge badge-xs badge-ghost shrink-0">HSK {word.hskLevel}</span>
								</div>
								<div class="text-xs text-base-content/50 truncate">{word.english}</div>
							</div>
						</button>
					{/each}

					<button
						class="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-t border-base-200 text-sm text-primary hover:bg-base-200 transition-colors font-medium"
						onpointerdown={(e) => {
							e.preventDefault();
							viewAll();
						}}
					>
						<Search size={13} />
						View all results for "{searchQuery.trim()}"
					</button>
				</div>
			{/if}
		</div>

		<div class="flex-none flex items-center gap-1 sm:gap-2">
			<a
				href={resolve('/')}
				class="btn btn-ghost btn-sm hidden sm:inline-flex"
				class:btn-active={isDashboard}
			>
				Dashboard
			</a>
			<a
				href={resolve('/explains')}
				class="btn btn-ghost btn-sm gap-1 hidden sm:inline-flex"
				class:btn-active={page.url.pathname.startsWith('/explains')}
			>
				<Sparkles size={14} />
				Explains
			</a>
			<a
				href={resolve('/map')}
				class="btn btn-ghost btn-sm gap-1 hidden sm:inline-flex"
				class:btn-active={page.url.pathname === '/map'}
			>
				<Network size={14} />
				Map
			</a>
			<a
				href={resolve('/stories')}
				class="btn btn-ghost btn-sm gap-1 hidden sm:inline-flex"
				class:btn-active={page.url.pathname.startsWith('/stories')}
			>
				<Library size={14} />
				Stories
			</a>
			<a
				href={resolve('/practice')}
				class="btn btn-primary btn-sm"
				class:btn-active={page.url.pathname.startsWith('/practice')}
			>
				Practice
			</a>
			<a
				href="https://github.com/Ileies/hsk-trainer"
				target="_blank"
				rel="noopener noreferrer"
				class="btn btn-ghost btn-sm btn-square text-base-content/40 hover:text-base-content"
				title="GitHub"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path
						d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
					/>
				</svg>
			</a>
			<a
				href={resolve('/settings')}
				class="btn btn-ghost btn-sm btn-square text-base-content/40 hover:text-base-content"
				class:btn-active={page.url.pathname.startsWith('/settings')}
				title="Settings"
			>
				<Settings size={16} />
			</a>
			{#if data.user}
				<div class="flex items-center gap-1 ml-1 border-l border-base-200 pl-3">
					<div class="tooltip tooltip-bottom" data-tip={data.user.email}>
						<span class="btn btn-ghost btn-sm btn-square text-base-content/40 cursor-default">
							<User size={16} />
						</span>
					</div>
					<form method="POST" action="/auth/logout">
						<button
							type="submit"
							class="btn btn-ghost btn-sm btn-square text-base-content/40 hover:text-error"
							title="Sign out"
						>
							<LogOut size={16} />
						</button>
					</form>
				</div>
			{/if}
		</div>
	</nav>

	<!-- Map canvas - always mounted so it survives route changes -->
	<div
		class="{isMap && !isAuthPage
			? 'flex flex-col'
			: 'hidden'} flex-1 min-h-0 overflow-hidden pb-16 md:pb-0"
	>
		<MapCanvas words={data.words} />
	</div>

	{#if isMap && !isAuthPage}
		{@render children()}
	{:else}
		<main class="flex-1 overflow-auto">
			<div
				class="container mx-auto px-4 py-8 max-w-5xl"
				class:mobile-content-pb={!isDashboard}
				class:mobile-content-pb-dashboard={isDashboard}
			>
				{@render children()}
			</div>
		</main>
	{/if}

	<!-- Mobile search bar - only on dashboard, pinned above bottom nav -->
	{#if isDashboard && !isAuthPage}
		<div
			class="fixed bottom-16 inset-x-0 bg-base-100 border-t border-base-200 px-4 py-2 z-40 md:hidden"
			onfocusout={onFocusOut}
		>
			<div class="relative">
				<label class="input input-sm flex items-center gap-2 w-full">
					<Search size={14} class="text-base-content/40 shrink-0" />
					<input
						bind:value={searchQuery}
						oninput={onSearchInput}
						onkeydown={onSearchKeydown}
						onfocus={() => {
							if (dropdown.length > 0) showDropdown = true;
						}}
						type="text"
						placeholder="Search..."
						class="grow min-w-0"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
					/>
				</label>

				{#if showDropdown}
					<div
						class="absolute bottom-full mb-1.5 left-0 right-0 bg-base-100 shadow-2xl rounded-2xl z-50 border border-base-200 overflow-hidden"
					>
						{#each dropdown as word (word.id)}
							<button
								class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 transition-colors text-left"
								onpointerdown={(e) => {
									e.preventDefault();
									selectWord(word.id);
								}}
							>
								<span class="hanzi text-2xl font-bold leading-none text-primary shrink-0">
									{word.hanzi}
								</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-1.5">
										<span class="text-sm font-medium text-base-content/80 truncate">
											{word.pinyin}
										</span>
										<span class="badge badge-xs badge-ghost shrink-0">HSK {word.hskLevel}</span>
									</div>
									<div class="text-xs text-base-content/50 truncate">{word.english}</div>
								</div>
							</button>
						{/each}

						<button
							class="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-t border-base-200 text-sm text-primary hover:bg-base-200 transition-colors font-medium"
							onpointerdown={(e) => {
								e.preventDefault();
								viewAll();
							}}
						>
							<Search size={13} />
							View all results for "{searchQuery.trim()}"
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Mobile bottom navigation -->
	<nav
		class="fixed bottom-0 inset-x-0 bg-base-100 border-t border-base-200 z-50 md:hidden {isAuthPage
			? 'hidden'
			: ''}"
	>
		<div class="flex h-16">
			<a
				href={resolve('/')}
				class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors {isDashboard
					? 'text-primary'
					: 'text-base-content/40'}"
			>
				<Home size={22} />
				<span class="text-xs">Dashboard</span>
			</a>
			<a
				href={resolve('/explains')}
				class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors {page.url.pathname.startsWith(
					'/explains'
				)
					? 'text-primary'
					: 'text-base-content/40'}"
			>
				<Sparkles size={22} />
				<span class="text-xs">Explains</span>
			</a>
			<a
				href={resolve('/stories')}
				class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors {page.url.pathname.startsWith(
					'/stories'
				)
					? 'text-primary'
					: 'text-base-content/40'}"
			>
				<Library size={22} />
				<span class="text-xs">Stories</span>
			</a>
			<a
				href={resolve('/practice')}
				class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors {page.url.pathname.startsWith(
					'/practice'
				)
					? 'text-primary'
					: 'text-base-content/40'}"
			>
				<BookOpen size={22} />
				<span class="text-xs">Practice</span>
			</a>
			<a
				href={resolve('/settings')}
				class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors {page.url.pathname.startsWith(
					'/settings'
				)
					? 'text-primary'
					: 'text-base-content/40'}"
			>
				<Settings size={22} />
				<span class="text-xs">Settings</span>
			</a>
		</div>
	</nav>
</div>
