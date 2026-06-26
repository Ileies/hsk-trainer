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
