import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { explains, explainsUsers } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const rows = await db
		.select({ explains })
		.from(explains)
		.innerJoin(
			explainsUsers,
			and(eq(explainsUsers.explainId, explains.id), eq(explainsUsers.userId, userId))
		)
		.orderBy(desc(explains.createdAt));
	return { explains: rows.map((r) => r.explains) };
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		if (!id || isNaN(id)) return fail(400, { error: 'Invalid ID' });
		await db
			.delete(explainsUsers)
			.where(and(eq(explainsUsers.explainId, id), eq(explainsUsers.userId, userId)));
	}
};
