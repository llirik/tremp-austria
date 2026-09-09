<script lang="ts">
	import { resolve } from '$app/paths';
	import '../app.css';
	import '@fontsource-variable/heebo';
	import { page } from '$app/state';
	import { Plus, UserRound, LayoutList, Heart, Route } from '@lucide/svelte';
	let { children, data } = $props();
</script>

<svelte:head>
	<title>טרמפ אוסטריה · בדרך ביחד</title>
	<meta
		name="description"
		content="הלוח הקהילתי לנסיעות בין וינה לשדה התעופה ברטיסלבה. מוצאים טרמפ, מציעים מקום או חולקים מונית. פשוט, ביחד."
	/>
	<meta name="theme-color" content="#164d41" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>
<a class="skip-link" href="#main">דילוג לתוכן</a>
<header class="site-header">
	<div class="header-inner">
		<a href={resolve('/')} class="brand" aria-label="טרמפ אוסטריה — לעמוד הבית"
			><span class="brand-mark"><Route size={23} strokeWidth={2.3} /></span><span
				>טרמפ<span class="brand-secondary">אוסטריה</span></span
			></a
		>
		<nav class="desktop-nav" aria-label="ניווט ראשי">
			<a class:active={page.url.pathname === '/'} href={resolve('/')}>לוח הנסיעות</a><a
				class:active={page.url.pathname === '/about'}
				href={resolve('/about')}>קצת עלינו</a
			>
		</nav>
		<div class="header-actions">
			<a class="account-link" href={resolve('/account')}
				><UserRound size={18} /><span>{data.user?.display_name || 'האזור שלי'}</span></a
			><a class="button button-primary header-create" href={resolve('/new')}
				><Plus size={18} /> פרסום נסיעה</a
			>
		</div>
	</div>
</header>
<main id="main">{@render children()}</main>
<footer class="site-footer">
	<div class="footer-inner">
		<p>מחברים אנשים, בדרך הביתה. <Heart size={13} /></p>
		<nav aria-label="קישורים נוספים">
			<a href={resolve('/about')}>על המיזם</a>
			<a href={resolve('/privacy')}>פרטיות</a>
			<a href={resolve('/terms')}>תנאי שימוש</a>
			<a href={resolve('/impressum')}>Impressum</a>
		</nav>
	</div>
</footer>
<nav class="mobile-nav" aria-label="ניווט נייד">
	<a class:active={page.url.pathname === '/'} href={resolve('/')}
		><LayoutList size={21} /><span>לוח הנסיעות</span></a
	><a class="mobile-create" href={resolve('/new')}
		><span><Plus size={23} /></span><span>פרסום נסיעה</span></a
	><a class:active={page.url.pathname.startsWith('/account')} href={resolve('/account')}
		><UserRound size={21} /><span>האזור שלי</span></a
	>
</nav>

<style>
	.footer-inner nav {
		flex-wrap: wrap;
	}
</style>
