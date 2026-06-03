import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authTokens, sessions } from '$lib/server/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { generateToken, SESSION_COOKIE, SESSION_DURATION_MS } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	if (!token) error(400, 'Missing token');

	const [row] = await db
		.select()
		.from(authTokens)
		.where(
			and(eq(authTokens.token, token), eq(authTokens.used, false), gt(authTokens.expiresAt, new Date()))
		)
		.limit(1);

	if (!row) error(400, 'This sign-in link is invalid or has expired. Please request a new one.');

	await db.update(authTokens).set({ used: true }).where(eq(authTokens.id, row.id));

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
};
