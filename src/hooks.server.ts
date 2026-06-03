import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { SESSION_COOKIE } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/auth/'];

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(SESSION_COOKIE);

	if (sessionId) {
		const [row] = await db
			.select({ userId: sessions.userId, email: users.email })
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
			.limit(1);

		event.locals.user = row ? { id: row.userId, email: row.email } : null;
	} else {
		event.locals.user = null;
	}

	const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
	if (!event.locals.user && !isPublic) {
		redirect(303, '/login');
	}

	return resolve(event);
};
