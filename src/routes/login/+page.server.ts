import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, authTokens } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateToken, TOKEN_DURATION_MS } from '$lib/server/auth';
import { sendMagicLink } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const data = await request.formData();
		const email = ((data.get('email') as string) ?? '').trim().toLowerCase();

		if (!email || !email.includes('@')) {
			return fail(400, { error: 'Please enter a valid email address.', email });
		}

		let [user] = await db.select().from(users).where(eq(users.email, email));
		if (!user) {
			[user] = await db.insert(users).values({ email }).returning();
		}

		const token = generateToken();
		const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS);
		await db.insert(authTokens).values({ userId: user.id, token, expiresAt });

		try {
			await sendMagicLink(email, token, url.origin);
		} catch (e) {
			console.error('Failed to send magic link email:', e);
			return fail(500, { error: 'Failed to send email. Please check SMTP configuration.', email });
		}

		return { sent: true, email };
	}
};
