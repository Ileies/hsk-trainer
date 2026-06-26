import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, authTokens, sessions } from '$lib/server/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import {
	generateToken,
	generatePin,
	TOKEN_DURATION_MS,
	SESSION_COOKIE,
	SESSION_DURATION_MS
} from '$lib/server/auth';
import { sendMagicLink } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	send: async ({ request, url }) => {
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
		const pin = generatePin();
		const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS);
		await db.insert(authTokens).values({ userId: user.id, token, pin, expiresAt });

		try {
			await sendMagicLink(email, token, pin, url.origin);
		} catch (e) {
			console.error('Failed to send magic link email:', e);
			return fail(500, { error: 'Failed to send email. Please check SMTP configuration.', email });
		}

		return { sent: true, email };
	},

	pin: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = ((data.get('email') as string) ?? '').trim().toLowerCase();
		const pin = ((data.get('pin') as string) ?? '').replace(/\s/g, '');

		if (!pin || !/^\d{6}$/.test(pin)) {
			return fail(400, {
				sent: true,
				email,
				pinError: 'Please enter the 6-digit PIN from your email.'
			});
		}

		const [row] = await db
			.select({ tokenId: authTokens.id, userId: authTokens.userId })
			.from(authTokens)
			.innerJoin(users, eq(users.id, authTokens.userId))
			.where(
				and(
					eq(users.email, email),
					eq(authTokens.pin, pin),
					eq(authTokens.used, false),
					gt(authTokens.expiresAt, new Date())
				)
			)
			.limit(1);

		if (!row) {
			return fail(400, {
				sent: true,
				email,
				pinError: 'Invalid or expired PIN. Please try again.'
			});
		}

		await db.update(authTokens).set({ used: true }).where(eq(authTokens.id, row.tokenId));

		const sessionId = generateToken();
		const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		await db.insert(sessions).values({ id: sessionId, userId: row.userId, expiresAt });

		cookies.set(SESSION_COOKIE, sessionId, {
			path: '/',
			httpOnly: true,
			secure: false,
			sameSite: 'lax',
			maxAge: SESSION_DURATION_MS / 1000
		});

		redirect(303, '/');
	}
};
