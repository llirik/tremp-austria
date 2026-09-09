<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, HeartHandshake } from '@lucide/svelte';
	import LegalLinks from '$lib/components/LegalLinks.svelte';
</script>

<svelte:head><title>פרטי המפעיל · Impressum · טרמפ אוסטריה</title></svelte:head>
<div class="narrow-shell prose">
	<a class="back-link" href={resolve('/')}><ArrowRight size={17} />בחזרה ללוח</a>
	<div class="surface">
		<span class="auth-icon"><HeartHandshake size={26} /></span>
		<h1>פרטי המפעיל · Impressum</h1>
		<p class="intro">לוח קהילתי חינמי, לא מסחרי, המופעל בהתנדבות.</p>
		<h2>מפעיל, בעל המדיה והאחראי למידע האישי</h2>
		<p>
			<bdi>Kirill Vodopianov</bdi><br />
			יישוב מגורים: <bdi>Reith bei Kitzbühel, Austria</bdi><br />
			לפניות משפטיות ולנושאי פרטיות:
			<a class="text-link" href="mailto:tremp.austra@gmail.com"><bdi>tremp.austra@gmail.com</bdi></a
			>
		</p>
		<h2>מטרת המיזם</h2>
		<p>
			Tremp Austria — טרמפ אוסטריה — הוא לוח מודעות לתיאום נסיעות בין חברי הקהילה הישראלית באוסטריה,
			בדגש על הדרך בין וינה לשדה התעופה ברטיסלבה. מטרת התוכן היא לעזור לאנשים למצוא מי נוסע באותו
			כיוון וליצור קשר באופן ישיר. השימוש חופשי וללא תשלום, ללא פרסום מסחרי וללא עמלות.
		</p>
		<h2>מה האתר עושה</h2>
		<p>
			האתר מציג מודעות, התאמות אפשריות ובקשות קשר. הוא אינו מספק תחבורה, מעסיק נהגים, משגר מוניות,
			מוכר נסיעות, קובע מחירי תחבורה או מעבד תשלומים עבור נסיעות. הוא אינו מקבל עמלות ואינו מתחייב
			לספק נסיעה. נהגים ונוסעים אינם עוברים בדיקת זהות או התאמה מטעם המיזם. כל תיאום נעשה ישירות בין
			המשתמשים.
		</p>
		<LegalLinks />
	</div>
</div>
