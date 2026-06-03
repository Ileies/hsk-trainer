import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPracticeData, parseNullableInt, parsePositiveIds } from '$lib/server/practice';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const userId = locals.user.id;

	const hsk = parseNullableInt(url.searchParams.get('hsk'));
	const excludeIds = parsePositiveIds(url.searchParams.get('exclude'));
	const lastId = parseNullableInt(url.searchParams.get('last'));

	return json(await getPracticeData(userId, hsk, excludeIds, lastId));
};
