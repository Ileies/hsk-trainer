import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { explains } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const rows = await db
		.select()
		.from(explains)
		.where(eq(explains.userId, userId))
		.orderBy(desc(explains.createdAt));
	return { explains: rows };
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const data = await request.formData();
		const id = parseInt(data.get('id') as string);
		if (!id || isNaN(id)) return fail(400, { error: 'Invalid ID' });
		await db
			.delete(explains)
			.where(and(eq(explains.id, id), eq(explains.userId, userId)));
	}
};
