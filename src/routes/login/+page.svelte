<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { ArrowRight, ArrowUpLeft, CheckCheck, LockKeyhole, Info } from '@lucide/svelte';
	let { data, form } = $props();
	let busy = $state(false);
	let googleAvailable = $derived(data.configured && data.googleEnabled);
	let hasProvider = $derived(data.configured && (data.googleEnabled || data.emailEnabled));
</script>

<svelte:head
	><title>נכנסים לקהילה · טרמפ אוסטריה</title><meta name="robots" content="noindex" /></svelte:head
>
<div class="auth-shell">
	<a class="back-link" href={resolve('/')}><ArrowRight size={17} />אפשר תמיד לעיין בלוח</a>
	<div class="surface">
		{#if form?.success}<span class="auth-icon"><CheckCheck size={27} /></span>
			<h1>נפגשים בתיבת הדואר.</h1>
			<p class="auth-description">
				אם ניתן לשלוח קישור לכתובת <bdi>{form.email}</bdi>, הוא בדרך אליכם. לחיצה עליו תחזיר אתכם
				לכאן, מחוברים.
			</p>
			<div class="notice info">
				כדאי לבדוק גם את תיקיית הספאם. הקישור אישי ומיועד לשימוש חד־פעמי.
			</div>
			<a class="button button-secondary button-wide" href={resolve('/')}>בינתיים, בחזרה ללוח</a
			>{:else}<span class="auth-icon"><LockKeyhole size={27} /></span>
			<h1>רגע קטן, ואתם בפנים.</h1>
			<p class="auth-description">
				נכנסים לחשבון כדי לפרסם נסיעה ולתאם עם הקהילה. בלי סיסמה, בלי סיבוכים.
			</p>
			{#if !hasProvider}<div class="notice info">
					<Info size={18} /><span
						>אנחנו משלימים את הגדרות הכניסה לקהילה. בינתיים אפשר לעיין בלוח הנסיעות.</span
					>
				</div>{/if}{#if form?.error || data.error}<div class="notice error" role="alert">
					{form?.error || data.error}
				</div>{/if}
			{#if googleAvailable}
				<form method="POST" action="?/google">
					<input type="hidden" name="next" value={data.next} />
					<button class="button button-secondary button-wide google-button" type="submit">
						<!-- Official gradient G: https://developers.google.com/identity/branding-guidelines -->
						<svg
							class="google-mark"
							width="20"
							height="20"
							viewBox="10 10 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
							focusable="false"
						>
							<mask
								id="mask0_google_signin"
								style="mask-type:alpha"
								maskUnits="userSpaceOnUse"
								x="10"
								y="10"
								width="20"
								height="20"
							>
								<path
									d="M29.3987 18.1814H19.9849V22.0445H25.3598C25.1286 23.294 24.4294 24.3596 23.3676 25.0712C22.4746 25.6716 21.3266 26.0211 19.9849 26.0211C17.3864 26.0211 15.1823 24.2666 14.3947 21.9004C14.1952 21.2989 14.0853 20.6599 14.0853 19.9983C14.0853 19.3367 14.1952 18.6966 14.3947 18.0962C15.1823 15.7311 17.3864 13.9755 19.9849 13.9755C21.4524 13.9755 22.767 14.4816 23.8039 15.4713L26.6653 12.6057C24.936 10.9908 22.6786 10 19.9849 10C16.0832 10 12.705 12.2414 11.0618 15.5076C10.383 16.8592 10 18.3834 10 19.9994C10 21.6155 10.383 23.1396 11.0618 24.4913C12.705 27.7597 16.0832 30 19.9849 30C22.6797 30 24.9485 29.1137 26.6018 27.5861C28.4887 25.8452 29.5732 23.2702 29.5732 20.2275C29.5732 19.5182 29.5131 18.835 29.3987 18.1825V18.1814Z"
									fill="#E94FFF"
								/>
							</mask>
							<g mask="url(#mask0_google_signin)">
								<g filter="url(#filter0_f_google_signin)">
									<g clip-path="url(#paint0_angular_google_signin_clip_path)"
										><g
											transform="matrix(0.00804129 -0.00805186 0.00804128 0.00805186 19.6819 19.7927)"
											><foreignObject x="-2105.64" y="-2105.64" width="4211.29" height="4211.29"
												><div
													xmlns="http://www.w3.org/1999/xhtml"
													style="background:conic-gradient(from 90deg,rgba(255, 70, 65, 1) 0deg,rgba(255, 70, 65, 1) 4.14555deg,rgba(49, 134, 255, 1) 39.154deg,rgba(49, 134, 255, 1) 72.0044deg,rgba(0, 165, 183, 1) 96.7463deg,rgba(14, 188, 95, 1) 120.897deg,rgba(14, 188, 95, 1) 154.722deg,rgba(108, 196, 0, 1) 179.136deg,rgba(255, 204, 0, 1) 203.588deg,rgba(255, 211, 20, 1) 226.915deg,rgba(255, 204, 0, 1) 251.688deg,rgba(255, 106, 43, 1) 273.129deg,rgba(253, 70, 65, 1) 289.305deg,rgba(255, 70, 65, 1) 359.593deg,rgba(255, 70, 65, 1) 360deg);height:100%;width:100%;opacity:1"
												></div></foreignObject
											></g
										></g
									>
								</g>
								<g filter="url(#filter1_f_google_signin)">
									<ellipse
										cx="20.0496"
										cy="20.2413"
										rx="5.39634"
										ry="2.83537"
										transform="rotate(24.4473 20.0496 20.2413)"
										fill="#3186FF"
									/>
								</g>
								<g filter="url(#filter2_f_google_signin)">
									<ellipse cx="33.3538" cy="18.2155" rx="7.43918" ry="3.09357" fill="#3186FF" />
								</g>
								<g filter="url(#filter3_f_google_signin)">
									<ellipse cx="25.2744" cy="16.2195" rx="7.40854" ry="2.37805" fill="#FF4641" />
								</g>
								<g filter="url(#filter4_f_google_signin)">
									<ellipse cx="29.5427" cy="12.9268" rx="7.40854" ry="2.37805" fill="#FF5B8B" />
								</g>
								<g filter="url(#filter5_f_google_signin)">
									<ellipse cx="24.4817" cy="19.878" rx="8.5061" ry="3.10976" fill="#3186FF" />
								</g>
								<g filter="url(#filter6_f_google_signin)">
									<ellipse
										cx="25.1842"
										cy="14.0197"
										rx="4.53882"
										ry="2.37805"
										transform="rotate(-28.6599 25.1842 14.0197)"
										fill="#FF4641"
									/>
								</g>
							</g>
							<defs>
								<filter
									id="filter0_f_google_signin"
									x="5.25922"
									y="4.90668"
									width="29.7381"
									height="29.772"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
								<clipPath id="paint0_angular_google_signin_clip_path"
									><path
										d="M7.25922 19.7927C7.25922 12.6759 13.0209 6.90668 20.1283 6.90668C27.2357 6.90668 32.9973 12.6759 32.9973 19.7927C32.9973 26.9094 27.2357 32.6786 20.1283 32.6786C13.0209 32.6786 7.25921 26.9094 7.25922 19.7927Z"
									/></clipPath
								><filter
									id="filter1_f_google_signin"
									x="12.9977"
									y="14.828"
									width="14.1038"
									height="10.8265"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
								<filter
									id="filter2_f_google_signin"
									x="23.9146"
									y="13.1219"
									width="18.8784"
									height="10.1871"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
								<filter
									id="filter3_f_google_signin"
									x="15.8659"
									y="11.8415"
									width="18.8171"
									height="8.7561"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
								<filter
									id="filter4_f_google_signin"
									x="20.1341"
									y="8.54878"
									width="18.8171"
									height="8.7561"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
								<filter
									id="filter5_f_google_signin"
									x="13.9756"
									y="14.7683"
									width="21.0122"
									height="10.2195"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
								<filter
									id="filter6_f_google_signin"
									x="19.0404"
									y="9.00419"
									width="12.2878"
									height="10.0309"
									filterUnits="userSpaceOnUse"
									color-interpolation-filters="sRGB"
								>
									<feFlood flood-opacity="0" result="BackgroundImageFix" />
									<feBlend
										mode="normal"
										in="SourceGraphic"
										in2="BackgroundImageFix"
										result="shape"
									/>
									<feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_google_signin" />
								</filter>
							</defs>
						</svg>
						<span>המשך עם <bdi>Google</bdi></span>
					</button>
				</form>
			{/if}
			{#if data.emailEnabled}
				{#if googleAvailable}<p class="auth-divider">או עם קישור לאימייל</p>{/if}
				<form
					method="POST"
					action="?/email"
					aria-busy={busy}
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							try {
								await update({ reset: false });
							} finally {
								busy = false;
							}
						};
					}}
				>
					<input type="hidden" name="next" value={data.next} /><label for="email"
						>כתובת האימייל שלכם</label
					><input
						id="email"
						name="email"
						type="email"
						value={form && 'values' in form
							? (form.values as Record<string, string> | undefined)?.email
							: ''}
						placeholder="you@example.com"
						autocomplete="email"
						required
						disabled={busy || !data.configured}
						dir="ltr"
						maxlength="254"
						style="margin-top:8px"
					/><button
						class={['button button-wide', googleAvailable ? 'button-secondary' : 'button-primary']}
						type="submit"
						disabled={busy || !data.configured}
						>{busy ? 'שולחים קישור…' : 'שלחו לי קישור כניסה'}<ArrowUpLeft size={18} /></button
					>
				</form>
			{/if}
			<p class="privacy-hint"><LockKeyhole size={15} />כתובת האימייל לא מוצגת בלוח הנסיעות.</p>{/if}
	</div>
	<p class="auth-footnote">
		בכניסה, אתם מסכימים להשתמש בלוח לצורך תיאום קהילתי.<br /><a
			class="text-link"
			href={resolve('/privacy')}>איך נשמרת הפרטיות שלכם</a
		>
	</p>
</div>

<style>
	.google-button {
		min-height: 50px;
		margin-top: 0;
		gap: 10px;
		padding-inline: 12px;
		border-color: #747775;
		color: #1f1f1f;
		background: #fff;
		font-weight: 500;
	}
	.google-button:hover {
		background: #fff;
		box-shadow: 0 1px 2px rgb(60 64 67 / 30%);
	}
	.google-mark {
		display: block;
		flex-shrink: 0;
	}
	.auth-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 24px 0;
		color: var(--muted);
		font-size: 12px;
	}
	.auth-divider::before,
	.auth-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}
</style>
